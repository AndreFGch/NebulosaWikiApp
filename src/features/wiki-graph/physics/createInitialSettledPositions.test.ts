import { describe, expect, it } from "vitest";
import { createInitialSettledPositions } from "./createInitialSettledPositions";
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

describe("createInitialSettledPositions", () => {
  it("devuelve un Map vacio para un grafo vacio", () => {
    const result = createInitialSettledPositions([], [], null);

    expect(result.size).toBe(0);
  });

  it("produce el mismo resultado para la misma entrada", () => {
    const nodeIds = ["a", "b", "c"];
    const edgeLinks: PhysicsEdgeLink[] = [
      { si: 0, ti: 1 },
      { si: 1, ti: 2 },
    ];

    const first = createInitialSettledPositions(
      nodeIds,
      edgeLinks,
      "a",
    );

    const second = createInitialSettledPositions(
      nodeIds,
      edgeLinks,
      "a",
    );

    expect(Array.from(first.entries())).toEqual(
      Array.from(second.entries()),
    );
  });

  it("incluye todos los nodos con posiciones finitas cuando el root es valido", () => {
    const nodeIds = ["a", "b", "c"];
    const edgeLinks: PhysicsEdgeLink[] = [
      { si: 0, ti: 1 },
      { si: 1, ti: 2 },
    ];

    const result = createInitialSettledPositions(
      nodeIds,
      edgeLinks,
      "a",
    );

    expect(result.has("a")).toBe(true);
    expectFiniteComplete(result, nodeIds);
  });

  it("mantiene resultados completos y finitos para componentes desconectados", () => {
    const nodeIds = ["a", "b", "c", "d"];
    const edgeLinks: PhysicsEdgeLink[] = [
      { si: 0, ti: 1 },
      { si: 2, ti: 3 },
    ];

    const result = createInitialSettledPositions(
      nodeIds,
      edgeLinks,
      "a",
    );

    expectFiniteComplete(result, nodeIds);
  });

  it("tolera un root inexistente sin perder nodos ni generar coordenadas invalidas", () => {
    const nodeIds = ["a", "b"];
    const edgeLinks: PhysicsEdgeLink[] = [
      { si: 0, ti: 1 },
    ];

    const result = createInitialSettledPositions(
      nodeIds,
      edgeLinks,
      "missing-root",
    );

    expectFiniteComplete(result, nodeIds);
  });

  it("tolera nodos aislados sin generar coordenadas invalidas", () => {
    const nodeIds = ["x", "y", "z"];

    const result = createInitialSettledPositions(
      nodeIds,
      [],
      null,
    );

    expectFiniteComplete(result, nodeIds);
  });
});