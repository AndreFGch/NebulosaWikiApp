import { describe, expect, it } from "vitest";
import type { MarkdownFile } from "../../../domain/markdown/types";
import type { WikiGraph, WikiEdge } from "../types";
import { buildWikiGraph, sanitizeId } from "../model/buildWikiGraph";
import { WikiGraphIndex } from "./WikiGraphIndex";
import type { WikiGraphDelta } from "./WikiGraphIndex";
import {
  compareRelativePath,
  sortMarkdownFilesByRelativePath,
} from "../../../domain/markdown/relativePathOrder";

// ─── Fixture helpers ───────────────────────────────────────────────────────────

function makeNote(relativePath: string, title: string, folder: string): MarkdownFile {
  return { title, path: relativePath, relativePath, folder };
}

/**
 * Forma canónica que ignora edge.id para comparar semánticamente contra buildWikiGraph.
 * buildWikiGraph regenera IDs en cada llamada; el índice los mantiene estables.
 */
function canonicalizeSemanticGraph(g: WikiGraph) {
  const nodes = [...g.nodes]
    .sort((a, b) => (a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0))
    .map(({ id: _id, ...rest }) => rest);

  const edges = [...g.edges]
    .sort((a, b) => {
      const k = (e: WikiEdge) => `${e.source}|${e.target}|${e.label}`;
      const ka = k(a), kb = k(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    })
    .map(({ id: _id, ...rest }) => rest);

  return {
    nodes,
    edges,
    orphanPaths: g.orphanNodes.map(n => n.relativePath).sort(),
    brokenLinkCount: g.brokenLinks.length,
    tags: [...g.tags].sort(),
    folders: [...g.folders].sort(),
  };
}

/**
 * Forma canónica con IDs para comparar applyDelta(before, delta) contra index.getGraph().
 */
function canonicalizeGraphWithIds(g: WikiGraph) {
  return {
    nodes: [...g.nodes]
      .sort((a, b) => (a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0)),
    edges: [...g.edges]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    orphanPaths: g.orphanNodes.map(n => n.relativePath).sort(),
    brokenLinkCount: g.brokenLinks.length,
    tags: [...g.tags].sort(),
    folders: [...g.folders].sort(),
  };
}

/**
 * Aplica un WikiGraphDelta sobre un WikiGraph anterior y retorna el nuevo estado.
 * Permite verificar que applyDelta(before, delta) ≡ index.getGraph() después de la mutación.
 */
function applyDelta(before: WikiGraph, delta: WikiGraphDelta): WikiGraph {
  const nodeMap = new Map(before.nodes.map(n => [n.id, { ...n }]));
  const edgeMap = new Map(before.edges.map(e => [e.id, { ...e }]));

  for (const id of delta.removedNodeIds) nodeMap.delete(id);
  for (const id of delta.removedEdgeIds) edgeMap.delete(id);
  for (const n of delta.updatedNodes) nodeMap.set(n.id, { ...n });
  for (const n of delta.addedNodes)   nodeMap.set(n.id, { ...n });
  for (const e of delta.updatedEdges) edgeMap.set(e.id, { ...e });
  for (const e of delta.addedEdges)   edgeMap.set(e.id, { ...e });

  const nodes = Array.from(nodeMap.values());
  const edges = Array.from(edgeMap.values());

  const allTags    = new Set<string>();
  const allFolders = new Set<string>();
  for (const n of nodes) {
    if (!n.exists) continue;
    n.tags.forEach(t => allTags.add(t));
    allFolders.add(n.folder);
  }

  return {
    nodes,
    edges,
    orphanNodes: nodes.filter(n => n.isOrphan),
    brokenLinks: edges.filter(e => e.isBroken),
    tags: Array.from(allTags).sort(),
    folders: Array.from(allFolders).sort(),
  };
}

/**
 * Valida invariantes del contrato WikiGraphDelta.
 */
function expectValidDelta(delta: WikiGraphDelta): void {
  const addedNodeIds   = delta.addedNodes.map(n => n.id);
  const updatedNodeIds = delta.updatedNodes.map(n => n.id);
  const addedEdgeIds   = delta.addedEdges.map(e => e.id);
  const updatedEdgeIds = delta.updatedEdges.map(e => e.id);

  // IDs únicos en cada colección
  expect(new Set(addedNodeIds).size,   "addedNodes IDs duplicados").toBe(addedNodeIds.length);
  expect(new Set(updatedNodeIds).size, "updatedNodes IDs duplicados").toBe(updatedNodeIds.length);
  expect(new Set(delta.removedNodeIds).size, "removedNodeIds duplicados").toBe(delta.removedNodeIds.length);
  expect(new Set(addedEdgeIds).size,   "addedEdges IDs duplicados").toBe(addedEdgeIds.length);
  expect(new Set(updatedEdgeIds).size, "updatedEdges IDs duplicados").toBe(updatedEdgeIds.length);
  expect(new Set(delta.removedEdgeIds).size, "removedEdgeIds duplicados").toBe(delta.removedEdgeIds.length);

  // Nodo no puede estar en added Y updated
  const addedNodeSet  = new Set(addedNodeIds);
  const removedNodeSet = new Set(delta.removedNodeIds);
  const removedEdgeSet = new Set(delta.removedEdgeIds);

  for (const id of updatedNodeIds) {
    expect(addedNodeSet.has(id), `nodo ${id} en added y updated`).toBe(false);
    expect(removedNodeSet.has(id), `nodo ${id} en removed y updated`).toBe(false);
  }

  // Arista removida no aparece en updated
  for (const id of updatedEdgeIds) {
    expect(removedEdgeSet.has(id), `arista ${id} en removed y updated`).toBe(false);
  }

  // affectedNodeIds sin duplicados
  expect(new Set(delta.affectedNodeIds).size, "affectedNodeIds duplicados")
    .toBe(delta.affectedNodeIds.length);

  // Endpoints de aristas añadidas y actualizadas están en affectedNodeIds
  const affectedSet = new Set(delta.affectedNodeIds);
  for (const e of delta.addedEdges) {
    expect(affectedSet.has(e.source), `source ${e.source} no en affectedNodeIds`).toBe(true);
    expect(affectedSet.has(e.target), `target ${e.target} no en affectedNodeIds`).toBe(true);
  }
  for (const e of delta.updatedEdges) {
    expect(affectedSet.has(e.source), `source ${e.source} no en affectedNodeIds`).toBe(true);
    expect(affectedSet.has(e.target), `target ${e.target} no en affectedNodeIds`).toBe(true);
  }
}

// ─── Vault helpers ─────────────────────────────────────────────────────────────

/** Construye un contentMap a partir de pares [relativePath, contenido]. */
function makeContentMap(entries: [string, string][]): Map<string, string> {
  return new Map(entries);
}

// ─── Caso 1: Paridad de hydrate ────────────────────────────────────────────────

describe("WikiGraphIndex — paridad de hydrate con buildWikiGraph", () => {
  // Vault:
  //   notes/alpha.md → title="Alpha", tags=[alpha], links a beta y a ghost (roto)
  //                    incluye self-link [[Alpha]] que debe ignorarse
  //   notes/beta.md  → title="Beta", frontmatter title="Beta Alias", sin links
  //
  // Notas entregadas en orden de relativePath para garantizar paridad.

  const alpha = makeNote("notes/alpha.md", "Alpha", "notes");
  const beta  = makeNote("notes/beta.md",  "Beta",  "notes");
  const notes = [alpha, beta]; // ya ordenadas

  const contentMap = makeContentMap([
    ["notes/alpha.md", "---\ntags: [alpha]\n---\n[[Beta]] [[Alpha]] [[Ghost]]"],
    ["notes/beta.md",  "---\ntitle: Beta Alias\n---\n"],
  ]);

  it("getGraph() es semánticamente idéntico a buildWikiGraph()", () => {
    const index = new WikiGraphIndex();
    index.hydrate(notes, contentMap);

    expect(canonicalizeSemanticGraph(index.getGraph()))
      .toEqual(canonicalizeSemanticGraph(buildWikiGraph(notes, contentMap)));
  });

  it("self-link [[Alpha]] en alpha.md no produce arista", () => {
    const index = new WikiGraphIndex();
    index.hydrate(notes, contentMap);
    const g = index.getGraph();
    const selfEdge = g.edges.find(e =>
      e.source === sanitizeId("notes/alpha.md") &&
      e.target === sanitizeId("notes/alpha.md"),
    );
    expect(selfEdge).toBeUndefined();
  });

  it("enlace roto [[Ghost]] produce nodo faltante y brokenLink", () => {
    const index = new WikiGraphIndex();
    index.hydrate(notes, contentMap);
    const g = index.getGraph();

    const missingNode = g.nodes.find(n => !n.exists);
    expect(missingNode).toBeDefined();
    expect(missingNode?.title).toBe("Ghost");
    expect(g.brokenLinks).toHaveLength(1);
  });

  it("tags y folders coinciden con buildWikiGraph", () => {
    const index = new WikiGraphIndex();
    index.hydrate(notes, contentMap);
    const ref = buildWikiGraph(notes, contentMap);

    expect([...index.getGraph().tags].sort()).toEqual([...ref.tags].sort());
    expect([...index.getGraph().folders].sort()).toEqual([...ref.folders].sort());
  });

  it("delta de hydrate es válido", () => {
    const index = new WikiGraphIndex();
    const delta = index.hydrate(notes, contentMap);
    expectValidDelta(delta);
  });
});

// ─── Caso 2: Nueva nota huérfana ──────────────────────────────────────────────

describe("WikiGraphIndex — nueva nota huérfana", () => {
  const existing = makeNote("notes/existing.md", "Existing", "notes");
  const orphan   = makeNote("notes/orphan.md",   "Orphan",   "notes");

  const baseContent = makeContentMap([["notes/existing.md", ""]]);

  it("upsert de nota huérfana emite exactamente un nodo añadido y cero aristas", () => {
    const index = new WikiGraphIndex();
    index.hydrate([existing], baseContent);

    const delta = index.upsertNote(orphan, "");
    expectValidDelta(delta);

    expect(delta.addedNodes).toHaveLength(1);
    expect(delta.addedNodes[0].relativePath).toBe("notes/orphan.md");
    expect(delta.addedEdges).toHaveLength(0);
    expect(delta.removedEdgeIds).toHaveLength(0);
    expect(delta.removedNodeIds).toHaveLength(0);
  });

  it("applyDelta(before, delta) coincide con getGraph() después", () => {
    const index = new WikiGraphIndex();
    index.hydrate([existing], baseContent);
    const before = index.getGraph();

    const delta = index.upsertNote(orphan, "");
    const after = index.getGraph();

    expect(canonicalizeGraphWithIds(applyDelta(before, delta)))
      .toEqual(canonicalizeGraphWithIds(after));
  });

  it("paridad semántica con buildWikiGraph después del upsert", () => {
    const index = new WikiGraphIndex();
    index.hydrate([existing], baseContent);
    index.upsertNote(orphan, "");

    const allNotes = [existing, orphan].sort((a, b) =>
      a.relativePath < b.relativePath ? -1 : 1,
    );
    const allContent = makeContentMap([["notes/existing.md", ""], ["notes/orphan.md", ""]]);

    expect(canonicalizeSemanticGraph(index.getGraph()))
      .toEqual(canonicalizeSemanticGraph(buildWikiGraph(allNotes, allContent)));
  });
});

// ─── Caso 3: Enlace roto que se resuelve ──────────────────────────────────────

describe("WikiGraphIndex — enlace roto que se resuelve al aparecer la nota destino", () => {
  const linker = makeNote("notes/linker.md", "Linker", "notes");
  const target = makeNote("notes/target.md", "Target", "notes");

  const linkerContent = "[[Target]]";
  const baseContent   = makeContentMap([["notes/linker.md", linkerContent]]);

  it("antes del upsert: arista rota existe, nodo faltante existe", () => {
    const index = new WikiGraphIndex();
    index.hydrate([linker], baseContent);
    const g = index.getGraph();

    expect(g.brokenLinks).toHaveLength(1);
    expect(g.nodes.some(n => !n.exists && n.title === "Target")).toBe(true);
  });

  it("upsert de target.md elimina nodo faltante y resuelve arista", () => {
    const index = new WikiGraphIndex();
    index.hydrate([linker], baseContent);
    const before = index.getGraph();

    const delta = index.upsertNote(target, "");
    expectValidDelta(delta);

    // Nodo real añadido
    expect(delta.addedNodes.some(n => n.relativePath === "notes/target.md" && n.exists)).toBe(true);
    // Nodo faltante eliminado
    expect(delta.removedNodeIds.length).toBeGreaterThan(0);
    // Arista rota eliminada
    expect(delta.removedEdgeIds).toHaveLength(1);
    // Arista resuelta añadida con ID nuevo
    expect(delta.addedEdges).toHaveLength(1);
    expect(delta.addedEdges[0].isBroken).toBe(false);
    expect(delta.addedEdges[0].id).not.toBe(before.edges[0]?.id);

    const after = index.getGraph();
    expect(after.brokenLinks).toHaveLength(0);
  });

  it("applyDelta(before, delta) coincide con getGraph() después", () => {
    const index = new WikiGraphIndex();
    index.hydrate([linker], baseContent);
    const before = index.getGraph();

    const delta = index.upsertNote(target, "");
    const after = index.getGraph();

    expect(canonicalizeGraphWithIds(applyDelta(before, delta)))
      .toEqual(canonicalizeGraphWithIds(after));
  });

  it("paridad semántica con buildWikiGraph después del upsert", () => {
    const index = new WikiGraphIndex();
    index.hydrate([linker], baseContent);
    index.upsertNote(target, "");

    const allNotes   = [linker, target].sort((a, b) => a.relativePath < b.relativePath ? -1 : 1);
    const allContent = makeContentMap([
      ["notes/linker.md", linkerContent],
      ["notes/target.md", ""],
    ]);

    expect(canonicalizeSemanticGraph(index.getGraph()))
      .toEqual(canonicalizeSemanticGraph(buildWikiGraph(allNotes, allContent)));
  });
});

// ─── Caso 4: Fallback de alias ─────────────────────────────────────────────────

describe("WikiGraphIndex — fallback de alias al eliminar el ganador", () => {
  // Vault:
  //   notes/linker.md  → [[Arquitectura]]
  //   notes/m-arq.md   → title="Arquitectura" (ganador inicial: m < n en path)
  //   notes/n-arq.md   → title="Arquitectura" (candidato de fallback)
  //
  // buildWikiGraph con notas en orden de relativePath confirma que m-arq gana.

  const linker    = makeNote("notes/linker.md", "Linker",       "notes");
  const primary   = makeNote("notes/m-arq.md",  "Arquitectura", "notes");
  const secondary = makeNote("notes/n-arq.md",  "Arquitectura", "notes");

  const notes = [linker, primary, secondary]; // orden relativePath
  const contentMap = makeContentMap([
    ["notes/linker.md", "[[Arquitectura]]"],
    ["notes/m-arq.md",  ""],
    ["notes/n-arq.md",  ""],
  ]);

  it("determinar ganador: buildWikiGraph elige m-arq.md", () => {
    const ref = buildWikiGraph(notes, contentMap);
    const edge = ref.edges.find(e => e.source === sanitizeId("notes/linker.md"));
    expect(edge?.target).toBe(sanitizeId("notes/m-arq.md"));
  });

  it("hydrate elige el mismo ganador que buildWikiGraph", () => {
    const index = new WikiGraphIndex();
    index.hydrate(notes, contentMap);
    const g = index.getGraph();
    const edge = g.edges.find(e => e.source === sanitizeId("notes/linker.md"));
    expect(edge?.target).toBe(sanitizeId("notes/m-arq.md"));
  });

  it("removeNote(m-arq.md) redirige la arista a n-arq.md sin quedar rota", () => {
    const index = new WikiGraphIndex();
    index.hydrate(notes, contentMap);
    const before = index.getGraph();

    const delta = index.removeNote("notes/m-arq.md");
    expectValidDelta(delta);

    const after = index.getGraph();
    expect(after.brokenLinks).toHaveLength(0);
    const edge = after.edges.find(e => e.source === sanitizeId("notes/linker.md"));
    expect(edge?.target).toBe(sanitizeId("notes/n-arq.md"));

    expect(canonicalizeGraphWithIds(applyDelta(before, delta)))
      .toEqual(canonicalizeGraphWithIds(after));
  });

  it("paridad semántica con buildWikiGraph después de removeNote", () => {
    const index = new WikiGraphIndex();
    index.hydrate(notes, contentMap);
    index.removeNote("notes/m-arq.md");

    const remaining = [linker, secondary].sort((a, b) => a.relativePath < b.relativePath ? -1 : 1);
    const remainContent = makeContentMap([
      ["notes/linker.md", "[[Arquitectura]]"],
      ["notes/n-arq.md",  ""],
    ]);

    expect(canonicalizeSemanticGraph(index.getGraph()))
      .toEqual(canonicalizeSemanticGraph(buildWikiGraph(remaining, remainContent)));
  });
});

// ─── Caso 5: Recuperación tras deduplicación ──────────────────────────────────

describe("WikiGraphIndex — recuperación de arista deduplicada al bifurcar destino", () => {
  // Vault inicial:
  //   notes/bar.md  → title="Foo", filename="bar" → aliases: "foo" (title), "bar" (filename)
  //   notes/src.md  → [[foo]] y [[bar]] → ambos a bar.md → dedup → 1 arista (label "foo")
  //
  // Tras upsert de notes/a-foo.md (title="Foo", path < "notes/bar.md"):
  //   alias "foo" → a-foo.md (nuevo ganador)
  //   alias "bar" → bar.md  (sin cambio)
  //   Resultado: 2 aristas correctas desde src.md

  const barMd  = makeNote("notes/bar.md",   "Foo", "notes");
  const srcMd  = makeNote("notes/src.md",   "Src", "notes");
  const aFooMd = makeNote("notes/a-foo.md", "Foo", "notes");

  const initialNotes   = [barMd, srcMd].sort((a, b) => a.relativePath < b.relativePath ? -1 : 1);
  const initialContent = makeContentMap([
    ["notes/bar.md", ""],
    ["notes/src.md", "[[foo]] and [[bar]]"],
  ]);

  it("estado inicial: una sola arista hacia bar.md (dedup)", () => {
    const index = new WikiGraphIndex();
    index.hydrate(initialNotes, initialContent);
    const g = index.getGraph();

    const outgoing = g.edges.filter(e => e.source === sanitizeId("notes/src.md"));
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0].target).toBe(sanitizeId("notes/bar.md"));
    expect(outgoing[0].label).toBe("foo");
  });

  it("tras upsert a-foo.md: dos aristas correctas", () => {
    const index = new WikiGraphIndex();
    index.hydrate(initialNotes, initialContent);
    const before = index.getGraph();

    const delta = index.upsertNote(aFooMd, "");
    expectValidDelta(delta);

    const after = index.getGraph();
    const outgoing = after.edges
      .filter(e => e.source === sanitizeId("notes/src.md"))
      .sort((a, b) => a.target < b.target ? -1 : 1);

    expect(outgoing).toHaveLength(2);
    const toAFoo = outgoing.find(e => e.target === sanitizeId("notes/a-foo.md"));
    const toBar  = outgoing.find(e => e.target === sanitizeId("notes/bar.md"));
    expect(toAFoo?.label).toBe("foo");
    expect(toBar?.label).toBe("bar");

    expect(canonicalizeGraphWithIds(applyDelta(before, delta)))
      .toEqual(canonicalizeGraphWithIds(after));
  });

  it("paridad semántica con buildWikiGraph después del upsert", () => {
    const index = new WikiGraphIndex();
    index.hydrate(initialNotes, initialContent);
    index.upsertNote(aFooMd, "");

    const allNotes = [aFooMd, barMd, srcMd].sort((a, b) => a.relativePath < b.relativePath ? -1 : 1);
    const allContent = makeContentMap([
      ["notes/a-foo.md", ""],
      ["notes/bar.md",   ""],
      ["notes/src.md",   "[[foo]] and [[bar]]"],
    ]);

    expect(canonicalizeSemanticGraph(index.getGraph()))
      .toEqual(canonicalizeSemanticGraph(buildWikiGraph(allNotes, allContent)));
  });
});

