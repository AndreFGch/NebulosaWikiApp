import type cytoscape from "cytoscape";
import type { WikiGraph, WikiEdge } from "../types";
import { getRootGraphNode } from "../model/getRootGraphNode";

export function buildGraphElements(wikiGraph: WikiGraph): {
  elements: cytoscape.ElementDefinition[];
  rootId: string | null;
  indexNodeIds: Set<string>;
  filteredEdges: WikiEdge[];
} {
  // Global graph hides index edges to avoid hub collapse.
  const indexNodeIds = new Set(
    wikiGraph.nodes
      .filter((n) => n.type === "indexes" || n.folder === "indexes")
      .map((n) => n.id)
  );

  const rootNode = getRootGraphNode(wikiGraph);
  const rootId = rootNode ? rootNode.id : null;

  const filteredEdges = wikiGraph.edges.filter(
    (e) => !indexNodeIds.has(e.source) && !indexNodeIds.has(e.target)
  );

  const elements: cytoscape.ElementDefinition[] = [
    ...wikiGraph.nodes.map((n) => ({
      data: {
        id: n.id,
        label: n.title,
        folder: n.folder,
        relativePath: n.relativePath,
        nodeType: !n.exists ? "missing" : n.isOrphan ? "orphan" : "existing",
        noteType: n.type,
        exists: n.exists,
        connections: n.outgoingCount + n.backlinkCount,
      },
    })),
    ...filteredEdges.map((e) => ({
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        edgeType: e.isBroken ? "broken" : "wikilink",
      },
    })),
  ];

  return { elements, rootId, indexNodeIds, filteredEdges };
}
