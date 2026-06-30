import { describe, expect, it } from "vitest";
import type { MarkdownFile } from "../../../domain/markdown/types";
import type { GraphProjectionOptions } from "../projection";
import { GraphRuntimeUpdateProducer } from "./GraphRuntimeUpdateProducer";

function makeNote(relativePath: string, folder: string): MarkdownFile {
  return { title: relativePath.replace(".md", ""), path: `D:/wiki/${relativePath}`, relativePath, folder };
}

const globalCtx: GraphProjectionOptions = {
  mode: "global",
  focusNodeId: null,
  visibleNodeTypes: ["notes"],
};

describe("GraphRuntimeUpdateProducer", () => {
  it("hydrate returns init with sequence 1", () => {
    const producer = new GraphRuntimeUpdateProducer();
    const result = producer.hydrate(
      [makeNote("notes/a.md", "notes")],
      new Map([["notes/a.md", ""]]),
      globalCtx,
    );
    expect(result.kind).toBe("init");
    expect(result.sequence).toBe(1);
  });

  it("new wikilink produces incremental with added edge and sequence 2", () => {
    const producer = new GraphRuntimeUpdateProducer();
    const noteA = makeNote("notes/a.md", "notes");
    const noteB = makeNote("notes/b.md", "notes");
    producer.hydrate([noteA, noteB], new Map([["notes/a.md", ""], ["notes/b.md", ""]]), globalCtx);

    const result = producer.upsertNote(noteA, "[[b]]", globalCtx);

    expect(result.kind).toBe("incremental");
    expect(result.sequence).toBe(2);
    if (result.kind === "incremental") {
      expect(result.delta.addedEdges.length).toBeGreaterThan(0);
    }
  });

  it("connection count of affected node updates in incremental delta", () => {
    const producer = new GraphRuntimeUpdateProducer();
    const noteA = makeNote("notes/a.md", "notes");
    const noteB = makeNote("notes/b.md", "notes");
    const init = producer.hydrate(
      [noteA, noteB],
      new Map([["notes/a.md", ""], ["notes/b.md", ""]]),
      globalCtx,
    );

    expect(init.kind).toBe("init");
    if (init.kind === "init") {
      const bBefore = init.snapshot.nodes.find((n) => n.relativePath === "notes/b.md");
      expect(bBefore?.connections).toBe(0);
    }

    const result = producer.upsertNote(noteA, "[[b]]", globalCtx);

    expect(result.kind).toBe("incremental");
    if (result.kind === "incremental") {
      const bAfter = result.delta.updatedNodes.find((n) => n.relativePath === "notes/b.md");
      expect(bAfter).toBeDefined();
      expect(bAfter?.connections).toBe(1);
    }
  });

  it("context change from global to local produces rebuild with explicit reason", () => {
    const producer = new GraphRuntimeUpdateProducer();
    const noteA = makeNote("notes/a.md", "notes");
    producer.hydrate([noteA], new Map([["notes/a.md", ""]]), globalCtx);

    const localCtx: GraphProjectionOptions = { mode: "local", focusNodeId: null, visibleNodeTypes: ["notes"] };
    const result = producer.upsertNote(noteA, "", localCtx);

    expect(result.kind).toBe("rebuild");
    if (result.kind === "rebuild") {
      expect(result.reason).toBe("projection-context-changed");
    }
  });

  it("re-hydrate increments sequence monotonically", () => {
    const producer = new GraphRuntimeUpdateProducer();
    const noteA = makeNote("notes/a.md", "notes");
    const first = producer.hydrate([noteA], new Map([["notes/a.md", ""]]), globalCtx);
    const second = producer.hydrate([noteA], new Map([["notes/a.md", ""]]), globalCtx);
    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
  });

  it("upsertNote with missing link adds ghost node with exists false and connections 1", () => {
    const missingCtx: GraphProjectionOptions = {
      mode: "global",
      focusNodeId: null,
      visibleNodeTypes: ["notes", "missing"],
    };
    const producer = new GraphRuntimeUpdateProducer();
    const noteA = makeNote("notes/a.md", "notes");
    producer.hydrate([noteA], new Map([["notes/a.md", ""]]), missingCtx);

    const result = producer.upsertNote(noteA, "[[Destino inexistente]]", missingCtx);

    expect(result.kind).toBe("incremental");
    if (result.kind === "incremental") {
      const ghost = result.delta.addedNodes.find((n) => n.exists === false);
      expect(ghost).toBeDefined();
      expect(ghost?.connections).toBe(1);
    }
  });

  it("upsertNote before hydrate throws an explicit error", () => {
    const producer = new GraphRuntimeUpdateProducer();
    const noteA = makeNote("notes/a.md", "notes");
    expect(() => producer.upsertNote(noteA, "", globalCtx)).toThrow(
      "call hydrate() before upsertNote()",
    );
  });
});
