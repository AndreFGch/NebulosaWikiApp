import { describe, expect, it } from "vitest";
import { createInitialSeedPositions } from "./createInitialSeedPositions";
import type { PhysicsEdgeLink } from "./physicalGraphTypes";

function allFinite(result: Map<string, { x: number; y: number }>): boolean {
  for (const { x, y } of result.values()) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  }
  return true;
}

function allPresent(result: Map<string, unknown>, ids: readonly string[]): boolean {
  return ids.every((id) => result.has(id));
}

describe("createInitialSeedPositions", () => {
  it("grafo vacío devuelve Map vacío", () => {
    const result = createInitialSeedPositions([], [], null);
    expect(result.size).toBe(0);
  });

  it("determinismo — misma entrada produce mismo resultado en dos llamadas", () => {
    const nodeIds = ["b", "a", "c"];
    const edgeLinks: PhysicsEdgeLink[] = [
      { si: 0, ti: 1 },
      { si: 1, ti: 2 },
    ];
    const r1 = createInitialSeedPositions(nodeIds, edgeLinks, "a");
    const r2 = createInitialSeedPositions(nodeIds, edgeLinks, "a");
    expect(Array.from(r1.entries())).toEqual(Array.from(r2.entries()));
  });

  it("root válido queda en el origen { x: 0, y: 0 }", () => {
    const nodeIds = ["a", "b", "c"];
    const edgeLinks: PhysicsEdgeLink[] = [
      { si: 0, ti: 1 },
      { si: 1, ti: 2 },
    ];
    const result = createInitialSeedPositions(nodeIds, edgeLinks, "a");
    expect(result.get("a")).toEqual({ x: 0, y: 0 });
  });

  it("completitud — todos los IDs presentes con coordenadas finitas", () => {
    const nodeIds = ["a", "b", "c"];
    const edgeLinks: PhysicsEdgeLink[] = [
      { si: 0, ti: 1 },
      { si: 1, ti: 2 },
    ];
    const result = createInitialSeedPositions(nodeIds, edgeLinks, "a");
    expect(result.size).toBe(nodeIds.length);
    expect(allPresent(result, nodeIds)).toBe(true);
    expect(allFinite(result)).toBe(true);
  });

  it("componentes desconectados — todos los nodos presentes con coordenadas finitas", () => {
    const nodeIds = ["a", "b", "c", "d"];
    // a-b en un componente, c-d en otro
    const edgeLinks: PhysicsEdgeLink[] = [
      { si: 0, ti: 1 },
      { si: 2, ti: 3 },
    ];
    const result = createInitialSeedPositions(nodeIds, edgeLinks, "a");
    expect(result.size).toBe(4);
    expect(allPresent(result, nodeIds)).toBe(true);
    expect(allFinite(result)).toBe(true);
  });

  it("nodos sin aristas — presentes con coordenadas finitas", () => {
    const nodeIds = ["x", "y", "z"];
    const result = createInitialSeedPositions(nodeIds, [], null);
    expect(result.size).toBe(3);
    expect(allPresent(result, nodeIds)).toBe(true);
    expect(allFinite(result)).toBe(true);
  });

  it("self-edge y arista fuera de rango no alteran el resultado", () => {
    const nodeIds = ["a", "b"];

    const validEdgeLinks: PhysicsEdgeLink[] = [
      { si: 0, ti: 1 },
    ];

    const edgeLinksWithInvalidEntries: PhysicsEdgeLink[] = [
      { si: 0, ti: 0 },
      { si: 0, ti: 99 },
      { si: 0, ti: 1 },
    ];

    const expected = createInitialSeedPositions(
      nodeIds,
      validEdgeLinks,
      "a",
    );

    const result = createInitialSeedPositions(
      nodeIds,
      edgeLinksWithInvalidEntries,
      "a",
    );

    expect(Array.from(result.entries())).toEqual(
      Array.from(expected.entries()),
    );
    expect(allPresent(result, nodeIds)).toBe(true);
    expect(allFinite(result)).toBe(true);
  });
});
