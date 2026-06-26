import type cytoscape from "cytoscape";

export function clampZoom(cy: cytoscape.Core): void {
  const z = cy.zoom();
  if (z < 0.55) cy.zoom(0.55);
  if (z > 1.2)  cy.zoom(1.2);
}

export function centerGraph(cy: cytoscape.Core): void {
  cy.fit(cy.elements(), 140);
  clampZoom(cy);
  cy.center(cy.elements());
}
