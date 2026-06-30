import { describe, expect, it } from "vitest";
import type { MarkdownFile } from "../../../domain/markdown/types";
import type { WikiEdge, WikiGraph } from "../types";
import { buildWikiGraph, sanitizeId } from "./buildWikiGraph";

function note(relativePath: string, title: string): MarkdownFile {
  return {
    title,
    path: relativePath,
    relativePath,
    folder: "notes",
  };
}

function contentWith(links: readonly string[]): string {
  return links.map((link) => `[[${link}]]`).join("\n");
}

function getEdge(
  graph: WikiGraph,
  sourcePath: string,
  targetPath: string,
): WikiEdge {
  const sourceId = sanitizeId(sourcePath);
  const targetId = sanitizeId(targetPath);

  const edge = graph.edges.find(
    (candidate) =>
      candidate.source === sourceId &&
      candidate.target === targetId,
  );

  if (!edge) {
    throw new Error(
      `Expected edge not found: ${sourcePath} -> ${targetPath}`,
    );
  }

  return edge;
}

describe("buildWikiGraph stable edge IDs", () => {
  const notes = [
    note("notes/a.md", "A"),
    note("notes/b.md", "B"),
    note("notes/c.md", "C"),
    note("notes/d.md", "D"),
  ];

  it("preserves existing IDs when a new earlier edge is added", () => {
    const before = buildWikiGraph(
      notes,
      new Map([
        ["notes/a.md", contentWith(["C"])],
        ["notes/b.md", contentWith(["D"])],
        ["notes/c.md", ""],
        ["notes/d.md", ""],
      ]),
    );

    const after = buildWikiGraph(
      notes,
      new Map([
        ["notes/a.md", contentWith(["C", "D"])],
        ["notes/b.md", contentWith(["D"])],
        ["notes/c.md", ""],
        ["notes/d.md", ""],
      ]),
    );

    const edgeACBefore = getEdge(before, "notes/a.md", "notes/c.md");
    const edgeBDBefore = getEdge(before, "notes/b.md", "notes/d.md");

    const edgeACAfter = getEdge(after, "notes/a.md", "notes/c.md");
    const edgeADAfter = getEdge(after, "notes/a.md", "notes/d.md");
    const edgeBDAfter = getEdge(after, "notes/b.md", "notes/d.md");

    expect(edgeACAfter.id).toBe(edgeACBefore.id);
    expect(edgeBDAfter.id).toBe(edgeBDBefore.id);

    expect(edgeADAfter.id).not.toBe(edgeBDBefore.id);
    expect(before.edges.map((edge) => edge.id)).not.toContain(edgeADAfter.id);

    const finalIds = after.edges.map((edge) => edge.id);
    expect(new Set(finalIds).size).toBe(finalIds.length);
  });
});
