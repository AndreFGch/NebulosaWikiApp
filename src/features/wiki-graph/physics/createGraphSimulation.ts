import type cytoscape from "cytoscape";
import type { Velocity, EdgeLink, GraphSimulationHandle } from "./simulationTypes";

// Umbral de alpha bajo el cual se abandona la física completa y se pasa a
// movimiento ambiental barato. Exportado para que el lifecycle pueda
// detectar el mismo cruce sin duplicar el número mágico.
export const PHYSICS_ALPHA_THRESHOLD = 0.04;

/**
 * Mantiene el grafo vivo alternando dos regímenes:
 *
 * - Physics: motor de fuerzas completo (repulsión, resortes, centro de masa).
 *   Corre solo mientras alpha está alto, por interacción real (carga, layout,
 *   drag, Centrar, refresh). Decae de forma natural y tiene un tope de
 *   duración para proteger vaults grandes.
 * - Ambient: movimiento barato O(n) alrededor de un ancla por nodo, sin pares
 *   ni integración de velocidad, así no acumula drift. Mantiene el grafo
 *   "respirando" indefinidamente sin costo cuadrático.
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

  // Enlaces respiran con fase propia durante episodios de física completa.
  const LINK_BREATH_AMPLITUDE = 24;
  const LINK_BREATH_PERIOD_MS = 14_000;
  const TAU = Math.PI * 2;

  // Tope de duración de un episodio de física completa, para que vaults
  // grandes con interacción sostenida no queden en O(n²) indefinidamente.
  const MAX_PHYSICS_DURATION_MS = 6_000;
  // Por encima de este número de nodos, se salta el bloque de repulsión/
  // colisión por pares incluso durante un episodio de física.
  const NODE_THRESHOLD_FULL_PHYSICS = 250;

  // Ambient: frecuencia baja, amplitud chica, sin pares.
  const AMBIENT_FPS = 12;
  const AMBIENT_FRAME_INTERVAL_MS = 1000 / AMBIENT_FPS;
  const AMBIENT_AMPLITUDE = 6;
  const AMBIENT_PERIOD_MS = 9_000;

  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const createPhase = (si: number, ti: number, index: number): number => {
    // Hash determinista: sin Math.random y estable entre ejecuciones.
    const hash = (
      Math.imul(si + 1, 73_856_093) ^
      Math.imul(ti + 1, 19_349_663) ^
      Math.imul(index + 1, 83_492_791)
    ) >>> 0;

    return (hash % 360) * (Math.PI / 180);
  };

  const edgePhases = edgeLinks.map((edge, index) => createPhase(edge.si, edge.ti, index));
  const nodePhases = nodeArr.map((_, index) => createPhase(index, index, index));

  const anchors = new Map<string, { x: number; y: number }>();
  let wasAbovePhysicsThreshold = true;
  let physicsEpisodeStart: number | null = null;
  let lastAmbientTick = 0;

  const snapshotAnchors = () => {
    for (const node of nodeArr) {
      const pos = node.position();
      anchors.set(node.id(), { x: pos.x, y: pos.y });
    }
  };

  const stepPhysics = (alpha: number) => {
    const count = nodeArr.length;
    const forceAlpha = alpha;

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

    // Repulsión y colisión: solo si el grafo no es demasiado grande, para
    // mantener acotado el costo O(n²) durante episodios de física.
    if (count <= NODE_THRESHOLD_FULL_PHYSICS) {
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
  };

  const stepAmbient = (now: number) => {
    if (reducedMotion) return;
    if (now - lastAmbientTick < AMBIENT_FRAME_INTERVAL_MS) return;
    lastAmbientTick = now;

    const clock = (now / AMBIENT_PERIOD_MS) * TAU;

    for (let i = 0; i < nodeArr.length; i++) {
      const node = nodeArr[i];
      if (node.grabbed()) continue;

      const anchor = anchors.get(node.id());
      if (!anchor) continue;

      const phase = nodePhases[i];
      const ox = Math.sin(clock + phase) * AMBIENT_AMPLITUDE;
      const oy = Math.cos(clock + phase * 1.3) * AMBIENT_AMPLITUDE;
      node.position({ x: anchor.x + ox, y: anchor.y + oy });
    }
  };

  const simulate = () => {
    rafRef.current = requestAnimationFrame(simulate);

    const now = performance.now();
    const alpha = alphaRef.current;
    const count = nodeArr.length;
    if (count === 0) return;

    const abovePhysicsThreshold = alpha > PHYSICS_ALPHA_THRESHOLD;

    if (abovePhysicsThreshold) {
      if (!wasAbovePhysicsThreshold || physicsEpisodeStart === null) {
        physicsEpisodeStart = now;
      }

      if (now - physicsEpisodeStart > MAX_PHYSICS_DURATION_MS) {
        // Tope de seguridad: corta el episodio aunque siga llegando energía.
        alphaRef.current = PHYSICS_ALPHA_THRESHOLD * 0.5;
        wasAbovePhysicsThreshold = false;
        snapshotAnchors();
        stepAmbient(now);
        return;
      }

      stepPhysics(alpha);
      alphaRef.current = alpha * 0.988;
      wasAbovePhysicsThreshold = true;
      return;
    }

    if (wasAbovePhysicsThreshold) {
      // Transición física → ambient: la posición actual (incluida post-drag)
      // se vuelve el ancla.
      snapshotAnchors();
    }
    wasAbovePhysicsThreshold = false;
    physicsEpisodeStart = null;

    stepAmbient(now);
  };

  return {
    start() {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(simulate);
    },
    pause() {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },
    resume() {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(simulate);
      }
    },
  };
}
