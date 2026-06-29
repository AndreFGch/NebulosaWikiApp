import { describe, expect, it } from "vitest";
import { WikiGraphStore, asNodeId, asEdgeId } from "../domain";
import type { LogicalNode, LogicalEdge, GraphNodeId, GraphEdgeId } from "../domain";
import type { WikiNode, WikiEdge } from "../types";
import type { WikiGraphDelta } from "../indexing";
import type { GraphProjectionDelta } from "../projection";
import { createGraphProjection, createGraphProjectionDelta } from "../projection";
import { createVisualGraph } from "./createVisualGraph";
import { createVisualGraphDelta } from "./createVisualGraphDelta";
import type { VisualGraphDelta, ConnectionCountResolver } from "./createVisualGraphDelta";
import type { GraphVisualNode, GraphVisualEdge, GraphVisualSnapshot } from "./graphVisualTypes";

// ─── Test helpers ─────────────────────────────────────────────────────────────

function logNode(
  id: string,
  folder: string,
  type: string,
  exists = true,
): LogicalNode {
  return {
    id: asNodeId(id),
    title: id,
    relativePath: id,
    folder,
    tags: [],
    type,
    exists,
  };
}

function logEdge(src: string, tgt: string, id: string, broken = false): LogicalEdge {
  return {
    id: asEdgeId(id),
    source: asNodeId(src),
    target: asNodeId(tgt),
    label: "",
    type: broken ? "broken" : "wikilink",
    weight: 1,
    resolution: broken ? "broken" : "resolved",
  };
}

function wNode(id: string, folder: string, type: string, exists = true): WikiNode {
  return { id, title: id, relativePath: id, folder, tags: [], type,
    outgoingCount: 0, backlinkCount: 0, isOrphan: false, exists };
}

function wEdge(id: string, src: string, tgt: string, broken = false): WikiEdge {
  return { id, source: src, target: tgt, label: "", type: broken ? "broken" : "wikilink",
    weight: 1, isBacklink: false, isBroken: broken };
}

function emptyWikiDelta(): WikiGraphDelta {
  return { addedNodes: [], updatedNodes: [], removedNodeIds: [],
    addedEdges: [], updatedEdges: [], removedEdgeIds: [],
    topologyChanged: false, affectedNodeIds: [] };
}

type IncrementalGraphProjectionDelta = Extract<
  GraphProjectionDelta,
  { readonly kind: "incremental" }
>;

function emptyIncrementalDelta(): IncrementalGraphProjectionDelta {
  return {
    kind: "incremental",
    addedNodes: [],
    updatedNodes: [],
    removedNodeIds: [],
    addedEdges: [],
    updatedEdges: [],
    removedEdgeIds: [],
    affectedNodeIds: [],
  };
}

function emptySnapshot(): GraphVisualSnapshot {
  return { rootNodeId: null, nodes: [], edges: [] };
}

function makeResolver(
  entries: ReadonlyArray<readonly [GraphNodeId, number]>,
): ConnectionCountResolver {
  const map = new Map(entries);
  return (id) => map.get(id) ?? 0;
}

function storeResolver(store: WikiGraphStore): ConnectionCountResolver {
  return (id) =>
    store.getOutgoingEdges(id).length + store.getIncomingEdges(id).length;
}

