import { useEffect, useState, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import "./App.css";
import { buildWikiGraph, sanitizeId } from "./features/wiki-graph/model/buildWikiGraph";
import { getGraphHealth } from "./features/wiki-graph/model/getGraphHealth";
import type { WikiNode, WikiGraph } from "./features/wiki-graph/types";
import type { MarkdownFile } from "./domain/markdown/types";
import { normalizeKey } from "./domain/markdown/normalizeKey";
import { stripFrontmatter, preprocessWikilinks, findNoteByWikilink } from "./domain/markdown/wikilinkUtils";
import { slugify, buildNoteTemplateContent, TEMPLATE_FOLDER_MAP, WIKI_FOLDERS } from "./features/markdown/noteTemplates";
import type { NoteTemplate } from "./features/markdown/noteTemplates";
import { listMarkdownFiles, readMarkdownFile, createMarkdownFile, updateMarkdownFile } from "./shared/tauri/vaultApi";
import { searchMarkdownContent, type ContentSearchResult } from "./shared/tauri/searchApi";
import { getWikiRoot, setWikiRoot as setWikiRootCommand } from "./shared/tauri/settingsApi";
import { importMarkdownFile, exportMarkdownFile, exportWiki, backupWiki } from "./shared/tauri/transferApi";
import { deleteMarkdownFile } from "./shared/tauri/deleteApi";

const MarkdownPreview = lazy(() => import("./features/markdown/MarkdownPreview"));
const WikiGraphView = lazy(() => import("./features/wiki-graph/components/WikiGraphView"));

type DetailMode = "preview" | "raw" | "edit";
type MainView = "home" | "graph";
type ToastKind = "success" | "error" | "info";
interface ToastMessage { id: number; kind: ToastKind; message: string; }

function App() {
  const [notes, setNotes] = useState<MarkdownFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNote, setSelectedNote] = useState<MarkdownFile | null>(null);
  const [recentNotePaths, setRecentNotePaths] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("nebulosa.recentNotes");
      const parsed = JSON.parse(raw ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [noteContent, setNoteContent] = useState<string>("");
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>("preview");
  const [editContent, setEditContent] = useState<string>("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [wikiGraph, setWikiGraph] = useState<WikiGraph | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [graphReady, setGraphReady] = useState(false);
  const [graphRefreshToken, setGraphRefreshToken] = useState(0);
  const requestGraphRefresh = useCallback(() => {
    setGraphRefreshToken((v) => v + 1);
  }, []);
  const graphBuildBusyRef = useRef(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [mainView, setMainView] = useState<MainView>("home");

  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [newNoteTemplate, setNewNoteTemplate] = useState<NoteTemplate>("simple");
  const [newNoteFolder, setNewNoteFolder] = useState("notes");
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteError, setNewNoteError] = useState<string | null>(null);
  const [newNoteCreating, setNewNoteCreating] = useState(false);

  const [relationActionError, setRelationActionError] = useState<string | null>(null);
  const [creatingMissingLink, setCreatingMissingLink] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [contentSearchResults, setContentSearchResults] = useState<ContentSearchResult[]>([]);
  const [contentSearchLoading, setContentSearchLoading] = useState(false);
  const [contentSearchError, setContentSearchError] = useState<string | null>(null);
  const [contentSearchRan, setContentSearchRan] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDeleting, setDeleteDeleting] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importSourcePath, setImportSourcePath] = useState("");
  const [importTargetFolder, setImportTargetFolder] = useState("notes");
  const [importError, setImportError] = useState<string | null>(null);
  const [importImporting, setImportImporting] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTargetPath, setExportTargetPath] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportExporting, setExportExporting] = useState(false);

  const [showExportWikiModal, setShowExportWikiModal] = useState(false);
  const [exportWikiTargetDir, setExportWikiTargetDir] = useState("");
  const [exportWikiError, setExportWikiError] = useState<string | null>(null);
  const [exportWikiSuccess, setExportWikiSuccess] = useState<string | null>(null);
  const [exportWikiExporting, setExportWikiExporting] = useState(false);

  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupTargetBaseDir, setBackupTargetBaseDir] = useState("");
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [backupCreating, setBackupCreating] = useState(false);

  const [wikiRoot, setWikiRoot] = useState<string>("");
  const [wikiRootDraft, setWikiRootDraft] = useState<string>("");
  const [wikiRootError, setWikiRootError] = useState<string | null>(null);
  const [wikiRootSaving, setWikiRootSaving] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev.slice(-2), { id, kind, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const rootIdRef = useRef<string | null>(null);
  const velocitiesRef = useRef<Map<string, { vx: number; vy: number }>>(new Map());
  const alphaRef = useRef<number>(1.0);
  const graphPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const graphViewportRef = useRef<{ zoom: number; pan: { x: number; y: number } } | null>(null);
  const hasInitializedGraphRef = useRef<boolean>(false);

  useEffect(() => {
    listMarkdownFiles()
      .then((files) => { setNotes(files); setLoading(false); })
      .catch((err) => { setError(String(err)); setLoading(false); });
  }, []);

  useEffect(() => {
    if (notes.length === 0) return;
    const existingPaths = new Set(notes.map(n => n.relativePath));
    setRecentNotePaths(prev => {
      const filtered = prev.filter(p => existingPaths.has(p));
      if (filtered.length !== prev.length)
        localStorage.setItem("nebulosa.recentNotes", JSON.stringify(filtered));
      return filtered;
    });
  }, [notes]);

  useEffect(() => {
    getWikiRoot()
      .then(root => { setWikiRoot(root); setWikiRootDraft(root); })
      .catch(() => {});
  }, []);


  const handleNoteClick = useCallback((note: MarkdownFile) => {
    if (detailMode === "edit" && editContent !== noteContent) {
      if (!window.confirm("Tienes cambios sin guardar. ¿Deseas descartar los cambios y abrir otra nota?")) {
        return;
      }
    }
    setSelectedNote(note);
    setRecentNotePaths(prev => {
      const updated = [note.relativePath, ...prev.filter(p => p !== note.relativePath)].slice(0, 6);
      localStorage.setItem("nebulosa.recentNotes", JSON.stringify(updated));
      return updated;
    });
    setIsDetailOpen(true);
    setNoteContent("");
    setContentError(null);
    setContentLoading(true);
    setDetailMode("preview");
    setEditError(null);
    readMarkdownFile(note.relativePath)
      .then((content) => { setNoteContent(content); setContentLoading(false); })
      .catch((err) => { setContentError(String(err)); setContentLoading(false); });
  }, [detailMode, editContent, noteContent]);

  const clearRecentNotes = useCallback(() => {
    setRecentNotePaths([]);
    localStorage.removeItem("nebulosa.recentNotes");
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedNote) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await updateMarkdownFile(selectedNote.relativePath, editContent);
      setNoteContent(editContent);
      setDetailMode("preview");
      const files = await listMarkdownFiles();
      setNotes(files);
      requestGraphRefresh();
      showToast("success", "Cambios guardados");
    } catch (err) {
      setEditError(String(err));
      showToast("error", "No se pudo guardar");
    } finally {
      setEditSaving(false);
    }
  }, [selectedNote, editContent, showToast, requestGraphRefresh]);

  const handleReloadWiki = useCallback(async () => {
    if (detailMode === "edit" && editContent !== noteContent) {
      if (!window.confirm("Tienes cambios sin guardar. ¿Recargar de todas formas y descartar los cambios?")) return;
    }
    try {
      const files = await listMarkdownFiles();
      setNotes(files);
      requestGraphRefresh();
      if (selectedNote) {
        const updated = files.find(f => f.relativePath === selectedNote.relativePath);
        if (!updated) {
          setSelectedNote(null);
          setIsDetailOpen(false);
          setNoteContent("");
          setDetailMode("preview");
        } else {
          setSelectedNote(updated);
          const content = await readMarkdownFile(updated.relativePath);
          setNoteContent(content);
          setEditContent(content);
        }
      }
      showToast("success", "Wiki recargada");
    } catch (err) {
      showToast("error", `No se pudo recargar: ${String(err)}`);
    }
  }, [detailMode, editContent, noteContent, selectedNote, showToast, requestGraphRefresh]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        if (detailMode === "edit" && selectedNote && !editSaving) {
          e.preventDefault();
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailMode, selectedNote, editSaving, handleSave]);

  const openNewNoteModal = useCallback(() => {
    setNewNoteTemplate("simple");
    setNewNoteTitle("");
    setNewNoteFolder("notes");
    setNewNoteError(null);
    setShowNewNoteModal(true);
  }, []);

  const handleCreateNote = useCallback(async () => {
    const title = newNoteTitle.trim();
    if (!title) { setNewNoteError("El título es requerido."); return; }
    const slug = slugify(title);
    if (!slug) { setNewNoteError("El slug generado está vacío. Revisá el título."); return; }
    const relativePath = `${newNoteFolder}/${slug}.md`;
    const date = new Date().toISOString().slice(0, 10);
    const content = buildNoteTemplateContent(newNoteTemplate, title, date);
    setNewNoteCreating(true);
    setNewNoteError(null);
    try {
      await createMarkdownFile(relativePath, content);
      const files = await listMarkdownFiles();
      setNotes(files);
      const created = files.find(f => f.relativePath === relativePath);
      if (created) {
        setSelectedNote(created);
        setIsDetailOpen(true);
        setNoteContent(content);
        setContentLoading(false);
        setContentError(null);
        setDetailMode("edit");
        setEditContent(content);
        setEditError(null);
      }
      requestGraphRefresh();
      setShowNewNoteModal(false);
      setNewNoteTemplate("simple");
      setNewNoteTitle("");
      setNewNoteFolder("notes");
      showToast("success", "Nota creada");
    } catch (err) {
      setNewNoteError(String(err));
    } finally {
      setNewNoteCreating(false);
    }
  }, [newNoteTitle, newNoteFolder, newNoteTemplate, showToast, requestGraphRefresh]);

  const handleCreateMissingNote = useCallback(async (label: string) => {
    const slug = slugify(label);
    if (!slug) return;
    const relativePath = `notes/${slug}.md`;
    const date = new Date().toISOString().slice(0, 10);
    const content = `---\ntipo: note\ntitulo: ${label}\nfecha: ${date}\ntags:\n  - nebulosa\n  - pendiente\n---\n\n# ${label}\n\nCreada desde enlace roto.\n\n- \n`;
    setCreatingMissingLink(label);
    setRelationActionError(null);
    try {
      await createMarkdownFile(relativePath, content);
      const files = await listMarkdownFiles();
      setNotes(files);
      const created = files.find(f => f.relativePath === relativePath);
      if (created) {
        setSelectedNote(created);
        setIsDetailOpen(true);
        setNoteContent(content);
        setContentLoading(false);
        setContentError(null);
        setDetailMode("edit");
        setEditContent(content);
        setEditError(null);
      }
      requestGraphRefresh();
      showToast("success", "Nota creada desde enlace roto");
    } catch (err) {
      setRelationActionError(String(err));
    } finally {
      setCreatingMissingLink(null);
    }
  }, [showToast, requestGraphRefresh]);

  const handleCreateDailyNote = useCallback(async () => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const title = `Diario ${date}`;
    const relativePath = `sessions/${date}.md`;
    const content = `---\ntipo: session\ntitulo: ${title}\nfecha: ${date}\ntags:\n  - nebulosa\n  - diario\n---\n\n# ${title}\n\n## Pendientes\n\n- \n\n## Notas\n\n- \n\n## Enlaces\n\n- \n`;
    try {
      await createMarkdownFile(relativePath, content);
      const files = await listMarkdownFiles();
      setNotes(files);
      const created = files.find(f => f.relativePath === relativePath);
      if (created) {
        setSelectedNote(created);
        setIsDetailOpen(true);
        setNoteContent(content);
        setContentLoading(false);
        setContentError(null);
        setDetailMode("edit");
        setEditContent(content);
        setEditError(null);
      }
      requestGraphRefresh();
      showToast("success", "Nota diaria creada");
    } catch {
      const files = await listMarkdownFiles();
      setNotes(files);
      const existing = files.find(f => f.relativePath === relativePath);
      if (existing) {
        setSelectedNote(existing);
        setIsDetailOpen(true);
        setDetailMode("edit");
        requestGraphRefresh();
        showToast("info", "Nota diaria abierta");
      }
    }
  }, [showToast, requestGraphRefresh]);

  const handleCreateQuickNote = useCallback(async () => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const pad = (n: number) => String(n).padStart(2, "0");
    const base = `${date.replace(/-/g, "")}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const title = `Nota rápida ${date} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const content = `---\ntipo: note\ntitulo: ${title}\nfecha: ${date}\ntags:\n  - nebulosa\n  - quick\n---\n\n# ${title}\n\n- \n`;
    let relativePath = `notes/quick-${base}.md`;
    try {
      await createMarkdownFile(relativePath, content);
    } catch {
      relativePath = `notes/quick-${base}${pad(now.getSeconds())}.md`;
      try {
        await createMarkdownFile(relativePath, content);
      } catch {
        return;
      }
    }
    const files = await listMarkdownFiles();
    setNotes(files);
    const created = files.find(f => f.relativePath === relativePath);
    if (created) {
      setSelectedNote(created);
      setIsDetailOpen(true);
      setNoteContent(content);
      setContentLoading(false);
      setContentError(null);
      setDetailMode("edit");
      setEditContent(content);
      setEditError(null);
    }
    requestGraphRefresh();
    showToast("success", "Nota rápida creada");
  }, [showToast, requestGraphRefresh]);

  const openImportModal = useCallback(() => {
    setImportSourcePath("");
    setImportTargetFolder("notes");
    setImportError(null);
    setShowImportModal(true);
  }, []);

  const handleImportNote = useCallback(async () => {
    const src = importSourcePath.trim();
    if (!src) { setImportError("La ruta de origen es requerida."); return; }
    setImportImporting(true);
    setImportError(null);
    try {
      const relativePath = await importMarkdownFile(src, importTargetFolder);
      const files = await listMarkdownFiles();
      setNotes(files);
      const imported = files.find(f => f.relativePath === relativePath);
      if (imported) handleNoteClick(imported);
      requestGraphRefresh();
      setShowImportModal(false);
      setImportSourcePath("");
      setImportTargetFolder("notes");
      showToast("success", "Markdown importado");
    } catch (err) {
      setImportError(String(err));
      showToast("error", "No se pudo importar");
    } finally {
      setImportImporting(false);
    }
  }, [importSourcePath, importTargetFolder, handleNoteClick, showToast, requestGraphRefresh]);

  const handleContentSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setContentSearchLoading(true);
    setContentSearchError(null);
    setContentSearchResults([]);
    setContentSearchRan(false);
    try {
      const results = await searchMarkdownContent(q);
      setContentSearchResults(results);
      setContentSearchRan(true);
    } catch (err) {
      setContentSearchError(String(err));
      setContentSearchRan(true);
    } finally {
      setContentSearchLoading(false);
    }
  }, [searchQuery]);

  const openExportWikiModal = useCallback(() => {
    setExportWikiTargetDir("");
    setExportWikiError(null);
    setExportWikiSuccess(null);
    setShowExportWikiModal(true);
  }, []);

  const openBackupModal = useCallback(() => {
    setBackupTargetBaseDir("");
    setBackupError(null);
    setBackupSuccess(null);
    setShowBackupModal(true);
  }, []);

  const handleBrowseBackupDir = useCallback(async () => {
    const result = await openDialog({ multiple: false, directory: true });
    if (typeof result === "string") {
      setBackupTargetBaseDir(result);
      setBackupError(null);
      setBackupSuccess(null);
    }
  }, []);

  const handleBackup = useCallback(async () => {
    const dir = backupTargetBaseDir.trim();
    if (!dir) { setBackupError("La carpeta base es requerida."); return; }
    setBackupCreating(true);
    setBackupError(null);
    setBackupSuccess(null);
    try {
      const path = await backupWiki(dir);
      setBackupSuccess(path);
      showToast("success", "Backup creado");
    } catch (err) {
      setBackupError(String(err));
      showToast("error", "No se pudo crear backup");
    } finally {
      setBackupCreating(false);
    }
  }, [backupTargetBaseDir, showToast]);

  const handleExportWiki = useCallback(async () => {
    const dir = exportWikiTargetDir.trim();
    if (!dir) { setExportWikiError("La carpeta destino es requerida."); return; }
    setExportWikiExporting(true);
    setExportWikiError(null);
    setExportWikiSuccess(null);
    try {
      const count = await exportWiki(dir);
      setExportWikiSuccess(`Wiki exportada: ${count} archivo${count !== 1 ? "s" : ""} copiado${count !== 1 ? "s" : ""}.`);
      showToast("success", "Wiki exportada");
    } catch (err) {
      setExportWikiError(String(err));
      showToast("error", "No se pudo exportar");
    } finally {
      setExportWikiExporting(false);
    }
  }, [exportWikiTargetDir, showToast]);

  const handleSaveWikiRoot = useCallback(async () => {
    setWikiRootSaving(true);
    setWikiRootError(null);
    try {
      const newRoot = await setWikiRootCommand(wikiRootDraft);
      setWikiRoot(newRoot);
      setWikiRootDraft(newRoot);
      setShowSettingsModal(false);
      setSelectedNote(null);
      setNoteContent("");
      setEditContent("");
      hasInitializedGraphRef.current = false;
      const files = await listMarkdownFiles();
      setNotes(files);
      requestGraphRefresh();
      showToast("success", "Ruta de wiki actualizada");
    } catch (err) {
      setWikiRootError(String(err));
      showToast("error", "No se pudo actualizar la ruta");
    } finally {
      setWikiRootSaving(false);
    }
  }, [wikiRootDraft, showToast, requestGraphRefresh]);

  const handleBrowseWikiRoot = useCallback(async () => {
    const result = await openDialog({ directory: true, multiple: false });
    if (result) setWikiRootDraft(result as string);
  }, []);

  const handleBrowseImportFile = useCallback(async () => {
    const result = await openDialog({
      multiple: false,
      directory: false,
      filters: [{ name: "Markdown", extensions: ["md"] }]
    });
    if (typeof result === "string") setImportSourcePath(result);
  }, []);

  const handleBrowseExportFile = useCallback(async () => {
    const result = await saveDialog({
      filters: [{ name: "Markdown", extensions: ["md"] }],
      defaultPath: selectedNote ? `${selectedNote.title}.md` : "nota.md"
    });
    if (typeof result === "string") setExportTargetPath(result);
  }, [selectedNote]);

  const handleBrowseExportWikiDir = useCallback(async () => {
    const result = await openDialog({ multiple: false, directory: true });
    if (typeof result === "string") {
      setExportWikiTargetDir(result);
      setExportWikiError(null);
      setExportWikiSuccess(null);
    }
  }, []);

  const openExportModal = useCallback(() => {
    setExportTargetPath("");
    setExportError(null);
    setExportSuccess(false);
    setShowExportModal(true);
  }, []);

  const handleExportNote = useCallback(async () => {
    if (!selectedNote) return;
    const target = exportTargetPath.trim();
    if (!target) { setExportError("La ruta destino es requerida."); return; }
    setExportExporting(true);
    setExportError(null);
    setExportSuccess(false);
    try {
      await exportMarkdownFile(selectedNote.relativePath, target);
      setExportSuccess(true);
      showToast("success", "Nota exportada");
    } catch (err) {
      setExportError(String(err));
      showToast("error", "No se pudo exportar");
    } finally {
      setExportExporting(false);
    }
  }, [selectedNote, exportTargetPath, showToast]);

  const handleDeleteNote = useCallback(async () => {
    if (!selectedNote || deleteConfirmText !== "ELIMINAR") return;
    setDeleteDeleting(true);
    setDeleteError(null);
    try {
      await deleteMarkdownFile(selectedNote.relativePath);
      const files = await listMarkdownFiles();
      setNotes(files);
      setSelectedNote(null);
      setNoteContent("");
      setDetailMode("preview");
      setIsDetailOpen(false);
      requestGraphRefresh();
      setShowDeleteModal(false);
      setDeleteConfirmText("");
      showToast("success", "Nota eliminada");
    } catch (err) {
      setDeleteError(String(err));
      showToast("error", "No se pudo eliminar");
    } finally {
      setDeleteDeleting(false);
    }
  }, [selectedNote, deleteConfirmText, showToast, requestGraphRefresh]);

  useEffect(() => {
    if (notes.length === 0 || graphBuildBusyRef.current) return;

    graphBuildBusyRef.current = true;
    setGraphLoading(true);
    setGraphError(null);

    Promise.all(
      notes.map((note) =>
        readMarkdownFile(note.relativePath)
          .then((content) => [note.relativePath, content] as [string, string])
          .catch(() => [note.relativePath, ""] as [string, string])
      )
    ).then((pairs) => {
      const contentMap = new Map<string, string>(pairs);
      const graph = buildWikiGraph(notes, contentMap);
      setWikiGraph(graph);
      setGraphReady(true);
      setGraphLoading(false);
      graphBuildBusyRef.current = false;
    }).catch((err) => {
      setGraphError(String(err));
      setGraphLoading(false);
      graphBuildBusyRef.current = false;
    });
  }, [notes, graphRefreshToken]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setIsCommandPaletteOpen(v => !v);
        setCommandQuery("");
        return;
      }
      if (e.key === "Escape" && isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
        setCommandQuery("");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isCommandPaletteOpen]);

  const closeCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false);
    setCommandQuery("");
  }, []);

  const wikiHealth = useMemo(() => getGraphHealth(wikiGraph), [wikiGraph]);

  const commands = useMemo(() => {
    const base: { id: string; label: string; hint: string; action: () => void }[] = [
      { id: "home",         label: "Ir a inicio",          hint: "Dashboard",                      action: () => setMainView("home") },
      { id: "graph",        label: "Abrir grafo",           hint: "Vista de grafo",                 action: () => setMainView("graph") },
      { id: "new-note",     label: "Nueva nota",            hint: "Crear nota",                     action: openNewNoteModal },
      { id: "daily",        label: "Nota diaria",           hint: "sessions/YYYY-MM-DD.md",         action: handleCreateDailyNote },
      { id: "quick",        label: "Nota rápida",           hint: "notes/quick-…",                  action: handleCreateQuickNote },
      { id: "search",       label: "Buscar",                hint: "Buscar por título o contenido",  action: () => { setIsSidebarOpen(true); setIsSearchOpen(true); } },
      { id: "import",       label: "Importar Markdown",     hint: "Copiar .md a la wiki",           action: openImportModal },
      { id: "export-wiki",  label: "Exportar wiki",         hint: "Copiar wiki completa",           action: openExportWikiModal },
      { id: "backup",       label: "Backup de wiki",        hint: "Copia con timestamp",            action: openBackupModal },
    ];
    if (selectedNote) {
      base.push({ id: "edit",        label: "Editar nota actual",   hint: selectedNote.title, action: () => { setIsDetailOpen(true); setDetailMode("edit"); } });
      base.push({ id: "export-note", label: "Exportar nota actual", hint: selectedNote.title, action: openExportModal });
    }
    return base;
  }, [selectedNote, openNewNoteModal, handleCreateDailyNote, handleCreateQuickNote, openImportModal, openExportWikiModal, openBackupModal, openExportModal]);

  const filteredCommands = useMemo(() => {
    const q = commandQuery.toLowerCase().trim();
    if (!q) return commands;
    return commands.filter(c => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q));
  }, [commands, commandQuery]);

  const selectedNodeMeta = selectedNote && wikiGraph
    ? (wikiGraph.nodes.find((n) => n.relativePath === selectedNote.relativePath) ?? null)
    : null;

  const availableTags: string[] = wikiGraph
    ? [...new Set(wikiGraph.nodes.flatMap(n => n.tags).map(t => t.toLowerCase()).filter(Boolean))].sort()
    : [];

  const tagFromQuery = searchQuery.trim().toLowerCase().startsWith("tag:")
    ? searchQuery.trim().toLowerCase().slice(4).trim()
    : null;
  const activeTag = tagFromQuery || selectedTag;

  const filteredNotes = (() => {
    let result = notes;
    if (activeTag) {
      result = result.filter(n => {
        const node = wikiGraph?.nodes.find(nd => nd.relativePath === n.relativePath);
        return node?.tags.map(t => t.toLowerCase()).includes(activeTag) ?? false;
      });
    }
    const q = tagFromQuery ? null : normalizeKey(searchQuery);
    if (q) {
      result = result.filter(n =>
        normalizeKey(n.title).includes(q) ||
        normalizeKey(n.folder).includes(q) ||
        normalizeKey(n.relativePath).includes(q)
      );
    }
    return result;
  })();

  const selectedNoteNodeId = selectedNote ? sanitizeId(selectedNote.relativePath) : null;

  const outgoingRelations: WikiNode[] = selectedNote && wikiGraph && selectedNoteNodeId
    ? wikiGraph.edges
        .filter(e => !e.isBroken && e.source === selectedNoteNodeId)
        .map(e => wikiGraph.nodes.find(n => n.id === e.target))
        .filter((n): n is WikiNode => n !== undefined && n.exists)
    : [];

  const backlinkRelations: WikiNode[] = selectedNote && wikiGraph && selectedNoteNodeId
    ? wikiGraph.edges
        .filter(e => !e.isBroken && e.target === selectedNoteNodeId)
        .map(e => wikiGraph.nodes.find(n => n.id === e.source))
        .filter((n): n is WikiNode => n !== undefined && n.exists)
    : [];

  const brokenOutgoing = selectedNote && wikiGraph && selectedNoteNodeId
    ? wikiGraph.edges
        .filter(e => e.isBroken && e.source === selectedNoteNodeId)
        .map(e => ({ label: e.label, targetId: e.target }))
    : [];

  const hasUnsavedChanges = detailMode === "edit" && editContent !== noteContent;

  return (
    <div
      className={`nw-shell${!isSidebarOpen ? " nw-shell--sidebar-collapsed" : ""}${!isDetailOpen ? " nw-shell--detail-collapsed" : ""}`}
    >
      <nav className="nw-ribbon">
        <button
          className={`nw-ribbon-btn${mainView === "home" ? " nw-ribbon-btn--active" : ""}`}
          onClick={() => setMainView("home")}
          title="Inicio"
        >
          ◆
        </button>
        <button
          className={`nw-ribbon-btn${isSidebarOpen ? " nw-ribbon-btn--active" : ""}`}
          onClick={() => setIsSidebarOpen(v => !v)}
          title={isSidebarOpen ? "Cerrar explorador" : "Explorador"}
        >
          ☰
        </button>
        <button
          className={`nw-ribbon-btn${mainView === "graph" ? " nw-ribbon-btn--active" : ""}`}
          onClick={() => setMainView("graph")}
          title="Grafo"
        >
          ◎
        </button>
        <button
          className={`nw-ribbon-btn${isSearchOpen ? " nw-ribbon-btn--active" : ""}`}
          onClick={() => {
            const closing = isSearchOpen;
            setIsSearchOpen(v => !v);
            setIsSidebarOpen(true);
            if (closing) { setContentSearchResults([]); setContentSearchError(null); setContentSearchRan(false); setSearchQuery(""); }
          }}
          title="Buscar"
        >
          ⌕
        </button>
        <div className="nw-ribbon-spacer" />
        <button className="nw-ribbon-btn" onClick={handleCreateDailyNote} title="Nota diaria">◷</button>
        <button className="nw-ribbon-btn" onClick={handleCreateQuickNote} title="Nota rápida">✦</button>
        <button className="nw-ribbon-btn" onClick={openNewNoteModal} title="Nueva nota">+</button>
        <button className="nw-ribbon-btn" onClick={openImportModal} title="Importar Markdown">⇣</button>
        <button
          className={`nw-ribbon-btn${!selectedNote ? " nw-ribbon-btn--disabled" : ""}`}
          onClick={selectedNote ? openExportModal : undefined}
          title={selectedNote ? "Exportar nota actual" : "Exportar (seleccioná una nota primero)"}
          disabled={!selectedNote}
        >
          ⇡
        </button>
        <button className="nw-ribbon-btn" onClick={handleReloadWiki} title="Recargar wiki">↻</button>
        <button className="nw-ribbon-btn" title="Ajustes" onClick={() => { setWikiRootDraft(wikiRoot); setWikiRootError(null); setShowSettingsModal(true); }}>⚙</button>
      </nav>
      <aside className={`nw-sidebar${!isSidebarOpen ? " nw-sidebar--collapsed" : ""}`}>
        <div className="nw-sidebar-header">
          {isSidebarOpen && <span className="nw-title">Notas</span>}
          {isSidebarOpen && (
            <span className={`nw-status-badge${error ? " nw-status-badge--error" : !loading ? " nw-status-badge--ok" : ""}`}>
              {loading && "Cargando..."}
              {error && "Error"}
              {!loading && !error && ((searchQuery || activeTag) ? `${filteredNotes.length}/${notes.length}` : `${notes.length}`)}
            </span>
          )}
        </div>
        {isSidebarOpen && error && <p className="nw-sidebar-error">{error}</p>}
        {isSidebarOpen && isSearchOpen && (
          <div className="nw-search-bar">
            <input
              className="nw-search-input"
              type="text"
              placeholder="Buscar notas… Enter para contenido"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && searchQuery.length >= 2) handleContentSearch();
                if (e.key === "Escape") { setSearchQuery(""); setSelectedTag(null); setIsSearchOpen(false); setContentSearchResults([]); setContentSearchError(null); setContentSearchRan(false); }
              }}
              autoFocus
            />
            {searchQuery && (
              <button className="nw-search-clear" onClick={() => { setSearchQuery(""); setSelectedTag(null); setContentSearchResults([]); setContentSearchError(null); setContentSearchRan(false); }}>✕</button>
            )}
            {searchQuery.length >= 2 && (
              <button className="nw-search-btn" onClick={handleContentSearch} title="Buscar en contenido" disabled={contentSearchLoading}>⏎</button>
            )}
          </div>
        )}
        {isSidebarOpen && (availableTags.length > 0 || selectedTag) && (
          <div className="nw-tag-filter">
            <div className="nw-tag-filter-header">
              <span>Tags</span>
              {selectedTag && !tagFromQuery && (
                <button className="nw-tag-filter-clear" onClick={() => setSelectedTag(null)}>✕ #{selectedTag}</button>
              )}
            </div>
            {availableTags.length > 0 ? (
              <div className="nw-tag-chip-list">
                {availableTags.slice(0, 12).map(tag => (
                  <button
                    key={tag}
                    className={`nw-tag-chip${activeTag === tag ? " nw-tag-chip--active" : ""}`}
                    onClick={() => { setSelectedTag(activeTag === tag ? null : tag); setSearchQuery(""); }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            ) : (
              <p className="nw-tag-filter-empty">Sin tags en la wiki.</p>
            )}
          </div>
        )}
        {isSidebarOpen && searchQuery && !activeTag && (
          <div className="nw-quick-search-label">Navegación rápida</div>
        )}
        {isSidebarOpen && (
          <ul className="nw-note-list">
            {filteredNotes.map((note) => (
              <li
                className={`nw-note-item${selectedNote?.relativePath === note.relativePath ? " nw-note-item--selected" : ""}`}
                key={note.relativePath}
                onClick={() => handleNoteClick(note)}
              >
                <span className="nw-note-folder">{note.folder || "/"}</span>
                <span className="nw-note-title">{note.title}</span>
              </li>
            ))}
            {filteredNotes.length === 0 && searchQuery && (
              <li className="nw-note-empty">Sin resultados para "{searchQuery}"</li>
            )}
          </ul>
        )}
        {isSidebarOpen && isSearchOpen && (contentSearchLoading || contentSearchRan) && (
          <div className="nw-content-search">
            <div className="nw-content-search-header">
              {contentSearchLoading ? "Buscando en contenido…" : `Resultados en contenido (${contentSearchResults.length})`}
            </div>
            {contentSearchError && <div className="nw-content-search-error">{contentSearchError}</div>}
            {contentSearchResults.map(r => (
              <div
                key={r.relativePath}
                className={`nw-content-result${selectedNote?.relativePath === r.relativePath ? " nw-content-result--selected" : ""}`}
                onClick={() => { const note = notes.find(n => n.relativePath === r.relativePath); if (note) handleNoteClick(note); }}
              >
                <div className="nw-content-result-top">
                  <span className="nw-content-result-folder">{r.folder}</span>
                  <span className="nw-content-result-title">{r.title}</span>
                </div>
                <div className="nw-content-result-snippet">{r.snippet}</div>
              </div>
            ))}
            {!contentSearchLoading && !contentSearchError && contentSearchRan && contentSearchResults.length === 0 && (
              <div className="nw-content-search-empty">Sin coincidencias en contenido.</div>
            )}
          </div>
        )}
      </aside>

      <main className="nw-graph-panel">
        {mainView === "home" && (
          <div className="nw-home">
            <div className="nw-home-hero">
              <div className="nw-home-hero-top">
                <div className="nw-home-hero-titles">
                  <h1 className="nw-home-title">Nebulosa Wiki</h1>
                  <p className="nw-home-subtitle">Wiki Markdown local-first para conocimiento conectado.</p>
                </div>
                <span className={`nw-home-health${error ? " nw-home-health--error" : !loading ? " nw-home-health--ok" : ""}`}>
                  <span className="nw-home-health-dot" />
                  {loading ? "Cargando" : error ? "Error" : "Vault OK"}
                </span>
              </div>
              {wikiRoot && (
                <div className="nw-home-vault">
                  <span className="nw-home-vault-name">{wikiRoot.split(/[/\\]/).filter(Boolean).pop()}</span>
                  <span className="nw-home-vault-path">{wikiRoot}</span>
                </div>
              )}
            </div>

            {!loading && error && (
              <div className="nw-home-empty nw-home-error">
                <p className="nw-home-empty-title">No se pudo cargar la wiki configurada.</p>
                <p className="nw-home-empty-desc">Verifica que la carpeta exista o selecciona otra ruta desde Ajustes.</p>
                <p className="nw-home-error-detail">{error}</p>
                <div className="nw-home-empty-actions">
                  <button className="nw-home-action nw-home-action--primary" onClick={() => { setWikiRootDraft(wikiRoot); setWikiRootError(null); setShowSettingsModal(true); }}>⚙ Abrir ajustes</button>
                </div>
              </div>
            )}

            {!loading && !error && notes.length === 0 && (
              <div className="nw-home-empty">
                <p className="nw-home-empty-title">Tu wiki está vacía</p>
                <p className="nw-home-empty-desc">Crea tu primera nota, importa archivos Markdown o configura otra carpeta de wiki para empezar.</p>
                <div className="nw-home-empty-actions">
                  <button className="nw-home-action nw-home-action--primary" onClick={openNewNoteModal}>+ Crear nota</button>
                  <button className="nw-home-action" onClick={handleCreateDailyNote}>◷ Nota diaria</button>
                  <button className="nw-home-action" onClick={handleCreateQuickNote}>✦ Nota rápida</button>
                  <button className="nw-home-action" onClick={openImportModal}>⇣ Importar Markdown</button>
                  <button className="nw-home-action" onClick={() => { setWikiRootDraft(wikiRoot); setWikiRootError(null); setShowSettingsModal(true); }}>⚙ Ajustes</button>
                </div>
              </div>
            )}

            {!error && notes.length > 0 && (
              <div className={`nw-home-health-panel nw-home-health-panel--${wikiHealth.tone}`}>
                <div className="nw-home-health-headline">{wikiHealth.headline}</div>
                {wikiHealth.tone !== "pending" ? (
                  <>
                    <ul className="nw-home-health-list">
                      <li>
                        {wikiHealth.connections} conexion{wikiHealth.connections === 1 ? "" : "es"} detectada{wikiHealth.connections === 1 ? "" : "s"}
                      </li>
                      <li className={wikiHealth.brokenCount > 0 ? "nw-home-health-item--warning" : "nw-home-health-item--ok"}>
                        {wikiHealth.brokenCount} enlace{wikiHealth.brokenCount === 1 ? "" : "s"} roto{wikiHealth.brokenCount === 1 ? "" : "s"}
                      </li>
                      <li className={wikiHealth.orphanCount > 0 ? "nw-home-health-item--notice" : "nw-home-health-item--ok"}>
                        {wikiHealth.orphanCount} nota{wikiHealth.orphanCount === 1 ? "" : "s"} huérfana{wikiHealth.orphanCount === 1 ? "" : "s"}
                      </li>
                    </ul>
                    <p className="nw-home-health-action">{wikiHealth.actionNote}</p>
                  </>
                ) : (
                  <p className="nw-home-health-action">Leyendo notas y calculando conexiones…</p>
                )}
              </div>
            )}

            <div className="nw-home-stats">
              <div className="nw-home-stat">
                <span className="nw-home-stat-value">{loading ? "—" : notes.length}</span>
                <span className="nw-home-stat-label">notas</span>
              </div>
              <div className="nw-home-stat">
                <span className="nw-home-stat-value">{wikiGraph ? wikiGraph.nodes.filter(n => n.exists).length : "—"}</span>
                <span className="nw-home-stat-label">nodos</span>
              </div>
              <div className="nw-home-stat">
                <span className="nw-home-stat-value">{wikiGraph ? wikiGraph.edges.filter(e => !e.isBroken).length : "—"}</span>
                <span className="nw-home-stat-label">enlaces</span>
              </div>
              <div className="nw-home-stat">
                <span className="nw-home-stat-value">{wikiGraph ? wikiGraph.orphanNodes.length : "—"}</span>
                <span className="nw-home-stat-label">huérfanas</span>
              </div>
              <div className="nw-home-stat">
                <span className="nw-home-stat-value">{wikiGraph ? wikiGraph.brokenLinks.length : "—"}</span>
                <span className="nw-home-stat-label">rotos</span>
              </div>
            </div>

            <div className="nw-home-actions-main">
              <button className="nw-home-action nw-home-action--primary" onClick={openNewNoteModal}>+ Nueva nota</button>
              <button className="nw-home-action nw-home-action--secondary" onClick={() => setMainView("graph")}>◎ Explorar grafo</button>
              <button className="nw-home-action nw-home-action--secondary" onClick={() => { setIsCommandPaletteOpen(true); setCommandQuery(""); }}>⌕ Buscar</button>
            </div>

            <div className="nw-home-actions">
              <button className="nw-home-action" onClick={handleCreateDailyNote}>◷ Nota diaria</button>
              <button className="nw-home-action" onClick={handleCreateQuickNote}>✦ Nota rápida</button>
              <button className="nw-home-action" onClick={openImportModal}>⇣ Importar</button>
              <button className="nw-home-action" onClick={openExportWikiModal}>⇡ Exportar wiki</button>
              <button className="nw-home-action" onClick={openBackupModal}>⧉ Backup</button>
              {selectedNote && !contentLoading && !contentError && (
                <>
                  <button className="nw-home-action" onClick={() => { setEditContent(noteContent); setEditError(null); setDetailMode("edit"); setIsDetailOpen(true); }}>✎ Editar nota</button>
                  <button className="nw-home-action" onClick={openExportModal}>⇡ Exportar nota</button>
                </>
              )}
            </div>

            <div className="nw-home-recent-card">
              <div className="nw-home-recent-header">
                <span>Recientes</span>
                {recentNotePaths.length > 0 && (
                  <button className="nw-home-recent-clear" onClick={clearRecentNotes}>Limpiar</button>
                )}
              </div>
              {recentNotePaths.length === 0 ? (
                <p className="nw-home-recent-empty">Abrí una nota para verla acá.</p>
              ) : (
                <ul className="nw-home-recent-list">
                  {recentNotePaths.slice(0, 5).map(path => {
                    const note = notes.find(n => n.relativePath === path);
                    if (!note) return null;
                    const folder = note.relativePath.split(/[/\\]/).slice(0, -1).join("/") || "—";
                    return (
                      <li key={path} className="nw-home-recent-item" onClick={() => handleNoteClick(note)}>
                        <span className="nw-home-recent-folder">{folder}</span>
                        <span className="nw-home-recent-title">{note.title}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

          </div>
        )}

        {mainView === "graph" && (
          <Suspense fallback={null}>
            <WikiGraphView
              notes={notes}
              wikiGraph={wikiGraph}
              graphReady={graphReady}
              graphLoading={graphLoading}
              graphError={graphError}
              selectedNote={selectedNote}
              onNoteClick={handleNoteClick}
              onClearSelection={() => setSelectedNote(null)}
              showToast={showToast}
              graphPositionsRef={graphPositionsRef}
              graphViewportRef={graphViewportRef}
              velocitiesRef={velocitiesRef}
              alphaRef={alphaRef}
              rootIdRef={rootIdRef}
              hasInitializedGraphRef={hasInitializedGraphRef}
            />
          </Suspense>
        )}
      </main>

      <aside className={`nw-detail-panel${!isDetailOpen ? " nw-detail-panel--collapsed" : ""}`}>
        <div className="nw-detail-header">
          <button
            className="nw-detail-toggle"
            onClick={() => setIsDetailOpen(!isDetailOpen)}
            title={isDetailOpen ? "Cerrar panel" : "Abrir panel"}
          >
            {isDetailOpen ? "»" : "«"}
          </button>
          {isDetailOpen && <span className="nw-detail-title">{selectedNote?.title ?? "—"}</span>}
          {isDetailOpen && hasUnsavedChanges && <span className="nw-unsaved-badge">• Sin guardar</span>}
          {isDetailOpen && selectedNote && (
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
              <button
                className={`nw-view-btn${detailMode === "edit" ? " nw-view-btn--active" : ""}`}
                onClick={() => { setEditContent(noteContent); setEditError(null); setDetailMode("edit"); }}
                disabled={contentLoading || !!contentError}
              >
                Editar
              </button>
              <button
                className="nw-view-btn"
                onClick={openExportModal}
                title="Exportar nota"
                disabled={contentLoading || !!contentError}
              >
                ⇡
              </button>
              <button
                className="nw-view-btn nw-view-btn--danger"
                onClick={() => { setDeleteConfirmText(""); setDeleteError(null); setShowDeleteModal(true); }}
                title="Eliminar nota"
                disabled={contentLoading || !!contentError}
              >
                ⊗
              </button>
            </div>
          )}
        </div>
        {!isDetailOpen && selectedNote && (
          <span className="nw-detail-collapsed-title">{selectedNote.title}</span>
        )}
        {isDetailOpen && selectedNodeMeta && (
          <div className="nw-node-meta">
            <div className="nw-node-meta-row">
              <span className="nw-node-meta-key">ruta</span>
              <span className="nw-node-meta-val nw-node-meta-path" title={selectedNodeMeta.relativePath}>{selectedNodeMeta.relativePath}</span>
            </div>
            <div className="nw-node-meta-row">
              <span className="nw-node-meta-key">carpeta</span>
              <span className="nw-node-meta-val">{selectedNodeMeta.folder}</span>
            </div>
            <div className="nw-node-meta-row">
              <span className="nw-node-meta-key">tipo</span>
              <span className="nw-node-meta-val">{selectedNodeMeta.type}</span>
            </div>
            <div className="nw-node-meta-row">
              <span className="nw-node-meta-key">estado</span>
              <span className={`nw-node-meta-val nw-node-meta-status--${!selectedNodeMeta.exists ? "faltante" : selectedNodeMeta.isOrphan ? "huerfana" : "normal"}`}>
                {!selectedNodeMeta.exists ? "faltante" : selectedNodeMeta.isOrphan ? "huérfana" : "normal"}
              </span>
            </div>
            <div className="nw-node-meta-row">
              <span className="nw-node-meta-key">salientes</span>
              <span className="nw-node-meta-val">{selectedNodeMeta.outgoingCount}</span>
            </div>
            <div className="nw-node-meta-row">
              <span className="nw-node-meta-key">backlinks</span>
              <span className="nw-node-meta-val">{selectedNodeMeta.backlinkCount}</span>
            </div>
          </div>
        )}
        {isDetailOpen && selectedNote && wikiGraph && (outgoingRelations.length > 0 || backlinkRelations.length > 0 || brokenOutgoing.length > 0) && (
          <div className="nw-relations">
            <div className="nw-relations-title">Relaciones</div>
            {relationActionError && <div className="nw-relation-error">{relationActionError}</div>}
            {outgoingRelations.length > 0 && (
              <>
                <div className="nw-relations-header">Salientes ({outgoingRelations.length})</div>
                {outgoingRelations.slice(0, 5).map(n => (
                  <div
                    key={n.id}
                    className="nw-relation-item"
                    onClick={() => { const note = notes.find(x => x.relativePath === n.relativePath); if (note) handleNoteClick(note); }}
                  >
                    <span className="nw-relation-folder">{n.folder}</span>
                    <span className="nw-relation-title">{n.title}</span>
                  </div>
                ))}
                {outgoingRelations.length > 5 && (
                  <div className="nw-relations-more">+ {outgoingRelations.length - 5} más</div>
                )}
              </>
            )}
            {backlinkRelations.length > 0 && (
              <>
                <div className="nw-relations-header">Backlinks ({backlinkRelations.length})</div>
                {backlinkRelations.slice(0, 5).map(n => (
                  <div
                    key={n.id}
                    className="nw-relation-item"
                    onClick={() => { const note = notes.find(x => x.relativePath === n.relativePath); if (note) handleNoteClick(note); }}
                  >
                    <span className="nw-relation-folder">{n.folder}</span>
                    <span className="nw-relation-title">{n.title}</span>
                  </div>
                ))}
                {backlinkRelations.length > 5 && (
                  <div className="nw-relations-more">+ {backlinkRelations.length - 5} más</div>
                )}
              </>
            )}
            {brokenOutgoing.length > 0 && (
              <>
                <div className="nw-relations-header">Rotos ({brokenOutgoing.length})</div>
                {brokenOutgoing.slice(0, 5).map(b => (
                  <div key={b.targetId} className="nw-relation-item nw-relation-item--missing">
                    <span className="nw-relation-title">{b.label}</span>
                    <span className="nw-relation-badge">faltante</span>
                    <button
                      className="nw-relation-create-btn"
                      disabled={creatingMissingLink === b.label}
                      onClick={e => { e.stopPropagation(); handleCreateMissingNote(b.label); }}
                    >
                      {creatingMissingLink === b.label ? "Creando…" : "Crear"}
                    </button>
                  </div>
                ))}
                {brokenOutgoing.length > 5 && (
                  <div className="nw-relations-more">+ {brokenOutgoing.length - 5} más</div>
                )}
              </>
            )}
          </div>
        )}
        {isDetailOpen && (
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
                <Suspense fallback={null}>
                  <MarkdownPreview
                    content={preprocessWikilinks(stripFrontmatter(noteContent))}
                    renderLink={(href, children) => {
                      if (href?.startsWith("#wikilink/")) {
                        const linkName = decodeURIComponent(href.slice(10));
                        const found = findNoteByWikilink(linkName, notes);
                        if (found) {
                          return (
                            <button
                              type="button"
                              className="nw-wikilink"
                              onClick={() => { handleNoteClick(found); }}
                            >
                              {children}
                            </button>
                          );
                        }
                        return (
                          <button
                            type="button"
                            className="nw-wikilink nw-wikilink--missing"
                            onClick={() => handleCreateMissingNote(linkName)}
                            disabled={creatingMissingLink === linkName}
                            title={`Crear nota: ${linkName}`}
                          >
                            {creatingMissingLink === linkName ? "Creando…" : children}
                          </button>
                        );
                      }
                      return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
                    }}
                  />
                </Suspense>
              </div>
            )}
            {selectedNote && !contentLoading && !contentError && detailMode === "raw" && (
              <pre className="nw-viewer-content">{noteContent}</pre>
            )}
            {selectedNote && !contentLoading && !contentError && detailMode === "edit" && (
              <div className="nw-edit-panel">
                <textarea
                  className="nw-edit-textarea"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  spellCheck={false}
                />
                <div className="nw-edit-actions">
                  {editError && <span className="nw-edit-error">{editError}</span>}
                  <button
                    className="nw-edit-btn nw-edit-btn--cancel"
                    onClick={() => { setDetailMode("preview"); setEditError(null); }}
                    disabled={editSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    className="nw-edit-btn nw-edit-btn--save"
                    onClick={handleSave}
                    disabled={editSaving}
                  >
                    {editSaving ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {showBackupModal && (
        <div className="nw-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setShowBackupModal(false); setBackupError(null); setBackupSuccess(null); } }}>
          <div className="nw-modal" onClick={e => e.stopPropagation()}>
            <div className="nw-modal-header">
              <span className="nw-modal-title">⧉ Backup de wiki</span>
              <button className="nw-modal-close" onClick={() => { setShowBackupModal(false); setBackupError(null); setBackupSuccess(null); }}>✕</button>
            </div>
            <div className="nw-modal-body">
              <label className="nw-modal-label">
                Carpeta base destino
                <input
                  className="nw-modal-input"
                  type="text"
                  value={backupTargetBaseDir}
                  onChange={e => { setBackupTargetBaseDir(e.target.value); setBackupError(null); setBackupSuccess(null); }}
                  placeholder="D:\NebulosaBackups"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter" && !backupSuccess) handleBackup();
                    if (e.key === "Escape") { setShowBackupModal(false); setBackupError(null); setBackupSuccess(null); }
                  }}
                />
              </label>
              <button className="nw-modal-btn nw-modal-btn--cancel" style={{ marginTop: "6px" }} onClick={handleBrowseBackupDir} type="button">
                Examinar…
              </button>
              <p className="nw-modal-hint">Se creará una carpeta con timestamp y se copiarán todos los Markdown. No se sobrescribe nada.</p>
              {backupSuccess && (
                <div className="nw-backup-success">
                  <span>Backup creado:</span>
                  <code className="nw-backup-path">{backupSuccess}</code>
                </div>
              )}
              {backupError && <p className="nw-modal-error">{backupError}</p>}
            </div>
            <div className="nw-modal-footer">
              <button
                className="nw-modal-btn nw-modal-btn--cancel"
                onClick={() => { setShowBackupModal(false); setBackupTargetBaseDir(""); setBackupError(null); setBackupSuccess(null); }}
              >
                Cerrar
              </button>
              <button
                className="nw-modal-btn nw-modal-btn--create"
                onClick={handleBackup}
                disabled={backupCreating || !backupTargetBaseDir.trim() || !!backupSuccess}
              >
                {backupCreating ? "Creando…" : "Crear backup"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showExportWikiModal && (
        <div className="nw-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setShowExportWikiModal(false); setExportWikiError(null); setExportWikiSuccess(null); } }}>
          <div className="nw-modal" onClick={e => e.stopPropagation()}>
            <div className="nw-modal-header">
              <span className="nw-modal-title">Exportar wiki</span>
              <button className="nw-modal-close" onClick={() => { setShowExportWikiModal(false); setExportWikiError(null); setExportWikiSuccess(null); }}>✕</button>
            </div>
            <div className="nw-modal-body">
              <label className="nw-modal-label">
                Carpeta destino
                <input
                  className="nw-modal-input"
                  type="text"
                  value={exportWikiTargetDir}
                  onChange={e => { setExportWikiTargetDir(e.target.value); setExportWikiError(null); setExportWikiSuccess(null); }}
                  placeholder="C:\Users\TuNombre\Documentos\NebulosaWiki-backup"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter") handleExportWiki();
                    if (e.key === "Escape") { setShowExportWikiModal(false); setExportWikiError(null); setExportWikiSuccess(null); }
                  }}
                />
              </label>
              <button className="nw-modal-btn nw-modal-btn--cancel" style={{ marginTop: "6px" }} onClick={handleBrowseExportWikiDir} type="button">
                Examinar…
              </button>
              <p className="nw-modal-hint">Se copiarán todos los archivos .md preservando carpetas. No se sobrescriben archivos existentes.</p>
              {exportWikiSuccess && <p className="nw-modal-success">{exportWikiSuccess}</p>}
              {exportWikiError && <p className="nw-modal-error">{exportWikiError}</p>}
            </div>
            <div className="nw-modal-footer">
              <button
                className="nw-modal-btn nw-modal-btn--cancel"
                onClick={() => { setShowExportWikiModal(false); setExportWikiTargetDir(""); setExportWikiError(null); setExportWikiSuccess(null); }}
              >
                Cerrar
              </button>
              <button
                className="nw-modal-btn nw-modal-btn--create"
                onClick={handleExportWiki}
                disabled={exportWikiExporting || !exportWikiTargetDir.trim() || !!exportWikiSuccess}
              >
                {exportWikiExporting ? "Exportando…" : "Exportar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showExportModal && selectedNote && (
        <div className="nw-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setShowExportModal(false); setExportError(null); setExportSuccess(false); } }}>
          <div className="nw-modal" onClick={e => e.stopPropagation()}>
            <div className="nw-modal-header">
              <span className="nw-modal-title">Exportar nota</span>
              <button className="nw-modal-close" onClick={() => { setShowExportModal(false); setExportError(null); setExportSuccess(false); }}>✕</button>
            </div>
            <div className="nw-modal-body">
              <div className="nw-delete-info">
                <span className="nw-modal-slug-label">nota:</span>
                <span className="nw-modal-slug-value">{selectedNote.relativePath}</span>
              </div>
              <label className="nw-modal-label">
                Ruta destino
                <input
                  className="nw-modal-input"
                  type="text"
                  value={exportTargetPath}
                  onChange={e => { setExportTargetPath(e.target.value); setExportError(null); setExportSuccess(false); }}
                  placeholder={`C:\\Users\\TuNombre\\Documentos\\${selectedNote.title}.md`}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter") handleExportNote();
                    if (e.key === "Escape") { setShowExportModal(false); setExportError(null); setExportSuccess(false); }
                  }}
                />
              </label>
              <button className="nw-modal-btn nw-modal-btn--cancel" style={{ marginTop: "6px" }} onClick={handleBrowseExportFile} type="button">
                Examinar…
              </button>
              <p className="nw-modal-hint">Pegá la ruta completa donde guardar la copia. El original no se modifica.</p>
              {exportSuccess && <p className="nw-modal-success">✓ Exportado correctamente.</p>}
              {exportError && <p className="nw-modal-error">{exportError}</p>}
            </div>
            <div className="nw-modal-footer">
              <button
                className="nw-modal-btn nw-modal-btn--cancel"
                onClick={() => { setShowExportModal(false); setExportTargetPath(""); setExportError(null); setExportSuccess(false); }}
              >
                Cerrar
              </button>
              <button
                className="nw-modal-btn nw-modal-btn--create"
                onClick={handleExportNote}
                disabled={exportExporting || !exportTargetPath.trim() || exportSuccess}
              >
                {exportExporting ? "Exportando…" : "Exportar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showImportModal && (
        <div className="nw-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setShowImportModal(false); setImportError(null); } }}>
          <div className="nw-modal" onClick={e => e.stopPropagation()}>
            <div className="nw-modal-header">
              <span className="nw-modal-title">Importar Markdown</span>
              <button className="nw-modal-close" onClick={() => { setShowImportModal(false); setImportError(null); }}>✕</button>
            </div>
            <div className="nw-modal-body">
              <label className="nw-modal-label">
                Ruta del archivo .md
                <input
                  className="nw-modal-input"
                  type="text"
                  value={importSourcePath}
                  onChange={e => { setImportSourcePath(e.target.value); setImportError(null); }}
                  placeholder="C:\Users\yo\nota.md"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter") handleImportNote();
                    if (e.key === "Escape") { setShowImportModal(false); setImportError(null); }
                  }}
                />
              </label>
              <button className="nw-modal-btn nw-modal-btn--cancel" style={{ marginTop: "6px" }} onClick={handleBrowseImportFile} type="button">
                Examinar…
              </button>
              <p className="nw-modal-hint">Pegá la ruta completa del archivo Markdown a importar.</p>
              <label className="nw-modal-label">
                Carpeta destino
                <select
                  className="nw-modal-select"
                  value={importTargetFolder}
                  onChange={e => setImportTargetFolder(e.target.value)}
                >
                  {WIKI_FOLDERS.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </label>
              <div className="nw-modal-slug">
                <span className="nw-modal-slug-label">destino:</span>
                <span className="nw-modal-slug-value">
                  {importTargetFolder}/{importSourcePath.trim().split(/[/\\]/).pop() || "archivo.md"}
                </span>
              </div>
              {importError && <p className="nw-modal-error">{importError}</p>}
            </div>
            <div className="nw-modal-footer">
              <button
                className="nw-modal-btn nw-modal-btn--cancel"
                onClick={() => { setShowImportModal(false); setImportSourcePath(""); setImportError(null); }}
              >
                Cancelar
              </button>
              <button
                className="nw-modal-btn nw-modal-btn--create"
                onClick={handleImportNote}
                disabled={importImporting || !importSourcePath.trim()}
              >
                {importImporting ? "Importando…" : "Importar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteModal && selectedNote && (
        <div className="nw-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setShowDeleteModal(false); setDeleteConfirmText(""); setDeleteError(null); } }}>
          <div className="nw-modal nw-modal--danger" onClick={e => e.stopPropagation()}>
            <div className="nw-modal-header">
              <span className="nw-modal-title">Eliminar nota</span>
              <button className="nw-modal-close" onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(""); setDeleteError(null); }}>✕</button>
            </div>
            <div className="nw-modal-body">
              <div className="nw-delete-info">
                <span className="nw-modal-slug-label">nota:</span>
                <span className="nw-modal-slug-value">{selectedNote.relativePath}</span>
              </div>
              {backlinkRelations.length > 0 && (
                <p className="nw-delete-warning">
                  ⚠ Esta nota tiene {backlinkRelations.length} backlink{backlinkRelations.length !== 1 ? "s" : ""} que quedarán rotos.
                </p>
              )}
              <label className="nw-modal-label">
                Escribí ELIMINAR para confirmar
                <input
                  className="nw-modal-input nw-modal-input--danger"
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => { setDeleteConfirmText(e.target.value); setDeleteError(null); }}
                  placeholder="ELIMINAR"
                  onKeyDown={e => {
                    if (e.key === "Enter" && deleteConfirmText === "ELIMINAR") handleDeleteNote();
                    if (e.key === "Escape") { setShowDeleteModal(false); setDeleteConfirmText(""); setDeleteError(null); }
                  }}
                  autoFocus
                />
              </label>
              {deleteError && <p className="nw-modal-error">{deleteError}</p>}
            </div>
            <div className="nw-modal-footer">
              <button
                className="nw-modal-btn nw-modal-btn--cancel"
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(""); setDeleteError(null); }}
              >
                Cancelar
              </button>
              <button
                className="nw-modal-btn nw-modal-btn--delete"
                onClick={handleDeleteNote}
                disabled={deleteDeleting || deleteConfirmText !== "ELIMINAR"}
              >
                {deleteDeleting ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showNewNoteModal && (
        <div className="nw-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setShowNewNoteModal(false); setNewNoteError(null); } }}>
          <div className="nw-modal" onClick={e => e.stopPropagation()}>
            <div className="nw-modal-header">
              <span className="nw-modal-title">Nueva nota</span>
              <button className="nw-modal-close" onClick={() => { setShowNewNoteModal(false); setNewNoteError(null); }}>✕</button>
            </div>
            <div className="nw-modal-body">
              <label className="nw-modal-label">
                Plantilla
                <select
                  className="nw-modal-select"
                  value={newNoteTemplate}
                  onChange={e => {
                    const t = e.target.value as NoteTemplate;
                    setNewNoteTemplate(t);
                    setNewNoteFolder(TEMPLATE_FOLDER_MAP[t]);
                  }}
                >
                  <option value="simple">Nota simple</option>
                  <option value="project">Proyecto</option>
                  <option value="source">Fuente / artículo</option>
                  <option value="skill">Skill</option>
                  <option value="session">Sesión</option>
                  <option value="index">Índice</option>
                </select>
              </label>
              <p className="nw-modal-hint">La plantilla define la estructura inicial del Markdown.</p>
              <label className="nw-modal-label">
                Carpeta
                <select
                  className="nw-modal-select"
                  value={newNoteFolder}
                  onChange={e => setNewNoteFolder(e.target.value)}
                >
                  {WIKI_FOLDERS.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label className="nw-modal-label">
                Título
                <input
                  className="nw-modal-input"
                  type="text"
                  value={newNoteTitle}
                  onChange={e => { setNewNoteTitle(e.target.value); setNewNoteError(null); }}
                  placeholder="Mi nueva nota"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter") handleCreateNote();
                    if (e.key === "Escape") { setShowNewNoteModal(false); setNewNoteError(null); }
                  }}
                />
              </label>
              <div className="nw-modal-slug">
                <span className="nw-modal-slug-label">ruta:</span>
                <span className="nw-modal-slug-value">{newNoteFolder}/{slugify(newNoteTitle) || "slug"}.md</span>
              </div>
              {newNoteError && <p className="nw-modal-error">{newNoteError}</p>}
            </div>
            <div className="nw-modal-footer">
              <button
                className="nw-modal-btn nw-modal-btn--cancel"
                onClick={() => { setShowNewNoteModal(false); setNewNoteTitle(""); setNewNoteError(null); }}
              >
                Cancelar
              </button>
              <button
                className="nw-modal-btn nw-modal-btn--create"
                onClick={handleCreateNote}
                disabled={newNoteCreating || !newNoteTitle.trim()}
              >
                {newNoteCreating ? "Creando…" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="nw-toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`nw-toast nw-toast--${t.kind}`}>
            <span className="nw-toast-message">{t.message}</span>
            <button className="nw-toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>✕</button>
          </div>
        ))}
      </div>
      {showSettingsModal && (
        <div className="nw-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setShowSettingsModal(false); setWikiRootError(null); } }}>
          <div className="nw-modal" onClick={e => e.stopPropagation()}>
            <div className="nw-modal-header">
              <span className="nw-modal-title">Ajustes</span>
              <button className="nw-modal-close" onClick={() => { setShowSettingsModal(false); setWikiRootError(null); }}>✕</button>
            </div>
            <div className="nw-modal-body">
              <div className="nw-settings-section">
                <label className="nw-modal-label">
                  Ruta de wiki
                  <input
                    className="nw-modal-input"
                    type="text"
                    value={wikiRootDraft}
                    onChange={e => { setWikiRootDraft(e.target.value); setWikiRootError(null); }}
                    placeholder={`D:\\NebulosaWiki`}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === "Enter") handleSaveWikiRoot();
                      if (e.key === "Escape") { setShowSettingsModal(false); setWikiRootError(null); }
                    }}
                  />
                </label>
                <button className="nw-modal-btn nw-modal-btn--cancel" style={{ marginTop: "6px" }} onClick={handleBrowseWikiRoot} type="button">
                  Examinar…
                </button>
                <p className="nw-settings-help">Debe ser una carpeta existente. No se mueven archivos automáticamente.</p>
                {wikiRootError && <p className="nw-settings-error">{wikiRootError}</p>}
              </div>
            </div>
            <div className="nw-modal-footer">
              <button
                className="nw-modal-btn nw-modal-btn--cancel"
                onClick={() => { setShowSettingsModal(false); setWikiRootError(null); }}
              >
                Cancelar
              </button>
              <button
                className="nw-modal-btn nw-modal-btn--create"
                onClick={handleSaveWikiRoot}
                disabled={wikiRootSaving || !wikiRootDraft.trim()}
              >
                {wikiRootSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {isCommandPaletteOpen && (
        <div className="nw-command-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeCommandPalette(); }}>
          <div className="nw-command-palette" onClick={e => e.stopPropagation()}>
            <input
              className="nw-command-input"
              autoFocus
              placeholder="Escribí un comando…"
              value={commandQuery}
              onChange={e => setCommandQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") { closeCommandPalette(); return; }
                if (e.key === "Enter" && filteredCommands.length > 0) {
                  filteredCommands[0].action();
                  closeCommandPalette();
                }
              }}
            />
            <ul className="nw-command-list">
              {filteredCommands.map((cmd, i) => (
                <li
                  key={cmd.id}
                  className={`nw-command-item${i === 0 ? " nw-command-item--active" : ""}`}
                  onClick={() => { cmd.action(); closeCommandPalette(); }}
                >
                  <span className="nw-command-label">{cmd.label}</span>
                  <span className="nw-command-hint">{cmd.hint}</span>
                </li>
              ))}
              {filteredCommands.length === 0 && (
                <li className="nw-command-empty">Sin resultados para "{commandQuery}"</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
