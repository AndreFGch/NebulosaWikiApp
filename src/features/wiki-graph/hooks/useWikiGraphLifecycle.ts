import { useEffect, type RefObject } from "react";
import cytoscape from "cytoscape";
import type { MarkdownFile } from "../../../domain/markdown/types";
import type { WikiGraph } from "../types";
import { buildGraphElements } from "../cytoscape/buildGraphElements";
import { GRAPH_STYLE } from "../cytoscape/graphStyle";
import { bindGraphEvents } from "../cytoscape/bindGraphEvents";
import { captureGraphState } from "../cytoscape/captureGraphState";
import {
  mergeSavedNodePositions,
  applyInitialGraphViewport,
  restoreGraphViewport,
} from "../cytoscape/restoreGraphState";
import { runCoseLayout } from "../layout/runCoseLayout";
import { buildRadialPositions } from "../layout/buildRadialPositions";
import { reconcileVelocities } from "../physics/reconcileVelocities";
import { createGraphSimulation } from "../physics/createGraphSimulation";

interface UseWikiGraphLifecycleParams {
  graphReady: boolean;
  wikiGraph: WikiGraph | null;
  graphContainerRef: RefObject<HTMLDivElement | null>;
  cyRef: RefObject<cytoscape.Core | null>;
  graphPositionsRef: RefObject<Map<string, { x: number; y: number }>>;
  graphViewportRef: RefObject<{ zoom: number; pan: { x: number; y: number } } | null>;
  hasInitializedGraphRef: RefObject<boolean>;
  velocitiesRef: RefObject<Map<string, { vx: number; vy: number }>>;
  alphaRef: RefObject<number>;
  rafRef: RefObject<number | null>;
  rootIdRef: RefObject<string | null>;
  notesRef: RefObject<MarkdownFile[]>;
  selectedNoteRef: RefObject<MarkdownFile | null>;
  onNodeClick: (note: MarkdownFile) => void;
  onBackgroundClick: () => void;
}

export function useWikiGraphLifecycle({
  graphReady,
  wikiGraph,
  graphContainerRef,
  cyRef,
  graphPositionsRef,
  graphViewportRef,
  hasInitializedGraphRef,
  velocitiesRef,
  alphaRef,
  rafRef,
  rootIdRef,
  notesRef,
  selectedNoteRef,
  onNodeClick,
  onBackgroundClick,
}: UseWikiGraphLifecycleParams): void {
  useEffect(() => {
    if (!graphReady || !wikiGraph || !graphContainerRef.current) return;

    const isFirstBuild = !hasInitializedGraphRef.current;
    const savedPositions = graphPositionsRef.current;

    const { elements, rootId, filteredEdges } = buildGraphElements(wikiGraph);

    const cy = cytoscape({
      container: graphContainerRef.current,
      elements,
      style: GRAPH_STYLE,
      userPanningEnabled: true,
      userZoomingEnabled: true,
      boxSelectionEnabled: false,
      minZoom: 0.45,
      maxZoom: 1.7,
      wheelSensitivity: 0.18,
    });

    const handleLayoutStop = () => {
      if (rootId) {
        const rootEl = cy.nodes(`#${rootId}`);
        if (!rootEl.empty()) rootEl.addClass("nw-root");
      }
      rootIdRef.current = rootId;

      if (isFirstBuild || !graphViewportRef.current) {
        applyInitialGraphViewport(cy);
      } else {
        restoreGraphViewport(cy, graphViewportRef.current);
      }
      hasInitializedGraphRef.current = true;

      // Build stable node/edge arrays for physics (graph is static after init)
      const nodeArr: cytoscape.NodeSingular[] = [];
      cy.nodes().forEach((n) => { nodeArr.push(n); });
      const nodeIdx = new Map<string, number>();
      nodeArr.forEach((n, i) => { nodeIdx.set(n.id(), i); });

      const edgeLinks: Array<{ si: number; ti: number }> = [];
      cy.edges().forEach((edge) => {
        const si = nodeIdx.get(edge.source().id());
        const ti = nodeIdx.get(edge.target().id());
        if (si !== undefined && ti !== undefined) edgeLinks.push({ si, ti });
      });

      const reconcileResult = reconcileVelocities(
        velocitiesRef.current,
        nodeArr.map((n) => n.id()),
        isFirstBuild
      );
      alphaRef.current = reconcileResult.alpha;

      const simulation = createGraphSimulation({
        cy,
        nodeArr,
        edgeLinks,
        velocities: velocitiesRef.current,
        alphaRef,
        rafRef,
      });
      simulation.start();
    };

    if (isFirstBuild) {
      runCoseLayout(cy, handleLayoutStop);
    } else {
      const positionMap = buildRadialPositions(wikiGraph.nodes, filteredEdges, rootId);
      mergeSavedNodePositions(positionMap, savedPositions, wikiGraph.nodes.map((node) => node.id));

      const layoutRun = cy.layout({
        name: "preset",
        positions: (node: any) => positionMap.get(node.id()) ?? { x: 0, y: 0 },
        fit: false,
        padding: 70,
      } as unknown as cytoscape.LayoutOptions);

      layoutRun.on("layoutstop", handleLayoutStop);
      layoutRun.run();
    }

    cy.on("free", "node", (evt) => {
      velocitiesRef.current.set(evt.target.id(), { vx: 0, vy: 0 });
      alphaRef.current = Math.max(alphaRef.current, 0.8);
    });

    bindGraphEvents(cy, {
      notesRef,
      selectedNoteRef,
      alphaRef,
      onNodeClick,
      onBackgroundClick,
    });

    cyRef.current = cy;
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // Capturar posiciones y viewport ANTES de destruir, mientras cy aún vive.
      const captured = captureGraphState(cy);
      graphPositionsRef.current = captured.positions;
      graphViewportRef.current = captured.viewport;

      cy.destroy();
      cyRef.current = null;
    };
  }, [graphReady, wikiGraph]);
}
