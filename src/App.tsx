import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface MarkdownFile {
  title: string;
  path: string;
  relativePath: string;
  folder: string;
}

function App() {
  const [notes, setNotes] = useState<MarkdownFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <section className="nw-notes">
          <ul className="nw-note-list">
            {notes.map((note) => (
              <li className="nw-note-item" key={note.relativePath}>
                <span className="nw-note-folder">{note.folder || "/"}</span>
                <span className="nw-note-title">{note.title}</span>
                <code className="nw-note-path">{note.relativePath}</code>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

export default App;
