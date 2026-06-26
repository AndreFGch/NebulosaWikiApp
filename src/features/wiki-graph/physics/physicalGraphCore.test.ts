import { describe, expect, it } from "vitest";
import {
  createPhysicalGraphState,
  settlePhysicalGraph,
  snapshotPhysicalPositions,
  stepPhysicalGraph,
} from "./physicalGraphCore";
import type { PhysicsEdgeLink, PhysicsPoint } from "./physicalGraphTypes";

function expectFiniteComplete(
  result: ReadonlyMap<string, PhysicsPoint>,
  nodeIds: readonly string[],
): void {
  expect(result.size).toBe(nodeIds.length);

  for (const nodeId of nodeIds) {
    const point = result.get(nodeId);

    expect(point).toBeDefined();
    expect(Number.isFinite(point?.x)).toBe(true);
    expect(Number.isFinite(point?.y)).toBe(true);
  }
}

describe("physicalGraphCore", () => {
  it("crea un estado vacio y un snapshot vacio", () => {
    const state = createPhysicalGraphState([], new Map());

    expect(state.nodeIds).toEqual([]);
    expect(state.positions.length).toBe(0);
    expect(state.velocities.length).toBe(0);
    expect(state.stepCount).toBe(0);
    expect(snapshotPhysicalPositions(state).size).toBe(0);
  });

  it("copia las posiciones seed sin conservar referencias mutables externas", () => {
    const seedPositions = new Map<string, PhysicsPoint>([
      ["a", { x: 10, y: -5 }],
      ["b", { x: -20, y: 40 }],
    ]);

    const state = createPhysicalGraphState(["a", "b"], seedPositions);

    seedPositions.set("a", { x: 999, y: 999 });

    expect(Array.from(snapshotPhysicalPositions(state).entries())).toEqual([
      ["a", { x: 10, y: -5 }],
      ["b", { x: -20, y: 40 }],
    ]);
  });

  it("evoluciona de forma determinista ante la misma entrada", () => {
    const nodeIds = ["a", "b", "c"];
    const seedPositions = new Map<string, PhysicsPoint>([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 90, y: 0 }],
      ["c", { x: 180, y: 0 }],
    ]);
    const edgeLinks: PhysicsEdgeLink[] = [
      { si: 0, ti: 1 },
      { si: 1, ti: 2 },
    ];
    const first = createPhysicalGraphState(nodeIds, seedPositions);
    const second = createPhysicalGraphState(nodeIds, seedPositions);
    const options = { edgeLinks, rootIndex: 0 };

    stepPhysicalGraph(first, options);
    stepPhysicalGraph(second, options);

    expect(Array.from(snapshotPhysicalPositions(first).entries())).toEqual(
      Array.from(snapshotPhysicalPositions(second).entries()),
    );
    expect(Array.from(first.velocities)).toEqual(
      Array.from(second.velocities),
    );
    expect(first.alpha).toBe(second.alpha);
    expect(first.stepCount).toBe(second.stepCount);
  });

  it("no desplaza nodos fijos durante el settle", () => {
    const nodeIds = ["a", "b", "c"];
    const state = createPhysicalGraphState(
      nodeIds,
      new Map<string, PhysicsPoint>([
        ["a", { x: 100, y: -50 }],
        ["b", { x: -70, y: 40 }],
        ["c", { x: 15, y: 110 }],
      ]),
    );
    const before = snapshotPhysicalPositions(state);

    settlePhysicalGraph(
      state,
      {
        edgeLinks: [
          { si: 0, ti: 1 },
          { si: 1, ti: 2 },
        ],
        rootIndex: 0,
        fixedNodeIndices: new Set([0, 1]),
      },
      80,
      0.06,
    );

    const after = snapshotPhysicalPositions(state);
    expect(after.get("a")).toEqual(before.get("a"));
    expect(after.get("b")).toEqual(before.get("b"));
    expectFiniteComplete(after, nodeIds);
  });

  it("tolera aristas invalidas y nodos inicialmente solapados", () => {
    const nodeIds = ["a", "b", "c"];
    const state = createPhysicalGraphState(
      nodeIds,
      new Map<string, PhysicsPoint>([
        ["a", { x: 0, y: 0 }],
        ["b", { x: 0, y: 0 }],
        ["c", { x: 0, y: 0 }],
      ]),
    );

    expect(() => {
      settlePhysicalGraph(
        state,
        {
          edgeLinks: [
            { si: 0, ti: 0 },
            { si: 0, ti: 99 },
            { si: -1, ti: 1 },
            { si: 0, ti: 1 },
          ],
          rootIndex: null,
        },
        80,
        0.06,
      );
    }).not.toThrow();

    expectFiniteComplete(snapshotPhysicalPositions(state), nodeIds);
  });

  it("acepta root null sin perder posiciones validas", () => {
    const nodeIds = ["a", "b"];
    const state = createPhysicalGraphState(
      nodeIds,
      new Map<string, PhysicsPoint>([
        ["a", { x: -30, y: 0 }],
        ["b", { x: 30, y: 0 }],
      ]),
    );

    stepPhysicalGraph(
      state,
      {
        edgeLinks: [{ si: 0, ti: 1 }],
        rootIndex: null,
      },
    );

    expectFiniteComplete(snapshotPhysicalPositions(state), nodeIds);
  });

  it("entrega snapshots independientes del estado interno", () => {
    const state = createPhysicalGraphState(
      ["a"],
      new Map<string, PhysicsPoint>([
        ["a", { x: 8, y: -3 }],
      ]),
    );

    const snapshot = snapshotPhysicalPositions(state);
    snapshot.set("a", { x: 700, y: 700 });

    expect(snapshotPhysicalPositions(state).get("a")).toEqual({ x: 8, y: -3 });
  });
});
