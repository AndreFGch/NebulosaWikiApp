import { describe, expect, it } from "vitest";
import { WikiGraphStore, asNodeId, asEdgeId } from "../domain";
import type { LogicalNode, LogicalEdge } from "../domain";
import { createGraphProjection } from "./createGraphProjection";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function node(
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

function edge(src: string, tgt: string, id: string): LogicalEdge {
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

function ids(nodes: ReadonlyArray<LogicalNode>): string[] {
  return nodes.map((n) => n.id).sort();
}

function edgeIds(edges: ReadonlyArray<LogicalEdge>): string[] {
  return edges.map((e) => e.id).sort();
}

// ---------------------------------------------------------------------------
// Shared fixture — small wiki with notes, projects, indexes
//
//   notes/A  ──e1──▶  notes/B
//   notes/A  ──e2──▶  projects/C
//   notes/B  ──e3──▶  indexes/IX
//   projects/C ──e4──▶  notes/A   (creates a two-hop path from B via C to A)
// ---------------------------------------------------------------------------

const A = node("notes/A", "notes", "note");
const B = node("notes/B", "notes", "note");
const C = node("projects/C", "projects", "project");
const IX = node("indexes/IX", "indexes", "indexes");

const e1 = edge("notes/A", "notes/B", "e1");
const e2 = edge("notes/A", "projects/C", "e2");
const e3 = edge("notes/B", "indexes/IX", "e3"); // touches indexes
const e4 = edge("projects/C", "notes/A", "e4");

function makeBaseStore(): WikiGraphStore {
  return new WikiGraphStore({ nodes: [A, B, C, IX], edges: [e1, e2, e3, e4] });
}

// ---------------------------------------------------------------------------
// 1. Global with filters
// ---------------------------------------------------------------------------

describe("createGraphProjection — global with filters", () => {
  it("filters nodes by visibleNodeTypes", () => {
    const store = makeBaseStore();
    const result = createGraphProjection(store, {
      mode: "global",
      focusNodeId: null,
      visibleNodeTypes: ["note"],
    });

    expect(ids(result.nodes)).toEqual([asNodeId("notes/A"), asNodeId("notes/B")].sort());
  });

  it("drops edges when one endpoint is filtered out", () => {
    const store = makeBaseStore();
    // Only notes visible: e2 (A→C) dropped (C is project), e3 (B→IX) dropped
    // (IX touches indexes), e4 (C→A) dropped (C filtered). Only e1 survives.
    const result = createGraphProjection(store, {
      mode: "global",
      focusNodeId: null,
      visibleNodeTypes: ["note"],
    });

    expect(edgeIds(result.edges)).toEqual([asEdgeId("e1")].sort());
  });

  it("excludes edges touching indexes even when index type is in visibleNodeTypes", () => {
    const store = makeBaseStore();
    // Allow every type: IX is visible as a node, but e3 (B→IX) must still be excluded.
    // Contract: node visibility and edge exclusion are independent rules.
    const result = createGraphProjection(store, {
      mode: "global",
      focusNodeId: null,
      visibleNodeTypes: ["note", "project", "indexes"],
    });

    expect(ids(result.nodes)).toContain(asNodeId("indexes/IX"));
    expect(edgeIds(result.edges)).not.toContain(asEdgeId("e3"));
  });

  it("requestedMode and effectiveMode are both 'global'", () => {
    const store = makeBaseStore();
    const result = createGraphProjection(store, {
      mode: "global",
      focusNodeId: null,
      visibleNodeTypes: ["note"],
    });

    expect(result.requestedMode).toBe("global");
    expect(result.effectiveMode).toBe("global");
  });
});

// ---------------------------------------------------------------------------
// 2. Global does not depend on focus
// ---------------------------------------------------------------------------

describe("createGraphProjection — global ignores focusNodeId", () => {
  it("a valid focusNodeId does not switch result to local", () => {
    const store = makeBaseStore();
    const result = createGraphProjection(store, {
      mode: "global",
      focusNodeId: asNodeId("notes/A"),
      visibleNodeTypes: ["note", "project"],
    });

    expect(result.requestedMode).toBe("global");
    expect(result.effectiveMode).toBe("global");
    // All non-index nodes with allowed types present
    expect(ids(result.nodes)).toEqual(
      [asNodeId("notes/A"), asNodeId("notes/B"), asNodeId("projects/C")].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Local with valid focus
// ---------------------------------------------------------------------------

describe("createGraphProjection — local with valid focus", () => {
  //   notes/A  ──e1──▶  notes/B
  //   notes/A  ──e2──▶  projects/C
  //   projects/C ──e4──▶  notes/A
  //   notes/B  ──e3──▶  indexes/IX  (excluded)
  //   (two-hop from A: IX via B — must not appear)

  it("includes focus node", () => {
    const store = makeBaseStore();
    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: asNodeId("notes/A"),
      visibleNodeTypes: ["note", "project"],
    });

    expect(ids(result.nodes)).toContain(asNodeId("notes/A"));
  });

  it("includes direct outgoing neighbors", () => {
    const store = makeBaseStore();
    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: asNodeId("notes/A"),
      visibleNodeTypes: ["note", "project"],
    });

    expect(ids(result.nodes)).toContain(asNodeId("notes/B"));
    expect(ids(result.nodes)).toContain(asNodeId("projects/C"));
  });

  it("includes direct incoming neighbors", () => {
    // C has an incoming edge from A, but A also gets C as a direct neighbor
    // via e2. Test incoming: focus on B — A links to B (e1) so A is an incoming neighbor.
    const store = makeBaseStore();
    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: asNodeId("notes/B"),
      visibleNodeTypes: ["note", "project"],
    });

    expect(ids(result.nodes)).toContain(asNodeId("notes/A"));
  });

  it("does not include a node two hops away", () => {
    // Focus A. B is a direct neighbor. IX is reachable via B but 2 hops away.
    // Even if IX type were allowed, it would be excluded by edgeTouchesIndex.
    // Add a plain two-hop node to verify the hop limit independently.
    const D = node("notes/D", "notes", "note");
    const e5 = edge("notes/B", "notes/D", "e5"); // B→D, two hops from A
    const store = new WikiGraphStore({
      nodes: [A, B, C, IX, D],
      edges: [e1, e2, e3, e4, e5],
    });

    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: asNodeId("notes/A"),
      visibleNodeTypes: ["note", "project"],
    });

    expect(ids(result.nodes)).not.toContain(asNodeId("notes/D"));
  });

  it("includes only direct edges between visible nodes", () => {
    const store = makeBaseStore();
    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: asNodeId("notes/A"),
      visibleNodeTypes: ["note", "project"],
    });

    // e1 (A→B) and e2 (A→C) and e4 (C→A) are direct; e3 touches indexes
    expect(edgeIds(result.edges)).toEqual(
      [asEdgeId("e1"), asEdgeId("e2"), asEdgeId("e4")].sort(),
    );
  });

  it("excludes edges that touch indexes", () => {
    const store = makeBaseStore();
    // Focus B: has e1 (A→B incoming) and e3 (B→IX outgoing)
    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: asNodeId("notes/B"),
      visibleNodeTypes: ["note", "project", "indexes"],
    });

    expect(edgeIds(result.edges)).not.toContain(asEdgeId("e3"));
  });

  it("requestedMode and effectiveMode are both 'local'", () => {
    const store = makeBaseStore();
    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: asNodeId("notes/A"),
      visibleNodeTypes: ["note", "project"],
    });

    expect(result.requestedMode).toBe("local");
    expect(result.effectiveMode).toBe("local");
  });
});

