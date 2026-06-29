import type { WikiGraphDelta } from "../indexing";
import type { WikiNode, WikiEdge } from "../types";
import type { LogicalNode, LogicalEdge, GraphNodeId, GraphEdgeId } from "../domain";
import { asNodeId, asEdgeId } from "../domain";
import type { GraphProjection, GraphProjectionOptions } from "./graphProjectionTypes";
import {
  isProjectionIndexNode,
  isProjectionNodeVisible,
  isProjectionEdgeVisible,
} from "./createGraphProjection";

// ─── Public types ─────────────────────────────────────────────────────────────

export type GraphProjectionDeltaRebuildReason =
  | "local-projection"
  | "projection-context-changed"
  | "unsupported-visibility-transition";

export type GraphProjectionDelta =
  | {
      readonly kind: "incremental";
      readonly addedNodes: ReadonlyArray<LogicalNode>;
      readonly updatedNodes: ReadonlyArray<LogicalNode>;
      readonly removedNodeIds: ReadonlyArray<GraphNodeId>;
      readonly addedEdges: ReadonlyArray<LogicalEdge>;
      readonly updatedEdges: ReadonlyArray<LogicalEdge>;
      readonly removedEdgeIds: ReadonlyArray<GraphEdgeId>;
      readonly affectedNodeIds: ReadonlyArray<GraphNodeId>;
    }
  | {
      readonly kind: "rebuild-required";
      readonly reason: GraphProjectionDeltaRebuildReason;
    };

// ─── Converters ───────────────────────────────────────────────────────────────

function wikiNodeToLogical(n: WikiNode): LogicalNode {
  return {
    id: asNodeId(n.id),
    title: n.title,
    relativePath: n.relativePath,
    folder: n.folder,
    tags: n.tags,
    type: n.type,
    exists: n.exists,
  };
}

function wikiEdgeToLogical(e: WikiEdge): LogicalEdge {
  return {
    id: asEdgeId(e.id),
    source: asNodeId(e.source),
    target: asNodeId(e.target),
    label: e.label,
    type: e.type,
    weight: e.weight,
    resolution: e.isBroken ? "broken" : "resolved",
  };
}

// ─── Context equality ─────────────────────────────────────────────────────────

