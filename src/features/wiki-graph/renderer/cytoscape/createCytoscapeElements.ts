import type cytoscape from "cytoscape";
import type { GraphVisualSnapshot } from "../../visual";
import type { CytoscapeGraphElements } from "./cytoscapeElementTypes";

export function createCytoscapeElements(
  visualGraph: GraphVisualSnapshot,
): CytoscapeGraphElements {
  const nodeElements: cytoscape.ElementDefinition[] = visualGraph.nodes.map(
    (node) => ({
      group: "nodes" as const,
      data: {
        id: node.id,
        label: node.label,
        folder: node.folder,
        relativePath: node.relativePath,
        nodeType: node.nodeKind,
        noteType: node.noteType,
        exists: node.exists,
        connections: node.connections,
      },
    }),
  );

  const edgeElements: cytoscape.ElementDefinition[] = visualGraph.edges.map(
    (edge) => ({
      group: "edges" as const,
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        edgeType: edge.edgeKind,
      },
    }),
  );

  return {
    rootNodeId: visualGraph.rootNodeId,
    elements: [...nodeElements, ...edgeElements],
  };
}
