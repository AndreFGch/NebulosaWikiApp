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

interface WikiNode {
  id: string;
  title: string;
  relativePath: string;
  folder: string;
  tags: string[];
  type: string;
  outgoingCount: number;
  backlinkCount: number;
  isOrphan: boolean;
  exists: boolean;
}

interface WikiEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
  weight: number;
  isBacklink: boolean;
  isBroken: boolean;
}

interface WikiGraph {
  nodes: WikiNode[];
  edges: WikiEdge[];
  orphanNodes: WikiNode[];
  brokenLinks: WikiEdge[];
  tags: string[];
  folders: string[];
}

type DetailMode = "preview" | "raw";

function sanitizeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "_");
}

function normalizeKey(s: string): string {
  return s
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[-_/\\]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFrontmatterTitle(rawContent: string): string | null {
  if (!rawContent.startsWith("---\n") && !rawContent.startsWith("---\r\n")) return null;
  const closeIdx = rawContent.indexOf("\n---", 4);
  if (closeIdx === -1) return null;
  const fm = rawContent.slice(4, closeIdx);
  const m = fm.match(/^(?:titulo|title):\s*(.+)/mi);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : null;
}

function getNoteTypeFromFolder(folder: string): string {
  const top = folder.split("/")[0].toLowerCase();
  const known = ["notes", "projects", "sources", "skills", "sessions", "indexes", "inbox", "templates"];
  return known.includes(top) ? top : "notes";
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) return content;
  const closeIdx = content.indexOf("\n---", 4);
  if (closeIdx === -1) return content;
  return content.slice(closeIdx + 4).replace(/^[\n\r]+/, "");
}

function stripCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, " ");
}

