import type { Dispatch, RefObject, SetStateAction } from "react";
import type { WikiGraph } from "../types";
import { FOLDER_COLORS } from "../cytoscape/graphStyle";
import type { MarkdownFile } from "../../../domain/markdown/types";

interface WikiGraphPanelProps {
  wikiGraph: WikiGraph | null;
  graphViewMode: "global" | "local";
  setGraphViewMode: (mode: "global" | "local") => void;
  selectedNote: MarkdownFile | null;
  showToast: (kind: "success" | "error" | "info", message: string) => void;
  showGraphControls: boolean;
  setShowGraphControls: Dispatch<SetStateAction<boolean>>;
  onCenterGraph: () => void;
  graphReady: boolean;
  graphLoading: boolean;
  graphError: string | null;
  graphContainerRef: RefObject<HTMLDivElement | null>;
  visibleGraphTypes: string[];
  toggleGraphType: (type: string) => void;
  graphTypeLabels: { type: string; label: string }[];
}

export function WikiGraphPanel({
  wikiGraph,
  graphViewMode,
  setGraphViewMode,
  selectedNote,
  showToast,
  showGraphControls,
  setShowGraphControls,
  onCenterGraph,
  graphReady,
  graphLoading,
  graphError,
  graphContainerRef,
  visibleGraphTypes,
  toggleGraphType,
  graphTypeLabels,
}: WikiGraphPanelProps) {
  return (
    <>
      <div className="nw-graph-header">
        <span className="nw-graph-label">Grafo</span>
        {wikiGraph && (
          <span className="nw-graph-summary">
            {wikiGraph.nodes.filter(n => n.exists).length} nodos
            {" · "}
            {wikiGraph.edges.filter(e => !e.isBroken).length} enlaces
            {wikiGraph.orphanNodes.length > 0 && (
              <> · <span className="nw-graph-orphans">{wikiGraph.orphanNodes.length} huérfanas</span></>
            )}
            {wikiGraph.brokenLinks.length > 0 && (
              <> · <span className="nw-graph-broken">{wikiGraph.brokenLinks.length} rotos</span></>
            )}
          </span>
        )}
        <div className="nw-graph-chips">
          <span
            className={`nw-graph-chip${graphViewMode === "global" ? " nw-graph-chip--active" : ""}`}
            onClick={() => setGraphViewMode("global")}
            style={{ cursor: "pointer" }}
          >Global</span>
          <span
            className={`nw-graph-chip${graphViewMode === "local" ? " nw-graph-chip--active" : selectedNote ? " nw-graph-chip--focus" : " nw-graph-chip--dim"}`}
            onClick={() => { if (selectedNote) setGraphViewMode("local"); else showToast("info", "Seleccioná una nota primero"); }}
            style={{ cursor: selectedNote ? "pointer" : "default" }}
            title={!selectedNote ? "Seleccioná una nota para activar la vista local" : undefined}
          >Local</span>
          <span className="nw-graph-chip nw-graph-chip--dim">Índices ocultos</span>
        </div>
        {graphReady && (
          <>
            <button
              className={`nw-view-btn${showGraphControls ? " nw-view-btn--active" : ""}`}
              onClick={() => setShowGraphControls(v => !v)}
            >
              Controles
            </button>
            <button
              className="nw-view-btn"
              onClick={onCenterGraph}
            >
              Centrar
            </button>
          </>
        )}
      </div>
      {graphLoading && <p className="nw-graph-status">Actualizando grafo…</p>}
      {graphError && <p className="nw-graph-status nw-graph-status--error">Error: {graphError}</p>}
      <div className="nw-graph-canvas-wrapper">
        <div ref={graphContainerRef} className="nw-graph-container" />
        {graphReady && (
          <div className="nw-graph-overlay">
            {showGraphControls && (
              <div className="nw-graph-controls">
                <div className="nw-ctrl-section">
                  <span className="nw-ctrl-title">Vista</span>
                  <div className="nw-ctrl-row">
                    <span
                      className={`nw-ctrl-chip${graphViewMode === "global" ? " nw-ctrl-chip--active" : ""}`}
                      onClick={() => setGraphViewMode("global")}
                      style={{ cursor: "pointer" }}
                    >Global</span>
                    <span
                      className={`nw-ctrl-chip${graphViewMode === "local" ? " nw-ctrl-chip--active" : selectedNote ? "" : " nw-ctrl-chip--disabled"}`}
                      onClick={() => { if (selectedNote) setGraphViewMode("local"); else showToast("info", "Seleccioná una nota primero"); }}
                      style={{ cursor: selectedNote ? "pointer" : "default" }}
                      title={!selectedNote ? "Seleccioná una nota para activar la vista local" : undefined}
                    >Local</span>
                  </div>
                </div>
                <div className="nw-ctrl-section">
                  <span className="nw-ctrl-title">Mostrar</span>
                  <div className="nw-ctrl-row">
                    <span className="nw-ctrl-key">Labels</span>
                    <span className="nw-ctrl-val">Auto</span>
                  </div>
                  <div className="nw-ctrl-row">
                    <span className="nw-ctrl-key">Índices</span>
                    <span className="nw-ctrl-val">Off</span>
                  </div>
                  <div className="nw-ctrl-row">
                    <span className="nw-ctrl-key">Rotos</span>
                    <span className="nw-ctrl-val">On</span>
                  </div>
                </div>
                <div className="nw-ctrl-section">
                  <span className="nw-ctrl-title">Física</span>
                  <div className="nw-ctrl-row">
                    <span className="nw-ctrl-key">Motor</span>
                    <span className="nw-ctrl-val">Force</span>
                  </div>
                  <div className="nw-ctrl-row">
                    <span className="nw-ctrl-key">Centro</span>
                    <span className="nw-ctrl-val">Masa</span>
                  </div>
                  <div className="nw-ctrl-row">
                    <span className="nw-ctrl-key">Enlaces</span>
                    <span className="nw-ctrl-val">Suave</span>
                  </div>
                  <div className="nw-ctrl-row">
                    <span className="nw-ctrl-key">Ruido</span>
                    <span className="nw-ctrl-val">Bajo</span>
                  </div>
                </div>
                <div className="nw-ctrl-section">
                  <span className="nw-ctrl-title">Tipos</span>
                  <div className="nw-graph-type-filter">
                    {graphTypeLabels.map(({ type, label }) => {
                      const count = wikiGraph ? wikiGraph.nodes.filter(n => n.type === type).length : 0;
                      if (count === 0) return null;
                      const isActive = visibleGraphTypes.includes(type);
                      return (
                        <button
                          key={type}
                          className={`nw-graph-type-chip${isActive ? " nw-graph-type-chip--active" : " nw-graph-type-chip--disabled"}`}
                          onClick={() => toggleGraphType(type)}
                          title={isActive ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
                        >
                          {label}
                          <span className="nw-graph-type-count">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <div className="nw-graph-legend">
              {Object.entries(FOLDER_COLORS).map(([folder, color]) => (
                <div key={folder} className="nw-legend-item">
                  <span className="nw-legend-dot" style={{ backgroundColor: color }} />
                  <span className="nw-legend-label">{folder}</span>
                </div>
              ))}
              <div className="nw-legend-item">
                <span className="nw-legend-dot nw-legend-dot--orphan" />
                <span className="nw-legend-label">huérfana</span>
              </div>
              <div className="nw-legend-item">
                <span className="nw-legend-dot nw-legend-dot--missing" />
                <span className="nw-legend-label">faltante</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
