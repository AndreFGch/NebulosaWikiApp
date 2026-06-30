import type { MarkdownFile } from "../../../domain/markdown/types";
import { WikiGraphStore } from "../domain";
import type { GraphProjection, GraphProjectionOptions } from "../projection";
import { createGraphProjection, createGraphProjectionDelta } from "../projection";
import type { GraphProjectionDelta, GraphProjectionDeltaRebuildReason } from "../projection";
import { createLogicalGraphSnapshot, WikiGraphIndex } from "../indexing";
import type { WikiGraphDelta } from "../indexing";
import { createVisualGraph } from "../visual/createVisualGraph";
import { createVisualGraphDelta } from "../visual/createVisualGraphDelta";
import type { GraphVisualSnapshot } from "../visual/graphVisualTypes";
import type { VisualGraphDelta } from "../visual/createVisualGraphDelta";
import type { GraphRuntimeUpdate } from "./runtimeUpdateTypes";

// ─── Module-level helpers ─────────────────────────────────────────────────────

function buildFullState(
  index: WikiGraphIndex,
  context: GraphProjectionOptions,
): { projection: GraphProjection; snapshot: GraphVisualSnapshot } {
  const store = new WikiGraphStore(createLogicalGraphSnapshot(index.getGraph()));
  const projection = createGraphProjection(store, context);
  const snapshot = createVisualGraph(store, projection);
  return { projection, snapshot };
}

function applyProjectionDelta(
  projection: GraphProjection,
  delta: Extract<GraphProjectionDelta, { kind: "incremental" }>,
): GraphProjection {
  const removedNodes = new Set(delta.removedNodeIds);
  const removedEdges = new Set(delta.removedEdgeIds);
  const updatedNodesById = new Map(delta.updatedNodes.map((n) => [n.id, n]));
  const updatedEdgesById = new Map(delta.updatedEdges.map((e) => [e.id, e]));

  return {
    ...projection,
    nodes: [
      ...projection.nodes
        .filter((n) => !removedNodes.has(n.id))
        .map((n) => updatedNodesById.get(n.id) ?? n),
      ...delta.addedNodes,
    ],
    edges: [
      ...projection.edges
        .filter((e) => !removedEdges.has(e.id))
        .map((e) => updatedEdgesById.get(e.id) ?? e),
      ...delta.addedEdges,
    ],
  };
}

function applyVisualDelta(
  snapshot: GraphVisualSnapshot,
  delta: Extract<VisualGraphDelta, { kind: "incremental" }>,
): GraphVisualSnapshot {
  const removedNodes = new Set(delta.removedNodeIds);
  const removedEdges = new Set(delta.removedEdgeIds);
  const updatedNodesById = new Map(delta.updatedNodes.map((n) => [n.id, n]));
  const updatedEdgesById = new Map(delta.updatedEdges.map((e) => [e.id, e]));

  return {
    rootNodeId: delta.nextRootNodeId,
    nodes: [
      ...snapshot.nodes
        .filter((n) => !removedNodes.has(n.id))
        .map((n) => updatedNodesById.get(n.id) ?? n),
      ...delta.addedNodes,
    ],
    edges: [
      ...snapshot.edges
        .filter((e) => !removedEdges.has(e.id))
        .map((e) => updatedEdgesById.get(e.id) ?? e),
      ...delta.addedEdges,
    ],
  };
}

// ─── Producer ─────────────────────────────────────────────────────────────────

export class GraphRuntimeUpdateProducer {
  private readonly _index = new WikiGraphIndex();
  private _projection: GraphProjection | null = null;
  private _snapshot: GraphVisualSnapshot | null = null;
  private _context: GraphProjectionOptions | null = null;
  private _sequence = 0;

  hydrate(
    notes: MarkdownFile[],
    contentMap: Map<string, string>,
    context: GraphProjectionOptions,
  ): GraphRuntimeUpdate {
    this._index.hydrate(notes, contentMap);
    const { projection, snapshot } = buildFullState(this._index, context);
    this._projection = projection;
    this._snapshot = snapshot;
    this._context = context;
    const sequence = ++this._sequence;
    return { kind: "init", sequence, snapshot };
  }

  upsertNote(
    note: MarkdownFile,
    content: string,
    context: GraphProjectionOptions,
  ): GraphRuntimeUpdate {
    this._assertHydrated("upsertNote");
    return this._applyMutation(() => this._index.upsertNote(note, content), context);
  }

  removeNote(
    relativePath: string,
    context: GraphProjectionOptions,
  ): GraphRuntimeUpdate {
    this._assertHydrated("removeNote");
    return this._applyMutation(() => this._index.removeNote(relativePath), context);
  }

  private _assertHydrated(op: string): void {
    if (this._projection === null) {
      throw new Error(`GraphRuntimeUpdateProducer: call hydrate() before ${op}()`);
    }
  }

  private _applyMutation(
    mutate: () => WikiGraphDelta,
    nextContext: GraphProjectionOptions,
  ): GraphRuntimeUpdate {
    const wikiDelta = mutate();
    const projDelta = createGraphProjectionDelta(
      this._projection!,
      wikiDelta,
      this._context!,
      nextContext,
    );

    if (projDelta.kind === "rebuild-required") {
      return this._rebuild(nextContext, projDelta.reason);
    }

    const visualDelta = createVisualGraphDelta(
      this._snapshot!,
      projDelta,
      (nodeId) => this._index.getConnectionCount(nodeId),
    );

    if (visualDelta.kind === "rebuild-required") {
      return this._rebuild(nextContext, visualDelta.reason);
    }

    this._projection = applyProjectionDelta(this._projection!, projDelta);
    this._snapshot = applyVisualDelta(this._snapshot!, visualDelta);
    this._context = nextContext;

    return { kind: "incremental", sequence: ++this._sequence, delta: visualDelta };
  }

  private _rebuild(
    context: GraphProjectionOptions,
    reason: GraphProjectionDeltaRebuildReason,
  ): GraphRuntimeUpdate {
    const { projection, snapshot } = buildFullState(this._index, context);
    this._projection = projection;
    this._snapshot = snapshot;
    this._context = context;
    return { kind: "rebuild", sequence: ++this._sequence, snapshot, reason };
  }
}
