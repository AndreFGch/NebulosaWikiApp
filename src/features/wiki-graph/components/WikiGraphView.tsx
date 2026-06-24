import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type cytoscape from "cytoscape";
import type { MarkdownFile } from "../../../domain/markdown/types";
import type { WikiGraph } from "../types";
import { sanitizeId } from "../model/buildWikiGraph";
import { centerGraph } from "../cytoscape/centerGraph";
import { useWikiGraphLifecycle } from "../hooks/useWikiGraphLifecycle";
import { WikiGraphPanel } from "./WikiGraphPanel";

const GRAPH_TYPE_LABELS: { type: string; label: string }[] = [
  { type: "notes",     label: "Notas" },
  { type: "projects",  label: "Proyectos" },
  { type: "sources",   label: "Fuentes" },
  { type: "sessions",  label: "Sesiones" },
  { type: "skills",    label: "Skills" },
  { type: "indexes",   label: "Índices" },
  { type: "missing",   label: "Faltantes" },
];

const ALL_GRAPH_TYPES = GRAPH_TYPE_LABELS.map(t => t.type);

interface WikiGraphViewProps {
  notes: MarkdownFile[];
  wikiGraph: WikiGraph | null;
  graphReady: boolean;
  graphLoading: boolean;
  graphError: string | null;
  selectedNote: MarkdownFile | null;
  onNoteClick: (note: MarkdownFile) => void;
  onClearSelection: () => void;
  showToast: (kind: "success" | "error" | "info", message: string) => void;
  graphPositionsRef: RefObject<Map<string, { x: number; y: number }>>;
  graphViewportRef: RefObject<{ zoom: number; pan: { x: number; y: number } } | null>;
  velocitiesRef: RefObject<Map<string, { vx: number; vy: number }>>;
  alphaRef: RefObject<number>;
  rootIdRef: RefObject<string | null>;
  hasInitializedGraphRef: RefObject<boolean>;
}

export default function WikiGraphView({
  notes,
  wikiGraph,
  graphReady,
  graphLoading,
  graphError,
  selectedNote,
  onNoteClick,
  onClearSelection,
  showToast,
  graphPositionsRef,
  graphViewportRef,
  velocitiesRef,
  alphaRef,
  rootIdRef,
  hasInitializedGraphRef,
}: WikiGraphViewProps) {
  const [showGraphControls, setShowGraphControls] = useState(false);
  const [visibleGraphTypes, setVisibleGraphTypes] = useState<string[]>(ALL_GRAPH_TYPES);
  const [graphViewMode, setGraphViewMode] = useState<"global" | "local">("global");

  const toggleGraphType = (type: string) => {
    setVisibleGraphTypes(prev => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const rafRef = useRef<number | null>(null);
  const notesRef = useRef<MarkdownFile[]>(notes);
  const selectedNoteRef = useRef<MarkdownFile | null>(selectedNote);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const onNoteClickRef = useRef(onNoteClick);
  useEffect(() => { onNoteClickRef.current = onNoteClick; }, [onNoteClick]);

  const onClearSelectionRef = useRef(onClearSelection);
  useEffect(() => { onClearSelectionRef.current = onClearSelection; }, [onClearSelection]);

  useWikiGraphLifecycle({
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
    onNodeClick: (note) => onNoteClickRef.current(note),
    onBackgroundClick: () => onClearSelectionRef.current(),
  });

  useEffect(() => {
    selectedNoteRef.current = selectedNote;

    const cy = cyRef.current;
    if (!cy) return;

    cy.nodes().removeClass("nw-selected nw-neighbor nw-dimmed");
    cy.edges().removeClass("nw-connected nw-dimmed-edge nw-connected-hover nw-dimmed-hover");

    if (!selectedNote) return;

    const nodeId = sanitizeId(selectedNote.relativePath);
    const target = cy.nodes(`#${nodeId}`);
    if (target.empty()) return;

    target.addClass("nw-selected");

    const neighborIds = new Set<string>();
    cy.edges().forEach((e) => {
      const src = e.source().id();
      const tgt = e.target().id();
      if (src === nodeId) { e.addClass("nw-connected"); neighborIds.add(tgt); }
      else if (tgt === nodeId) { e.addClass("nw-connected"); neighborIds.add(src); }
      else e.addClass("nw-dimmed-edge");
    });

    cy.nodes().forEach((n) => {
      const id = n.id();
      if (id === nodeId) return;
      if (neighborIds.has(id)) n.addClass("nw-neighbor");
      else n.addClass("nw-dimmed");
    });
  }, [selectedNote]);

  useEffect(() => {
    if (!selectedNote && graphViewMode === "local") setGraphViewMode("global");
  }, [selectedNote, graphViewMode]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !graphReady) return;
    const visibleSet = new Set(visibleGraphTypes);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cya = cy as any;

    if (graphViewMode === "local" && selectedNote) {
      const centerId = sanitizeId(selectedNote.relativePath);
      const centerNode = cy.getElementById(centerId);

      if (centerNode.empty()) {
        const toShow = cy.nodes().filter(n => visibleSet.has(n.data("noteType") as string));
        const toHide = cy.nodes().filter(n => !visibleSet.has(n.data("noteType") as string));
        cya.edges().show();
        (toShow as any).show();
        (toHide as any).hide();
        (toHide.connectedEdges() as any).hide();
        return;
      }

      const relatedEdges = centerNode.connectedEdges();
      const neighborNodes = relatedEdges.connectedNodes().not(centerNode);

      const localNodeIds = new Set<string>([centerId]);
      neighborNodes.forEach((n) => {
        localNodeIds.add(n.id());
      });

      const relatedEdgeIds = new Set<string>();
      relatedEdges.forEach((e) => {
        relatedEdgeIds.add(e.id());
      });

      cy.nodes().forEach((n) => {
        if (localNodeIds.has(n.id()) && visibleSet.has(n.data("noteType") as string)) (n as any).show();
        else (n as any).hide();
      });

      cya.edges().forEach((e: any) => {
        if (
          relatedEdgeIds.has(e.id()) &&
          visibleSet.has(cy.getElementById(e.data("source")).data("noteType") as string) &&
          visibleSet.has(cy.getElementById(e.data("target")).data("noteType") as string)
        ) e.show();
        else e.hide();
      });
    } else {
      const toShow = cy.nodes().filter(n => visibleSet.has(n.data("noteType") as string));
      const toHide = cy.nodes().filter(n => !visibleSet.has(n.data("noteType") as string));
      cya.edges().show();
      (toShow as any).show();
      (toHide as any).hide();
      (toHide.connectedEdges() as any).hide();
    }
  }, [visibleGraphTypes, graphReady, graphViewMode, selectedNote]);

  const handleCenterGraph = () => {
    if (cyRef.current) centerGraph(cyRef.current, alphaRef);
  };

  const graphTypeLabels = useMemo(() => GRAPH_TYPE_LABELS, []);

  return (
    <WikiGraphPanel
      wikiGraph={wikiGraph}
      graphViewMode={graphViewMode}
      setGraphViewMode={setGraphViewMode}
      selectedNote={selectedNote}
      showToast={showToast}
      showGraphControls={showGraphControls}
      setShowGraphControls={setShowGraphControls}
      onCenterGraph={handleCenterGraph}
      graphReady={graphReady}
      graphLoading={graphLoading}
      graphError={graphError}
      graphContainerRef={graphContainerRef}
      visibleGraphTypes={visibleGraphTypes}
      toggleGraphType={toggleGraphType}
      graphTypeLabels={graphTypeLabels}
    />
  );
}
