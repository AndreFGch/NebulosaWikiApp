import type { GraphNodeId, LogicalNode, LogicalEdge } from "../domain";
import { WikiGraphStore } from "../domain";
import type { GraphProjectionOptions, GraphProjection } from "./graphProjectionTypes";

function isIndexNode(node: LogicalNode): boolean {
  return node.type === "indexes" || node.folder === "indexes";
}

function edgeTouchesIndex(edge: LogicalEdge, store: WikiGraphStore): boolean {
  const src = store.getNode(edge.source);
  const tgt = store.getNode(edge.target);
  if (src !== undefined && isIndexNode(src)) return true;
  if (tgt !== undefined && isIndexNode(tgt)) return true;
  return false;
}

function buildGlobal(
  store: WikiGraphStore,
  options: GraphProjectionOptions,
): { nodes: ReadonlyArray<LogicalNode>; edges: ReadonlyArray<LogicalEdge> } {
  const typeSet = new Set(options.visibleNodeTypes);

  const nodes = store.getNodes().filter((n) => typeSet.has(n.type));
  const nodeIdSet = new Set(nodes.map((n) => n.id));

  const edges = store.getEdges().filter((e) => {
    if (edgeTouchesIndex(e, store)) return false;
    if (!nodeIdSet.has(e.source)) return false;
    if (!nodeIdSet.has(e.target)) return false;
    return true;
  });

  return { nodes, edges };
}

export function createGraphProjection(
  store: WikiGraphStore,
  options: GraphProjectionOptions,
): GraphProjection {
  const { mode, focusNodeId, visibleNodeTypes } = options;
  const typeSet = new Set(visibleNodeTypes);

  if (mode === "global") {
    const { nodes, edges } = buildGlobal(store, options);
    return {
      requestedMode: "global",
      effectiveMode: "global",
      focusNodeId,
      nodes,
      edges,
    };
  }

  // Local mode — fallback to global when no valid focus
  const focusNode = focusNodeId !== null ? store.getNode(focusNodeId) : undefined;

  if (focusNode === undefined) {
    const { nodes, edges } = buildGlobal(store, options);
    return {
      requestedMode: "local",
      effectiveMode: "global",
      focusNodeId,
      nodes,
      edges,
    };
  }

  // Collect direct edges from/to focus that don't touch indexes — deduplicate by id
  const directEdgesById = new Map<LogicalEdge["id"], LogicalEdge>();
  for (const e of store.getOutgoingEdges(focusNode.id)) {
    if (!edgeTouchesIndex(e, store)) directEdgesById.set(e.id, e);
  }
  for (const e of store.getIncomingEdges(focusNode.id)) {
    if (!edgeTouchesIndex(e, store) && !directEdgesById.has(e.id)) {
      directEdgesById.set(e.id, e);
    }
  }
  const directEdges = Array.from(directEdgesById.values());

  // Candidate node ids: focus + both endpoints of each direct edge
  const candidateIds = new Set<GraphNodeId>();
  candidateIds.add(focusNode.id);
  for (const e of directEdges) {
    candidateIds.add(e.source);
    candidateIds.add(e.target);
  }

  // Resolve candidates: include if type is active (works for placeholders too)
  const visibleNodes: LogicalNode[] = [];
  for (const nodeId of candidateIds) {
    const node = store.getNode(nodeId);
    if (node !== undefined && typeSet.has(node.type)) {
      visibleNodes.push(node);
    }
  }
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

  // Keep only edges whose both endpoints are visible
  const visibleEdges = directEdges.filter(
    (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
  );

  return {
    requestedMode: "local",
    effectiveMode: "local",
    focusNodeId,
    nodes: visibleNodes,
    edges: visibleEdges,
  };
}
