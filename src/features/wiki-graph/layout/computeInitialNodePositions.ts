import type { WikiNode, WikiEdge } from "../types";
import { buildRadialPositions } from "./buildRadialPositions";

export interface GraphNodePosition {
  readonly x: number;
  readonly y: number;
}

// ─── Union-Find ────────────────────────────────────────────────────────────

function makeUnionFind(ids: readonly string[]): {
  find: (id: string) => string;
  union: (a: string, b: string) => void;
} {
  const parent = new Map<string, string>();
  const rank   = new Map<string, number>();

  for (const id of ids) {
    parent.set(id, id);
    rank.set(id, 0);
  }

  function find(id: string): string {
    let root = id;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    // Path compression
    let cur = id;
    while (cur !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    const rankA = rank.get(ra)!;
    const rankB = rank.get(rb)!;
    if (rankA < rankB) {
      parent.set(ra, rb);
    } else if (rankA > rankB) {
      parent.set(rb, ra);
    } else {
      parent.set(rb, ra);
      rank.set(ra, rankA + 1);
    }
  }

  return { find, union };
}

// ─── Bounding box ──────────────────────────────────────────────────────────

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function computeBBox(
  nodeIds: readonly string[],
  positions: Map<string, GraphNodePosition>,
): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const id of nodeIds) {
    const p = positions.get(id);
    if (!p) continue;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

// ─── Main export ───────────────────────────────────────────────────────────

/**
 * Pure layout: computes one (x, y) per node.
 * No Cytoscape, no React, no randomness, no physics.
 *
 * Algorithm:
 *   1. Build weakly-connected components via Union-Find.
 *   2. Layout each component independently with buildRadialPositions
 *      (prevents the legacy "disconnected nodes on huge ring" path).
 *   3. Pack secondary components into a compact deterministic grid
 *      to the right of the main component.
 */
export function computeInitialNodePositions(
  nodes: readonly WikiNode[],
  edges: readonly WikiEdge[],
  rootId: string | null,
): Map<string, GraphNodePosition> {
  if (nodes.length === 0) return new Map();

  const nodeSet = new Set(nodes.map((n) => n.id));

  // ── Step 1: build components ──────────────────────────────────────────────
  const uf = makeUnionFind(nodes.map((n) => n.id));

  for (const e of edges) {
    // Skip self-loops and edges whose endpoints are outside the node set.
    if (e.source === e.target) continue;
    if (!nodeSet.has(e.source) || !nodeSet.has(e.target)) continue;
    uf.union(e.source, e.target);
  }

  // Group nodes by their root representative, sort for determinism.
  const componentMap = new Map<string, WikiNode[]>();
  for (const n of [...nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    const rep = uf.find(n.id);
    const group = componentMap.get(rep);
    if (group) {
      group.push(n);
    } else {
      componentMap.set(rep, [n]);
    }
  }

  const components = Array.from(componentMap.values());

  // ── Step 2: identify main component ──────────────────────────────────────
  let mainIndex = -1;

  if (rootId !== null && nodeSet.has(rootId)) {
    const rootRep = uf.find(rootId);
    mainIndex = components.findIndex((comp) =>
      comp.some((n) => uf.find(n.id) === rootRep),
    );
  }

  if (mainIndex === -1) {
    // No rootId or rootId not found: largest component; tie → smallest first id.
    let bestSize = -1;
    let bestFirstId = "";
    components.forEach((comp, i) => {
      const firstId = comp[0].id; // already sorted by id
      if (
        comp.length > bestSize ||
        (comp.length === bestSize && firstId < bestFirstId)
      ) {
        bestSize = comp.length;
        bestFirstId = firstId;
        mainIndex = i;
      }
    });
  }

  // ── Step 3: build internal edge set per component ─────────────────────────
  // edges are re-used from the input; filter to each component on demand.
  const componentNodeSets: Map<number, Set<string>> = new Map();
  components.forEach((comp, i) => {
    componentNodeSets.set(i, new Set(comp.map((n) => n.id)));
  });

  function internalEdges(compIndex: number): WikiEdge[] {
    const ids = componentNodeSets.get(compIndex)!;
    // Self-loops (source === target) are included: both endpoints are in ids
    // by definition, and buildRadialPositions may use them.
    // Only skip edges whose endpoints are outside this component.
    return edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }

  // ── Step 4: choose effective root for each component ─────────────────────
  // For the main component: use rootId only if it explicitly belongs to it.
  // In all other cases (rootId null, not in nodeSet, or secondary component):
  // highest internal degree, tie → smallest id.
  function localRoot(comp: WikiNode[], compIndex: number): string | null {
    const inEdges = internalEdges(compIndex);
    const degree = new Map<string, number>();
    for (const n of comp) degree.set(n.id, 0);
    for (const e of inEdges) {
      if (e.source !== e.target) {
        degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
        degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
      }
    }
    let bestId = comp[0].id;
    let bestDeg = degree.get(bestId) ?? 0;
    for (const n of comp) {
      const d = degree.get(n.id) ?? 0;
      if (d > bestDeg || (d === bestDeg && n.id < bestId)) {
        bestDeg = d;
        bestId = n.id;
      }
    }
    return bestId;
  }

  // mainRootId: rootId if it belongs to the main component; local criterion otherwise.
  const mainComp = components[mainIndex];
  const mainCompIds = componentNodeSets.get(mainIndex)!;
  const mainRootId: string | null =
    rootId !== null && mainCompIds.has(rootId) ? rootId : localRoot(mainComp, mainIndex);

  function effectiveRoot(comp: WikiNode[], compIndex: number): string | null {
    if (compIndex === mainIndex) return mainRootId;
    return localRoot(comp, compIndex);
  }

  // ── Step 5: layout each component independently ──────────────────────────
  // buildRadialPositions returns a Map<id, {x,y}> in local coords (centered at 0,0).
  // We keep them local first, then translate.
  const localPositions: Map<number, Map<string, GraphNodePosition>> = new Map();

  components.forEach((comp, i) => {
    const compRoot = effectiveRoot(comp, i);
    const localEdges = internalEdges(i);
    // Cast: buildRadialPositions accepts WikiNode[] and WikiEdge[]; comp is WikiNode[].
    const radial = buildRadialPositions(comp as WikiNode[], localEdges, compRoot);
    // Copy into a fresh map so we never mutate buildRadialPositions output.
    const lp = new Map<string, GraphNodePosition>();
    for (const n of comp) {
      const p = radial.get(n.id);
      lp.set(n.id, p ?? { x: 0, y: 0 });
    }
    localPositions.set(i, lp);
  });

  // ── Step 6: translate and pack ────────────────────────────────────────────
  const result = new Map<string, GraphNodePosition>();
  const COMPONENT_GAP = 80;

  // Main component: place at origin (no translation).
  const mainLocal = localPositions.get(mainIndex)!;
  const mainBBox  = computeBBox(mainComp.map((n) => n.id), mainLocal);

  for (const [id, p] of mainLocal) {
    result.set(id, p);
  }

  // Secondary components: sort by (size desc, smallest id asc).
  const secondaryIndices = components
    .map((_, i) => i)
    .filter((i) => i !== mainIndex)
    .sort((a, b) => {
      const sizeB = components[b].length;
      const sizeA = components[a].length;
      if (sizeB !== sizeA) return sizeB - sizeA;
      return components[a][0].id.localeCompare(components[b][0].id);
    });

  if (secondaryIndices.length === 0) return result;

  // Compute per-secondary bboxes (local coords).
  const secBBoxes = secondaryIndices.map((si) =>
    computeBBox(components[si].map((n) => n.id), localPositions.get(si)!),
  );

  // Uniform cell dimensions: max secondary width/height + gap.
  const maxSecWidth  = Math.max(0, ...secBBoxes.map((b) => b.maxX - b.minX));
  const maxSecHeight = Math.max(0, ...secBBoxes.map((b) => b.maxY - b.minY));
  const cellWidth    = maxSecWidth  + COMPONENT_GAP;
  const cellHeight   = maxSecHeight + COMPONENT_GAP;

  // Grid shape: as square as possible.
  const columnCount = Math.max(1, Math.ceil(Math.sqrt(secondaryIndices.length)));
  const rowCount    = Math.ceil(secondaryIndices.length / columnCount);

  // Grid origin: to the right of main bbox, vertically centered on main bbox.
  const gridOriginX   = mainBBox.maxX + COMPONENT_GAP;
  const gridTotalH    = rowCount * cellHeight;
  const mainCenterY   = (mainBBox.minY + mainBBox.maxY) / 2;
  const gridOriginY   = mainCenterY - gridTotalH / 2;

  secondaryIndices.forEach((si, idx) => {
    const col       = idx % columnCount;
    const row       = Math.floor(idx / columnCount);
    const secComp   = components[si];
    const secLocal  = localPositions.get(si)!;
    const secBBox   = secBBoxes[idx];

    const secW = secBBox.maxX - secBBox.minX;
    const secH = secBBox.maxY - secBBox.minY;

    // Cell top-left corner in world coords.
    const cellOriginX = gridOriginX + col * cellWidth;
    const cellOriginY = gridOriginY + row * cellHeight;

    // Center the secondary bbox inside its cell (excluding the gap margin).
    const dx = cellOriginX + (cellWidth  - COMPONENT_GAP - secW)  / 2 - secBBox.minX;
    const dy = cellOriginY + (cellHeight - COMPONENT_GAP - secH) / 2 - secBBox.minY;

    for (const n of secComp) {
      const p = secLocal.get(n.id) ?? { x: 0, y: 0 };
      result.set(n.id, { x: p.x + dx, y: p.y + dy });
    }
  });

  return result;
}