// ─── Caso 6: Cambio de etiqueta sin cambio de destino ─────────────────────────

describe("WikiGraphIndex — cambio de capitalización sin cambio de destino", () => {
  const target = makeNote("notes/target.md", "Arquitectura", "notes");
  const src    = makeNote("notes/src.md",    "Src",          "notes");
  const notes  = [src, target].sort((a, b) => a.relativePath < b.relativePath ? -1 : 1);

  it("cambiar [[Arquitectura]] → [[arquitectura]] emite updatedEdge con mismo ID", () => {
    const index = new WikiGraphIndex();
    index.hydrate(notes, makeContentMap([
      ["notes/src.md",    "[[Arquitectura]]"],
      ["notes/target.md", ""],
    ]));

    const originalEdgeId = index.getGraph().edges
      .find(e => e.source === sanitizeId("notes/src.md"))?.id;
    expect(originalEdgeId).toBeDefined();

    const before = index.getGraph();
    const delta  = index.upsertNote(src, "[[arquitectura]]");
    expectValidDelta(delta);

    // Debe ser updatedEdge, no remove+add
    expect(delta.removedEdgeIds).toHaveLength(0);
    expect(delta.addedEdges).toHaveLength(0);
    expect(delta.updatedEdges).toHaveLength(1);
    expect(delta.updatedEdges[0].id).toBe(originalEdgeId);
    expect(delta.updatedEdges[0].label).toBe("arquitectura");

    expect(canonicalizeGraphWithIds(applyDelta(before, delta)))
      .toEqual(canonicalizeGraphWithIds(index.getGraph()));
  });

  it("paridad semántica con buildWikiGraph después del cambio de label", () => {
    const index = new WikiGraphIndex();
    index.hydrate(notes, makeContentMap([
      ["notes/src.md",    "[[Arquitectura]]"],
      ["notes/target.md", ""],
    ]));
    index.upsertNote(src, "[[arquitectura]]");

    const allContent = makeContentMap([
      ["notes/src.md",    "[[arquitectura]]"],
      ["notes/target.md", ""],
    ]);

    expect(canonicalizeSemanticGraph(index.getGraph()))
      .toEqual(canonicalizeSemanticGraph(buildWikiGraph(notes, allContent)));
  });
});

