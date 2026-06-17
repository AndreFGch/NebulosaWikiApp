import "./welcome.css";

export interface WelcomeRecentNote {
  relativePath: string;
  title: string;
  folder: string;
}

export interface WelcomeScreenProps {
  wikiRoot: string;
  loading: boolean;
  error: string | null;
  noteCount: number;
  nodeCount: number | null;
  edgeCount: number | null;
  orphanCount: number | null;
  brokenLinkCount: number | null;
  canExportNote: boolean;
  recentNotes: WelcomeRecentNote[];
  onOpenNote: (relativePath: string) => void;
  onNewNote: () => void;
  onOpenGraph: () => void;
  onDailyNote: () => void;
  onQuickNote: () => void;
  onImport: () => void;
  onExportWiki: () => void;
  onBackup: () => void;
  onOpenSettings: () => void;
  onExportNote: () => void;
}

function extractVaultName(wikiRoot: string): string {
  if (!wikiRoot) return "Sin vault";
  const parts = wikiRoot.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? wikiRoot;
}

export default function WelcomeScreen({
  wikiRoot,
  loading,
  error,
  noteCount,
  nodeCount,
  edgeCount,
  orphanCount,
  brokenLinkCount,
  canExportNote,
  recentNotes,
  onOpenNote,
  onNewNote,
  onOpenGraph,
  onDailyNote,
  onQuickNote,
  onImport,
  onExportWiki,
  onBackup,
  onOpenSettings,
  onExportNote,
}: WelcomeScreenProps) {
  const vaultName = extractVaultName(wikiRoot);
  const isHealthy = (orphanCount ?? 0) === 0 && (brokenLinkCount ?? 0) === 0;

  let statusDotClass = "nw-welcome-dot--ok";
  let statusLabel = "Conectado";

  if (loading) {
    statusDotClass = "nw-welcome-dot--loading";
    statusLabel = "Cargando...";
  } else if (error) {
    statusDotClass = "nw-welcome-dot--error";
    statusLabel = "Error";
  } else if (!isHealthy) {
    statusDotClass = "nw-welcome-dot--warning";
    statusLabel = "Atencion";
  }

  return (
    <div className="nw-welcome">
      <div className="nw-welcome-atmosphere" aria-hidden="true" />

      <div className="nw-welcome-content">
        <header className="nw-welcome-topbar">
          <div className="nw-welcome-vault-status">
            <span className={`nw-welcome-dot ${statusDotClass}`} />
            <span className="nw-welcome-vault-name">{vaultName}</span>
            <span className="nw-welcome-vault-sep">-</span>
            <span className="nw-welcome-vault-state">{statusLabel}</span>
          </div>

          <div className="nw-welcome-search-pill">
            <span className="nw-welcome-search-text">Buscar notas, enlaces, acciones...</span>
            <kbd>Ctrl+K</kbd>
          </div>

          <button className="nw-welcome-settings-btn" onClick={onOpenSettings} title="Ajustes">
            Ajustes
          </button>
          <button className="nw-welcome-cta-new" onClick={onNewNote}>
            Nueva nota
          </button>
        </header>

        {!loading && error && (
          <div className="nw-welcome-error-banner" role="alert">
            <span className="nw-welcome-error-text">{error}</span>
            <button className="nw-welcome-error-action" onClick={onOpenSettings}>
              Ajustes
            </button>
          </div>
        )}

        <section className="nw-welcome-hero-row">
          <div className="nw-welcome-hero-copy">
            <span className="nw-welcome-eyebrow">TU VAULT DE CONOCIMIENTO</span>
            <h1 className="nw-welcome-title">Nebulosa Wiki</h1>
            <p className="nw-welcome-subtitle">Tu conocimiento local, conectado y explorable.</p>

            {!loading && !error && (
              <p className="nw-welcome-pulse">
                <strong>{noteCount}</strong> notas
                {edgeCount !== null && (
                  <>
                    {" "}-{" "}
                    <strong>{edgeCount}</strong> conexiones
                  </>
                )}
                {" "}-{" "}
                Salud {isHealthy ? "OK" : "atencion"}
              </p>
            )}
          </div>

          <div className="nw-welcome-hero-actions">
            <button className="nw-welcome-cta nw-welcome-cta--primary" onClick={onNewNote}>
              Nueva nota
            </button>
            <button className="nw-welcome-cta nw-welcome-cta--secondary" onClick={onOpenGraph}>
              Explorar grafo
            </button>
          </div>
        </section>

        <section className="nw-welcome-recent">
          <div className="nw-welcome-section-header">
            <span>Recientes</span>
          </div>
          {recentNotes.length > 0 ? (
            <div className={`nw-welcome-recent-grid${recentNotes.length >= 3 ? " nw-welcome-recent-grid--featured" : ""}`}>
              {recentNotes.map((note, index) => (
                <button
                  key={note.relativePath}
                  className={`nw-welcome-recent-card${index === 0 && recentNotes.length >= 3 ? " nw-welcome-recent-card--featured" : ""}`}
                  onClick={() => onOpenNote(note.relativePath)}
                >
                  <span className="nw-welcome-recent-title">{note.title}</span>
                  <span className="nw-welcome-recent-folder">{note.folder || "/"}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="nw-welcome-recent-empty">Tus notas recientes apareceran aqui.</p>
          )}
        </section>

        <button className="nw-welcome-graph-surface" onClick={onOpenGraph}>
          <div className="nw-welcome-graph-surface-decor" aria-hidden="true" />
          <div className="nw-welcome-graph-surface-body">
            <span className="nw-welcome-graph-surface-label">WikiGraph</span>
            <span className="nw-welcome-graph-surface-title">Explora la red de tu vault</span>
            <span className="nw-welcome-graph-surface-meta">
              {nodeCount !== null ? `${nodeCount} nodos` : "Sin datos"}
              {" - "}
              {edgeCount !== null ? `${edgeCount} conexiones` : "Sin datos"}
            </span>
          </div>
          <span className="nw-welcome-graph-surface-arrow" aria-hidden="true">{"→"}</span>
        </button>

        <div className="nw-welcome-secondary">
          <span className="nw-welcome-section-header">Acciones</span>
          <div className="nw-welcome-secondary-row">
            <button className="nw-welcome-secondary-action" onClick={onDailyNote}>Nota diaria</button>
            <button className="nw-welcome-secondary-action" onClick={onQuickNote}>Nota rapida</button>
            <button className="nw-welcome-secondary-action" onClick={onImport}>Importar</button>
            <button className="nw-welcome-secondary-action" onClick={onExportWiki}>Exportar wiki</button>
            <button className="nw-welcome-secondary-action" onClick={onBackup}>Backup</button>
            <button className="nw-welcome-secondary-action" onClick={onOpenSettings}>Ajustes</button>
            {canExportNote && (
              <button className="nw-welcome-secondary-action" onClick={onExportNote}>Exportar nota</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
