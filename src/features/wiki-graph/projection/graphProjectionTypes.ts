import type { GraphNodeId, LogicalNode, LogicalEdge } from "../domain";

export type GraphProjectionMode = "global" | "local";

export interface GraphProjectionOptions {
  readonly mode: GraphProjectionMode;
  readonly focusNodeId: GraphNodeId | null;
  readonly visibleNodeTypes: readonly string[];
}

export interface GraphProjection {
  readonly requestedMode: GraphProjectionMode;
  readonly effectiveMode: GraphProjectionMode;
  readonly focusNodeId: GraphNodeId | null;
  readonly nodes: ReadonlyArray<LogicalNode>;
  readonly edges: ReadonlyArray<LogicalEdge>;
}
