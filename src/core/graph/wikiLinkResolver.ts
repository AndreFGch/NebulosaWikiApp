import type { MarkdownFile } from "../../types/wiki";
import { normalizeKey } from "../markdown/markdownUtils";

export function findNoteByWikilink(link: string, notes: MarkdownFile[]): MarkdownFile | null {
  const nk = normalizeKey(link);
  for (const note of notes) {
    if (normalizeKey(note.title) === nk) return note;
    const fname = note.relativePath.replace(/\.md$/i, "").split(/[/\\]/).pop() ?? "";
    if (normalizeKey(fname) === nk) return note;
  }
  return null;
}
