import { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import cytoscape from "cytoscape";
import "./App.css";

interface MarkdownFile {
  title: string;
  path: string;
  relativePath: string;
  folder: string;
}

interface WikiGraphNode {
  id: string;
  label: string;
  folder: string;
  relativePath: string;
}

interface WikiGraphEdge {
  source: string;
  target: string;
}

type ViewMode = "preview" | "raw" | "graph";

function sanitizeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "_");
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) return content;
  const closeIdx = content.indexOf("\n---", 4);
  if (closeIdx === -1) return content;
  return content.slice(closeIdx + 4).replace(/^[\n\r]+/, "");
}

function preprocessWikilinks(content: string): string {
  return content
    .replace(/\[\[([^\]|\n]+)\|([^\]\n]+)\]\]/g, (_, name, alias) =>
      `[${alias.trim()}](#wikilink/${encodeURIComponent(name.trim())})`
    )
    .replace(/\[\[([^\]\n]+)\]\]/g, (_, name) =>
      `[${name.trim()}](#wikilink/${encodeURIComponent(name.trim())})`
    );
}

function extractWikilinks(content: string): string[] {
  const links: string[] = [];
  const re = /\[\[([^\]|\n]+?)(?:\|[^\]\n]*)?\]\]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    links.push(m[1].trim());
  }
  return links;
}

const FOLDER_COLORS: Record<string, string> = {
  notes:    "#7c6af7",
  projects: "#4ade80",
  sources:  "#60a5fa",
  skills:   "#f472b6",
  sessions: "#fb923c",
  indexes:  "#facc15",
};

const GRAPH_STYLE: cytoscape.Stylesheet[] = [
  {
    selector: "node",
    style: {
      "background-color": "#2a2f42",
      "label": "data(label)",
      "color": "#b8bcce",
      "font-size": "11px",
      "font-family": "Inter, Avenir, Helvetica, Arial, sans-serif",
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 5,
      "width": 26,
      "height": 26,
      "border-width": 1.5,
      "border-color": "#3a3f52",
    },
  },
  ...Object.entries(FOLDER_COLORS).map(([folder, color]) => ({
    selector: `node[folder = "${folder}"]`,
    style: { "background-color": color, "border-color": color } as cytoscape.Css.Node,
  })),
  {
    selector: "node.nw-selected",
    style: {
      "border-color": "#ffffff",
      "border-width": 3,
    },
  },
  {
    selector: "edge",
    style: {
      "width": 1,
      "line-color": "#2a3048",
      "target-arrow-color": "#3a4060",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "opacity": 0.7,
      "arrow-scale": 0.7,
    },
  },
];

