import { describe, expect, it } from "vitest";
import cytoscape from "cytoscape";
import { asNodeId, asEdgeId } from "../../domain";
import type { GraphNodeId, GraphEdgeId } from "../../domain";
import type { GraphVisualNode, GraphVisualEdge } from "../../visual/graphVisualTypes";
import type { VisualGraphDelta } from "../../visual/createVisualGraphDelta";
import { applyVisualGraphDelta } from "./applyVisualGraphDelta";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type IncrementalDelta = Extract<VisualGraphDelta, { readonly kind: "incremental" }>;

function vNode(id: string, overrides?: Partial<GraphVisualNode>): GraphVisualNode {
  return {
    id: asNodeId(id),
    label: id,
    folder: "notes",
    relativePath: id,
    noteType: "note",
    nodeKind: "existing",
    exists: true,
    connections: 1,
    ...overrides,
  };
}

function vEdge(id: string, src: string, tgt: string): GraphVisualEdge {
  return {
    id: asEdgeId(id),
    source: asNodeId(src),
    target: asNodeId(tgt),
    edgeKind: "wikilink",
  };
}

function delta(overrides?: Partial<IncrementalDelta>): IncrementalDelta {
  return {
    kind: "incremental",
    addedNodes: [],
    updatedNodes: [],
    removedNodeIds: [],
    addedEdges: [],
    updatedEdges: [],
    removedEdgeIds: [],
    affectedNodeIds: [],
    nextRootNodeId: null,
    ...overrides,
  };
}

function makeCy(
  nodes: Array<{ id: string; x?: number; y?: number }>,
  edges: Array<{ id: string; source: string; target: string }>,
): cytoscape.Core {
  const cy = cytoscape({ headless: true });
  for (const n of nodes) {
    cy.add({ group: "nodes", data: { id: n.id }, position: { x: n.x ?? 0, y: n.y ?? 0 } });
  }
  for (const e of edges) {
    cy.add({ group: "edges", data: { id: e.id, source: e.source, target: e.target } });
  }
  return cy;
}

// ─── Test 1: delta misto — add/update/remove nodos y aristas + nw-root ───────

describe("applyVisualGraphDelta — test 1: delta mixto", () => {
  it("agrega, actualiza y elimina nodos/aristas correctamente y transfiere nw-root", () => {
    const cy = makeCy(
      [{ id: "A", x: 100, y: 100 }, { id: "B", x: 200, y: 200 }],
      [{ id: "e_ab", source: "A", target: "B" }],
    );
    cy.getElementById("A").addClass("nw-root");

    const result = applyVisualGraphDelta(
      cy,
      delta({
        addedNodes: [vNode("C")],
        updatedNodes: [vNode("A", { connections: 5 })],
        removedNodeIds: [asNodeId("B")] as GraphNodeId[],
        addedEdges: [vEdge("e_ac", "A", "C")],
        removedEdgeIds: [asEdgeId("e_ab")] as GraphEdgeId[],
        nextRootNodeId: asNodeId("C"),
      }),
      asNodeId("A"),
    );

    // Return value = delta.nextRootNodeId
    expect(result).toBe(asNodeId("C"));

    // B removido
    expect(cy.getElementById("B").empty()).toBe(true);
    // e_ab removida
    expect(cy.getElementById("e_ab").empty()).toBe(true);
    // C agregado
    expect(cy.getElementById("C").empty()).toBe(false);
    // e_ac agregada
    expect(cy.getElementById("e_ac").empty()).toBe(false);
    // A actualizado
    expect(cy.getElementById("A").data("connections")).toBe(5);
    // nw-root transferido
    expect(cy.getElementById("A").hasClass("nw-root")).toBe(false);
    expect(cy.getElementById("C").hasClass("nw-root")).toBe(true);
  });
});

// ─── Test 2: nodo existente conserva su posición exacta ──────────────────────

describe("applyVisualGraphDelta — test 2: posición de nodo existente intacta", () => {
  it("updatedNodes no modifica la posición del nodo en cy", () => {
    const cy = makeCy([{ id: "A", x: 123, y: 456 }], []);

    applyVisualGraphDelta(
      cy,
      delta({ updatedNodes: [vNode("A", { connections: 3 })] }),
      null,
    );

    const pos = cy.getElementById("A").position();
    expect(pos.x).toBe(123);
    expect(pos.y).toBe(456);
    // Data sí actualizó
    expect(cy.getElementById("A").data("connections")).toBe(3);
  });
});

// ─── Test 3: nodo nuevo recibe posición distinta del origen con vecino ────────

