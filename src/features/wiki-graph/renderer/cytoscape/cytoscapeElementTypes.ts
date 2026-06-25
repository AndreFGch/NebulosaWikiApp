import type cytoscape from "cytoscape";
import type { GraphNodeId } from "../../domain";

export interface CytoscapeGraphElements {
  readonly rootNodeId: GraphNodeId | null;
  readonly elements: ReadonlyArray<cytoscape.ElementDefinition>;
}
