import { describe, expect, it } from "vitest";
import { WikiGraphStore, asNodeId, asEdgeId } from "../domain";
import { createGraphProjection } from "../projection";
import { createVisualGraph } from "./createVisualGraph";
import type { LogicalNode, LogicalEdge } from "../domain";
import type { GraphProjection } from "../projection";

function node(
  relativePath: string,
  folder: string,
  type: string,
  exists: boolean,
): LogicalNode {
  return {
    id: asNodeId(relativePath),
    title: relativePath,
    relativePath,
    folder,
    tags: [],
    type,
    exists,
  };
}

function edge(source: string, target: string, n: number): LogicalEdge {
  return {
    id: asEdgeId(`e${n}`),
    source: asNodeId(source),
    target: asNodeId(target),
    label: "",
    type: "wikilink",
    weight: 1,
    resolution: "resolved",
  };
}

function projection(
  nodes: ReadonlyArray<LogicalNode>,
  edges: ReadonlyArray<LogicalEdge>,
): GraphProjection {
  return {
    requestedMode: "global",
    effectiveMode: "global",
    focusNodeId: null,
    nodes,
    edges,
  };
}

describe("createVisualGraph — rootNodeId selection", () => {
  it("grafo vacio — rootNodeId es null y colecciones vacias", () => {
    const store = new WikiGraphStore({ nodes: [], edges: [] });
    const result = createVisualGraph(store, projection([], []));

    expect(result.rootNodeId).toBeNull();
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it("projects/nebulosa-wiki.md es root aunque tenga menos conexiones", () => {
    const preferred = node("projects/nebulosa-wiki.md", "projects", "notes", true);
    const heavy = node("notes/heavy.md", "notes", "notes", true);
    const refs = [0, 1, 2, 3, 4].map((i) =>
      node(`notes/ref${i}.md`, "notes", "notes", true),
    );
    const edges = [
      ...refs.map((r, i) => edge(r.relativePath, "notes/heavy.md", i)),
      edge("notes/ref0.md", "projects/nebulosa-wiki.md", 5),
    ];

    const store = new WikiGraphStore({ nodes: [preferred, heavy, ...refs], edges });
    const result = createVisualGraph(store, projection([preferred, heavy, ...refs], edges));

    expect(result.rootNodeId).toBe(asNodeId("projects/nebulosa-wiki.md"));
  });

  it("indexes/indice-principal.md es root cuando la primera preferencia no existe", () => {
    const second = node("indexes/indice-principal.md", "indexes", "notes", true);
    const heavy = node("notes/heavy.md", "notes", "notes", true);
    const refs = [0, 1, 2].map((i) =>
      node(`notes/ref${i}.md`, "notes", "notes", true),
    );
    const edges = [
      ...refs.map((r, i) => edge(r.relativePath, "notes/heavy.md", i)),
      edge("notes/ref0.md", "indexes/indice-principal.md", 3),
    ];

    const store = new WikiGraphStore({ nodes: [second, heavy, ...refs], edges });
    const result = createVisualGraph(store, projection([second, heavy, ...refs], edges));

    expect(result.rootNodeId).toBe(asNodeId("indexes/indice-principal.md"));
  });

  it("nodo con exists:false o type:missing nunca es root", () => {
    // preferred paths present but disqualified: one has exists:false, other has type:"missing"
    const falseExists = node("projects/nebulosa-wiki.md", "projects", "notes", false);
    const missingType = node("indexes/indice-principal.md", "indexes", "missing", true);
    const valid = node("notes/valid.md", "notes", "notes", true);

    const store = new WikiGraphStore({
      nodes: [falseExists, missingType, valid],
      edges: [],
    });
    const result = createVisualGraph(
      store,
      projection([falseExists, missingType, valid], []),
    );

    expect(result.rootNodeId).toBe(asNodeId("notes/valid.md"));
  });

  it("sin rutas preferidas, gana el nodo con mas conexiones", () => {
    const many = node("notes/many.md", "notes", "notes", true);
    const few = node("notes/few.md", "notes", "notes", true);
    const linker1 = node("notes/linker1.md", "notes", "notes", true);
    const linker2 = node("notes/linker2.md", "notes", "notes", true);
    // many: 2 in + 1 out = 3 connections; others: 1 each
    const edges = [
      edge("notes/linker1.md", "notes/many.md", 0),
      edge("notes/linker2.md", "notes/many.md", 1),
      edge("notes/many.md", "notes/few.md", 2),
    ];

    const store = new WikiGraphStore({
      nodes: [many, few, linker1, linker2],
      edges,
    });
    const result = createVisualGraph(
      store,
      projection([many, few, linker1, linker2], edges),
    );

    expect(result.rootNodeId).toBe(asNodeId("notes/many.md"));
  });

  it("empate de conexiones — projects gana a indexes, indexes gana a notes", () => {
    const projNode = node("projects/a.md", "projects", "notes", true);
    const idxNode = node("indexes/b.md", "indexes", "notes", true);
    const noteNode = node("notes/c.md", "notes", "notes", true);

    const store = new WikiGraphStore({
      nodes: [projNode, idxNode, noteNode],
      edges: [],
    });
    const result = createVisualGraph(
      store,
      projection([projNode, idxNode, noteNode], []),
    );

    expect(result.rootNodeId).toBe(asNodeId("projects/a.md"));
  });

  it("empate de conexiones sin projects — indexes gana a notes", () => {
    const idxNode = node("indexes/b.md", "indexes", "notes", true);
    const noteNode = node("notes/c.md", "notes", "notes", true);

    const store = new WikiGraphStore({
      nodes: [idxNode, noteNode],
      edges: [],
    });
    const result = createVisualGraph(
      store,
      projection([idxNode, noteNode], []),
    );

    expect(result.rootNodeId).toBe(asNodeId("indexes/b.md"));
  });

  it("proyeccion local — root se decide solo entre nodos visibles del subgrafo", () => {
    // dominant has 8 connections in the store but is not reachable from the focus node
    const dominant = node("projects/dominant.md", "projects", "projects", true);
    const focusNode = node("notes/a.md", "notes", "notes", true);
    const neighbor = node("notes/b.md", "notes", "notes", true);
    const domLinks = [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
      node(`projects/domlink${i}.md`, "projects", "projects", true),
    );

    const storeEdges = [
      ...domLinks.map((l, i) =>
        edge(l.relativePath, "projects/dominant.md", i),
      ),
      edge("notes/a.md", "notes/b.md", 100),
    ];

    const store = new WikiGraphStore({
      nodes: [dominant, focusNode, neighbor, ...domLinks],
      edges: storeEdges,
    });

    // Local projection focused on notes/a.md — dominant is unreachable from focus
    const proj = createGraphProjection(store, {
      mode: "local",
      focusNodeId: asNodeId("notes/a.md"),
      visibleNodeTypes: ["notes", "projects"],
    });

    expect(proj.effectiveMode).toBe("local");
    expect(proj.nodes.find((n) => n.id === asNodeId("projects/dominant.md"))).toBeUndefined();

    const result = createVisualGraph(store, proj);

    expect(result.rootNodeId).not.toBe(asNodeId("projects/dominant.md"));
    expect(proj.nodes.some((n) => n.id === result.rootNodeId)).toBe(true);
  });
});
