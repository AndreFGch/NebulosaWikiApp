import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

interface MarkdownFile {
  title: string;
  path: string;
  relativePath: string;
  folder: string;
}

type ViewMode = "preview" | "raw";

function preprocessWikilinks(content: string): string {
  return content
    .replace(/\[\[([^\]|\n]+)\|([^\]\n]+)\]\]/g, (_, name, alias) =>
      `[${alias.trim()}](#wikilink/${encodeURIComponent(name.trim())})`
    )
    .replace(/\[\[([^\]\n]+)\]\]/g, (_, name) =>
      `[${name.trim()}](#wikilink/${encodeURIComponent(name.trim())})`
    );
}

function App() {
  const [notes, setNotes] = useState<MarkdownFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNote, setSelectedNote] = useState<MarkdownFile | null>(null);
  const [noteContent, setNoteContent] = useState<string>("");
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");

  useEffect(() => {
    invoke<MarkdownFile[]>("list_markdown_files")
      .then((files) => {
        setNotes(files);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  function handleNoteClick(note: MarkdownFile) {
    setSelectedNote(note);
    setNoteContent("");
    setContentError(null);
    setContentLoading(true);
    invoke<string>("read_markdown_file", { relativePath: note.relativePath })
      .then((content) => {
        setNoteContent(content);
        setContentLoading(false);
      })
      .catch((err) => {
        setContentError(String(err));
        setContentLoading(false);
      });
  }

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
            {!selectedNote && (
              <p className="nw-viewer-empty">Seleccioná una nota para ver su contenido.</p>
            )}
            {selectedNote && (
              <>
                <div className="nw-viewer-header">
                  <span className="nw-viewer-title">{selectedNote.title}</span>
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
                  </div>
                  <code className="nw-viewer-path">{selectedNote.relativePath}</code>
                </div>
                {contentLoading && (
                  <p className="nw-viewer-loading">Cargando contenido...</p>
                )}
                {contentError && (
                  <p className="nw-viewer-error">Error: {contentError}</p>
                )}
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
                      {preprocessWikilinks(noteContent)}
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
