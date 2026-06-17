import "./welcome.css";

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
  let statusLabel = vaultName;

  if (loading) {
    statusDotClass = "nw-welcome-dot--loading";
    statusLabel = "Cargando...";
  } else if (error) {
    statusDotClass = "nw-welcome-dot--error";
  } else if (!isHealthy) {
    statusDotClass = "nw-welcome-dot--warning";
  }

  return (
    <div className="nw-welcome">
      <div className="nw-welcome-bg" aria-hidden="true" />

      <div className="nw-welcome-identity">
        <h1 className="nw-welcome-title">Nebulosa Wiki</h1>
        <p className="nw-welcome-subtitle">Tu conocimiento local, conectado y explorable.</p>

        <div className="nw-welcome-vault-pill">
          <span className={`nw-welcome-dot ${statusDotClass}`} />
          <span className="nw-welcome-vault-name">{statusLabel}</span>
        </div>

        {wikiRoot && <p className="nw-welcome-path">{wikiRoot}</p>}
      </div>

      {!loading && error && (
        <p className="nw-welcome-error-detail">{error}</p>
      )}

      {!loading && !error && (
        <p className="nw-welcome-pulse">
          {noteCount} notas
          {nodeCount !== null && <> - {nodeCount} nodos</>}
          {edgeCount !== null && <> - {edgeCount} conexiones</>}
          {" - "}
          Salud {isHealthy ? "OK" : "atencion"}
        </p>
      )}

      <div className="nw-welcome-entry">
        <button className="nw-welcome-cta nw-welcome-cta--primary" onClick={onNewNote}>
          Nueva nota
        </button>
        <button className="nw-welcome-cta nw-welcome-cta--secondary" onClick={onOpenGraph}>
          Explorar grafo
        </button>
      </div>

      <div className="nw-welcome-secondary">
        <p className="nw-welcome-secondary-title">Mas acciones</p>
        <div className="nw-welcome-secondary-actions">
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

      <p className="nw-welcome-command-hint">Buscar o saltar a... <kbd>Ctrl+K</kbd></p>
    </div>
  );
}
