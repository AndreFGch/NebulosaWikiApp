import type cytoscape from "cytoscape";
import type { GraphVisualNode, GraphVisualEdge, GraphVisualSnapshot } from "../../visual";
import type { CytoscapeGraphElements } from "./cytoscapeElementTypes";

export function visualNodeToElement(node: GraphVisualNode): cytoscape.ElementDefinition {
  return {
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
  };
}

export function visualEdgeToElement(edge: GraphVisualEdge): cytoscape.ElementDefinition {
  return {
    group: "edges" as const,
    data: {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      edgeType: edge.edgeKind,
    },
  };
}

export function createCytoscapeElements(
  visualGraph: GraphVisualSnapshot,
): CytoscapeGraphElements {
  return {
    rootNodeId: visualGraph.rootNodeId,
    elements: [
      ...visualGraph.nodes.map(visualNodeToElement),
      ...visualGraph.edges.map(visualEdgeToElement),
    ],
  };
}
