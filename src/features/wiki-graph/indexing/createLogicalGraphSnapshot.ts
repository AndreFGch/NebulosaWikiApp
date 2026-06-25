import type { WikiGraph } from "../types";
import { asNodeId, asEdgeId } from "../domain/graphTypes";
import type { LogicalGraphSnapshot } from "../domain/graphTypes";

/**
 * Adaptador temporal: convierte el modelo legado WikiGraph en LogicalGraphSnapshot.
 * No muta la entrada. No parsea Markdown. No resuelve wikilinks.
 * buildWikiGraph.ts sigue siendo la fuente de verdad durante esta fase.
 */
export function createLogicalGraphSnapshot(wikiGraph: WikiGraph): LogicalGraphSnapshot {
  const nodes = wikiGraph.nodes.map((node) => ({
    id: asNodeId(node.id),
    title: node.title,
    relativePath: node.relativePath,
    folder: node.folder,
    tags: [...node.tags],
    type: node.type,
    exists: node.exists,
  }));

  const edges = wikiGraph.edges.map((edge) => ({
    id: asEdgeId(edge.id),
    source: asNodeId(edge.source),
    target: asNodeId(edge.target),
    label: edge.label,
    type: edge.type,
    weight: edge.weight,
    resolution: edge.isBroken ? ("broken" as const) : ("resolved" as const),
  }));

  return { nodes, edges };
}
