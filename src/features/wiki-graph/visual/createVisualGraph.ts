import type { GraphNodeId, LogicalNode, LogicalEdge } from "../domain";
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

export function resolveNodeKind(exists: boolean, connections: number): GraphVisualNodeKind {
  if (!exists) return "missing";
  if (connections === 0) return "orphan";
  return "existing";
}

export function resolveEdgeKind(resolution: string): GraphVisualEdgeKind {
  return resolution === "broken" ? "broken" : "wikilink";
}

export function toVisualNode(node: LogicalNode, connections: number): GraphVisualNode {
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
}

export function toVisualEdge(edge: LogicalEdge): GraphVisualEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    edgeKind: resolveEdgeKind(edge.resolution),
  };
}

export interface RootNodeCandidate {
  readonly id: GraphNodeId;
  readonly relativePath: string;
  readonly folder: string;
  readonly type: string;
  readonly exists: boolean;
}

export function getRootNodeId(
  candidates: ReadonlyArray<RootNodeCandidate>,
  connectionMap: Map<GraphNodeId, number>,
): GraphNodeId | null {
  const candidates_ = candidates.filter(
    (n) => n.exists && n.type !== "missing",
  );

  const preferred = ["projects/nebulosa-wiki.md", "indexes/indice-principal.md"];
  for (const rp of preferred) {
    const found = candidates_.find((n) => n.relativePath === rp);
    if (found !== undefined) return found.id;
  }

  if (candidates_.length === 0) return null;

  const sorted = [...candidates_].sort((a, b) => {
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

  const nodes: GraphVisualNode[] = projection.nodes.map((node) =>
    toVisualNode(node, connectionMap.get(node.id) ?? 0),
  );

  const edges: GraphVisualEdge[] = projection.edges.map(toVisualEdge);

  const rootNodeId = getRootNodeId(projection.nodes, connectionMap);

  return { rootNodeId, nodes, edges };
}
