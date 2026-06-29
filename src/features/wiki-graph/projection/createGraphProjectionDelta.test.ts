import { describe, expect, it } from "vitest";
import { WikiGraphStore, asNodeId, asEdgeId } from "../domain";
import type { LogicalNode, LogicalEdge, GraphNodeId, GraphEdgeId } from "../domain";
import type { WikiNode, WikiEdge } from "../types";
import type { WikiGraphDelta } from "../indexing";
import type { GraphProjectionOptions, GraphProjection } from "./graphProjectionTypes";
import { createGraphProjection } from "./createGraphProjection";
import { createGraphProjectionDelta } from "./createGraphProjectionDelta";
import type { GraphProjectionDelta } from "./createGraphProjectionDelta";

// ─── Test helpers ─────────────────────────────────────────────────────────────

function logicalNode(
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

function logicalEdge(src: string, tgt: string, id: string): LogicalEdge {
  return {
    id: asEdgeId(id),
    source: asNodeId(src),
    target: asNodeId(tgt),
    label: "",
    type: "wikilink",
    weight: 1,
    resolution: "resolved",
  };
}

function wikiNode(
  id: string,
  folder: string,
  type: string,
  exists = true,
): WikiNode {
  return {
    id,
    title: id,
    relativePath: id,
    folder,
    tags: [],
    type,
    outgoingCount: 0,
    backlinkCount: 0,
    isOrphan: false,
    exists,
  };
}

function wikiEdge(
  id: string,
  src: string,
  tgt: string,
  broken = false,
): WikiEdge {
  return {
    id,
    source: src,
    target: tgt,
    label: "",
    type: broken ? "broken" : "wikilink",
    weight: 1,
    isBacklink: false,
    isBroken: broken,
  };
}

function emptyDelta(): WikiGraphDelta {
  return {
    addedNodes: [],
    updatedNodes: [],
    removedNodeIds: [],
    addedEdges: [],
    updatedEdges: [],
    removedEdgeIds: [],
    topologyChanged: false,
    affectedNodeIds: [],
  };
}

// Applies an incremental GraphProjectionDelta to a base GraphProjection,
// producing a new GraphProjection. Used for parity tests.
function applyProjectionDelta(
  base: GraphProjection,
  delta: GraphProjectionDelta,
): GraphProjection {
  if (delta.kind !== "incremental") {
    throw new Error(`applyProjectionDelta: expected incremental, got ${delta.kind}`);
  }

  const nodeMap = new Map<GraphNodeId, LogicalNode>(base.nodes.map((n) => [n.id, n]));
  for (const n of delta.addedNodes) nodeMap.set(n.id, n);
  for (const n of delta.updatedNodes) nodeMap.set(n.id, n);
  for (const id of delta.removedNodeIds) nodeMap.delete(id);

  const edgeMap = new Map<GraphEdgeId, LogicalEdge>(base.edges.map((e) => [e.id, e]));
  for (const e of delta.addedEdges) edgeMap.set(e.id, e);
  for (const e of delta.updatedEdges) edgeMap.set(e.id, e);
  for (const id of delta.removedEdgeIds) edgeMap.delete(id);

  return {
    requestedMode: base.requestedMode,
    effectiveMode: base.effectiveMode,
    focusNodeId: base.focusNodeId,
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}

function canonicalNodes(nodes: ReadonlyArray<LogicalNode>) {
  return [...nodes]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((n) => ({
      id: n.id,
      title: n.title,
      relativePath: n.relativePath,
      folder: n.folder,
      tags: n.tags,
      type: n.type,
      exists: n.exists,
    }));
}

function canonicalEdges(edges: ReadonlyArray<LogicalEdge>) {
  return [...edges]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: e.type,
      weight: e.weight,
      resolution: e.resolution,
    }));
}

function canonicalProjection(p: GraphProjection) {
  return {
    requestedMode: p.requestedMode,
    effectiveMode: p.effectiveMode,
    focusNodeId: p.focusNodeId,
    nodes: canonicalNodes(p.nodes),
    edges: canonicalEdges(p.edges),
  };
}

