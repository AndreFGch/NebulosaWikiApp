import type { WikiNode, WikiEdge, WikiGraph } from "../../types/graph";

export function getNodeConnections(node: WikiNode): number {
  return node.outgoingCount + node.backlinkCount;
}

export function getRootGraphNode(graph: WikiGraph): WikiNode | null {
  const preferred = ["projects/nebulosa-wiki.md", "indexes/indice-principal.md"];
  for (const rp of preferred) {
    const found = graph.nodes.find((n) => n.relativePath === rp && n.exists);
    if (found) return found;
  }
  const folderPriority: Record<string, number> = { projects: 0, indexes: 1, notes: 2 };
  const candidates = graph.nodes
    .filter((n) => n.exists && n.type !== "missing")
    .sort((a, b) => {
      const diff = getNodeConnections(b) - getNodeConnections(a);
      if (diff !== 0) return diff;
      const pa = folderPriority[a.folder?.split("/")[0]] ?? 99;
      const pb = folderPriority[b.folder?.split("/")[0]] ?? 99;
      return pa - pb;
    });
  return candidates[0] ?? null;
}

export function buildRadialPositions(
  nodes: WikiNode[],
  edges: WikiEdge[],
  rootId: string | null
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const CX = 0, CY = 0;
  const TAU = 2 * Math.PI;
  const MIN_SPACING = 26;

  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  if (!rootId || !adj.has(rootId)) {
    const r = Math.max(240, (nodes.length * MIN_SPACING) / TAU);
    nodes.forEach((n, i) => {
      const angle = (TAU * i) / nodes.length - Math.PI / 2;
      positions.set(n.id, { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) });
    });
    return positions;
  }

  const layerMap = new Map<string, number>();
  const queue: string[] = [rootId];
  layerMap.set(rootId, 0);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curLayer = layerMap.get(cur)!;
    for (const nb of (adj.get(cur) ?? [])) {
      if (!layerMap.has(nb)) {
        layerMap.set(nb, curLayer + 1);
        queue.push(nb);
      }
    }
  }

  const layerGroups = new Map<number, string[]>();
  const disconnected: string[] = [];
  for (const n of nodes) {
    if (layerMap.has(n.id)) {
      const l = layerMap.get(n.id)!;
      if (!layerGroups.has(l)) layerGroups.set(l, []);
      layerGroups.get(l)!.push(n.id);
    } else {
      disconnected.push(n.id);
    }
  }

  const baseRadii = [0, 150, 280, 410, 540, 650];
  positions.set(rootId, { x: CX, y: CY });

  for (const [layer, ids] of layerGroups.entries()) {
    if (layer === 0) continue;
    const base = baseRadii[Math.min(layer, baseRadii.length - 1)];
    const minR = (ids.length * MIN_SPACING) / TAU;
    const r = Math.max(base, minR);
    ids.forEach((id, i) => {
      const angle = (TAU * i) / ids.length - Math.PI / 2;
      positions.set(id, { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) });
    });
  }

  if (disconnected.length > 0) {
    const minR = (disconnected.length * MIN_SPACING) / TAU;
    const disconnectedRadius = Math.max(240, Math.sqrt(disconnected.length) * 52);
    const r = Math.max(disconnectedRadius, minR);
    disconnected.forEach((id, i) => {
      const angle = (TAU * i) / disconnected.length + Math.PI / 6;
      positions.set(id, { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) });
    });
  }

  return positions;
}
