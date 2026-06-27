import { normalizeKey } from "./normalizeKey";
import type { MarkdownFile } from "./types";

export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) return content;
  const closeIdx = content.indexOf("\n---", 4);
  if (closeIdx === -1) return content;
  return content.slice(closeIdx + 4).replace(/^[\n\r]+/, "");
}

export function preprocessWikilinks(content: string): string {
  return content
    .replace(/\[\[([^\]|\n]+)\|([^\]\n]+)\]\]/g, (_, name, alias) =>
      `[${alias.trim()}](#wikilink/${encodeURIComponent(name.trim())})`
    )
    .replace(/\[\[([^\]\n]+)\]\]/g, (_, name) =>
      `[${name.trim()}](#wikilink/${encodeURIComponent(name.trim())})`
    );
}

export function findNoteByWikilink(link: string, notes: MarkdownFile[]): MarkdownFile | null {
  const nk = normalizeKey(link);
  for (const note of notes) {
    if (normalizeKey(note.title) === nk) return note;
    const fname = note.relativePath.replace(/\.md$/i, "").split(/[/\\]/).pop() ?? "";
    if (normalizeKey(fname) === nk) return note;
  }
  return null;
}