function stripInlineCode(content: string): string {
  return content.replace(/`[^`\n]+`/g, " ");
}

function extractTags(rawContent: string): string[] {
  if (!rawContent.startsWith("---\n") && !rawContent.startsWith("---\r\n")) return [];
  const closeIdx = rawContent.indexOf("\n---", 4);
  if (closeIdx === -1) return [];
  const fm = rawContent.slice(4, closeIdx);

  const inline = fm.match(/^tags:\s*\[([^\]]*)\]/m);
  if (inline) {
    return inline[1].split(",").map(t => t.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  }

  const block = fm.match(/^tags:\s*\n((?:[ \t]*-[ \t]*.+\n?)*)/m);
  if (block) {
    return block[1]
      .split("\n")
      .map(line => { const m = line.match(/^[ \t]*-[ \t]*(.+)/); return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : ""; })
      .filter(Boolean);
  }

  return [];
}

function extractWikilinks(content: string): string[] {
  const cleaned = stripInlineCode(stripCodeBlocks(content));
  const links: string[] = [];
  const re = /\[\[([^\]|\n]+?)(?:\|[^\]\n]*)?\]\]/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    links.push(m[1].trim());
  }
  return links;
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

function buildWikiGraph(notes: MarkdownFile[], contentMap: Map<string, string>): WikiGraph {
  const index = new Map<string, MarkdownFile>();

  function addKey(key: string, note: MarkdownFile) {
    const nk = normalizeKey(key);
    if (nk && !index.has(nk)) index.set(nk, note);
  }

  notes.forEach((n) => {
    const raw = contentMap.get(n.relativePath) ?? "";
    addKey(n.title, n);
    const fname = n.relativePath.replace(/\.md$/i, "").split(/[/\\]/).pop() ?? "";
    if (fname) addKey(fname, n);
    const fmTitle = extractFrontmatterTitle(raw);
    if (fmTitle) addKey(fmTitle, n);
  });

  function resolve(link: string): MarkdownFile | undefined {
    return index.get(normalizeKey(link));
  }

  const allTags = new Set<string>();
  const allFolders = new Set<string>();
  const nodeMap = new Map<string, WikiNode>();

  notes.forEach((n) => {
    const raw = contentMap.get(n.relativePath) ?? "";
    const tags = extractTags(raw);
    tags.forEach(t => allTags.add(t));
    const folder = n.folder.split("/")[0] || "notes";
    allFolders.add(folder);

    nodeMap.set(n.relativePath, {
      id: sanitizeId(n.relativePath),
      title: n.title,
      relativePath: n.relativePath,
      folder,
      tags,
      type: getNoteTypeFromFolder(folder),
      outgoingCount: 0,
      backlinkCount: 0,
      isOrphan: false,
      exists: true,
    });
  });

  const idToNode = new Map<string, WikiNode>();
  nodeMap.forEach(node => idToNode.set(node.id, node));

  const seenEdges = new Set<string>();
  const edges: WikiEdge[] = [];
  let edgeCounter = 0;

  notes.forEach((n) => {
    const raw = contentMap.get(n.relativePath) ?? "";
    const sourceId = sanitizeId(n.relativePath);

    extractWikilinks(raw).forEach((link) => {
      const resolved = resolve(link);
      if (resolved?.relativePath === n.relativePath) return;

      const normLink = normalizeKey(link);
      const targetKey = resolved
        ? resolved.relativePath
        : `__missing__/${normLink}`;
      const targetId = resolved
        ? sanitizeId(resolved.relativePath)
        : sanitizeId(`missing_${normLink}`);

      const edgeKey = `${sourceId}→${targetId}`;
      if (seenEdges.has(edgeKey)) return;
      seenEdges.add(edgeKey);

      const isBroken = !resolved;

      if (isBroken && !nodeMap.has(targetKey)) {
        const virtual: WikiNode = {
          id: targetId,
          title: link,
          relativePath: targetKey,
          folder: "missing",
          tags: [],
          type: "missing",
          outgoingCount: 0,
          backlinkCount: 0,
          isOrphan: false,
          exists: false,
        };
        nodeMap.set(targetKey, virtual);
        idToNode.set(targetId, virtual);
      }

      edges.push({
        id: `e${edgeCounter++}`,
        source: sourceId,
        target: targetId,
        label: link,
        type: isBroken ? "broken" : "wikilink",
        weight: 1,
        isBacklink: false,
        isBroken,
      });
    });
  });

  edges.forEach((edge) => {
    const src = idToNode.get(edge.source);
    const tgt = idToNode.get(edge.target);
    if (src) src.outgoingCount++;
    if (tgt) tgt.backlinkCount++;
  });

  nodeMap.forEach((node) => {
    if (node.exists && node.outgoingCount === 0 && node.backlinkCount === 0) {
      node.isOrphan = true;
    }
  });

  const allNodes = Array.from(nodeMap.values());

  return {
    nodes: allNodes,
    edges,
    orphanNodes: allNodes.filter(n => n.isOrphan),
    brokenLinks: edges.filter(e => e.isBroken),
    tags: Array.from(allTags).sort(),
    folders: Array.from(allFolders).sort(),
  };
}

const FOLDER_COLORS: Record<string, string> = {
  notes:    "#6259b3",
  projects: "#2e8a5e",
  sources:  "#2f6fa8",
  skills:   "#984070",
  sessions: "#956030",
  indexes:  "#8a7825",
};

const GRAPH_STYLE: cytoscape.Stylesheet[] = [
  {
    selector: "node",
    style: {
      "background-color": "#2e3450",
      "label": "data(label)",
      "color": "#40475e",
      "font-size": "9px",
      "font-family": "Inter, Avenir, Helvetica, Arial, sans-serif",
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 4,
      "width": 12,
      "height": 12,
      "border-width": 0,
      "text-wrap": "ellipsis",
      "text-max-width": "80px",
    },
  },
  ...Object.entries(FOLDER_COLORS).map(([folder, color]) => ({
    selector: `node[folder = "${folder}"]`,
    style: { "background-color": color } as cytoscape.Css.Node,
  })),
  {
    selector: 'node[nodeType = "missing"]',
    style: {
      "background-color": "#252535",
      "border-width": 1,
      "border-color": "#4a4a5e",
      "border-style": "dashed",
      "width": 8,
      "height": 8,
      "opacity": 0.5,
    } as cytoscape.Css.Node,
  },
  {
    selector: 'node[nodeType = "orphan"]',
    style: {
      "border-width": 1.5,
      "border-color": "#956030",
      "opacity": 0.65,
    } as cytoscape.Css.Node,
  },
  {
    selector: "node.nw-hovered",
    style: {
      "color": "#9ea3be",
      "font-size": "10px",
      "z-index": 10,
    },
  },
  {
    selector: "node.nw-selected",
    style: {
      "width": 16,
      "height": 16,
      "border-width": 2,
      "border-color": "#e2e4ee",
      "color": "#e2e4ee",
      "font-size": "11px",
      "z-index": 20,
    },
  },
  {
    selector: "edge",
    style: {
      "width": 0.75,
      "line-color": "#18203a",
      "target-arrow-shape": "none",
      "curve-style": "bezier",
      "opacity": 0.5,
    },
  },
  {
    selector: 'edge[edgeType = "broken"]',
    style: {
      "line-color": "#4a2222",
      "line-style": "dashed",
      "opacity": 0.3,
    } as cytoscape.Css.Edge,
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
  const [detailMode, setDetailMode] = useState<DetailMode>("preview");

  const [wikiGraph, setWikiGraph] = useState<WikiGraph | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [graphReady, setGraphReady] = useState(false);

  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

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

  useEffect(() => {
    if (graphReady || graphLoading || notes.length === 0) return;

    setGraphLoading(true);
    setGraphError(null);

    Promise.all(
      notes.map((note) =>
        invoke<string>("read_markdown_file", { relativePath: note.relativePath })
          .then((content) => [note.relativePath, content] as [string, string])
          .catch(() => [note.relativePath, ""] as [string, string])
      )
    ).then((pairs) => {
      const contentMap = new Map<string, string>(pairs);
      const graph = buildWikiGraph(notes, contentMap);
      setWikiGraph(graph);
      setGraphReady(true);
      setGraphLoading(false);
    }).catch((err) => {
      setGraphError(String(err));
      setGraphLoading(false);
    });
  }, [notes, graphReady, graphLoading]);

  useEffect(() => {
    if (!graphReady || !wikiGraph || !graphContainerRef.current) return;

    cyRef.current?.destroy();

    const elements: cytoscape.ElementDefinition[] = [
      ...wikiGraph.nodes.map((n) => ({
        data: {
          id: n.id,
          label: n.title,
          folder: n.folder,
          relativePath: n.relativePath,
          nodeType: !n.exists ? "missing" : n.isOrphan ? "orphan" : "existing",
          exists: n.exists,
        },
      })),
      ...wikiGraph.edges.map((e) => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          edgeType: e.isBroken ? "broken" : "wikilink",
        },
      })),
    ];

    const cy = cytoscape({
      container: graphContainerRef.current,
      elements,
      style: GRAPH_STYLE,
      layout: {
        name: "cose",
        animate: false,
        fit: true,
        padding: 60,
        nodeRepulsion: 9000,
        idealEdgeLength: 160,
        edgeElasticity: 32,
        gravity: 0.25,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0,
      } as unknown as cytoscape.LayoutOptions,
    });

    cy.on("mouseover", "node", (evt) => evt.target.addClass("nw-hovered"));
    cy.on("mouseout", "node", (evt) => evt.target.removeClass("nw-hovered"));

    cy.on("tap", "node", (evt) => {
      if (!evt.target.data("exists")) return;
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
  }, [graphReady, wikiGraph, notes, handleNoteClick]);

  useEffect(() => {
    if (!cyRef.current || !selectedNote) return;
    cyRef.current.nodes().removeClass("nw-selected");
    cyRef.current.$(`#${sanitizeId(selectedNote.relativePath)}`).addClass("nw-selected");
  }, [selectedNote]);

  return (
    <div className="nw-shell">
      <aside className="nw-sidebar">
        <div className="nw-sidebar-header">
          <span className="nw-title">Nebulosa Wiki</span>
          <span className={`nw-status-badge${error ? " nw-status-badge--error" : !loading ? " nw-status-badge--ok" : ""}`}>
            {loading && "Cargando..."}
            {error && "Error"}
            {!loading && !error && `${notes.length} notas`}
          </span>
        </div>
        {error && <p className="nw-sidebar-error">{error}</p>}
        <ul className="nw-note-list">
          {notes.map((note) => (
            <li
              className={`nw-note-item${selectedNote?.relativePath === note.relativePath ? " nw-note-item--selected" : ""}`}
              key={note.relativePath}
              onClick={() => handleNoteClick(note)}
            >
              <span className="nw-note-folder">{note.folder || "/"}</span>
              <span className="nw-note-title">{note.title}</span>
            </li>
          ))}
        </ul>
      </aside>

      <main className="nw-graph-panel">
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
          {graphReady && (
            <button
              className="nw-view-btn"
              onClick={() => cyRef.current?.fit(cyRef.current.elements(), 60)}
            >
              Centrar
            </button>
          )}
        </div>
        {graphLoading && <p className="nw-graph-status">Construyendo grafo...</p>}
        {graphError && <p className="nw-graph-status nw-graph-status--error">Error: {graphError}</p>}
        <div ref={graphContainerRef} className="nw-graph-container" />
      </main>

      <aside className="nw-detail-panel">
        <div className="nw-detail-header">
          <span className="nw-detail-title">{selectedNote?.title ?? "—"}</span>
          {selectedNote && (
            <div className="nw-view-toggle">
              <button
                className={`nw-view-btn${detailMode === "preview" ? " nw-view-btn--active" : ""}`}
                onClick={() => setDetailMode("preview")}
              >
                Preview
              </button>
              <button
                className={`nw-view-btn${detailMode === "raw" ? " nw-view-btn--active" : ""}`}
                onClick={() => setDetailMode("raw")}
              >
                Raw
              </button>
            </div>
          )}
        </div>
        <div className="nw-detail-content">
          {!selectedNote && (
            <p className="nw-viewer-empty">Seleccioná un nodo en el grafo.</p>
          )}
          {selectedNote && contentLoading && (
            <p className="nw-viewer-loading">Cargando...</p>
          )}
          {selectedNote && contentError && (
            <p className="nw-viewer-error">Error: {contentError}</p>
          )}
          {selectedNote && !contentLoading && !contentError && detailMode === "preview" && (
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
          {selectedNote && !contentLoading && !contentError && detailMode === "raw" && (
            <pre className="nw-viewer-content">{noteContent}</pre>
          )}
        </div>
      </aside>
    </div>
  );
}

export default App;
