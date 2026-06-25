export type GraphNodeId = string & { readonly __brand: "GraphNodeId" };
export type GraphEdgeId = string & { readonly __brand: "GraphEdgeId" };

export function asNodeId(id: string): GraphNodeId {
  return id as GraphNodeId;
}

export function asEdgeId(id: string): GraphEdgeId {
  return id as GraphEdgeId;
}

/**
 * Nodo lógico del grafo — modelo semántico, no de renderer.
 * Sin posición, sin velocidad, sin clases CSS, sin referencias Cytoscape.
 */
export interface LogicalNode {
  readonly id: GraphNodeId;
  readonly title: string;
  readonly relativePath: string;
  readonly folder: string;
  readonly tags: readonly string[];
  readonly type: string;
  readonly exists: boolean;
}

/** Estado de resolución de una referencia de enlace en el índice lógico. */
export type GraphEdgeResolution = "resolved" | "broken";

/**
 * Arista dirigida y ponderada — relación entre dos nodos lógicos.
 * Sin estilos, sin estado de renderer.
 * isBacklink es consulta derivada (entrantes de un nodo), no propiedad estructural.
 */
export interface LogicalEdge {
  readonly id: GraphEdgeId;
  readonly source: GraphNodeId;
  readonly target: GraphNodeId;
  readonly label: string;
  readonly type: string;
  readonly weight: number;
  readonly resolution: GraphEdgeResolution;
}

/**
 * Snapshot inmutable del grafo lógico completo.
 * Fuente de verdad para construir proyecciones, layouts y física.
 */
export interface LogicalGraphSnapshot {
  readonly nodes: readonly LogicalNode[];
  readonly edges: readonly LogicalEdge[];
}

export type GraphNeighborDirection = "incoming" | "outgoing" | "both";
