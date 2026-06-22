import type { WikiGraph, WikiNode } from "../types";

function getNodeConnections(node: WikiNode): number {
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
