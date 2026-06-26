import type { PhysicsEdgeLink, PhysicsPoint } from "./physicalGraphTypes";
import {
  createPhysicalGraphState,
  settlePhysicalGraph,
  snapshotPhysicalPositions,
} from "./physicalGraphCore";
import { createInitialSeedPositions } from "./createInitialSeedPositions";
import { createInitialSettledPositions } from "./createInitialSettledPositions";

const REBUILD_SETTLE_MAX_STEPS = 240;
const REBUILD_SETTLE_MIN_ALPHA = 0.06;

/**
 * Produces stable node positions for a rebuild cycle.
 *
 * Nodes with a valid entry in savedPositions are treated as immovable anchors:
 * their positions are copied verbatim and held fixed during the settle pass.
 * New nodes start near their anchored neighbors (via centroid propagation) and
 * then settle deterministically into their equilibrium positions.
 */
export function createRebuildSettledPositions(
  nodeIds: readonly string[],
  edgeLinks: readonly PhysicsEdgeLink[],
  rootNodeId: string | null,
  savedPositions: ReadonlyMap<string, PhysicsPoint>,
): Map<string, PhysicsPoint> {
  if (nodeIds.length === 0) {
    return new Map();
  }

  const count = nodeIds.length;

  // First pass: collect valid anchor positions indexed by node index.
  const validSavedPositionsByIndex = new Map<number, PhysicsPoint>();
  const fixedNodeIndices = new Set<number>();

  for (let i = 0; i < count; i++) {
    const saved = savedPositions.get(nodeIds[i]);

    if (
      saved !== undefined &&
      Number.isFinite(saved.x) &&
      Number.isFinite(saved.y)
    ) {
      validSavedPositionsByIndex.set(i, saved);
      fixedNodeIndices.add(i);
    }
  }

  // No overlap with saved positions: delegate to a full fresh settle.
  if (fixedNodeIndices.size === 0) {
    return createInitialSettledPositions(nodeIds, edgeLinks, rootNodeId);
  }

  // Build seed, then overwrite with valid anchor positions.
  const seedPositions = createInitialSeedPositions(nodeIds, edgeLinks, rootNodeId);

  const mergedPositions = new Map<string, PhysicsPoint>();

  for (const [id, point] of seedPositions) {
    mergedPositions.set(id, point);
  }

  for (const [i, saved] of validSavedPositionsByIndex) {
    mergedPositions.set(nodeIds[i], { x: saved.x, y: saved.y });
  }

  // All current nodes have saved positions: return the merged map without settle.
  if (fixedNodeIndices.size === count) {
    return mergedPositions;
  }

  // Mixed: place new nodes near anchored neighbors before the settle pass.

  // Undirected adjacency list; invalid and self edges are skipped.
  const adjacency: number[][] = Array.from({ length: count }, () => []);

  for (const { si, ti } of edgeLinks) {
    if (
      !Number.isInteger(si) ||
      !Number.isInteger(ti) ||
      si < 0 || ti < 0 ||
      si >= count || ti >= count ||
      si === ti
    ) {
      continue;
    }

    adjacency[si].push(ti);
    adjacency[ti].push(si);
  }

  // Propagate anchor positions outward via centroid of positioned neighbors.
  // Chains are resolved across multiple passes; components with no anchor
  // connection retain their compact seed positions.
  const positionedNodeIndices = new Set<number>(fixedNodeIndices);

  let madeProgress = true;

  while (madeProgress) {
    madeProgress = false;

    for (let i = 0; i < count; i++) {
      if (positionedNodeIndices.has(i)) continue;

      let sumX = 0;
      let sumY = 0;
      let positionedNeighborCount = 0;

      for (const neighbor of adjacency[i]) {
        if (!positionedNodeIndices.has(neighbor)) continue;

        const pos = mergedPositions.get(nodeIds[neighbor]);
        if (pos === undefined) continue;

        sumX += pos.x;
        sumY += pos.y;
        positionedNeighborCount++;
      }

      if (positionedNeighborCount === 0) continue;

      mergedPositions.set(nodeIds[i], {
        x: sumX / positionedNeighborCount,
        y: sumY / positionedNeighborCount,
      });
      positionedNodeIndices.add(i);
      madeProgress = true;
    }
  }

  // Settle with anchors fixed so new nodes reach equilibrium without
  // displacing the existing layout.
  const state = createPhysicalGraphState(nodeIds, mergedPositions);

  const rootIndex =
    rootNodeId !== null
      ? (state.indexById.get(rootNodeId) ?? null)
      : null;

  settlePhysicalGraph(
    state,
    { edgeLinks, rootIndex, fixedNodeIndices },
    REBUILD_SETTLE_MAX_STEPS,
    REBUILD_SETTLE_MIN_ALPHA,
  );

  return snapshotPhysicalPositions(state);
}
