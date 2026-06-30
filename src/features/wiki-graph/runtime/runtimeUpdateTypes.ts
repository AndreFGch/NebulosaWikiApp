import type { GraphVisualSnapshot } from "../visual/graphVisualTypes";
import type { VisualGraphDelta } from "../visual/createVisualGraphDelta";
import type { GraphProjectionDeltaRebuildReason } from "../projection";

export type GraphRuntimeUpdate =
  | {
      readonly kind: "init";
      readonly sequence: number;
      readonly snapshot: GraphVisualSnapshot;
    }
  | {
      readonly kind: "incremental";
      readonly sequence: number;
      readonly delta: Extract<VisualGraphDelta, { readonly kind: "incremental" }>;
    }
  | {
      readonly kind: "rebuild";
      readonly sequence: number;
      readonly snapshot: GraphVisualSnapshot;
      readonly reason: GraphProjectionDeltaRebuildReason;
    };
