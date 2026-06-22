import type cytoscape from "cytoscape";
import { clampZoom } from "./centerGraph";

export function mergeSavedNodePositions(
  positionMap: Map<string, { x: number; y: number }>,
  savedPositions: Map<string, { x: number; y: number }>,
  nodeIds: string[]
): void {
  for (const id of nodeIds) {
    const saved = savedPositions.get(id);
    if (saved) positionMap.set(id, saved);
  }
}

export function applyInitialGraphViewport(cy: cytoscape.Core): void {
  cy.fit(cy.elements(), 140);
  clampZoom(cy);
  cy.center(cy.elements());
}

export function restoreGraphViewport(
  cy: cytoscape.Core,
  viewport: { zoom: number; pan: { x: number; y: number } }
): void {
  cy.zoom(viewport.zoom);
  cy.pan(viewport.pan);
}
