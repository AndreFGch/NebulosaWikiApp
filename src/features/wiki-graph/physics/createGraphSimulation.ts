import type cytoscape from "cytoscape";
import type { Velocity, EdgeLink, GraphSimulationHandle } from "./simulationTypes";

/**
 * Mantiene el grafo vivo sin usar oscilaciones independientes por nodo.
 *
 * La energía continua se inyecta alterando de manera lenta y determinista
 * la longitud objetivo de cada enlace. Como cada cambio viaja a través de
 * resortes, repulsión y centro de masa, el movimiento permanece ligado a la
 * topología real del grafo.
 */
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

  // Constantes existentes del motor físico.
  const CENTER_MASS_K = 0.0012;
  const ROOT_CENTER_K = 0.0015;
  const REPEL = 85;
  const LINK_DIST = 170;
  const LINK_K = 0.0035;
  const MIN_DIST = 48;
  const DAMP = 0.82;
  const MAX_SPEED = 1.35;
  const LIMIT = 720;

  // Energía mínima para que el grafo siga relajando su topología de forma
  // sutil después de que alpha se enfría. No modifica alphaRef ni el ciclo
  // de calentamiento que activan hover, drag o Centrar.
  const LIVE_FORCE_ALPHA = 0.14;

  // Cada enlace respira con una fase propia. Esto hace que los grupos se
  // relajen como red conectada, no como nodos que oscilan por separado.
  const LINK_BREATH_AMPLITUDE = 24;
  const LINK_BREATH_PERIOD_MS = 14_000;
  const TAU = Math.PI * 2;

  const createEdgePhase = (edge: EdgeLink, index: number): number => {
    // Hash determinista: sin Math.random y estable entre ejecuciones.
    const hash = (
      Math.imul(edge.si + 1, 73_856_093) ^
      Math.imul(edge.ti + 1, 19_349_663) ^
      Math.imul(index + 1, 83_492_791)
    ) >>> 0;

    return (hash % 360) * (Math.PI / 180);
  };

  const edgePhases = edgeLinks.map(createEdgePhase);

  const simulate = () => {
    rafRef.current = requestAnimationFrame(simulate);

    const alpha = alphaRef.current;
    const count = nodeArr.length;
    if (alpha < 0.01 || count === 0) return;

    // La física conserva alpha para sus picos de interacción, pero mantiene
    // una energía base leve que evita que una topología ya equilibrada quede
    // visualmente congelada.
    const forceAlpha = Math.max(alpha, LIVE_FORCE_ALPHA);

    const px = new Float32Array(count);
    const py = new Float32Array(count);
    const grabbed = new Uint8Array(count);
    let sumX = 0;
    let sumY = 0;
    let freeCount = 0;

    for (let i = 0; i < count; i++) {
      const pos = nodeArr[i].position();
      px[i] = pos.x;
      py[i] = pos.y;
      grabbed[i] = nodeArr[i].grabbed() ? 1 : 0;

      if (!grabbed[i]) {
        sumX += pos.x;
        sumY += pos.y;
        freeCount++;
      }
    }

    const forceX = new Float32Array(count);
    const forceY = new Float32Array(count);

    // Corrección del centro de masa: evita que la nube se aleje del origen.
    if (freeCount > 0) {
      const cdx = -(sumX / freeCount);
      const cdy = -(sumY / freeCount);

      for (let i = 0; i < count; i++) {
        if (grabbed[i]) continue;
        forceX[i] += cdx * CENTER_MASS_K * forceAlpha;
        forceY[i] += cdy * CENTER_MASS_K * forceAlpha;
      }
    }

    // El nodo raíz funciona como ancla, pero no queda fijado artificialmente.
    for (let i = 0; i < count; i++) {
      if (grabbed[i]) continue;
      if (!nodeArr[i].hasClass("nw-root")) continue;

      forceX[i] += (0 - px[i]) * ROOT_CENTER_K * forceAlpha;
      forceY[i] += (0 - py[i]) * ROOT_CENTER_K * forceAlpha;
    }

    // Repulsión y colisión: mantiene espacio entre nodos cercanos.
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
          const repelForce = (REPEL / distSq) * forceAlpha;
          forceX[i] += nx * repelForce;
          forceY[i] += ny * repelForce;
          forceX[j] -= nx * repelForce;
          forceY[j] -= ny * repelForce;
        }

        if (dist < MIN_DIST) {
          const collisionForce = (MIN_DIST - dist) * 0.5 * forceAlpha;
          forceX[i] += nx * collisionForce;
          forceY[i] += ny * collisionForce;
          forceX[j] -= nx * collisionForce;
          forceY[j] -= ny * collisionForce;
        }
      }
    }

    // Resortes por enlace. La longitud objetivo cambia apenas y en fases
    // distintas por enlace: la topología se relaja y respira en conjunto.
    const linkClock = (performance.now() / LINK_BREATH_PERIOD_MS) * TAU;

    for (let edgeIndex = 0; edgeIndex < edgeLinks.length; edgeIndex++) {
      const { si, ti } = edgeLinks[edgeIndex];
      const dx = px[ti] - px[si];
      const dy = py[ti] - py[si];
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const targetDistance = LINK_DIST + (
        Math.sin(linkClock + edgePhases[edgeIndex]) * LINK_BREATH_AMPLITUDE
      );
      const springForce = (dist - targetDistance) * LINK_K * forceAlpha;
      const nx = dx / dist;
      const ny = dy / dist;

      forceX[si] += nx * springForce;
      forceY[si] += ny * springForce;
      forceX[ti] -= nx * springForce;
      forceY[ti] -= ny * springForce;
    }

    // Integración y límites de posición.
    for (let i = 0; i < count; i++) {
      if (grabbed[i]) continue;

      const id = nodeArr[i].id();
      const velocity = velocities.get(id) ?? { vx: 0, vy: 0 };
      let vx = (velocity.vx + forceX[i]) * DAMP;
      let vy = (velocity.vy + forceY[i]) * DAMP;
      const speed = Math.sqrt(vx * vx + vy * vy);

      if (speed > MAX_SPEED) {
        const inv = MAX_SPEED / speed;
        vx *= inv;
        vy *= inv;
      }

      let nextX = px[i] + vx;
      let nextY = py[i] + vy;

      if (nextX > LIMIT) { nextX = LIMIT; vx = 0; }
      if (nextX < -LIMIT) { nextX = -LIMIT; vx = 0; }
      if (nextY > LIMIT) { nextY = LIMIT; vy = 0; }
      if (nextY < -LIMIT) { nextY = -LIMIT; vy = 0; }

      velocities.set(id, { vx, vy });
      nodeArr[i].position({ x: nextX, y: nextY });
    }

    // Conserva la semántica de alpha existente para refresh, hover y drag.
    alphaRef.current = Math.max(0.01, alpha * 0.988);
  };

  return {
    start() {
      rafRef.current = requestAnimationFrame(simulate);
    },
  };
}
