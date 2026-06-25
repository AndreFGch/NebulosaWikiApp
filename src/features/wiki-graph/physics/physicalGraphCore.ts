import type {
  PhysicsPoint,
  PhysicalGraphState,
  PhysicsStepOptions,
} from "./physicalGraphTypes";

// ─── Constantes físicas ──────────────────────────────────────────────────────
// Mantener sincronizadas con createGraphSimulation.ts mientras el motor
// legado esté activo. Cualquier cambio de balance debe aplicarse en ambos.

const CENTER_MASS_K = 0.0012;
const ROOT_CENTER_K = 0.0015;
const REPEL = 85;
const LINK_DIST = 170;
const LINK_K = 0.0035;
const MIN_DIST = 48;
const DAMP = 0.82;
const MAX_SPEED = 1.35;
const LIMIT = 720;
const NODE_THRESHOLD_FULL_PHYSICS = 250;
const ALPHA_DECAY = 0.988;

// Spring breathing: misma amplitud y período que el motor legado.
const LINK_BREATH_AMPLITUDE = 24;
const LINK_BREATH_PERIOD_MS = 14_000;
const TAU = Math.PI * 2;

// Paso virtual fijo: reemplaza performance.now() para que el settle sea determinista.
const SIMULATION_STEP_MS = 1000 / 60;

// Separación mínima asignada a pares coincidentes para evitar división por cero.
const COINCIDENT_SEED_DISTANCE = MIN_DIST * 0.25;

// ─── Helpers deterministas ───────────────────────────────────────────────────

function edgePhaseFor(si: number, ti: number, index: number): number {
  const hash = (
    Math.imul(si + 1, 73_856_093) ^
    Math.imul(ti + 1, 19_349_663) ^
    Math.imul(index + 1, 83_492_791)
  ) >>> 0;

  return (hash % 360) * (Math.PI / 180);
}

function coincidentDirectionFor(
  firstIndex: number,
  secondIndex: number,
  phaseIndex: number,
): PhysicsPoint {
  const phase = edgePhaseFor(firstIndex, secondIndex, phaseIndex);

  return {
    x: Math.cos(phase),
    y: Math.sin(phase),
  };
}