// ─── Shared fixture ───────────────────────────────────────────────────────────
//
//  notes/A  ──e1──▶  notes/B
//  notes/A  ──e2──▶  projects/C
//  notes/B  ──e3──▶  indexes/IX   (always excluded: touches index)
//
// Default context: global, visibleNodeTypes: ["note", "project"]
// Baseline projection: { A, B, C } nodes, { e1, e2 } edges

const A  = logicalNode("notes/A",    "notes",    "note");
const B  = logicalNode("notes/B",    "notes",    "note");
const C  = logicalNode("projects/C", "projects", "project");
const IX = logicalNode("indexes/IX", "indexes",  "indexes");

const e1 = logicalEdge("notes/A",    "notes/B",    "e1");
const e2 = logicalEdge("notes/A",    "projects/C", "e2");
const e3 = logicalEdge("notes/B",    "indexes/IX", "e3");

const baseContext: GraphProjectionOptions = {
  mode: "global",
  focusNodeId: null,
  visibleNodeTypes: ["note", "project"],
};

function makeBaseProjection(): GraphProjection {
  const store = new WikiGraphStore({ nodes: [A, B, C, IX], edges: [e1, e2, e3] });
  return createGraphProjection(store, baseContext);
}

// ─── 1. Visible node added ────────────────────────────────────────────────────

describe("createGraphProjectionDelta — case 1: visible node added", () => {
  it("parity: adding a visible note node matches createGraphProjection on new store", () => {
    const D  = logicalNode("notes/D", "notes", "note");
    const wD = wikiNode("notes/D", "notes", "note");

    const storeAfter = new WikiGraphStore({ nodes: [A, B, C, IX, D], edges: [e1, e2, e3] });
    const projAfter  = createGraphProjection(storeAfter, baseContext);

    const delta: WikiGraphDelta = { ...emptyDelta(), addedNodes: [wD], topologyChanged: true };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    const applied = applyProjectionDelta(makeBaseProjection(), projDelta);

    expect(canonicalProjection(applied)).toEqual(canonicalProjection(projAfter));
  });

  it("addedNodes contains the new visible node", () => {
    const wD    = wikiNode("notes/D", "notes", "note");
    const delta: WikiGraphDelta = { ...emptyDelta(), addedNodes: [wD] };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    if (projDelta.kind !== "incremental") return;
    expect(projDelta.addedNodes.map((n) => n.id)).toContain(asNodeId("notes/D"));
  });
});

// ─── 2. Excluded node added — not emitted ────────────────────────────────────

describe("createGraphProjectionDelta — case 2: excluded node added", () => {
  it("parity: adding a session node (excluded type) matches createGraphProjection on new store", () => {
    const S  = logicalNode("sessions/S", "sessions", "session");
    const wS = wikiNode("sessions/S", "sessions", "session");

    const storeAfter = new WikiGraphStore({ nodes: [A, B, C, IX, S], edges: [e1, e2, e3] });
    const projAfter  = createGraphProjection(storeAfter, baseContext);

    const delta: WikiGraphDelta = { ...emptyDelta(), addedNodes: [wS], topologyChanged: true };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    const applied = applyProjectionDelta(makeBaseProjection(), projDelta);

    expect(canonicalProjection(applied)).toEqual(canonicalProjection(projAfter));
  });

  it("excluded node is not present in addedNodes", () => {
    const wS    = wikiNode("sessions/S", "sessions", "session");
    const delta: WikiGraphDelta = { ...emptyDelta(), addedNodes: [wS] };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    if (projDelta.kind !== "incremental") return;
    expect(projDelta.addedNodes.map((n) => n.id)).not.toContain(asNodeId("sessions/S"));
  });
});

// ─── 3. New edge between two visible nodes ────────────────────────────────────