function contextsEqual(a: GraphProjectionOptions, b: GraphProjectionOptions): boolean {
  if (a.mode !== b.mode) return false;
  if (a.focusNodeId !== b.focusNodeId) return false;
  if (a.visibleNodeTypes.length !== b.visibleNodeTypes.length) return false;
  const aSet = new Set(a.visibleNodeTypes);
  for (const t of b.visibleNodeTypes) if (!aSet.has(t)) return false;
  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreateList<K, V>(map: Map<K, V[]>, key: K): V[] {
  let list = map.get(key);
  if (list === undefined) { list = []; map.set(key, list); }
  return list;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Traduce un WikiGraphDelta lógico a un GraphProjectionDelta aplicando las
 * reglas de visibilidad de la proyección actual.
 *
 * Solo el camino incremental está implementado para Global con contexto estable.
 * Devuelve rebuild-required en cualquier otro caso.
 *
 * prevContext: contexto usado para construir currentProjection.
 * nextContext: contexto deseado para la nueva proyección.
 */
export function createGraphProjectionDelta(
  currentProjection: GraphProjection,
  logicalDelta: WikiGraphDelta,
  prevContext: GraphProjectionOptions,
  nextContext: GraphProjectionOptions,
): GraphProjectionDelta {
  // Context change → rebuild
  if (!contextsEqual(prevContext, nextContext)) {
    return { kind: "rebuild-required", reason: "projection-context-changed" };
  }

  // Local mode → rebuild (incremental BFS not implemented)
  if (nextContext.mode === "local" || currentProjection.effectiveMode === "local") {
    return { kind: "rebuild-required", reason: "local-projection" };
  }

  const typeSet = new Set(nextContext.visibleNodeTypes);

  // ── Index current projection state ────────────────────────────────────────
  const currentNodeById = new Map<GraphNodeId, LogicalNode>(
    currentProjection.nodes.map((n) => [n.id, n]),
  );
  const currentNodeIds = new Set<GraphNodeId>(currentNodeById.keys());

  const currentEdgeById = new Map<GraphEdgeId, LogicalEdge>(
    currentProjection.edges.map((e) => [e.id, e]),
  );
  const currentEdgeIds = new Set<GraphEdgeId>(currentEdgeById.keys());

  // Edge lookup by node (for removing edges when a node becomes invisible)
  const currentEdgesByNodeId = new Map<GraphNodeId, LogicalEdge[]>();
  for (const e of currentProjection.edges) {
    getOrCreateList(currentEdgesByNodeId, e.source).push(e);
    getOrCreateList(currentEdgesByNodeId, e.target).push(e);
  }

  // ── Accumulators ──────────────────────────────────────────────────────────
  const addedNodes: LogicalNode[]    = [];
  const updatedNodes: LogicalNode[]  = [];
  const removedNodeIdSet             = new Set<GraphNodeId>();
  const addedEdges: LogicalEdge[]    = [];
  const updatedEdges: LogicalEdge[]  = [];
  const removedEdgeIdSet             = new Set<GraphEdgeId>();
  const affectedIds = new Set<GraphNodeId>(logicalDelta.affectedNodeIds.map((id) => asNodeId(id)),);

  // ── 1. Added nodes ────────────────────────────────────────────────────────
  for (const wn of logicalDelta.addedNodes) {
    const n = wikiNodeToLogical(wn);
    if (isProjectionNodeVisible(n, typeSet)) {
      addedNodes.push(n);
      affectedIds.add(n.id);
    }
  }

  // ── 2. Updated nodes — detect visibility and index transitions ────────────
  for (const wn of logicalDelta.updatedNodes) {
    const n          = wikiNodeToLogical(wn);
    const wasVisible = currentNodeIds.has(n.id);
    const nowVisible = isProjectionNodeVisible(n, typeSet);

    if (wasVisible && nowVisible) {
      const oldNode  = currentNodeById.get(n.id);
      const wasIndex = oldNode !== undefined && isProjectionIndexNode(oldNode);
      const nowIndex = isProjectionIndexNode(n);

      if (wasIndex && !nowIndex) {
        // index → non-index while still visible: can't reconstruct hidden edges
        return { kind: "rebuild-required", reason: "unsupported-visibility-transition" };
      }

      updatedNodes.push(n);
      affectedIds.add(n.id);

      if (!wasIndex && nowIndex) {
        // non-index → index: its visible incident edges must leave the projection
        for (const e of (currentEdgesByNodeId.get(n.id) ?? [])) {
          if (currentEdgeIds.has(e.id) && !removedEdgeIdSet.has(e.id)) {
            removedEdgeIdSet.add(e.id);
            affectedIds.add(e.source);
            affectedIds.add(e.target);
          }
        }
      }
    } else if (wasVisible && !nowVisible) {
      // Node leaves projection: cascade to its currently-visible edges
      removedNodeIdSet.add(n.id);
      affectedIds.add(n.id);
      for (const e of (currentEdgesByNodeId.get(n.id) ?? [])) {
        if (currentEdgeIds.has(e.id) && !removedEdgeIdSet.has(e.id)) {
          removedEdgeIdSet.add(e.id);
          affectedIds.add(e.source);
          affectedIds.add(e.target);
        }
      }
    } else if (!wasVisible && nowVisible) {
      // Can't reconstruct existing logical edges without the full store.
      return { kind: "rebuild-required", reason: "unsupported-visibility-transition" };
    }
    // !wasVisible && !nowVisible: no-op
  }

  // ── 3. Removed nodes ──────────────────────────────────────────────────────
  for (const rawId of logicalDelta.removedNodeIds) {
    const id = asNodeId(rawId);
    if (currentNodeIds.has(id)) {
      removedNodeIdSet.add(id);
      affectedIds.add(id);
      // Cascade: remove visible incident edges (idempotent via set)
      for (const e of (currentEdgesByNodeId.get(id) ?? [])) {
        if (currentEdgeIds.has(e.id) && !removedEdgeIdSet.has(e.id)) {
          removedEdgeIdSet.add(e.id);
          affectedIds.add(e.source);
          affectedIds.add(e.target);
        }
      }
    }
  }

  // ── 4. Build visible-after set for edge decisions ─────────────────────────
  const visibleAfter = new Set<GraphNodeId>(currentNodeIds);
  for (const n of addedNodes) visibleAfter.add(n.id);
  for (const id of removedNodeIdSet) visibleAfter.delete(id);

  // Node lookup after delta (for isIndexNode checks in edge visibility)
  const nodeAfterById = new Map<GraphNodeId, LogicalNode>(currentNodeById);
  for (const n of addedNodes) nodeAfterById.set(n.id, n);
  for (const n of updatedNodes) nodeAfterById.set(n.id, n);
  for (const id of removedNodeIdSet) nodeAfterById.delete(id);

  // ── 5. Removed edges ──────────────────────────────────────────────────────
  for (const rawId of logicalDelta.removedEdgeIds) {
    const id = asEdgeId(rawId);
    if (currentEdgeIds.has(id) && !removedEdgeIdSet.has(id)) {
      removedEdgeIdSet.add(id);
      const e = currentEdgeById.get(id);
      if (e) {
        affectedIds.add(e.source);
        affectedIds.add(e.target);
      }
    }
  }

  // ── 6. Added edges ────────────────────────────────────────────────────────
  for (const we of logicalDelta.addedEdges) {
    const e = wikiEdgeToLogical(we);
    if (isProjectionEdgeVisible(e, visibleAfter, nodeAfterById)) {
      addedEdges.push(e);
      affectedIds.add(e.source);
      affectedIds.add(e.target);
    }
  }

  // ── 7. Updated edges ──────────────────────────────────────────────────────
  for (const we of logicalDelta.updatedEdges) {
    const e          = wikiEdgeToLogical(we);
    const wasVisible = currentEdgeIds.has(e.id);
    const nowVisible = isProjectionEdgeVisible(e, visibleAfter, nodeAfterById);

    if (wasVisible && nowVisible) {
      updatedEdges.push(e);
      affectedIds.add(e.source);
      affectedIds.add(e.target);
    } else if (!wasVisible && nowVisible) {
      addedEdges.push(e);
      affectedIds.add(e.source);
      affectedIds.add(e.target);
    } else if (wasVisible && !nowVisible) {
      if (!removedEdgeIdSet.has(e.id)) {
        removedEdgeIdSet.add(e.id);
        affectedIds.add(e.source);
        affectedIds.add(e.target);
      }
    }
  }

  return {
    kind: "incremental",
    addedNodes,
    updatedNodes,
    removedNodeIds: Array.from(removedNodeIdSet),
    addedEdges,
    updatedEdges,
    removedEdgeIds: Array.from(removedEdgeIdSet),
    affectedNodeIds: Array.from(affectedIds),
  };
}
