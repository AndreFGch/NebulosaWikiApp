import type { GraphNodeId, GraphEdgeId } from "../domain";

export type GraphVisualNodeKind = "existing" | "missing" | "orphan";
export type GraphVisualEdgeKind = "wikilink" | "broken";

export interface GraphVisualNode {
  readonly id: GraphNodeId;
  readonly label: string;
  readonly folder: string;
  readonly relativePath: string;
  readonly noteType: string;
  readonly nodeKind: GraphVisualNodeKind;
  readonly exists: boolean;
  readonly connections: number;
}

export interface GraphVisualEdge {
  readonly id: GraphEdgeId;
  readonly source: GraphNodeId;
  readonly target: GraphNodeId;
  readonly edgeKind: GraphVisualEdgeKind;
}

export interface GraphVisualSnapshot {
  readonly rootNodeId: GraphNodeId | null;
  readonly nodes: ReadonlyArray<GraphVisualNode>;
  readonly edges: ReadonlyArray<GraphVisualEdge>;
}
