import type { GraphNodeId, GraphEdgeId } from "../domain";
import type { GraphProjectionDelta, GraphProjectionDeltaRebuildReason } from "../projection";
import type { GraphVisualNode, GraphVisualEdge, GraphVisualSnapshot } from "./graphVisualTypes";
import {
  resolveNodeKind,
  toVisualNode,
  toVisualEdge,
  getRootNodeId,
} from "./createVisualGraph";
import type { RootNodeCandidate } from "./createVisualGraph";

export type ConnectionCountResolver = (nodeId: GraphNodeId) => number;

export type VisualGraphDelta =
  | {
      readonly kind: "incremental";
      readonly addedNodes: ReadonlyArray<GraphVisualNode>;
      readonly updatedNodes: ReadonlyArray<GraphVisualNode>;
      readonly removedNodeIds: ReadonlyArray<GraphNodeId>;
      readonly addedEdges: ReadonlyArray<GraphVisualEdge>;
      readonly updatedEdges: ReadonlyArray<GraphVisualEdge>;
      readonly removedEdgeIds: ReadonlyArray<GraphEdgeId>;
      readonly affectedNodeIds: ReadonlyArray<GraphNodeId>;
      readonly nextRootNodeId: GraphNodeId | null;
    }
  | {
      readonly kind: "rebuild-required";
      readonly reason: GraphProjectionDeltaRebuildReason;
    };

export function createVisualGraphDelta(
  currentVisualGraph: GraphVisualSnapshot,
  projectionDelta: GraphProjectionDelta,
  getConnectionCount: ConnectionCountResolver,
): VisualGraphDelta {
  if (projectionDelta.kind === "rebuild-required") {
    return { kind: "rebuild-required", reason: projectionDelta.reason };
  }

  const {
    addedNodes: logAddedNodes,
    updatedNodes: logUpdatedNodes,
    removedNodeIds,
    addedEdges: logAddedEdges,
    updatedEdges: logUpdatedEdges,
    removedEdgeIds,
    affectedNodeIds,
  } = projectionDelta;

  const addedNodes = logAddedNodes.map((n) =>
    toVisualNode(n, getConnectionCount(n.id)),
  );

  // Nodes explicitly handled by the projection delta — skip in connection-update pass
  const explicitNodeIds = new Set<GraphNodeId>([
    ...logAddedNodes.map((n) => n.id),
    ...logUpdatedNodes.map((n) => n.id),
    ...removedNodeIds,
  ]);

  const currentNodeById = new Map(
    currentVisualGraph.nodes.map((n) => [n.id, n]),
  );

  // Affected visible nodes whose connection count changed but aren't in explicit entries
  const connectionUpdates: GraphVisualNode[] = [];
  for (const nodeId of affectedNodeIds) {
    if (explicitNodeIds.has(nodeId)) continue;
    const vn = currentNodeById.get(nodeId);
    if (vn === undefined) continue;
    const newConn = getConnectionCount(nodeId);
    if (newConn === vn.connections) continue;
    connectionUpdates.push({
      ...vn,
      connections: newConn,
      nodeKind: resolveNodeKind(vn.exists, newConn),
    });
  }

  const updatedNodes = [
    ...logUpdatedNodes.map((n) => toVisualNode(n, getConnectionCount(n.id))),
    ...connectionUpdates,
  ];

  // ── Compute nextRootNodeId from post-delta node set ───────────────────────
  const removedNodeIdSet = new Set(removedNodeIds);
  const updatedNodeById = new Map(logUpdatedNodes.map((n) => [n.id, n]));

  const rootCandidates: RootNodeCandidate[] = [];
  const connectionMapForRoot = new Map<GraphNodeId, number>();

  for (const vn of currentVisualGraph.nodes) {
    if (removedNodeIdSet.has(vn.id)) continue;
    const updated = updatedNodeById.get(vn.id);
    rootCandidates.push(
      updated !== undefined
        ? { id: updated.id, relativePath: updated.relativePath,
            folder: updated.folder, type: updated.type, exists: updated.exists }
        : { id: vn.id, relativePath: vn.relativePath,
            folder: vn.folder, type: vn.noteType, exists: vn.exists },
    );
    connectionMapForRoot.set(vn.id, getConnectionCount(vn.id));
  }

  for (const n of logAddedNodes) {
    rootCandidates.push({ id: n.id, relativePath: n.relativePath,
      folder: n.folder, type: n.type, exists: n.exists });
    connectionMapForRoot.set(n.id, getConnectionCount(n.id));
  }

  const nextRootNodeId = getRootNodeId(rootCandidates, connectionMapForRoot);

  return {
    kind: "incremental",
    addedNodes,
    updatedNodes,
    removedNodeIds,
    addedEdges: logAddedEdges.map(toVisualEdge),
    updatedEdges: logUpdatedEdges.map(toVisualEdge),
    removedEdgeIds,
    affectedNodeIds,
    nextRootNodeId,
  };
}