describe("createGraphProjectionDelta — case 3: new edge between visible nodes", () => {
  it("parity: new edge B→A appears in projection", () => {
    const eBA  = logicalEdge("notes/B", "notes/A", "eBA");
    const weBA = wikiEdge("eBA", "notes/B", "notes/A");

    const storeAfter = new WikiGraphStore({ nodes: [A, B, C, IX], edges: [e1, e2, e3, eBA] });
    const projAfter  = createGraphProjection(storeAfter, baseContext);

    const delta: WikiGraphDelta = { ...emptyDelta(), addedEdges: [weBA], topologyChanged: true };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    const applied = applyProjectionDelta(makeBaseProjection(), projDelta);

    expect(canonicalProjection(applied)).toEqual(canonicalProjection(projAfter));
  });

  it("addedEdges contains the new visible edge", () => {
    const weBA = wikiEdge("eBA", "notes/B", "notes/A");
    const delta: WikiGraphDelta = { ...emptyDelta(), addedEdges: [weBA] };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    if (projDelta.kind !== "incremental") return;
    expect(projDelta.addedEdges.map((e) => e.id)).toContain(asEdgeId("eBA"));
  });
});

// ─── 4. New edge with hidden endpoint — not emitted ──────────────────────────

describe("createGraphProjectionDelta — case 4: new edge with hidden endpoint", () => {
  it("parity: edge to excluded-type node does not appear in projection", () => {
    const S   = logicalNode("sessions/S", "sessions", "session");
    const eAS = logicalEdge("notes/A", "sessions/S", "eAS");
    const weAS = wikiEdge("eAS", "notes/A", "sessions/S");

    const storeAfter = new WikiGraphStore({ nodes: [A, B, C, IX, S], edges: [e1, e2, e3, eAS] });
    const projAfter  = createGraphProjection(storeAfter, baseContext);

    const delta: WikiGraphDelta = {
      ...emptyDelta(),
      addedNodes: [wikiNode("sessions/S", "sessions", "session")],
      addedEdges: [weAS],
      topologyChanged: true,
    };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    const applied = applyProjectionDelta(makeBaseProjection(), projDelta);

    expect(canonicalProjection(applied)).toEqual(canonicalProjection(projAfter));
  });

  it("edge to index node is not emitted (index exclusion rule)", () => {
    // notes/B already has e3 → IX, which is already excluded. Add a new edge A→IX.
    const weAIX = wikiEdge("eAIX", "notes/A", "indexes/IX");
    const delta: WikiGraphDelta = { ...emptyDelta(), addedEdges: [weAIX] };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    if (projDelta.kind !== "incremental") return;
    expect(projDelta.addedEdges.map((e) => e.id)).not.toContain(asEdgeId("eAIX"));
  });
});

// ─── 5. Remove visible node and its edges ────────────────────────────────────

describe("createGraphProjectionDelta — case 5: remove visible node with edges", () => {
  it("parity: removing notes/B removes it and e1 from projection", () => {
    const storeAfter = new WikiGraphStore({ nodes: [A, C, IX], edges: [e2, e3] });
    const projAfter  = createGraphProjection(storeAfter, baseContext);

    const delta: WikiGraphDelta = {
      ...emptyDelta(),
      removedNodeIds: ["notes/B"],
      removedEdgeIds: ["e1", "e3"], // e3 was already not in projection
      topologyChanged: true,
    };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    const applied = applyProjectionDelta(makeBaseProjection(), projDelta);

    expect(canonicalProjection(applied)).toEqual(canonicalProjection(projAfter));
  });

  it("removedNodeIds contains the removed node id", () => {
    const delta: WikiGraphDelta = {
      ...emptyDelta(),
      removedNodeIds: ["notes/B"],
      removedEdgeIds: ["e1", "e3"],
      topologyChanged: true,
    };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    if (projDelta.kind !== "incremental") return;
    expect(projDelta.removedNodeIds).toContain(asNodeId("notes/B"));
    expect(projDelta.removedEdgeIds).toContain(asEdgeId("e1"));
  });

  it("non-visible edge removal (e3 touches index) is silently skipped", () => {
    const delta: WikiGraphDelta = {
      ...emptyDelta(),
      removedEdgeIds: ["e3"],
    };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    if (projDelta.kind !== "incremental") return;
    expect(projDelta.removedEdgeIds).not.toContain(asEdgeId("e3"));
  });
});

// ─── 6. Visible node becomes invisible (visibility transition) ────────────────

