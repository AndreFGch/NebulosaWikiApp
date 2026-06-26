import { describe, expect, it } from "vitest";
import { createInitialSettledPositions } from "./createInitialSettledPositions";
import { createRebuildSettledPositions } from "./createRebuildSettledPositions";
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

describe("createRebuildSettledPositions", () => {
  it("devuelve un Map vacio para un grafo vacio", () => {
    const result = createRebuildSettledPositions([], [], null, new Map());

    expect(result.size).toBe(0);
  });

  it("preserva exactamente las posiciones guardadas cuando todos los nodos son anclas", () => {
    const nodeIds = ["a", "b", "c"];
    const edgeLinks: PhysicsEdgeLink[] = [
      { si: 0, ti: 1 },
      { si: 1, ti: 2 },
    ];

    const savedPositions = new Map<string, PhysicsPoint>([
      ["a", { x: 120, y: -80 }],
      ["b", { x: -45, y: 65 }],
      ["c", { x: 20, y: 140 }],
    ]);

    const result = createRebuildSettledPositions(
      nodeIds,
      edgeLinks,
      "a",
      savedPositions,
    );

    expect(Array.from(result.entries())).toEqual(
      Array.from(savedPositions.entries()),
    );
  });

  it("mantiene las anclas y posiciona de forma finita un nodo nuevo conectado", () => {
    const nodeIds = ["a", "b", "c"];
    const edgeLinks: PhysicsEdgeLink[] = [
      { si: 0, ti: 1 },
      { si: 1, ti: 2 },
    ];

    const savedPositions = new Map<string, PhysicsPoint>([
      ["a", { x: 100, y: -40 }],
      ["b", { x: -80, y: 55 }],
    ]);

    const result = createRebuildSettledPositions(
      nodeIds,
      edgeLinks,
      "a",
      savedPositions,
    );

    expect(result.get("a")).toEqual({ x: 100, y: -40 });
    expect(result.get("b")).toEqual({ x: -80, y: 55 });
    expectFiniteComplete(result, nodeIds);
  });

  it("mantiene el ancla y posiciona de forma finita un nodo huerfano nuevo", () => {
    const nodeIds = ["anchor", "orphan"];

    const savedPositions = new Map<string, PhysicsPoint>([
      ["anchor", { x: 40, y: -20 }],
    ]);

    const result = createRebuildSettledPositions(
      nodeIds,
      [],
      "anchor",
      savedPositions,
    );

    expect(result.get("anchor")).toEqual({ x: 40, y: -20 });
    expectFiniteComplete(result, nodeIds);
  });

  it("sin posiciones guardadas delega al settle inicial", () => {
    const nodeIds = ["a", "b", "c"];
    const edgeLinks: PhysicsEdgeLink[] = [
      { si: 0, ti: 1 },
      { si: 1, ti: 2 },
    ];

    const expected = createInitialSettledPositions(
      nodeIds,
      edgeLinks,
      "a",
    );

    const result = createRebuildSettledPositions(
      nodeIds,
      edgeLinks,
      "a",
      new Map(),
    );

    expect(Array.from(result.entries())).toEqual(
      Array.from(expected.entries()),
    );
  });

  it("ignora posiciones guardadas invalidas sin perder las anclas validas", () => {
    const nodeIds = ["a", "b"];
    const edgeLinks: PhysicsEdgeLink[] = [
      { si: 0, ti: 1 },
    ];

    const validAnchor = { x: 90, y: -35 };

    const expected = createRebuildSettledPositions(
      nodeIds,
      edgeLinks,
      "a",
      new Map<string, PhysicsPoint>([
        ["a", validAnchor],
      ]),
    );

    const result = createRebuildSettledPositions(
      nodeIds,
      edgeLinks,
      "a",
      new Map<string, PhysicsPoint>([
        ["a", validAnchor],
        ["b", { x: Number.NaN, y: Number.POSITIVE_INFINITY }],
      ]),
    );

    expect(Array.from(result.entries())).toEqual(
      Array.from(expected.entries()),
    );
    expect(result.get("a")).toEqual(validAnchor);
    expectFiniteComplete(result, nodeIds);
  });
});
