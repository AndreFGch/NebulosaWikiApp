import type cytoscape from "cytoscape";
import { coseLayoutConfig } from "./coseLayoutConfig";

export function runCoseLayout(cy: cytoscape.Core, onStop: () => void): void {
  const layoutRun = cy.layout({
    ...coseLayoutConfig,
  } as unknown as cytoscape.LayoutOptions);

  layoutRun.one("layoutstop", onStop);
  layoutRun.run();
}