describe("createGraphProjectionDelta — case 6: node visible→invisible", () => {
  it("parity: notes/C changes type to 'session' (excluded) → removed from projection", () => {
    // Simulate C having its type changed from "project" to "session".
    // In the logical model this would come as an updatedNode with new type.
    const CSession = logicalNode("projects/C", "projects", "session");
    const wCSession = wikiNode("projects/C", "projects", "session");

    const storeAfter = new WikiGraphStore({ nodes: [A, B, CSession, IX], edges: [e1, e2, e3] });
    const projAfter  = createGraphProjection(storeAfter, baseContext);

    const delta: WikiGraphDelta = { ...emptyDelta(), updatedNodes: [wCSession] };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    const applied = applyProjectionDelta(makeBaseProjection(), projDelta);

    expect(canonicalProjection(applied)).toEqual(canonicalProjection(projAfter));
  });

  it("edge connected to newly-invisible node is also removed", () => {
    const wCSession = wikiNode("projects/C", "projects", "session");
    const delta: WikiGraphDelta = { ...emptyDelta(), updatedNodes: [wCSession] };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    if (projDelta.kind !== "incremental") return;
    expect(projDelta.removedNodeIds).toContain(asNodeId("projects/C"));
    expect(projDelta.removedEdgeIds).toContain(asEdgeId("e2")); // A→C was visible
  });
});

// ─── 7. Visible node updated without visibility change ───────────────────────

describe("createGraphProjectionDelta — case 7: visible node updated, stays visible", () => {
  it("parity: notes/A title update propagates full entity into applied projection", () => {
    const newTitle  = "Updated Title";
    const AUpdated: LogicalNode = { ...A, title: newTitle };
    const wAUpdated: WikiNode   = { ...wikiNode("notes/A", "notes", "note"), title: newTitle };

    const storeAfter = new WikiGraphStore({ nodes: [AUpdated, B, C, IX], edges: [e1, e2, e3] });
    const projAfter  = createGraphProjection(storeAfter, baseContext);

    const delta: WikiGraphDelta = { ...emptyDelta(), updatedNodes: [wAUpdated] };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    const applied = applyProjectionDelta(makeBaseProjection(), projDelta);

    expect(canonicalProjection(applied)).toEqual(canonicalProjection(projAfter));
  });

  it("updated node is in updatedNodes, not in added or removed", () => {
    const wA = wikiNode("notes/A", "notes", "note");
    const delta: WikiGraphDelta = { ...emptyDelta(), updatedNodes: [wA] };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    if (projDelta.kind !== "incremental") return;
    expect(projDelta.updatedNodes.map((n) => n.id)).toContain(asNodeId("notes/A"));
    expect(projDelta.addedNodes.map((n) => n.id)).not.toContain(asNodeId("notes/A"));
    expect(projDelta.removedNodeIds).not.toContain(asNodeId("notes/A"));
  });
});

// ─── 8. Local mode → rebuild-required ────────────────────────────────────────

describe("createGraphProjectionDelta — case 8: local mode", () => {
  it("returns rebuild-required with reason 'local-projection' when nextContext is local", () => {
    const localContext: GraphProjectionOptions = {
      mode: "local",
      focusNodeId: asNodeId("notes/A"),
      visibleNodeTypes: ["note", "project"],
    };
    const projDelta = createGraphProjectionDelta(
      makeBaseProjection(),
      emptyDelta(),
      baseContext,
      localContext,
    );

    expect(projDelta.kind).toBe("rebuild-required");
    if (projDelta.kind !== "rebuild-required") return;
    // Could be "projection-context-changed" because mode changed; that is valid too.
    // Either rebuild reason is correct — the important thing is it's not incremental.
    expect(["local-projection", "projection-context-changed"]).toContain(projDelta.reason);
  });

  it("returns rebuild-required when prevContext is already local", () => {
    const localContext: GraphProjectionOptions = {
      mode: "local",
      focusNodeId: asNodeId("notes/A"),
      visibleNodeTypes: ["note", "project"],
    };
    const store = new WikiGraphStore({ nodes: [A, B, C, IX], edges: [e1, e2, e3] });
    const localProjection = createGraphProjection(store, localContext);

    const projDelta = createGraphProjectionDelta(
      localProjection,
      emptyDelta(),
      localContext,
      localContext,
    );

    expect(projDelta.kind).toBe("rebuild-required");
    if (projDelta.kind !== "rebuild-required") return;
    expect(projDelta.reason).toBe("local-projection");
  });
});