function App() {
  const [notes, setNotes] = useState<MarkdownFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNote, setSelectedNote] = useState<MarkdownFile | null>(null);
  const [noteContent, setNoteContent] = useState<string>("");
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");

  const [graphNodes, setGraphNodes] = useState<WikiGraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<WikiGraphEdge[]>([]);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [graphReady, setGraphReady] = useState(false);

  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  // Load note list on mount
  useEffect(() => {
    invoke<MarkdownFile[]>("list_markdown_files")
      .then((files) => { setNotes(files); setLoading(false); })
      .catch((err) => { setError(String(err)); setLoading(false); });
  }, []);

  const handleNoteClick = useCallback((note: MarkdownFile) => {
    setSelectedNote(note);
    setNoteContent("");
    setContentError(null);
    setContentLoading(true);
    invoke<string>("read_markdown_file", { relativePath: note.relativePath })
      .then((content) => { setNoteContent(content); setContentLoading(false); })
      .catch((err) => { setContentError(String(err)); setContentLoading(false); });
  }, []);

  // Build graph data the first time the user opens the graph view
  useEffect(() => {
    if (viewMode !== "graph" || graphReady || graphLoading || notes.length === 0) return;

    setGraphLoading(true);
    setGraphError(null);

    const noteIndex = new Map<string, string>();
    notes.forEach((n) => {
      noteIndex.set(n.title.toLowerCase(), n.relativePath);
      const filename = n.relativePath.toLowerCase().replace(/\.md$/, "").split("/").pop() ?? "";
      if (filename) noteIndex.set(filename, n.relativePath);
    });

    Promise.all(
      notes.map((note) =>
        invoke<string>("read_markdown_file", { relativePath: note.relativePath })
          .then((content) => ({ note, content }))
          .catch(() => ({ note, content: "" }))
      )
    ).then((results) => {
      const nodes: WikiGraphNode[] = notes.map((n) => ({
        id: sanitizeId(n.relativePath),
        label: n.title,
        folder: n.folder.split("/")[0] || "notes",
        relativePath: n.relativePath,
      }));

      const seen = new Set<string>();
      const edges: WikiGraphEdge[] = [];

      results.forEach(({ note, content }) => {
        extractWikilinks(content).forEach((target) => {
          const resolvedPath = noteIndex.get(target.toLowerCase());
          if (!resolvedPath || resolvedPath === note.relativePath) return;
          const key = `${note.relativePath}→${resolvedPath}`;
          if (!seen.has(key)) {
            seen.add(key);
            edges.push({ source: sanitizeId(note.relativePath), target: sanitizeId(resolvedPath) });
          }
        });
      });

      setGraphNodes(nodes);
      setGraphEdges(edges);
      setGraphReady(true);
      setGraphLoading(false);
    }).catch((err) => {
      setGraphError(String(err));
      setGraphLoading(false);
    });
  }, [viewMode, notes, graphReady, graphLoading]);

  // Initialize Cytoscape once graph data is ready and container is in the DOM
  useEffect(() => {
    if (viewMode !== "graph" || !graphReady || !graphContainerRef.current) return;

    cyRef.current?.destroy();

    const elements: cytoscape.ElementDefinition[] = [
      ...graphNodes.map((n) => ({
        data: { id: n.id, label: n.label, folder: n.folder, relativePath: n.relativePath },
      })),
      ...graphEdges.map((e, i) => ({
        data: { id: `e${i}`, source: e.source, target: e.target },
      })),
    ];

    const cy = cytoscape({
      container: graphContainerRef.current,
      elements,
      style: GRAPH_STYLE,
      layout: { name: "cose", padding: 48, animate: false } as cytoscape.LayoutOptions,
    });

    cy.on("tap", "node", (evt) => {
      const relPath: string = evt.target.data("relativePath");
      const note = notes.find((n) => n.relativePath === relPath);
      if (note) {
        cy.nodes().removeClass("nw-selected");
        evt.target.addClass("nw-selected");
        handleNoteClick(note);
      }
    });

    cyRef.current = cy;
    return () => { cy.destroy(); cyRef.current = null; };
  }, [viewMode, graphReady, graphNodes, graphEdges, notes, handleNoteClick]);

  // Keep selected node highlighted when note changes from outside the graph
  useEffect(() => {
    if (!cyRef.current || !selectedNote) return;
    cyRef.current.nodes().removeClass("nw-selected");
    cyRef.current.$(`#${sanitizeId(selectedNote.relativePath)}`).addClass("nw-selected");
  }, [selectedNote]);

  return (
    <main className="nw-container">
      <header className="nw-header">
        <h1 className="nw-title">Nebulosa Wiki</h1>
        <p className="nw-subtitle">Wiki Markdown local, portable y preparada para Claude Code.</p>
      </header>

      <section className="nw-info">
        <span className="nw-info-label">Carpeta wiki</span>
        <code className="nw-path">D:\NebulosaWiki</code>
      </section>

      <section className="nw-status">
        {loading && <span className="nw-status-loading">Cargando notas...</span>}
        {error && <span className="nw-status-error">Error: {error}</span>}
        {!loading && !error && (
          <span className="nw-status-ok">{notes.length} notas encontradas</span>
        )}
      </section>

      {!loading && !error && notes.length > 0 && (
        <div className="nw-workspace">
          <section className="nw-notes">
            <ul className="nw-note-list">
              {notes.map((note) => (
                <li
                  className={`nw-note-item${selectedNote?.relativePath === note.relativePath ? " nw-note-item--selected" : ""}`}
                  key={note.relativePath}
                  onClick={() => handleNoteClick(note)}
                >
                  <span className="nw-note-folder">{note.folder || "/"}</span>
                  <span className="nw-note-title">{note.title}</span>
                  <code className="nw-note-path">{note.relativePath}</code>
                </li>
              ))}
            </ul>
          </section>

          <section className="nw-viewer">
            {/* Header — always visible */}
            <div className="nw-viewer-header">
              <span className="nw-viewer-title">
                {viewMode === "graph" ? "Grafo de la wiki" : (selectedNote?.title ?? "—")}
              </span>
              <div className="nw-view-toggle">
                <button
                  className={`nw-view-btn${viewMode === "preview" ? " nw-view-btn--active" : ""}`}
                  onClick={() => setViewMode("preview")}
                >
                  Preview
                </button>
                <button
                  className={`nw-view-btn${viewMode === "raw" ? " nw-view-btn--active" : ""}`}
                  onClick={() => setViewMode("raw")}
                >
                  Raw
                </button>
                <button
                  className={`nw-view-btn${viewMode === "graph" ? " nw-view-btn--active" : ""}`}
                  onClick={() => setViewMode("graph")}
                >
                  Grafo
                </button>
              </div>
              {viewMode === "graph" && graphReady && (
                <span className="nw-graph-summary">
                  {graphNodes.length} nodos · {graphEdges.length} enlaces
                </span>
              )}
              {viewMode !== "graph" && selectedNote && (
                <code className="nw-viewer-path">{selectedNote.relativePath}</code>
              )}
            </div>

            {/* Graph view */}
            {viewMode === "graph" && (
              <>
                {graphLoading && <p className="nw-viewer-loading">Construyendo grafo...</p>}
                {graphError && <p className="nw-viewer-error">Error: {graphError}</p>}
                {!graphLoading && !graphError && (
                  <div ref={graphContainerRef} className="nw-graph-container" />
                )}
              </>
            )}

            {/* Preview / Raw — no note selected */}
            {viewMode !== "graph" && !selectedNote && (
              <p className="nw-viewer-empty">Seleccioná una nota para ver su contenido.</p>
            )}

            {/* Preview / Raw — note selected */}
            {viewMode !== "graph" && selectedNote && (
              <>
                {contentLoading && <p className="nw-viewer-loading">Cargando contenido...</p>}
                {contentError && <p className="nw-viewer-error">Error: {contentError}</p>}
                {!contentLoading && !contentError && viewMode === "preview" && (
                  <div className="nw-markdown-preview">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => {
                          if (href?.startsWith("#wikilink/")) {
                            return <span className="nw-wikilink">{children}</span>;
                          }
                          return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
                        },
                      }}
                    >
                      {preprocessWikilinks(stripFrontmatter(noteContent))}
                    </ReactMarkdown>
                  </div>
                )}
                {!contentLoading && !contentError && viewMode === "raw" && (
                  <pre className="nw-viewer-content">{noteContent}</pre>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
