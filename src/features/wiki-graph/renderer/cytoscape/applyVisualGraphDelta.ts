import type cytoscape from "cytoscape";
import type { GraphNodeId } from "../../domain";
import type { VisualGraphDelta } from "../../visual/createVisualGraphDelta";
import { visualNodeToElement, visualEdgeToElement } from "./createCytoscapeElements";

type IncrementalDelta = Extract<VisualGraphDelta, { readonly kind: "incremental" }>;

export function applyVisualGraphDelta(
  cy: cytoscape.Core,
  delta: IncrementalDelta,
  currentRootNodeId: GraphNodeId | null,
): GraphNodeId | null {
  cy.batch(() => {
    // 1. Remove edges before nodes to avoid dangling-edge state
    for (const edgeId of delta.removedEdgeIds) {
      const el = cy.getElementById(edgeId as string);
      if (!el.empty()) el.remove();
    }

    // 2. Remove nodes (cy auto-removes incident edges, harmless if already gone)
    for (const nodeId of delta.removedNodeIds) {
      const el = cy.getElementById(nodeId as string);
      if (!el.empty()) el.remove();
    }

    // 3. Add nodes — position from existing neighbor or graph center
    for (const vn of delta.addedNodes) {
      const pos = resolveInitialPosition(cy, vn.id as string, delta);
      cy.add({ ...visualNodeToElement(vn), position: pos });
    }

    // 4. Update node data — position untouched
    for (const vn of delta.updatedNodes) {
      const n = cy.getElementById(vn.id as string);
      if (n.empty()) continue;
      const elData = visualNodeToElement(vn).data as Record<string, unknown>;
      for (const [key, val] of Object.entries(elData)) {
        if (key !== "id") n.data(key, val);
      }
    }

    // 5. Add edges
    for (const ve of delta.addedEdges) {
      cy.add(visualEdgeToElement(ve));
    }

    // 6. Update edge data
    for (const ve of delta.updatedEdges) {
      const e = cy.getElementById(ve.id as string);
      if (e.empty()) continue;
      e.data("edgeType", ve.edgeKind);
    }

    // 7. Transfer nw-root class only if root changed
    const nextRoot = delta.nextRootNodeId;
    if (currentRootNodeId !== nextRoot) {
      if (currentRootNodeId) {
        const prev = cy.getElementById(currentRootNodeId as string);
        if (!prev.empty()) prev.removeClass("nw-root");
      }
      if (nextRoot) {
        const next = cy.getElementById(nextRoot as string);
        if (!next.empty()) next.addClass("nw-root");
      }
    }
  });

  return delta.nextRootNodeId;
}

function resolveInitialPosition(
  cy: cytoscape.Core,
  newNodeId: string,
  delta: IncrementalDelta,
): { x: number; y: number } {
  for (const ve of delta.addedEdges) {
    const otherId =
      (ve.source as string) === newNodeId ? (ve.target as string) :
      (ve.target as string) === newNodeId ? (ve.source as string) : null;
    if (otherId === null) continue;
    const neighbor = cy.getElementById(otherId);
    if (!neighbor.empty()) return addOffset(neighbor.position(), newNodeId);
  }

  const ext = cy.extent();
  const centerX = (ext.x1 + ext.x2) / 2;
  const centerY = (ext.y1 + ext.y2) / 2;
  const base = Number.isFinite(centerX) && Number.isFinite(centerY)
    ? { x: centerX, y: centerY }
    : { x: 0, y: 0 };
  return addOffset(base, newNodeId);
}

function addOffset(base: { x: number; y: number }, id: string): { x: number; y: number } {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  const angle = (h % 360) * (Math.PI / 180);
  const radius = 80 + (h % 61);
  return { x: base.x + Math.cos(angle) * radius, y: base.y + Math.sin(angle) * radius };
}