// ─── 9. Context change → rebuild-required ────────────────────────────────────

describe("createGraphProjectionDelta — case 9: projection context change", () => {
  it("returns rebuild-required when visibleNodeTypes changes", () => {
    const narrowContext: GraphProjectionOptions = {
      mode: "global",
      focusNodeId: null,
      visibleNodeTypes: ["note"], // dropped "project"
    };
    const projDelta = createGraphProjectionDelta(
      makeBaseProjection(),
      emptyDelta(),
      baseContext,    // prev had ["note", "project"]
      narrowContext,  // next has ["note"] only
    );

    expect(projDelta.kind).toBe("rebuild-required");
    if (projDelta.kind !== "rebuild-required") return;
    expect(projDelta.reason).toBe("projection-context-changed");
  });

  it("returns rebuild-required when mode changes from global to local", () => {
    const localContext: GraphProjectionOptions = {
      mode: "local",
      focusNodeId: asNodeId("notes/A"),
      visibleNodeTypes: ["note", "project"],
    };
    const projDelta = createGraphProjectionDelta(
      makeBaseProjection(),
      emptyDelta(),
      baseContext,
      localContext,
    );

    expect(projDelta.kind).toBe("rebuild-required");
  });
});

// ─── Shared context that includes "indexes" in visibleNodeTypes ───────────────

const indexContext: GraphProjectionOptions = {
  mode: "global",
  focusNodeId: null,
  visibleNodeTypes: ["note", "project", "indexes"],
};

function makeBaseProjectionWithIndexes(): GraphProjection {
  // IX is visible (type "indexes" included), but e3 still excluded (touches index node)
  const store = new WikiGraphStore({ nodes: [A, B, C, IX], edges: [e1, e2, e3] });
  return createGraphProjection(store, indexContext);
}

// ─── 10. No-op delta → empty incremental ─────────────────────────────────────