// ─── Caso 7: Nodo faltante compartido ─────────────────────────────────────────

describe("WikiGraphIndex — nodo faltante compartido entre múltiples fuentes", () => {
  const noteA = makeNote("notes/a.md", "A", "notes");
  const noteB = makeNote("notes/b.md", "B", "notes");

  it("agregar segunda fuente: backlinkCount del nodo faltante sube a 2", () => {
    const index = new WikiGraphIndex();
    index.hydrate([noteA], makeContentMap([["notes/a.md", "[[Ghost]]"]]));

    const before = index.getGraph();
    expect(before.brokenLinks).toHaveLength(1);
    const missingBefore = before.nodes.find(n => !n.exists);
    expect(missingBefore?.backlinkCount).toBe(1);

    const delta = index.upsertNote(noteB, "[[Ghost]]");
    expectValidDelta(delta);

    const after = index.getGraph();
    const missingAfter = after.nodes.find(n => !n.exists);
    expect(missingAfter?.backlinkCount).toBe(2);

    // El nodo faltante debe estar en updatedNodes
    const updatedMissing = delta.updatedNodes.find(n => !n.exists);
    expect(updatedMissing).toBeDefined();
    expect(updatedMissing?.backlinkCount).toBe(2);

    expect(canonicalizeGraphWithIds(applyDelta(before, delta)))
      .toEqual(canonicalizeGraphWithIds(after));
  });

  it("eliminar segunda fuente: backlinkCount vuelve a 1", () => {
    const index = new WikiGraphIndex();
    index.hydrate([noteA], makeContentMap([["notes/a.md", "[[Ghost]]"]]));
    index.upsertNote(noteB, "[[Ghost]]");

    const before = index.getGraph();
    const delta  = index.removeNote("notes/b.md");
    expectValidDelta(delta);

    const after = index.getGraph();
    const missingAfter = after.nodes.find(n => !n.exists);
    expect(missingAfter?.backlinkCount).toBe(1);

    expect(canonicalizeGraphWithIds(applyDelta(before, delta)))
      .toEqual(canonicalizeGraphWithIds(after));
  });

  it("eliminar última fuente: nodo faltante desaparece del grafo", () => {
    const index = new WikiGraphIndex();
    index.hydrate([noteA], makeContentMap([["notes/a.md", "[[Ghost]]"]]));

    const before = index.getGraph();
    const delta  = index.removeNote("notes/a.md");
    expectValidDelta(delta);

    const after = index.getGraph();
    expect(after.nodes.some(n => !n.exists)).toBe(false);
    expect(after.brokenLinks).toHaveLength(0);

    // El nodo faltante debe aparecer en removedNodeIds
    const missingId = sanitizeId("missing_ghost");
    expect(delta.removedNodeIds).toContain(missingId);

    expect(canonicalizeGraphWithIds(applyDelta(before, delta)))
      .toEqual(canonicalizeGraphWithIds(after));
  });
});

