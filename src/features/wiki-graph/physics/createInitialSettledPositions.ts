import {
  createPhysicalGraphState,
  settlePhysicalGraph,
  snapshotPhysicalPositions,
} from "./physicalGraphCore";
import { createInitialSeedPositions } from "./createInitialSeedPositions";
import type { PhysicsEdgeLink, PhysicsPoint } from "./physicalGraphTypes";

// ─── Constantes ───────────────────────────────────────────────────────────────

const INITIAL_SETTLE_MAX_STEPS = 240;
const INITIAL_SETTLE_MIN_ALPHA = 0.06;

// ─── API pública ──────────────────────────────────────────────────────────────

export function createInitialSettledPositions(
  nodeIds: readonly string[],
  edgeLinks: readonly PhysicsEdgeLink[],
  rootNodeId: string | null,
): Map<string, PhysicsPoint> {
  const seedPositions = createInitialSeedPositions(nodeIds, edgeLinks, rootNodeId);

  const state = createPhysicalGraphState(nodeIds, seedPositions);

  const rootIndex =
    rootNodeId !== null
      ? (state.indexById.get(rootNodeId) ?? null)
      : null;

  settlePhysicalGraph(
    state,
    { edgeLinks, rootIndex },
    INITIAL_SETTLE_MAX_STEPS,
    INITIAL_SETTLE_MIN_ALPHA,
  );

  return snapshotPhysicalPositions(state);
}
