import type cytoscape from "cytoscape";
import type { Velocity, EdgeLink, GraphSimulationHandle } from "./simulationTypes";

export function createGraphSimulation({
  cy,
  nodeArr,
  edgeLinks,
  velocities,
  alphaRef,
  rafRef,
}: {
  cy: cytoscape.Core;
  nodeArr: cytoscape.NodeSingular[];
  edgeLinks: EdgeLink[];
  velocities: Map<string, Velocity>;
  alphaRef: { current: number };
  rafRef: { current: number | null };
}): GraphSimulationHandle {
  void cy;

  const simulate = () => {
    rafRef.current = requestAnimationFrame(simulate);
    const alpha = alphaRef.current;
    const count = nodeArr.length;
    if (alpha < 0.01 || count === 0) return;

    const CENTER_MASS_K = 0.0012;
    const ROOT_CENTER_K = 0.0015;
    const REPEL         = 85;
    const LINK_DIST     = 170;
    const LINK_K        = 0.0035;
    const MIN_DIST      = 48;
    const DAMP          = 0.82;
    const MAX_SPEED     = 1.35;
    const LIMIT         = 720;

    const px = new Float32Array(count);
    const py = new Float32Array(count);
    const grabbed = new Uint8Array(count);
    let sumX = 0, sumY = 0, freeCount = 0;
    for (let i = 0; i < count; i++) {
      const pos = nodeArr[i].position();
      px[i] = pos.x;
      py[i] = pos.y;
      grabbed[i] = nodeArr[i].grabbed() ? 1 : 0;
      if (!grabbed[i]) { sumX += pos.x; sumY += pos.y; freeCount++; }
    }

    const forceX = new Float32Array(count);
    const forceY = new Float32Array(count);

    // Center-of-mass correction: pull whole cloud toward origin
    if (freeCount > 0) {
      const cdx = -(sumX / freeCount);
      const cdy = -(sumY / freeCount);
      for (let i = 0; i < count; i++) {
        if (grabbed[i]) continue;
        forceX[i] += cdx * CENTER_MASS_K * alpha;
        forceY[i] += cdy * CENTER_MASS_K * alpha;
      }
    }

    // Extra pull for root node toward origin
    for (let i = 0; i < count; i++) {
      if (grabbed[i]) continue;
      if (nodeArr[i].hasClass("nw-root")) {
        forceX[i] += (0 - px[i]) * ROOT_CENTER_K * alpha;
        forceY[i] += (0 - py[i]) * ROOT_CENTER_K * alpha;
      }
    }

    // Repulsion + collision (O(n²), range-limited)
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = px[i] - px[j];
        const dy = py[i] - py[j];
        const distSq = dx * dx + dy * dy;
        if (distSq < 0.0001) continue;
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        if (dist < 200) {
          const rf = (REPEL / distSq) * alpha;
          forceX[i] += nx * rf; forceY[i] += ny * rf;
          forceX[j] -= nx * rf; forceY[j] -= ny * rf;
        }

        if (dist < MIN_DIST) {
          const cf = (MIN_DIST - dist) * 0.5 * alpha;
          forceX[i] += nx * cf; forceY[i] += ny * cf;
          forceX[j] -= nx * cf; forceY[j] -= ny * cf;
        }
      }
    }

    // Link spring
    for (let e = 0; e < edgeLinks.length; e++) {
      const { si, ti } = edgeLinks[e];
      const dx = px[ti] - px[si];
      const dy = py[ti] - py[si];
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (dist - LINK_DIST) * LINK_K * alpha;
      const nx = dx / dist;
      const ny = dy / dist;
      forceX[si] += nx * f; forceY[si] += ny * f;
      forceX[ti] -= nx * f; forceY[ti] -= ny * f;
    }

    // Integrate + clamp position
    for (let i = 0; i < count; i++) {
      if (grabbed[i]) continue;
      const id = nodeArr[i].id();
      const vel = velocities.get(id) ?? { vx: 0, vy: 0 };
      let vx = (vel.vx + forceX[i]) * DAMP;
      let vy = (vel.vy + forceY[i]) * DAMP;
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > MAX_SPEED) { const inv = MAX_SPEED / speed; vx *= inv; vy *= inv; }
      let nx = px[i] + vx;
      let ny = py[i] + vy;
      if (nx >  LIMIT) { nx =  LIMIT; vx = 0; }
      if (nx < -LIMIT) { nx = -LIMIT; vx = 0; }
      if (ny >  LIMIT) { ny =  LIMIT; vy = 0; }
      if (ny < -LIMIT) { ny = -LIMIT; vy = 0; }
      velocities.set(id, { vx, vy });
      nodeArr[i].position({ x: nx, y: ny });
    }

    alphaRef.current = Math.max(0.01, alpha * 0.988);
  };

  return {
    start() {
      rafRef.current = requestAnimationFrame(simulate);
    },
  };
}