// ---------------------------------------------------------------------------
// 4. Local with type filter — neighbor excluded by type
// ---------------------------------------------------------------------------

describe("createGraphProjection — local with type filter excludes typed-out neighbors", () => {
  it("omits neighbor whose type is not in visibleNodeTypes", () => {
    const store = makeBaseStore();
    // Focus A, only "note" visible → C ("project") must be absent
    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: asNodeId("notes/A"),
      visibleNodeTypes: ["note"],
    });

    expect(ids(result.nodes)).not.toContain(asNodeId("projects/C"));
  });

  it("omits edge to type-filtered neighbor", () => {
    const store = makeBaseStore();
    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: asNodeId("notes/A"),
      visibleNodeTypes: ["note"],
    });

    expect(edgeIds(result.edges)).not.toContain(asEdgeId("e2")); // A→C
    expect(edgeIds(result.edges)).not.toContain(asEdgeId("e4")); // C→A
  });

  it("keeps focus node when its type is in visibleNodeTypes", () => {
    const store = makeBaseStore();
    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: asNodeId("notes/A"),
      visibleNodeTypes: ["note"],
    });

    expect(ids(result.nodes)).toContain(asNodeId("notes/A"));
  });
});

// ---------------------------------------------------------------------------
// 5. Local with inexistent focusNodeId → fallback global
// ---------------------------------------------------------------------------

