import type cytoscape from "cytoscape";

export interface CapturedGraphState {
  positions: Map<string, { x: number; y: number }>;
  viewport: {
    zoom: number;
    pan: { x: number; y: number };
  };
}

export function captureGraphState(cy: cytoscape.Core): CapturedGraphState {
  const positions = new Map<string, { x: number; y: number }>();
  cy.nodes().forEach((n) => { positions.set(n.id(), n.position()); });

  return {
    positions,
    viewport: { zoom: cy.zoom(), pan: cy.pan() },
  };
}
