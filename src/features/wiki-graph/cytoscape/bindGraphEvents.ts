import type cytoscape from "cytoscape";
import type { MarkdownFile } from "../../../domain/markdown/types";

export function bindGraphEvents(
  cy: cytoscape.Core,
  {
    notesRef,
    selectedNoteRef,
    alphaRef,
    onNodeClick,
    onBackgroundClick,
  }: {
    notesRef: { current: MarkdownFile[] };
    selectedNoteRef: { current: MarkdownFile | null };
    alphaRef: { current: number };
    onNodeClick: (note: MarkdownFile) => void;
    onBackgroundClick: () => void;
  }
): void {
  cy.on("mouseover", "node", (evt) => {
    const node = evt.target;
    node.addClass("nw-hovered");
    alphaRef.current = Math.max(alphaRef.current, 0.25);
    if (!selectedNoteRef.current) {
      const nodeId = node.id();
      cy.edges().forEach((e) => {
        if (e.source().id() === nodeId || e.target().id() === nodeId) {
          e.addClass("nw-connected-hover");
          const other = e.source().id() === nodeId ? e.target() : e.source();
          other.addClass("nw-neighbor");
        } else {
          e.addClass("nw-dimmed-hover");
        }
      });
      cy.nodes().forEach((n) => {
        if (n.id() !== nodeId && !n.hasClass("nw-neighbor")) {
          n.addClass("nw-dimmed");
        }
      });
    }
  });

  cy.on("mouseout", "node", (evt) => {
    evt.target.removeClass("nw-hovered");
    if (!selectedNoteRef.current) {
      cy.nodes().removeClass("nw-neighbor nw-dimmed");
      cy.edges().removeClass("nw-connected-hover nw-dimmed-hover");
    }
  });

  cy.on("tap", "node", (evt) => {
    if (!evt.target.data("exists")) return;
    const relPath: string = evt.target.data("relativePath");
    const note = notesRef.current.find((n) => n.relativePath === relPath);
    if (note) onNodeClick(note);
  });

  cy.on("tap", (evt) => {
    if (evt.target === cy) onBackgroundClick();
  });
}