// ─── Caso 8: Endpoints de aristas eliminadas en affectedNodeIds ────────────────

describe("WikiGraphIndex — affectedNodeIds incluye endpoints de aristas eliminadas", () => {
  const noteA = makeNote("notes/a.md", "A", "notes");
  const noteB = makeNote("notes/b.md", "B", "notes");

  it("eliminar wikilink: source y target reales en affectedNodeIds", () => {
    const index = new WikiGraphIndex();
    index.hydrate(
      [noteA, noteB],
      makeContentMap([["notes/a.md", "[[B]]"], ["notes/b.md", ""]]),
    );

    // Quitar el link de a.md
    const delta = index.upsertNote(noteA, "");
    expectValidDelta(delta);

    expect(delta.removedEdgeIds).toHaveLength(1);

    const affectedSet = new Set(delta.affectedNodeIds);
    expect(affectedSet.has(sanitizeId("notes/a.md"))).toBe(true);
    expect(affectedSet.has(sanitizeId("notes/b.md"))).toBe(true);
  });

  it("eliminar nota con links salientes: endpoints en affectedNodeIds", () => {
    const index = new WikiGraphIndex();
    index.hydrate(
      [noteA, noteB],
      makeContentMap([["notes/a.md", "[[B]]"], ["notes/b.md", ""]]),
    );

    const delta = index.removeNote("notes/a.md");
    expectValidDelta(delta);

    expect(delta.removedEdgeIds).toHaveLength(1);

    const affectedSet = new Set(delta.affectedNodeIds);
    expect(affectedSet.has(sanitizeId("notes/a.md"))).toBe(true);
    expect(affectedSet.has(sanitizeId("notes/b.md"))).toBe(true);
  });

  it("eliminar arista rota: source y target faltante en affectedNodeIds", () => {
    const index = new WikiGraphIndex();
    index.hydrate(
      [noteA],
      makeContentMap([["notes/a.md", "[[Ghost]]"]]),
    );

    // Quitar el link roto
    const delta = index.upsertNote(noteA, "");
    expectValidDelta(delta);

    const affectedSet = new Set(delta.affectedNodeIds);
    expect(affectedSet.has(sanitizeId("notes/a.md"))).toBe(true);
    expect(affectedSet.has(sanitizeId("missing_ghost"))).toBe(true);
  });
});