describe("createGraphProjection — local with inexistent focusNodeId", () => {
  it("requestedMode is 'local'", () => {
    const store = makeBaseStore();
    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: asNodeId("notes/DOES_NOT_EXIST"),
      visibleNodeTypes: ["note", "project"],
    });

    expect(result.requestedMode).toBe("local");
  });

  it("effectiveMode falls back to 'global'", () => {
    const store = makeBaseStore();
    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: asNodeId("notes/DOES_NOT_EXIST"),
      visibleNodeTypes: ["note", "project"],
    });

    expect(result.effectiveMode).toBe("global");
  });

  it("returns same node set as equivalent global projection", () => {
    const store = makeBaseStore();
    const opts = {
      focusNodeId: asNodeId("notes/DOES_NOT_EXIST"),
      visibleNodeTypes: ["note", "project"],
    } as const;

    const fallback = createGraphProjection(store, { mode: "local", ...opts });
    const global = createGraphProjection(store, { mode: "global", ...opts });

    expect(ids(fallback.nodes)).toEqual(ids(global.nodes));
    expect(edgeIds(fallback.edges)).toEqual(edgeIds(global.edges));
  });
});

// ---------------------------------------------------------------------------
// 6. Local with focusNodeId null → fallback global
// ---------------------------------------------------------------------------

describe("createGraphProjection — local with focusNodeId null", () => {
  it("requestedMode is 'local'", () => {
    const store = makeBaseStore();
    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: null,
      visibleNodeTypes: ["note", "project"],
    });

    expect(result.requestedMode).toBe("local");
  });

  it("effectiveMode falls back to 'global'", () => {
    const store = makeBaseStore();
    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: null,
      visibleNodeTypes: ["note", "project"],
    });

    expect(result.effectiveMode).toBe("global");
  });

  it("respects type filter and index exclusion same as global", () => {
    const store = makeBaseStore();
    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: null,
      visibleNodeTypes: ["note"],
    });

    expect(ids(result.nodes)).toEqual([asNodeId("notes/A"), asNodeId("notes/B")].sort());
    expect(edgeIds(result.edges)).toEqual([asEdgeId("e1")].sort());
  });
});

// ---------------------------------------------------------------------------
// 7. Duplicate edge via self-loop / bidirectional
// ---------------------------------------------------------------------------

describe("createGraphProjection — duplicate edge deduplication", () => {
  it("self-loop appears only once in local projection", () => {
    // Self-loop: A → A
    const selfEdge = edge("notes/A", "notes/A", "self");
    const store = new WikiGraphStore({
      nodes: [A, B],
      edges: [e1, selfEdge],
    });

    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: asNodeId("notes/A"),
      visibleNodeTypes: ["note"],
    });

    const selfEdgeOccurrences = result.edges.filter((e) => e.id === asEdgeId("self"));
    expect(selfEdgeOccurrences).toHaveLength(1);
  });

  it("bidirectional edge pair (A→B and B→A) both appear, each exactly once", () => {
    // A→B (e1, existing) plus B→A (e_back)
    const eBack = edge("notes/B", "notes/A", "e_back");
    const store = new WikiGraphStore({
      nodes: [A, B],
      edges: [e1, eBack],
    });

    const result = createGraphProjection(store, {
      mode: "local",
      focusNodeId: asNodeId("notes/A"),
      visibleNodeTypes: ["note"],
    });

    expect(result.edges.filter((e) => e.id === asEdgeId("e1"))).toHaveLength(1);
    expect(result.edges.filter((e) => e.id === asEdgeId("e_back"))).toHaveLength(1);
    expect(result.edges).toHaveLength(2);
  });
});
