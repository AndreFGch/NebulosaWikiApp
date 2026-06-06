import type { MarkdownFile } from "../../types/wiki";
import type { WikiGraph, WikiNode, WikiEdge } from "../../types/graph";
import {
  normalizeKey,
  extractFrontmatterTitle,
  getNoteTypeFromFolder,
  extractTags,
  extractWikilinks,
} from "../markdown/markdownUtils";

export function sanitizeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "_");
}

export function buildWikiGraph(notes: MarkdownFile[], contentMap: Map<string, string>): WikiGraph {
  const index = new Map<string, MarkdownFile>();

  function addKey(key: string, note: MarkdownFile) {
    const nk = normalizeKey(key);
    if (nk && !index.has(nk)) index.set(nk, note);
  }

  notes.forEach((n) => {
    const raw = contentMap.get(n.relativePath) ?? "";
    addKey(n.title, n);
    const fname = n.relativePath.replace(/\.md$/i, "").split(/[/\\]/).pop() ?? "";
    if (fname) addKey(fname, n);
    const fmTitle = extractFrontmatterTitle(raw);
    if (fmTitle) addKey(fmTitle, n);
  });

  function resolve(link: string): MarkdownFile | undefined {
    return index.get(normalizeKey(link));
  }

  const allTags = new Set<string>();
  const allFolders = new Set<string>();
  const nodeMap = new Map<string, WikiNode>();

  notes.forEach((n) => {
    const raw = contentMap.get(n.relativePath) ?? "";
    const tags = extractTags(raw);
    tags.forEach(t => allTags.add(t));
    const folder = n.folder.split("/")[0] || "notes";
    allFolders.add(folder);

    nodeMap.set(n.relativePath, {
      id: sanitizeId(n.relativePath),
      title: n.title,
      relativePath: n.relativePath,
      folder,
      tags,
      type: getNoteTypeFromFolder(folder),
      outgoingCount: 0,
      backlinkCount: 0,
      isOrphan: false,
      exists: true,
    });
  });

  const idToNode = new Map<string, WikiNode>();
  nodeMap.forEach(node => idToNode.set(node.id, node));

  const seenEdges = new Set<string>();
  const edges: WikiEdge[] = [];
  let edgeCounter = 0;

  notes.forEach((n) => {
    const raw = contentMap.get(n.relativePath) ?? "";
    const sourceId = sanitizeId(n.relativePath);

    extractWikilinks(raw).forEach((link) => {
      const resolved = resolve(link);
      if (resolved?.relativePath === n.relativePath) return;

      const normLink = normalizeKey(link);
      const targetKey = resolved
        ? resolved.relativePath
        : `__missing__/${normLink}`;
      const targetId = resolved
        ? sanitizeId(resolved.relativePath)
        : sanitizeId(`missing_${normLink}`);

      const edgeKey = `${sourceId}→${targetId}`;
      if (seenEdges.has(edgeKey)) return;
      seenEdges.add(edgeKey);

      const isBroken = !resolved;

      if (isBroken && !nodeMap.has(targetKey)) {
        const virtual: WikiNode = {
          id: targetId,
          title: link,
          relativePath: targetKey,
          folder: "missing",
          tags: [],
          type: "missing",
          outgoingCount: 0,
          backlinkCount: 0,
          isOrphan: false,
          exists: false,
        };
        nodeMap.set(targetKey, virtual);
        idToNode.set(targetId, virtual);
      }

      edges.push({
        id: `e${edgeCounter++}`,
        source: sourceId,
        target: targetId,
        label: link,
        type: isBroken ? "broken" : "wikilink",
        weight: 1,
        isBacklink: false,
        isBroken,
      });
    });
  });

  edges.forEach((edge) => {
    const src = idToNode.get(edge.source);
    const tgt = idToNode.get(edge.target);
    if (src) src.outgoingCount++;
    if (tgt) tgt.backlinkCount++;
  });

  nodeMap.forEach((node) => {
    if (node.exists && node.outgoingCount === 0 && node.backlinkCount === 0) {
      node.isOrphan = true;
    }
  });

  const allNodes = Array.from(nodeMap.values());

  return {
    nodes: allNodes,
    edges,
    orphanNodes: allNodes.filter(n => n.isOrphan),
    brokenLinks: edges.filter(e => e.isBroken),
    tags: Array.from(allTags).sort(),
    folders: Array.from(allFolders).sort(),
  };
}