// Applies a VisualGraphDelta onto a base GraphVisualSnapshot.
function applyVisualDelta(
  base: GraphVisualSnapshot,
  delta: VisualGraphDelta,
): GraphVisualSnapshot {
  if (delta.kind !== "incremental") {
    throw new Error(`applyVisualDelta: expected incremental, got ${delta.kind}`);
  }
  const nodeMap = new Map<GraphNodeId, GraphVisualNode>(base.nodes.map((n) => [n.id, n]));
  for (const n of delta.addedNodes) nodeMap.set(n.id, n);
  for (const n of delta.updatedNodes) nodeMap.set(n.id, n);
  for (const id of delta.removedNodeIds) nodeMap.delete(id);

  const edgeMap = new Map<GraphEdgeId, GraphVisualEdge>(base.edges.map((e) => [e.id, e]));
  for (const e of delta.addedEdges) edgeMap.set(e.id, e);
  for (const e of delta.updatedEdges) edgeMap.set(e.id, e);
  for (const id of delta.removedEdgeIds) edgeMap.delete(id);

  return {
    rootNodeId: delta.nextRootNodeId,
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}

function sortById<T extends { id: string }>(arr: ReadonlyArray<T>): T[] {
  return [...arr].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// ─── 1. Added node converts identically to createVisualGraph ─────────────────

describe("createVisualGraphDelta — test 1: nodo añadido se convierte igual", () => {
  it("added node visual fields match toVisualNode output", () => {
    const A = logNode("notes/A", "notes", "note");
    const delta: GraphProjectionDelta = {
      ...emptyIncrementalDelta(),
      addedNodes: [A],
      affectedNodeIds: [A.id],
    };
    const resolver = makeResolver([[A.id, 0]]);
    const result = createVisualGraphDelta(emptySnapshot(), delta, resolver);
    expect(result.kind).toBe("incremental");
    if (result.kind !== "incremental") return;

    expect(result.addedNodes).toHaveLength(1);
    const vn = result.addedNodes[0];
    expect(vn.id).toBe(asNodeId("notes/A"));
    expect(vn.label).toBe("notes/A");
    expect(vn.folder).toBe("notes");
    expect(vn.relativePath).toBe("notes/A");
    expect(vn.noteType).toBe("note");
    expect(vn.exists).toBe(true);
    expect(vn.connections).toBe(0);
    expect(vn.nodeKind).toBe("orphan");
  });

  it("added node with connections gets nodeKind=existing", () => {
    const A = logNode("notes/A", "notes", "note");
    const delta: GraphProjectionDelta = {
      ...emptyIncrementalDelta(),
      addedNodes: [A],
      affectedNodeIds: [A.id],
    };
    const resolver = makeResolver([[A.id, 3]]);
    const result = createVisualGraphDelta(emptySnapshot(), delta, resolver);
    expect(result.kind).toBe("incremental");
    if (result.kind !== "incremental") return;
    expect(result.addedNodes[0].connections).toBe(3);
    expect(result.addedNodes[0].nodeKind).toBe("existing");
  });

  it("added missing node gets nodeKind=missing", () => {
    const M = logNode("notes/M", "notes", "note", false);
    const delta: GraphProjectionDelta = {
      ...emptyIncrementalDelta(),
      addedNodes: [M],
      affectedNodeIds: [M.id],
    };
    const result = createVisualGraphDelta(emptySnapshot(), delta, makeResolver([]));
    expect(result.kind).toBe("incremental");
    if (result.kind !== "incremental") return;
    expect(result.addedNodes[0].nodeKind).toBe("missing");
  });
});

// ─── 2. Updated node preserves full visual parity ────────────────────────────

describe("createVisualGraphDelta — test 2: nodo actualizado conserva paridad visual", () => {
  it("updated node title propagates to label, connections from resolver", () => {
    const A = logNode("notes/A", "notes", "note");
    const baseVisual: GraphVisualSnapshot = {
      rootNodeId: null,
      nodes: [{ id: asNodeId("notes/A"), label: "notes/A", folder: "notes",
        relativePath: "notes/A", noteType: "note", nodeKind: "existing",
        exists: true, connections: 2 }],
      edges: [],
    };

    const AUpdated: LogicalNode = { ...A, title: "Nuevo Título" };
    const delta: GraphProjectionDelta = {
      ...emptyIncrementalDelta(),
      updatedNodes: [AUpdated],
      affectedNodeIds: [A.id],
    };
    // Resolver returns 2 — same as before (no edge change, just title update)
    const resolver = makeResolver([[A.id, 2]]);
    const result = createVisualGraphDelta(baseVisual, delta, resolver);
    expect(result.kind).toBe("incremental");
    if (result.kind !== "incremental") return;

    expect(result.updatedNodes).toHaveLength(1);
    const vn = result.updatedNodes[0];
    expect(vn.label).toBe("Nuevo Título");
    expect(vn.connections).toBe(2);
    expect(vn.nodeKind).toBe("existing");
    expect(vn.folder).toBe("notes");
    expect(vn.relativePath).toBe("notes/A");
    expect(vn.noteType).toBe("note");
    expect(vn.exists).toBe(true);
  });

  it("updated node losing all connections transitions to orphan", () => {
    const A = logNode("notes/A", "notes", "note");
    const baseVisual: GraphVisualSnapshot = {
      rootNodeId: null,
      nodes: [{ id: A.id, label: "notes/A", folder: "notes",
        relativePath: "notes/A", noteType: "note", nodeKind: "existing",
        exists: true, connections: 1 }],
      edges: [],
    };
    const delta: GraphProjectionDelta = {
      ...emptyIncrementalDelta(),
      updatedNodes: [A],
      affectedNodeIds: [A.id],
    };
    const result = createVisualGraphDelta(baseVisual, delta, makeResolver([[A.id, 0]]));
    expect(result.kind).toBe("incremental");
    if (result.kind !== "incremental") return;
    expect(result.updatedNodes[0].nodeKind).toBe("orphan");
    expect(result.updatedNodes[0].connections).toBe(0);
  });
});

// ─── 3. Added edge converts identically ──────────────────────────────────────

describe("createVisualGraphDelta — test 3: arista añadida se convierte igual", () => {
  it("resolved edge gets edgeKind=wikilink", () => {
    const e1 = logEdge("notes/A", "notes/B", "e1");
    const delta: GraphProjectionDelta = {
      ...emptyIncrementalDelta(),
      addedEdges: [e1],
      affectedNodeIds: [asNodeId("notes/A"), asNodeId("notes/B")],
    };
    const result = createVisualGraphDelta(emptySnapshot(), delta, makeResolver([]));
    expect(result.kind).toBe("incremental");
    if (result.kind !== "incremental") return;
    expect(result.addedEdges).toHaveLength(1);
    const ve = result.addedEdges[0];
    expect(ve.id).toBe(asEdgeId("e1"));
    expect(ve.source).toBe(asNodeId("notes/A"));
    expect(ve.target).toBe(asNodeId("notes/B"));
    expect(ve.edgeKind).toBe("wikilink");
  });

  it("broken edge gets edgeKind=broken", () => {
    const eBroken = logEdge("notes/A", "notes/Missing", "eBroken", true);
    const delta: GraphProjectionDelta = {
      ...emptyIncrementalDelta(),
      addedEdges: [eBroken],
      affectedNodeIds: [asNodeId("notes/A"), asNodeId("notes/Missing")],
    };
    const result = createVisualGraphDelta(emptySnapshot(), delta, makeResolver([]));
    expect(result.kind).toBe("incremental");
    if (result.kind !== "incremental") return;
    expect(result.addedEdges[0].edgeKind).toBe("broken");
  });
});

// ─── 4. Removed IDs pass through unchanged ───────────────────────────────────

describe("createVisualGraphDelta — test 4: removidos pasan por ID", () => {
  it("removedNodeIds and removedEdgeIds are forwarded verbatim", () => {
    const baseVisual: GraphVisualSnapshot = {
      rootNodeId: null,
      nodes: [{ id: asNodeId("notes/A"), label: "notes/A", folder: "notes",
        relativePath: "notes/A", noteType: "note", nodeKind: "existing",
        exists: true, connections: 1 }],
      edges: [{ id: asEdgeId("e1"), source: asNodeId("notes/A"),
        target: asNodeId("notes/B"), edgeKind: "wikilink" }],
    };

    const delta: GraphProjectionDelta = {
      ...emptyIncrementalDelta(),
      removedNodeIds: [asNodeId("notes/A")],
      removedEdgeIds: [asEdgeId("e1")],
      affectedNodeIds: [asNodeId("notes/A"), asNodeId("notes/B")],
    };

    const result = createVisualGraphDelta(baseVisual, delta, makeResolver([]));
    expect(result.kind).toBe("incremental");
    if (result.kind !== "incremental") return;
    expect(result.removedNodeIds).toContain(asNodeId("notes/A"));
    expect(result.removedEdgeIds).toContain(asEdgeId("e1"));
    expect(result.addedNodes).toHaveLength(0);
    expect(result.updatedNodes).toHaveLength(0);
  });
});

// ─── 5. No-op delta produces empty arrays ────────────────────────────────────

describe("createVisualGraphDelta — test 5: no-op conserva arrays vacíos", () => {
  it("empty incremental delta produces all empty arrays", () => {
    const result = createVisualGraphDelta(emptySnapshot(), emptyIncrementalDelta(), makeResolver([]));
    expect(result.kind).toBe("incremental");
    if (result.kind !== "incremental") return;
    expect(result.addedNodes).toHaveLength(0);
    expect(result.updatedNodes).toHaveLength(0);
    expect(result.removedNodeIds).toHaveLength(0);
    expect(result.addedEdges).toHaveLength(0);
    expect(result.updatedEdges).toHaveLength(0);
    expect(result.removedEdgeIds).toHaveLength(0);
    expect(result.affectedNodeIds).toHaveLength(0);
  });
});

// ─── 6. rebuild-required propagates ─────────────────────────────────────────

describe("createVisualGraphDelta — test 6: rebuild-required se propaga", () => {
  it("local-projection reason propagates unchanged", () => {
    const delta: GraphProjectionDelta = {
      kind: "rebuild-required",
      reason: "local-projection",
    };
    const result = createVisualGraphDelta(emptySnapshot(), delta, makeResolver([]));
    expect(result.kind).toBe("rebuild-required");
    if (result.kind !== "rebuild-required") return;
    expect(result.reason).toBe("local-projection");
  });

  it("projection-context-changed reason propagates unchanged", () => {
    const delta: GraphProjectionDelta = {
      kind: "rebuild-required",
      reason: "projection-context-changed",
    };
    const result = createVisualGraphDelta(emptySnapshot(), delta, makeResolver([]));
    expect(result.kind).toBe("rebuild-required");
    if (result.kind !== "rebuild-required") return;
    expect(result.reason).toBe("projection-context-changed");
  });
});

// ─── 7. Apply VisualGraphDelta → full parity with createVisualGraph ──────────

describe("createVisualGraphDelta — test 7: paridad completa con createVisualGraph", () => {
  const ctx = { mode: "global" as const, focusNodeId: null,
    visibleNodeTypes: ["note", "project"] };

  it("add node + connecting edge: applied delta matches full rebuild including rootNodeId", () => {
    const A = logNode("notes/A", "notes", "note");
    const B = logNode("notes/B", "notes", "note");
    const e1 = logEdge("notes/A", "notes/B", "e1");

    const store1 = new WikiGraphStore({ nodes: [A, B], edges: [e1] });
    const proj1 = createGraphProjection(store1, ctx);
    const visual1 = createVisualGraph(store1, proj1);

    const C = logNode("notes/C", "notes", "note");
    const e2 = logEdge("notes/B", "notes/C", "e2");

    const store2 = new WikiGraphStore({ nodes: [A, B, C], edges: [e1, e2] });
    const proj2 = createGraphProjection(store2, ctx);
    const visual2Expected = createVisualGraph(store2, proj2);

    const wikiDelta: WikiGraphDelta = {
      ...emptyWikiDelta(),
      addedNodes: [wNode("notes/C", "notes", "note")],
      addedEdges: [wEdge("e2", "notes/B", "notes/C")],
      topologyChanged: true,
      affectedNodeIds: ["notes/B", "notes/C"],
    };

    const projDelta = createGraphProjectionDelta(proj1, wikiDelta, ctx, ctx);
    expect(projDelta.kind).toBe("incremental");

    const visualDelta = createVisualGraphDelta(visual1, projDelta, storeResolver(store2));
    expect(visualDelta.kind).toBe("incremental");

    const visualApplied = applyVisualDelta(visual1, visualDelta);

    expect(sortById(visualApplied.nodes)).toEqual(sortById(visual2Expected.nodes));
    expect(sortById(visualApplied.edges)).toEqual(sortById(visual2Expected.edges));
    expect(visualApplied.rootNodeId).toBe(visual2Expected.rootNodeId);
  });

  it("remove node + cascade edge: applied delta matches full rebuild including rootNodeId", () => {
    const A = logNode("notes/A", "notes", "note");
    const B = logNode("notes/B", "notes", "note");
    const C = logNode("notes/C", "notes", "note");
    const e1 = logEdge("notes/A", "notes/B", "e1");
    const e2 = logEdge("notes/B", "notes/C", "e2");

    const store1 = new WikiGraphStore({ nodes: [A, B, C], edges: [e1, e2] });
    const proj1 = createGraphProjection(store1, ctx);
    const visual1 = createVisualGraph(store1, proj1);

    const store2 = new WikiGraphStore({ nodes: [A, C], edges: [] });
    const proj2 = createGraphProjection(store2, ctx);
    const visual2Expected = createVisualGraph(store2, proj2);

    const wikiDelta: WikiGraphDelta = {
      ...emptyWikiDelta(),
      removedNodeIds: ["notes/B"],
      removedEdgeIds: ["e1", "e2"],
      topologyChanged: true,
    };

    const projDelta = createGraphProjectionDelta(proj1, wikiDelta, ctx, ctx);
    expect(projDelta.kind).toBe("incremental");

    const visualDelta = createVisualGraphDelta(visual1, projDelta, storeResolver(store2));
    expect(visualDelta.kind).toBe("incremental");

    const visualApplied = applyVisualDelta(visual1, visualDelta);

    expect(sortById(visualApplied.nodes)).toEqual(sortById(visual2Expected.nodes));
    expect(sortById(visualApplied.edges)).toEqual(sortById(visual2Expected.edges));
    expect(visualApplied.rootNodeId).toBe(visual2Expected.rootNodeId);
  });
});

// ─── 8. Arista lógica hacia nodo oculto actualiza connections del nodo visible ─

describe("createVisualGraphDelta — test 8: enlace oculto actualiza connections", () => {
  it("edge to hidden session node: A.connections increases via resolver, edge not emitted", () => {
    const A = logNode("notes/A", "notes", "note");

    // A exists in the current visual with connections=1
    const baseVisual: GraphVisualSnapshot = {
      rootNodeId: null,
      nodes: [{ id: A.id, label: "notes/A", folder: "notes",
        relativePath: "notes/A", noteType: "note", nodeKind: "existing",
        exists: true, connections: 1 }],
      edges: [],
    };

    // After delta: A gained a store edge to sessions/S (hidden, not projected)
    // projectionDelta has no addedEdges (edge filtered by visibility)
    // but A appears in affectedNodeIds
    const delta: GraphProjectionDelta = {
      ...emptyIncrementalDelta(),
      affectedNodeIds: [A.id],
    };

    // Resolver reflects post-delta store: A now has 2 store edges (1 visible + 1 hidden)
    const resolver = makeResolver([[A.id, 2]]);
    const result = createVisualGraphDelta(baseVisual, delta, resolver);

    expect(result.kind).toBe("incremental");
    if (result.kind !== "incremental") return;

    // No visible edge was added
    expect(result.addedEdges).toHaveLength(0);
    expect(result.addedNodes).toHaveLength(0);

    // A should appear in updatedNodes with updated connections
    expect(result.updatedNodes).toHaveLength(1);
    const vn = result.updatedNodes[0];
    expect(vn.id).toBe(A.id);
    expect(vn.connections).toBe(2);
    expect(vn.nodeKind).toBe("existing");
  });

  it("hidden edge to node that was orphan transitions it to existing", () => {
    const A = logNode("notes/A", "notes", "note");
    const baseVisual: GraphVisualSnapshot = {
      rootNodeId: null,
      nodes: [{ id: A.id, label: "notes/A", folder: "notes",
        relativePath: "notes/A", noteType: "note", nodeKind: "orphan",
        exists: true, connections: 0 }],
      edges: [],
    };

    const delta: GraphProjectionDelta = {
      ...emptyIncrementalDelta(),
      affectedNodeIds: [A.id],
    };

    // Resolver: A now has 1 hidden store edge
    const result = createVisualGraphDelta(baseVisual, delta, makeResolver([[A.id, 1]]));
    expect(result.kind).toBe("incremental");
    if (result.kind !== "incremental") return;
    expect(result.updatedNodes[0].nodeKind).toBe("existing");
  });
});

// ─── 9. nextRootNodeId reflects preferred node ───────────────────────────────

describe("createVisualGraphDelta — test 9: cambio de raíz", () => {
  it("adding projects/nebulosa-wiki.md sets nextRootNodeId to that node", () => {
    const A = logNode("notes/A", "notes", "note");
    const baseVisual: GraphVisualSnapshot = {
      rootNodeId: asNodeId("notes/A"),
      nodes: [{ id: A.id, label: "notes/A", folder: "notes",
        relativePath: "notes/A", noteType: "note", nodeKind: "existing",
        exists: true, connections: 1 }],
      edges: [],
    };

    const preferred = logNode("projects/nebulosa-wiki.md", "projects", "projects");
    const delta: GraphProjectionDelta = {
      ...emptyIncrementalDelta(),
      addedNodes: [preferred],
      affectedNodeIds: [preferred.id],
    };

    const result = createVisualGraphDelta(baseVisual, delta, makeResolver([[preferred.id, 0], [A.id, 1]]));
    expect(result.kind).toBe("incremental");
    if (result.kind !== "incremental") return;
    expect(result.nextRootNodeId).toBe(asNodeId("projects/nebulosa-wiki.md"));
  });

  it("removing the current root selects the next best candidate", () => {
    const A = logNode("notes/A", "notes", "note");
    const B = logNode("notes/B", "notes", "note");
    const baseVisual: GraphVisualSnapshot = {
      rootNodeId: A.id,
      nodes: [
        { id: A.id, label: "notes/A", folder: "notes", relativePath: "notes/A",
          noteType: "note", nodeKind: "existing", exists: true, connections: 2 },
        { id: B.id, label: "notes/B", folder: "notes", relativePath: "notes/B",
          noteType: "note", nodeKind: "existing", exists: true, connections: 1 },
      ],
      edges: [],
    };

    const delta: GraphProjectionDelta = {
      ...emptyIncrementalDelta(),
      removedNodeIds: [A.id],
      affectedNodeIds: [A.id, B.id],
    };

    const result = createVisualGraphDelta(baseVisual, delta, makeResolver([[B.id, 1]]));
    expect(result.kind).toBe("incremental");
    if (result.kind !== "incremental") return;
    // After removing A, B is the only candidate
    expect(result.nextRootNodeId).toBe(B.id);
  });

  it("no-op delta preserves current root", () => {
    const A = logNode("notes/A", "notes", "note");
    const baseVisual: GraphVisualSnapshot = {
      rootNodeId: A.id,
      nodes: [{ id: A.id, label: "notes/A", folder: "notes", relativePath: "notes/A",
        noteType: "note", nodeKind: "existing", exists: true, connections: 1 }],
      edges: [],
    };

    const result = createVisualGraphDelta(baseVisual, emptyIncrementalDelta(), makeResolver([[A.id, 1]]));
    expect(result.kind).toBe("incremental");
    if (result.kind !== "incremental") return;
    expect(result.nextRootNodeId).toBe(A.id);
  });
});