function isValidNodeIndex(index: number, count: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < count;
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Crea un PhysicalGraphState con posiciones seed y velocidades en cero.
 * Nodos sin entrada en seedPositions quedan en (0, 0).
 */
export function createPhysicalGraphState(
  nodeIds: readonly string[],
  seedPositions: ReadonlyMap<string, PhysicsPoint>,
  initialAlpha = 1.0,
): PhysicalGraphState {
  const stateNodeIds = [...nodeIds];
  const count = stateNodeIds.length;
  const positions = new Float64Array(count * 2);
  const velocities = new Float64Array(count * 2);
  const indexById = new Map<string, number>();

  for (let i = 0; i < count; i++) {
    const id = stateNodeIds[i];
    indexById.set(id, i);

    const seed = seedPositions.get(id);
    positions[i * 2] = seed?.x ?? 0;
    positions[i * 2 + 1] = seed?.y ?? 0;
  }

  return {
    nodeIds: stateNodeIds,
    indexById,
    positions,
    velocities,
    alpha: initialAlpha,
    stepCount: 0,
  };
}

/**
 * Ejecuta un paso físico completo sobre state.
 *
 * Fuerzas aplicadas:
 *   1. Corrección de centro de masa.
 *   2. Root-center.
 *   3. Repulsión + colisión O(n²), solo en grafos pequeños.
 *   4. Resortes con breathing determinista.
 *   5. Integración con damping, max speed y clamp.
 *   6. Decaimiento de alpha.
 *
 * Nodos en fixedNodeIndices mantienen posición y velocidad cero.
 * Siguen participando como masa fija en las fuerzas de otros nodos.
 *
 * Muta: state.positions, state.velocities, state.alpha, state.stepCount.
 */
export function stepPhysicalGraph(
  state: PhysicalGraphState,
  options: PhysicsStepOptions,
): void {
  const { nodeIds, positions, velocities, alpha } = state;
  const { edgeLinks, rootIndex, fixedNodeIndices } = options;
  const count = nodeIds.length;

  if (count === 0) return;

  const forceX = new Float64Array(count);
  const forceY = new Float64Array(count);

  // 1. Corrección de centro de masa.
  let sumX = 0;
  let sumY = 0;
  let freeCount = 0;

  for (let i = 0; i < count; i++) {
    if (fixedNodeIndices?.has(i)) continue;

    sumX += positions[i * 2];
    sumY += positions[i * 2 + 1];
    freeCount++;
  }

  if (freeCount > 0) {
    const centerDx = -(sumX / freeCount);
    const centerDy = -(sumY / freeCount);

    for (let i = 0; i < count; i++) {
      if (fixedNodeIndices?.has(i)) continue;

      forceX[i] += centerDx * CENTER_MASS_K * alpha;
      forceY[i] += centerDy * CENTER_MASS_K * alpha;
    }
  }

  // 2. Root-center: atrae el nodo raíz al origen sin fijarlo.
  if (
    rootIndex !== null &&
    isValidNodeIndex(rootIndex, count) &&
    !fixedNodeIndices?.has(rootIndex)
  ) {
    forceX[rootIndex] +=
      (0 - positions[rootIndex * 2]) * ROOT_CENTER_K * alpha;

    forceY[rootIndex] +=
      (0 - positions[rootIndex * 2 + 1]) * ROOT_CENTER_K * alpha;
  }

  // 3. Repulsión + colisión O(n²), acotada a grafos pequeños.
  if (count <= NODE_THRESHOLD_FULL_PHYSICS) {
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        let dx = positions[i * 2] - positions[j * 2];
        let dy = positions[i * 2 + 1] - positions[j * 2 + 1];
        let distSq = dx * dx + dy * dy;

        if (distSq < 0.0001) {
          const direction = coincidentDirectionFor(i, j, 0);
          dx = direction.x * COINCIDENT_SEED_DISTANCE;
          dy = direction.y * COINCIDENT_SEED_DISTANCE;
          distSq = dx * dx + dy * dy;
        }

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        if (dist < 200) {
          const repelForce = (REPEL / distSq) * alpha;
          forceX[i] += nx * repelForce;
          forceY[i] += ny * repelForce;
          forceX[j] -= nx * repelForce;
          forceY[j] -= ny * repelForce;
        }

        if (dist < MIN_DIST) {
          const collisionForce = (MIN_DIST - dist) * 0.5 * alpha;
          forceX[i] += nx * collisionForce;
          forceY[i] += ny * collisionForce;
          forceX[j] -= nx * collisionForce;
          forceY[j] -= ny * collisionForce;
        }
      }
    }
  }

  // 4. Resortes con breathing determinista.
  const linkClock =
    ((state.stepCount * SIMULATION_STEP_MS) / LINK_BREATH_PERIOD_MS) * TAU;

  for (let edgeIndex = 0; edgeIndex < edgeLinks.length; edgeIndex++) {
    const { si, ti } = edgeLinks[edgeIndex];

    if (!isValidNodeIndex(si, count) || !isValidNodeIndex(ti, count)) {
      continue;
    }

    let dx = positions[ti * 2] - positions[si * 2];
    let dy = positions[ti * 2 + 1] - positions[si * 2 + 1];
    let distSq = dx * dx + dy * dy;

    if (distSq < 0.0001) {
      const direction = coincidentDirectionFor(si, ti, edgeIndex);
      dx = direction.x * COINCIDENT_SEED_DISTANCE;
      dy = direction.y * COINCIDENT_SEED_DISTANCE;
      distSq = dx * dx + dy * dy;
    }

    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;

    const phase = edgePhaseFor(si, ti, edgeIndex);
    const targetDistance =
      LINK_DIST + Math.sin(linkClock + phase) * LINK_BREATH_AMPLITUDE;

    const springForce = (dist - targetDistance) * LINK_K * alpha;

    forceX[si] += nx * springForce;
    forceY[si] += ny * springForce;
    forceX[ti] -= nx * springForce;
    forceY[ti] -= ny * springForce;
  }

  // 5. Integración + clamp de velocidad + clamp de posición.
  for (let i = 0; i < count; i++) {
    if (fixedNodeIndices?.has(i)) {
      velocities[i * 2] = 0;
      velocities[i * 2 + 1] = 0;
      continue;
    }

    let vx = (velocities[i * 2] + forceX[i]) * DAMP;
    let vy = (velocities[i * 2 + 1] + forceY[i]) * DAMP;

    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > MAX_SPEED) {
      const inv = MAX_SPEED / speed;
      vx *= inv;
      vy *= inv;
    }

    let nextX = positions[i * 2] + vx;
    let nextY = positions[i * 2 + 1] + vy;

    if (nextX > LIMIT) {
      nextX = LIMIT;
      vx = 0;
    }

    if (nextX < -LIMIT) {
      nextX = -LIMIT;
      vx = 0;
    }

    if (nextY > LIMIT) {
      nextY = LIMIT;
      vy = 0;
    }

    if (nextY < -LIMIT) {
      nextY = -LIMIT;
      vy = 0;
    }

    velocities[i * 2] = vx;
    velocities[i * 2 + 1] = vy;
    positions[i * 2] = nextX;
    positions[i * 2 + 1] = nextY;
  }

  // 6. Decaimiento determinista de alpha.
  state.alpha *= ALPHA_DECAY;
  state.stepCount += 1;
}

/**
 * Ejecuta pasos hasta que alpha caiga bajo minAlpha o se alcance maxSteps.
 * Terminación garantizada por maxSteps.
 */
export function settlePhysicalGraph(
  state: PhysicalGraphState,
  options: PhysicsStepOptions,
  maxSteps: number,
  minAlpha: number,
): void {
  for (let step = 0; step < maxSteps; step++) {
    if (state.alpha <= minAlpha) break;
    stepPhysicalGraph(state, options);
  }
}

/**
 * Devuelve snapshot de posiciones actuales, indexado por node id.
 * No muta state.
 */
export function snapshotPhysicalPositions(
  state: PhysicalGraphState,
): Map<string, PhysicsPoint> {
  const result = new Map<string, PhysicsPoint>();

  for (let i = 0; i < state.nodeIds.length; i++) {
    result.set(state.nodeIds[i], {
      x: state.positions[i * 2],
      y: state.positions[i * 2 + 1],
    });
  }

  return result;
}