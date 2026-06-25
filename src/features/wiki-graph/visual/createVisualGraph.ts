import type { GraphNodeId, LogicalNode } from "../domain";
import { WikiGraphStore } from "../domain";
import type { GraphProjection } from "../projection";
import type {
  GraphVisualNode,
  GraphVisualEdge,
  GraphVisualSnapshot,
  GraphVisualNodeKind,
  GraphVisualEdgeKind,
} from "./graphVisualTypes";

const FOLDER_PRIORITY: Record<string, number> = {
  projects: 0,
  indexes: 1,
  notes: 2,
};

function resolveNodeKind(exists: boolean, connections: number): GraphVisualNodeKind {
  if (!exists) return "missing";
  if (connections === 0) return "orphan";
  return "existing";
}

function resolveEdgeKind(resolution: string): GraphVisualEdgeKind {
  return resolution === "broken" ? "broken" : "wikilink";
}

function getRootNodeId(
  projectionNodes: ReadonlyArray<LogicalNode>,
  connectionMap: Map<GraphNodeId, number>,
): GraphNodeId | null {
  const candidates = projectionNodes.filter(
    (n) => n.exists && n.type !== "missing",
  );

  const preferred = ["projects/nebulosa-wiki.md", "indexes/indice-principal.md"];
  for (const rp of preferred) {
    const found = candidates.find((n) => n.relativePath === rp);
    if (found !== undefined) return found.id;
  }

  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => {
    const connDiff = (connectionMap.get(b.id) ?? 0) - (connectionMap.get(a.id) ?? 0);
    if (connDiff !== 0) return connDiff;
    const pa = FOLDER_PRIORITY[a.folder.split("/")[0]] ?? 99;
    const pb = FOLDER_PRIORITY[b.folder.split("/")[0]] ?? 99;
    return pa - pb;
  });

  return sorted[0]?.id ?? null;
}

export function createVisualGraph(
  store: WikiGraphStore,
  projection: GraphProjection,
): GraphVisualSnapshot {
  // Pre-compute connections from full store topology for each projected node
  const connectionMap = new Map<GraphNodeId, number>();
  for (const node of projection.nodes) {
    const count =
      store.getOutgoingEdges(node.id).length +
      store.getIncomingEdges(node.id).length;
    connectionMap.set(node.id, count);
  }

  const nodes: GraphVisualNode[] = projection.nodes.map((node) => {
    const connections = connectionMap.get(node.id) ?? 0;
    return {
      id: node.id,
      label: node.title,
      folder: node.folder,
      relativePath: node.relativePath,
      noteType: node.type,
      nodeKind: resolveNodeKind(node.exists, connections),
      exists: node.exists,
      connections,
    };
  });

  const edges: GraphVisualEdge[] = projection.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    edgeKind: resolveEdgeKind(edge.resolution),
  }));

  const rootNodeId = getRootNodeId(projection.nodes, connectionMap);

  return { rootNodeId, nodes, edges };
}
