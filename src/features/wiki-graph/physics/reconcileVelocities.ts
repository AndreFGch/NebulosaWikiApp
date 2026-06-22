import type { Velocity, ReconcileVelocitiesResult } from "./simulationTypes";

export function reconcileVelocities(
  velocities: Map<string, Velocity>,
  nodeIds: readonly string[],
  isFirstBuild: boolean
): ReconcileVelocitiesResult {
  if (isFirstBuild) {
    velocities.clear();
    nodeIds.forEach((id) => { velocities.set(id, { vx: 0, vy: 0 }); });
    return { alpha: 1.0, hasNewNodes: false };
  }

  const currentIds = new Set(nodeIds);
  for (const id of Array.from(velocities.keys())) {
    if (!currentIds.has(id)) velocities.delete(id);
  }

  let hasNewNodes = false;
  nodeIds.forEach((id) => {
    if (!velocities.has(id)) {
      velocities.set(id, { vx: 0, vy: 0 });
      hasNewNodes = true;
    }
  });

  return { alpha: hasNewNodes ? 0.3 : 0.05, hasNewNodes };
}