describe("createGraphProjectionDelta — case 10: no-op delta", () => {
  it("empty delta produces incremental with all empty arrays", () => {
    const projDelta = createGraphProjectionDelta(
      makeBaseProjection(),
      emptyDelta(),
      baseContext,
      baseContext,
    );

    expect(projDelta.kind).toBe("incremental");
    if (projDelta.kind !== "incremental") return;
    expect(projDelta.addedNodes).toHaveLength(0);
    expect(projDelta.updatedNodes).toHaveLength(0);
    expect(projDelta.removedNodeIds).toHaveLength(0);
    expect(projDelta.addedEdges).toHaveLength(0);
    expect(projDelta.updatedEdges).toHaveLength(0);
    expect(projDelta.removedEdgeIds).toHaveLength(0);
    expect(projDelta.affectedNodeIds).toHaveLength(0);
  });

  it("parity: no-op delta applied produces same projection as original", () => {
    const base      = makeBaseProjection();
    const projDelta = createGraphProjectionDelta(base, emptyDelta(), baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    const applied = applyProjectionDelta(base, projDelta);

    expect(canonicalProjection(applied)).toEqual(canonicalProjection(base));
  });
});

// ─── 11. Removed node without explicit edge cascade in logicalDelta ───────────

describe("createGraphProjectionDelta — case 11: removed node without removedEdgeIds in delta", () => {
  it("parity: removing notes/B without edge ids still removes e1 from projection", () => {
    const storeAfter = new WikiGraphStore({ nodes: [A, C, IX], edges: [e2, e3] });
    const projAfter  = createGraphProjection(storeAfter, baseContext);

    const delta: WikiGraphDelta = {
      ...emptyDelta(),
      removedNodeIds: ["notes/B"],
      // removedEdgeIds intentionally omitted
      topologyChanged: true,
    };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    const applied = applyProjectionDelta(makeBaseProjection(), projDelta);
    expect(canonicalProjection(applied)).toEqual(canonicalProjection(projAfter));
  });

  it("e1 appears in removedEdgeIds even when absent from logicalDelta.removedEdgeIds", () => {
    const delta: WikiGraphDelta = {
      ...emptyDelta(),
      removedNodeIds: ["notes/B"],
    };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    if (projDelta.kind !== "incremental") return;
    expect(projDelta.removedNodeIds).toContain(asNodeId("notes/B"));
    expect(projDelta.removedEdgeIds).toContain(asEdgeId("e1"));
  });
});

// ─── 12. Visible node becomes index node ─────────────────────────────────────

describe("createGraphProjectionDelta — case 12: visible node becomes index node", () => {
  it("parity: C becomes index node → stays visible but incident edge e2 removed", () => {
    const C_asIndex: LogicalNode = { ...C, type: "indexes", folder: "indexes" };
    const wC_asIndex = wikiNode("projects/C", "indexes", "indexes");

    const storeAfter = new WikiGraphStore({ nodes: [A, B, C_asIndex, IX], edges: [e1, e2, e3] });
    const projAfter  = createGraphProjection(storeAfter, indexContext);

    const delta: WikiGraphDelta = { ...emptyDelta(), updatedNodes: [wC_asIndex] };
    const projDelta = createGraphProjectionDelta(
      makeBaseProjectionWithIndexes(), delta, indexContext, indexContext,
    );

    expect(projDelta.kind).toBe("incremental");
    const applied = applyProjectionDelta(makeBaseProjectionWithIndexes(), projDelta);
    expect(canonicalProjection(applied)).toEqual(canonicalProjection(projAfter));
  });

  it("C stays in updatedNodes and e2 appears in removedEdgeIds", () => {
    const wC_asIndex = wikiNode("projects/C", "indexes", "indexes");
    const delta: WikiGraphDelta = { ...emptyDelta(), updatedNodes: [wC_asIndex] };
    const projDelta = createGraphProjectionDelta(
      makeBaseProjectionWithIndexes(), delta, indexContext, indexContext,
    );

    expect(projDelta.kind).toBe("incremental");
    if (projDelta.kind !== "incremental") return;
    expect(projDelta.updatedNodes.map((n) => n.id)).toContain(asNodeId("projects/C"));
    expect(projDelta.removedEdgeIds).toContain(asEdgeId("e2"));
  });
});

// ─── 13. Index node becomes non-index → rebuild-required ─────────────────────

describe("createGraphProjectionDelta — case 13: index node becomes non-index node", () => {
  it("returns rebuild-required with unsupported-visibility-transition", () => {
    // IX was index (type:"indexes"), now becomes note (type:"note") — still visible in indexContext
    const wIX_asNote = wikiNode("indexes/IX", "notes", "note");
    const delta: WikiGraphDelta = { ...emptyDelta(), updatedNodes: [wIX_asNote] };
    const projDelta = createGraphProjectionDelta(
      makeBaseProjectionWithIndexes(), delta, indexContext, indexContext,
    );

    expect(projDelta.kind).toBe("rebuild-required");
    if (projDelta.kind !== "rebuild-required") return;
    expect(projDelta.reason).toBe("unsupported-visibility-transition");
  });
});

// ─── 14. Title update — full entity comparison ───────────────────────────────

describe("createGraphProjectionDelta — case 14: title update full entity comparison", () => {
  it("full parity: updated title propagates into applied projection entity", () => {
    const newTitle  = "Título Actualizado";
    const AUpdated: LogicalNode = { ...A, title: newTitle };
    const wAUpdated: WikiNode   = { ...wikiNode("notes/A", "notes", "note"), title: newTitle };

    const storeAfter = new WikiGraphStore({ nodes: [AUpdated, B, C, IX], edges: [e1, e2, e3] });
    const projAfter  = createGraphProjection(storeAfter, baseContext);

    const delta: WikiGraphDelta = { ...emptyDelta(), updatedNodes: [wAUpdated] };
    const projDelta = createGraphProjectionDelta(makeBaseProjection(), delta, baseContext, baseContext);

    expect(projDelta.kind).toBe("incremental");
    const applied = applyProjectionDelta(makeBaseProjection(), projDelta);
    expect(canonicalProjection(applied)).toEqual(canonicalProjection(projAfter));
  });
});
