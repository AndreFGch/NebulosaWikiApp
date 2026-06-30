import { describe, expect, it } from "vitest";
import cytoscape from "cytoscape";
import { createGraphSimulation } from "./createGraphSimulation";
import type { Velocity, SimulationEdgeLink } from "./simulationTypes";

function makeNode(cy: cytoscape.Core, id: string, x: number, y: number): cytoscape.NodeSingular {
  cy.add({ group: "nodes", data: { id }, position: { x, y } });
  return cy.$id(id) as unknown as cytoscape.NodeSingular;
}

describe("createGraphSimulation — updateTopology", () => {
  it("limpia estado de nodos removidos y conserva estado de nodos existentes", () => {
    const cy = cytoscape({ headless: true });
    const nodeA = makeNode(cy, "A", 10, 20);
    const nodeB = makeNode(cy, "B", 30, 40);

    const velocities = new Map<string, Velocity>([
      ["A", { vx: 1, vy: 2 }],
      ["B", { vx: 3, vy: 4 }],
    ]);
    const alphaRef = { current: 0 };
    const rafRef: { current: number | null } = { current: 777 };

    const handle = createGraphSimulation({
      cy,
      nodeArr: [nodeA, nodeB],
      edgeLinks: [],
      velocities,
      alphaRef,
      rafRef,
    });

    const nodeC = makeNode(cy, "C", 50, 60);

    expect(() => handle.updateTopology({ nodeArr: [nodeB, nodeC], edgeLinks: [] })).not.toThrow();

    expect(velocities.has("A")).toBe(false);
    expect(velocities.has("B")).toBe(true);
    expect(nodeB.position()).toMatchObject({ x: 30, y: 40 });
    expect(nodeC.position()).toMatchObject({ x: 50, y: 60 });
    expect(rafRef.current).toBe(777);
  });

  it("acepta arista con key estable y retorna handle con API completa", () => {
    const cy = cytoscape({ headless: true });
    const nodeA = makeNode(cy, "A", 0, 0);
    const nodeB = makeNode(cy, "B", 100, 0);
    const nodeC = makeNode(cy, "C", 200, 0);

    const alphaRef = { current: 0 };
    const rafRef: { current: number | null } = { current: null };

    const handle = createGraphSimulation({
      cy,
      nodeArr: [nodeA, nodeB],
      edgeLinks: [],
      velocities: new Map(),
      alphaRef,
      rafRef,
    });

    const edgeLink: SimulationEdgeLink = { si: 0, ti: 1, key: "cy-edge-42" };

    expect(() =>
      handle.updateTopology({ nodeArr: [nodeA, nodeB, nodeC], edgeLinks: [edgeLink] }),
    ).not.toThrow();

    expect(typeof handle.start).toBe("function");
    expect(typeof handle.pause).toBe("function");
    expect(typeof handle.resume).toBe("function");
    expect(typeof handle.updateTopology).toBe("function");
  });
});