// ─── Caso 9: Compatibilidad UTF-8 fuera del BMP ───────────────────────────────
//
// U+E000 (BMP área privada) → UTF-8: 0xEE 0x80 0x80
// U+10000 𐀀 (Linear B)     → UTF-8: 0xF0 0x90 0x80 0x80
//
// Rust String::cmp compara bytes UTF-8: 0xEE < 0xF0 → U+E000 primero.
// JS nativo (</>)  compara code units UTF-16: U+E000 (0xE000) > surrogate D800
// → inversión de orden. compareRelativePath corrige esto.

describe("relativePathOrder — compatibilidad UTF-8 fuera del BMP", () => {
  const pBmp  = "/shared.md";  // U+E000 → byte 0xEE en UTF-8
  const pSupp = "𐀀/shared.md";      // U+10000 → byte 0xF0 en UTF-8

  it("compareRelativePath: BMP U+E000 ordena antes que U+10000 (byte UTF-8)", () => {
    expect(compareRelativePath(pBmp, pSupp)).toBeLessThan(0);
  });

  it("JS nativo (<) daría el orden inverso — justifica el helper", () => {
    // Confirma la divergencia que el helper corrige.
    const jsOrder = pBmp < pSupp ? -1 : pBmp > pSupp ? 1 : 0;
    expect(jsOrder).toBeGreaterThan(0);
  });

  it("sortMarkdownFilesByRelativePath no muta el array original", () => {
    const a  = makeNote("z/a.md", "A", "notes");
    const b  = makeNote("a/b.md", "B", "notes");
    const original = [a, b];
    const snapshot = [...original];
    sortMarkdownFilesByRelativePath(original);
    expect(original).toEqual(snapshot);
  });

  it("alias con rutas fuera del BMP: Index y buildWikiGraph eligen el mismo ganador", () => {
    // Dos notas con el mismo alias "SharedAlias".
    // En UTF-8: pBmp (0xEE) < pSupp (0xF0) → pBmp debe ganar.
    // En JS nativo pBmp > pSupp → sin el helper los sistemas divergirían.
    const noteSupp = makeNote(pSupp, "SharedAlias", "");
    const noteBmp  = makeNote(pBmp,  "SharedAlias", "");
    const linker   = makeNote("notes/linker.md", "Linker", "notes");

    // sortMarkdownFilesByRelativePath ordena por UTF-8: pBmp antes que pSupp
    const sorted = sortMarkdownFilesByRelativePath([noteSupp, noteBmp, linker]);
    const iBmp  = sorted.findIndex(n => n.relativePath === pBmp);
    const iSupp = sorted.findIndex(n => n.relativePath === pSupp);
    expect(iBmp).toBeLessThan(iSupp); // UTF-8: pBmp (0xEE) < pSupp (0xF0)

    const contentMap = makeContentMap([
      [pBmp,               ""],
      [pSupp,              ""],
      ["notes/linker.md",  "[[SharedAlias]]"],
    ]);

    // buildWikiGraph con notas en orden UTF-8: primer candidato = pBmp = ganador
    const refGraph = buildWikiGraph(sorted, contentMap);
    const refEdge  = refGraph.edges.find(
      e => e.source === sanitizeId("notes/linker.md"),
    );
    expect(refEdge?.target).toBe(sanitizeId(pBmp));

    // WikiGraphIndex usa compareRelativePath → mismo ganador que buildWikiGraph
    const index = new WikiGraphIndex();
    index.hydrate(sorted, contentMap);
    const idxEdge = index.getGraph().edges.find(
      e => e.source === sanitizeId("notes/linker.md"),
    );
    expect(idxEdge?.target).toBe(sanitizeId(pBmp));

    expect(idxEdge?.target).toBe(refEdge?.target);
  });
});
