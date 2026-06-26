import { useEffect, useRef, type RefObject } from "react";
import cytoscape from "cytoscape";
import type { MarkdownFile } from "../../../domain/markdown/types";
import type { WikiGraph } from "../types";
import { buildGraphElements } from "../cytoscape/buildGraphElements";
import { WikiGraphStore } from "../domain";
import { createLogicalGraphSnapshot } from "../indexing";
import { createGraphProjection } from "../projection";
import { createVisualGraph } from "../visual";
import { createCytoscapeElements } from "../renderer/cytoscape";
import { GRAPH_STYLE } from "../cytoscape/graphStyle";
import { bindGraphEvents } from "../cytoscape/bindGraphEvents";
import { captureGraphState } from "../cytoscape/captureGraphState";
import {
  mergeSavedNodePositions,
  applyInitialGraphViewport,
  restoreGraphViewport,
} from "../cytoscape/restoreGraphState";
import { centerGraph } from "../cytoscape/centerGraph";
import { buildRadialPositions } from "../layout/buildRadialPositions";
import { createInitialSettledPositions } from "../physics/createInitialSettledPositions";
import type { PhysicsEdgeLink } from "../physics/physicalGraphTypes";
import { reconcileVelocities } from "../physics/reconcileVelocities";
import { createGraphSimulation, PHYSICS_ALPHA_THRESHOLD } from "../physics/createGraphSimulation";
import type { GraphSimulationHandle } from "../physics/simulationTypes";

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
  const simulationRef = useRef<GraphSimulationHandle | null>(null);

  useEffect(() => {
    if (!graphReady || !wikiGraph || !graphContainerRef.current) return;

    const isFirstBuild = !hasInitializedGraphRef.current;
    const savedPositions = graphPositionsRef.current;

    let initialSettleRafId: number | null = null;
    let userInteractedDuringSettle = false;

    const { rootId: legacyRootId, filteredEdges } = buildGraphElements(wikiGraph);

    const snapshot = createLogicalGraphSnapshot(wikiGraph);
    const store = new WikiGraphStore(snapshot);

    const visibleNodeTypes = Array.from(
      new Set(store.getNodes().map((node) => node.type)),
    );

    const projection = createGraphProjection(store, {
      mode: "global",
      focusNodeId: null,
      visibleNodeTypes,
    });

    const visualGraph = createVisualGraph(store, projection);

    const initialNodeIds = visualGraph.nodes.map((node) => node.id);

    const initialNodeIndexById = new Map(
      initialNodeIds.map((nodeId, index) => [nodeId, index]),
    );

    const initialEdgeLinks: PhysicsEdgeLink[] = [];

    for (const edge of visualGraph.edges) {
      const si = initialNodeIndexById.get(edge.source);
      const ti = initialNodeIndexById.get(edge.target);

      if (si === undefined || ti === undefined) {
        continue;
      }

      initialEdgeLinks.push({ si, ti });
    }

    const initialRootNodeId = visualGraph.rootNodeId ?? legacyRootId;

    const { elements } = createCytoscapeElements(visualGraph);

    const cy = cytoscape({
      container: graphContainerRef.current,
      elements: [...elements],
      style: GRAPH_STYLE,
      userPanningEnabled: true,
      userZoomingEnabled: true,
      boxSelectionEnabled: false,
      minZoom: 0.45,
      maxZoom: 1.7,
      wheelSensitivity: 0.18,
    });

    const syncSimulationActivity = () => {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        simulationRef.current?.resume();
      } else {
        simulationRef.current?.pause();
      }
    };

    const handleLayoutStop = () => {
      if (legacyRootId) {
        const rootEl = cy.nodes(`#${legacyRootId}`);
        if (!rootEl.empty()) rootEl.addClass("nw-root");
      }
      rootIdRef.current = legacyRootId;

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
      simulationRef.current = simulation;
      syncSimulationActivity();

      // Solo en el primer montaje: el episodio de física a alpha=1.0 reacomoda
      // el grafo respecto al fit ya aplicado arriba. Re-centramos una sola vez
      // cuando la física cruza el mismo umbral que usa el motor para pasar a
      // modo ambient, salvo que el usuario ya haya intervenido (drag de nodo).
      if (isFirstBuild) {
        let hasRequestedSecondConvergence = false;
        const watchInitialSettle = () => {
          if (userInteractedDuringSettle) {
            initialSettleRafId = null;
            return;
          }
          if (alphaRef.current <= PHYSICS_ALPHA_THRESHOLD) {
            if (!hasRequestedSecondConvergence) {
              hasRequestedSecondConvergence = true;
              centerGraph(cy, alphaRef);
              initialSettleRafId = requestAnimationFrame(watchInitialSettle);
              return;
            }
            applyInitialGraphViewport(cy);
            initialSettleRafId = null;
            return;
          }
          initialSettleRafId = requestAnimationFrame(watchInitialSettle);
        };
        initialSettleRafId = requestAnimationFrame(watchInitialSettle);
      }
    };

    if (isFirstBuild) {
      const settledPositions = createInitialSettledPositions(
        initialNodeIds,
        initialEdgeLinks,
        initialRootNodeId,
      );

      cy.nodes().forEach((node) => {
        node.position(
          settledPositions.get(node.id()) ?? { x: 0, y: 0 },
        );
      });

      const layoutRun = cy.layout({
        name: "preset",
        fit: false,
        padding: 70,
      });

      layoutRun.on("layoutstop", handleLayoutStop);
      layoutRun.run();
    } else {
      const positionMap = buildRadialPositions(wikiGraph.nodes, filteredEdges, legacyRootId);
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
      userInteractedDuringSettle = true;
    });

    bindGraphEvents(cy, {
      notesRef,
      selectedNoteRef,
      onNodeClick,
      onBackgroundClick,
    });

    cyRef.current = cy;

    document.addEventListener("visibilitychange", syncSimulationActivity);
    window.addEventListener("blur", syncSimulationActivity);
    window.addEventListener("focus", syncSimulationActivity);
    syncSimulationActivity();

    return () => {
      document.removeEventListener("visibilitychange", syncSimulationActivity);
      window.removeEventListener("blur", syncSimulationActivity);
      window.removeEventListener("focus", syncSimulationActivity);

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (initialSettleRafId !== null) {
        cancelAnimationFrame(initialSettleRafId);
        initialSettleRafId = null;
      }
      simulationRef.current = null;

      // Capturar posiciones y viewport ANTES de destruir, mientras cy aún vive.
      const captured = captureGraphState(cy);
      graphPositionsRef.current = captured.positions;
      graphViewportRef.current = captured.viewport;

      cy.destroy();
      cyRef.current = null;
    };
  }, [graphReady, wikiGraph]);
}