describe("applyVisualGraphDelta — test 3: posición inicial de nodo nuevo", () => {
  it("nodo nuevo con vecino existente no cae en {0,0}", () => {
    const cy = makeCy([{ id: "A", x: 300, y: 300 }], []);

    applyVisualGraphDelta(
      cy,
      delta({
        addedNodes: [vNode("C")],
        addedEdges: [vEdge("e_ac", "A", "C")],
      }),
      null,
    );

    const pos = cy.getElementById("C").position();
    expect(pos.x).not.toBe(0);
    expect(pos.y).not.toBe(0);
    // Distancia al vecino A debe ser > 0
    const dist = Math.hypot(pos.x - 300, pos.y - 300);
    expect(dist).toBeGreaterThan(0);
  });

  it("nodo nuevo sin vecino cae cerca del centro del grafo, no en {0,0}", () => {
    // cy con nodo A en posición no-origin para que el centro no sea {0,0}
    const cy = makeCy([{ id: "A", x: 500, y: 500 }], []);

    applyVisualGraphDelta(
      cy,
      delta({ addedNodes: [vNode("C")] }),
      null,
    );

    const pos = cy.getElementById("C").position();
    // El centro del extent de cy.extent() estará alrededor de (500,500),
    // así que la posición no debe ser exactamente {0,0}
    const distFromOrigin = Math.hypot(pos.x, pos.y);
    expect(distFromOrigin).toBeGreaterThan(0);
  });
});

// ─── Test 4: zoom y pan no cambian ───────────────────────────────────────────

describe("applyVisualGraphDelta — test 4: viewport intacto", () => {
  it("zoom y pan no se modifican durante el delta", () => {
    const cy = makeCy([{ id: "A", x: 0, y: 0 }], []);
    cy.zoom(1.5);
    cy.pan({ x: 30, y: 40 });

    applyVisualGraphDelta(
      cy,
      delta({ updatedNodes: [vNode("A")] }),
      null,
    );

    expect(cy.zoom()).toBeCloseTo(1.5);
    expect(cy.pan().x).toBeCloseTo(30);
    expect(cy.pan().y).toBeCloseTo(40);
  });
});

// ─── Test 5: IDs inexistentes no lanzan ──────────────────────────────────────

describe("applyVisualGraphDelta — test 5: IDs ausentes son no-op", () => {
  it("removedNodeIds con ID inexistente no lanza error", () => {
    const cy = makeCy([], []);
    expect(() =>
      applyVisualGraphDelta(
        cy,
        delta({
          removedNodeIds: [asNodeId("phantom-node")] as GraphNodeId[],
          removedEdgeIds: [asEdgeId("phantom-edge")] as GraphEdgeId[],
        }),
        null,
      ),
    ).not.toThrow();
  });

  it("updatedNodes con ID inexistente no lanza error", () => {
    const cy = makeCy([], []);
    expect(() =>
      applyVisualGraphDelta(
        cy,
        delta({ updatedNodes: [vNode("ghost")] }),
        null,
      ),
    ).not.toThrow();
  });
});

// ─── Test 6: campo cy usa nodeType, no nodeKind ───────────────────────────────

describe("applyVisualGraphDelta — test 6: campo cy es nodeType", () => {
  it("nodo agregado almacena nodeType en cy data, no nodeKind", () => {
    const cy = makeCy([], []);

    applyVisualGraphDelta(
      cy,
      delta({ addedNodes: [vNode("X", { nodeKind: "orphan" })] }),
      null,
    );

    const n = cy.getElementById("X");
    expect(n.empty()).toBe(false);
    expect(n.data("nodeType")).toBe("orphan");
    expect(n.data("nodeKind")).toBeUndefined();
  });

  it("nodo actualizado escribe nodeType, no nodeKind", () => {
    const cy = makeCy([{ id: "X" }], []);
    cy.getElementById("X").data("nodeType", "existing");

    applyVisualGraphDelta(
      cy,
      delta({ updatedNodes: [vNode("X", { nodeKind: "missing" })] }),
      null,
    );

    expect(cy.getElementById("X").data("nodeType")).toBe("missing");
    expect(cy.getElementById("X").data("nodeKind")).toBeUndefined();
  });
});

// ─── Test 7: nodo nuevo en cy vacío tiene posición finita y no-origin ─────────

describe("applyVisualGraphDelta — test 7: posición finita en cy vacío", () => {
  it("nodo nuevo en grafo vacío tiene posición finita y distinta de {0,0}", () => {
    const cy = makeCy([], []);

    applyVisualGraphDelta(
      cy,
      delta({ addedNodes: [vNode("Z")] }),
      null,
    );

    const pos = cy.getElementById("Z").position();
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
    expect(pos.x === 0 && pos.y === 0).toBe(false);
  });
});

// ─── Test 8: cy.batch invocado exactamente una vez ────────────────────────────

describe("applyVisualGraphDelta — test 8: cy.batch exactamente una vez", () => {
  it("cy.batch se llama exactamente una vez por invocación", () => {
    const cy = makeCy([{ id: "A" }], []);
    let callCount = 0;
    const originalBatch = cy.batch.bind(cy);
    // ponytail: manual wrap — avoids TypeScript overload ambiguity with vi.spyOn
    (cy as unknown as { batch: (fn: () => void) => cytoscape.Core }).batch = (fn) => {
      callCount++;
      originalBatch(fn);
      return cy;
    };

    applyVisualGraphDelta(cy, delta(), null);
    expect(callCount).toBe(1);
  });
});
