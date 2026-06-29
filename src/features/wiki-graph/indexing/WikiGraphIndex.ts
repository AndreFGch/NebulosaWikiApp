import type { MarkdownFile } from "../../../domain/markdown/types";
import { normalizeKey } from "../../../domain/markdown/normalizeKey";
import { compareRelativePath } from "../../../domain/markdown/relativePathOrder";
import type { WikiGraph, WikiNode, WikiEdge } from "../types";
import {
  sanitizeId,
  extractWikilinks,
  extractTags,
  extractFrontmatterTitle,
  getNoteTypeFromFolder,
} from "../model/buildWikiGraph";

// ─── Delta contract ───────────────────────────────────────────────────────────

/**
 * Cambios exactos producidos por una mutación del vault.
 * Transporta entidades reales para que el renderer aplique cambios sin consultar
 * el índice. IDs garantizados únicos dentro de cada colección.
 */
export interface WikiGraphDelta {
  addedNodes: WikiNode[];
  updatedNodes: WikiNode[];
  removedNodeIds: string[];
  addedEdges: WikiEdge[];
  updatedEdges: WikiEdge[];
  removedEdgeIds: string[];
  /** true cuando la topología del grafo cambió (nodos o aristas añadidos/eliminados). */
  topologyChanged: boolean;
  /**
   * Acumulación explícita: nodos cambiados + endpoints de aristas añadidas,
   * actualizadas y eliminadas. Registrado antes de cada _removeEdge para que
   * los endpoints de aristas ya desaparecidas queden incluidos.
   */
  affectedNodeIds: string[];
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface RawLink {
  label: string;
  normalizedKey: string;
  linkOrder: number;
}

interface NoteEntry {
  note: MarkdownFile;
  tags: string[];
  type: string;
  aliasKeys: string[];
  rawLinks: RawLink[];
}

interface InternalEdge {
  id: string;
  sourceRelPath: string;
  targetRelPath: string;
  label: string;
  isBroken: boolean;
}

// ─── WikiGraphIndex ───────────────────────────────────────────────────────────

/**
 * Índice incremental en memoria del WikiGraph.
 *
 * Semántica idéntica a buildWikiGraph:
 *   - Resolución de aliases: para cada clave normalizada, gana la primera nota
 *     según el orden determinista de relativePath. Cada nota registra título,
 *     nombre de archivo y título de frontmatter; el primer registro de esa clave
 *     (en orden de path) es el ganador.
 *   - Candidatos ordenados por relativePath (mismo orden que list_markdown_files).
 *   - Dedup de aristas por sourceId→targetId; weight siempre 1.
 *   - Self-links ignorados.
 *
 * Reconciliación: cuando cambia una resolución de alias, se recalcula el conjunto
 * completo de aristas deseadas de cada fuente afectada (no arista por arista).
 *
 * Invariantes:
 *   - entriesByPath        ↔ notas conocidas
 *   - outgoingBySource[src] = set de edgeIds salientes desde src
 *   - incomingByTarget[tgt] = set de edgeIds entrantes a tgt
 *   - unresolvedByTargetKey[normKey] = fuentes con enlace roto a esa clave
 *   - aliasOwnersByKey[normKey] = relPaths candidatos ordenados por relativePath
 *   - sourcesByLinkKey[normKey] = todas las fuentes con un wikilink de esa clave
 */
export class WikiGraphIndex {
  readonly entriesByPath         = new Map<string, NoteEntry>();
  readonly outgoingBySource      = new Map<string, Set<string>>();
  readonly incomingByTarget      = new Map<string, Set<string>>();
  readonly unresolvedByTargetKey = new Map<string, Set<string>>();
  /** normKey → relPaths en orden de relativePath asc (posición 0 = ganador). */
  readonly aliasOwnersByKey      = new Map<string, string[]>();
  /** normKey → todas las fuentes que tienen un wikilink con esa clave normalizada. */
  readonly sourcesByLinkKey      = new Map<string, Set<string>>();

  private _edges       = new Map<string, InternalEdge>();
  private _edgeCounter = 0;

  // ── Utilería básica ────────────────────────────────────────────────────────

  private _emptyDelta(): WikiGraphDelta {
    return {
      addedNodes: [], updatedNodes: [], removedNodeIds: [],
      addedEdges: [], updatedEdges: [], removedEdgeIds: [],
      topologyChanged: false, affectedNodeIds: [],
    };
  }

  private _nextEdgeId(): string { return `e${this._edgeCounter++}`; }

  private _addToSetMap<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
    let s = map.get(key);
    if (!s) { s = new Set(); map.set(key, s); }
    s.add(value);
  }

  private _removeFromSetMap<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
    const s = map.get(key);
    if (s) { s.delete(value); if (s.size === 0) map.delete(key); }
  }

  // ── Gestión de aliases ─────────────────────────────────────────────────────

  private _computeAliasKeys(note: MarkdownFile, content: string): string[] {
    const seen = new Set<string>();
    const keys: string[] = [];
    const push = (raw: string | null | undefined) => {
      if (!raw) return;
      const k = normalizeKey(raw);
      if (k && !seen.has(k)) { seen.add(k); keys.push(k); }
    };
    push(note.title);
    push(note.relativePath.replace(/\.md$/i, "").split(/[/\\]/).pop());
    push(extractFrontmatterTitle(content));
    return keys;
  }

  /**
   * Inserta relPath en la posición ordenada (por relativePath asc, bytes UTF-8) para key.
   * Retorna true si el ganador efectivo (posición 0) cambió.
   *
   * Usa compareRelativePath para que el orden sea idéntico al de Rust String::cmp,
   * compatible con el orden que list_markdown_files garantiza en el backend.
   */
  private _registerAlias(relPath: string, key: string): boolean {
    let arr = this.aliasOwnersByKey.get(key);
    if (!arr) { arr = []; this.aliasOwnersByKey.set(key, arr); }
    if (arr.includes(relPath)) return false;
    const prevWinner = arr[0];
    let i = 0;
    while (i < arr.length && compareRelativePath(arr[i], relPath) < 0) i++;
    arr.splice(i, 0, relPath);
    return arr[0] !== prevWinner;
  }

  /**
   * Elimina relPath de los candidatos para key.
   * Retorna true si el ganador efectivo (posición 0) cambió.
   */
  private _unregisterAlias(relPath: string, key: string): boolean {
    const arr = this.aliasOwnersByKey.get(key);
    if (!arr) return false;
    const idx = arr.indexOf(relPath);
    if (idx === -1) return false;
    const wasWinner = idx === 0;
    arr.splice(idx, 1);
    if (arr.length === 0) this.aliasOwnersByKey.delete(key);
    return wasWinner;
  }

  private _resolveKey(key: string): string | undefined {
    return this.aliasOwnersByKey.get(key)?.[0];
  }

  // ── Gestión de rawLinks ────────────────────────────────────────────────────

  private _computeRawLinks(wikilinks: string[]): RawLink[] {
    return wikilinks.map((label, i) => ({
      label,
      normalizedKey: normalizeKey(label),
      linkOrder: i,
    }));
  }

  private _registerSourceLinks(relPath: string, rawLinks: RawLink[]): void {
    const seen = new Set<string>();
    for (const { normalizedKey } of rawLinks) {
      if (!seen.has(normalizedKey)) {
        seen.add(normalizedKey);
        this._addToSetMap(this.sourcesByLinkKey, normalizedKey, relPath);
      }
    }
  }

  private _unregisterSourceLinks(relPath: string, rawLinks: RawLink[]): void {
    const seen = new Set<string>();
    for (const { normalizedKey } of rawLinks) {
      if (!seen.has(normalizedKey)) {
        seen.add(normalizedKey);
        this._removeFromSetMap(this.sourcesByLinkKey, normalizedKey, relPath);
      }
    }
  }

  // ── Gestión de aristas ─────────────────────────────────────────────────────

  private _addEdge(edge: InternalEdge): void {
    this._edges.set(edge.id, edge);
    this._addToSetMap(this.outgoingBySource, edge.sourceRelPath, edge.id);
    this._addToSetMap(this.incomingByTarget, edge.targetRelPath, edge.id);
    if (edge.isBroken) {
      this._addToSetMap(this.unresolvedByTargetKey, normalizeKey(edge.label), edge.sourceRelPath);
    }
  }

  /**
   * Registra los endpoints de una arista en affectedIds ANTES de eliminarla.
   * Garantiza que affectedNodeIds incluya source y target de aristas eliminadas.
   */
  private _recordEdgeEndpoints(edge: InternalEdge, affectedIds: Set<string>): void {
    affectedIds.add(sanitizeId(edge.sourceRelPath));
    affectedIds.add(
      edge.isBroken
        ? sanitizeId(`missing_${normalizeKey(edge.label)}`)
        : sanitizeId(edge.targetRelPath),
    );
  }

  private _removeEdge(edgeId: string): InternalEdge | undefined {
    const edge = this._edges.get(edgeId);
    if (!edge) return undefined;
    this._edges.delete(edgeId);
    this._removeFromSetMap(this.outgoingBySource, edge.sourceRelPath, edgeId);
    this._removeFromSetMap(this.incomingByTarget, edge.targetRelPath, edgeId);
    if (edge.isBroken) {
      this._removeFromSetMap(this.unresolvedByTargetKey, normalizeKey(edge.label), edge.sourceRelPath);
    }
    return edge;
  }

  // ── Derivación de aristas deseadas ────────────────────────────────────────

  /**
   * Calcula el conjunto completo de aristas deseadas para sourceRelPath usando
   * el estado actual del índice de aliases y los rawLinks en linkOrder.
   *
   * Deduplicación por sourceId→targetId (primer label en orden gana).
   * Self-links ignorados.
   */
  private _deriveDesiredOutgoing(sourceRelPath: string): Array<{
    targetRelPath: string;
    label: string;
    isBroken: boolean;
  }> {
    const entry = this.entriesByPath.get(sourceRelPath);
    if (!entry) return [];

    // TODO(GRAPH-IDENTITY-01): sanitizeId puede colisionar entre paths distintos.
    // No resuelto aquí; se mantiene el comportamiento actual de buildWikiGraph.
    const sourceId = sanitizeId(sourceRelPath);
    const seenEdgeKeys = new Set<string>();
    const desired: Array<{ targetRelPath: string; label: string; isBroken: boolean }> = [];

    for (const { label, normalizedKey } of entry.rawLinks) {
      const resolved = this._resolveKey(normalizedKey);
      if (resolved === sourceRelPath) continue; // self-link

      const isBroken = !resolved;
      const targetRelPath = resolved ?? `__missing__/${normalizedKey}`;
      const targetId = isBroken
        ? sanitizeId(`missing_${normalizedKey}`)
        : sanitizeId(targetRelPath);

      const edgeKey = `${sourceId}→${targetId}`;
      if (seenEdgeKeys.has(edgeKey)) continue;
      seenEdgeKeys.add(edgeKey);

      desired.push({ targetRelPath, label, isBroken });
    }

    return desired;
  }

  // ── Reconciliación por fuente ──────────────────────────────────────────────

  /**
   * Reconcilia las aristas salientes reales de sourceRelPath contra las deseadas.
   *
   * Captura estado de nodos faltantes ANTES de tocar aristas (popula missingBefore).
   * Para mismo targetRelPath: mantiene edgeId, emite updatedEdges si cambia label.
   * Para targetRelPath nuevo: crea arista con ID fresco.
   * Para targetRelPath obsoleto: elimina arista.
   */
  private _reconcileOutgoingForSource(
    sourceRelPath: string,
    delta: WikiGraphDelta,
    affectedReal: Set<string>,
    missingBefore: Map<string, WikiNode | null>,
    explicitIds: Set<string>,
  ): void {
    const desired      = this._deriveDesiredOutgoing(sourceRelPath);
    const desiredByTgt = new Map(desired.map(d => [d.targetRelPath, d]));

    const currentByTgt = new Map<string, InternalEdge>();
    for (const edgeId of (this.outgoingBySource.get(sourceRelPath) ?? new Set())) {
      const edge = this._edges.get(edgeId);
      if (edge) currentByTgt.set(edge.targetRelPath, edge);
    }

    // Snapshot missing nodes ANTES de cualquier mutación de aristas
    for (const tp of [...currentByTgt.keys(), ...desiredByTgt.keys()]) {
      if (tp.startsWith("__missing__/") && !missingBefore.has(tp)) {
        missingBefore.set(tp, this._captureMissingNode(tp));
      }
    }

    // Eliminar aristas que ya no se desean
    for (const [tp, edge] of currentByTgt) {
      if (!desiredByTgt.has(tp)) {
        this._recordEdgeEndpoints(edge, explicitIds);
        this._removeEdge(edge.id);
        delta.removedEdgeIds.push(edge.id);
        affectedReal.add(sourceRelPath);
        if (!edge.isBroken) affectedReal.add(tp);
      }
    }

    // Agregar o actualizar aristas deseadas
    for (const [tp, d] of desiredByTgt) {
      const current = currentByTgt.get(tp);
      if (current) {
        // Mismo targetRelPath: solo puede cambiar el label (normKey intacto → no
        // afecta unresolvedByTargetKey ni incomingByTarget).
        if (current.label !== d.label) {
          current.label = d.label;
          delta.updatedEdges.push(this._buildWikiEdge(current));
          // El título del nodo faltante puede cambiar; se detecta en _emitMissingNodeDeltas.
        }
      } else {
        const newEdge: InternalEdge = {
          id: this._nextEdgeId(),
          sourceRelPath,
          targetRelPath: tp,
          label: d.label,
          isBroken: d.isBroken,
        };
        this._addEdge(newEdge);
        delta.addedEdges.push(this._buildWikiEdge(newEdge));
        affectedReal.add(sourceRelPath);
        if (!d.isBroken) affectedReal.add(tp);
      }
    }
  }

  // ── Captura de estado de nodos ────────────────────────────────────────────

  /** Captura estado actual de un nodo faltante (null si no tiene entrantes). */
  private _captureMissingNode(targetRelPath: string): WikiNode | null {
    return (this.incomingByTarget.get(targetRelPath)?.size ?? 0) > 0
      ? this._buildMissingNode(targetRelPath)
      : null;
  }

  // ── Delta de nodos faltantes ──────────────────────────────────────────────

  private _emitMissingNodeDeltas(
    missingBefore: Map<string, WikiNode | null>,
    delta: WikiGraphDelta,
    explicitIds: Set<string>,
  ): void {
    for (const [tp, before] of missingBefore) {
      const after = this._captureMissingNode(tp);
      if (!before && after) {
        delta.addedNodes.push(after);
        explicitIds.add(after.id);
      } else if (before && !after) {
        delta.removedNodeIds.push(before.id);
        explicitIds.add(before.id);
      } else if (before && after) {
        if (before.title !== after.title || before.backlinkCount !== after.backlinkCount) {
          delta.updatedNodes.push(after);
          explicitIds.add(after.id);
        }
      }
    }
  }

  // ── Constructores de entidades WikiGraph ───────────────────────────────────

  private _buildWikiNode(relPath: string): WikiNode {
    const entry = this.entriesByPath.get(relPath);
    if (!entry) throw new Error(`WikiGraphIndex: entrada no encontrada para "${relPath}"`);
    const out = this.outgoingBySource.get(relPath)?.size ?? 0;
    const bl  = this.incomingByTarget.get(relPath)?.size ?? 0;
    return {
      id: sanitizeId(relPath),
      title: entry.note.title,
      relativePath: relPath,
      folder: entry.note.folder.split("/")[0] || "notes",
      tags: [...entry.tags],
      type: entry.type,
      outgoingCount: out,
      backlinkCount: bl,
      isOrphan: out === 0 && bl === 0,
      exists: true,
    };
  }

  /**
   * Título del nodo faltante: primer edge entrante según
   * (sourceRelPath asc, linkOrder asc).
   */
  private _getMissingNodeTitle(targetRelPath: string): string {
    const normKey  = targetRelPath.slice("__missing__/".length);
    const incoming = this.incomingByTarget.get(targetRelPath);
    if (!incoming || incoming.size === 0) return normKey;

    let bestLabel  = normKey;
    let bestSource = "￿"; // cualquier path real es menor
    let bestOrder  = Infinity;

    for (const edgeId of incoming) {
      const edge = this._edges.get(edgeId);
      if (!edge) continue;
      const src      = edge.sourceRelPath;
      const srcEntry = this.entriesByPath.get(src);
      const link     = srcEntry?.rawLinks.find(l => l.label === edge.label);
      const order    = link?.linkOrder ?? Infinity;

      const cmp = src < bestSource ? -1 : src > bestSource ? 1 : 0;
      if (cmp < 0 || (cmp === 0 && order < bestOrder)) {
        bestSource = src;
        bestOrder  = order;
        bestLabel  = edge.label;
      }
    }

    return bestLabel;
  }

  private _buildMissingNode(targetRelPath: string): WikiNode {
    const normKey = targetRelPath.slice("__missing__/".length);
    const bl      = this.incomingByTarget.get(targetRelPath)?.size ?? 0;
    return {
      id: sanitizeId(`missing_${normKey}`),
      title: this._getMissingNodeTitle(targetRelPath),
      relativePath: targetRelPath,
      folder: "missing",
      tags: [],
      type: "missing",
      outgoingCount: 0,
      backlinkCount: bl,
      isOrphan: false,
      exists: false,
    };
  }

  private _buildWikiEdge(edge: InternalEdge): WikiEdge {
    const normKey  = normalizeKey(edge.label);
    const targetId = edge.isBroken
      ? sanitizeId(`missing_${normKey}`)
      : sanitizeId(edge.targetRelPath);
    return {
      id: edge.id,
      source: sanitizeId(edge.sourceRelPath),
      target: targetId,
      label: edge.label,
      type: edge.isBroken ? "broken" : "wikilink",
      weight: 1,
      isBacklink: false,
      isBroken: edge.isBroken,
    };
  }

  // ── Canonicalización del delta ─────────────────────────────────────────────

  private _finalizeDelta(delta: WikiGraphDelta, explicitIds: Set<string>): WikiGraphDelta {
    const removedNodeSet = new Set(delta.removedNodeIds);
    const removedEdgeSet = new Set(delta.removedEdgeIds);

    const addedNodesMap = new Map<string, WikiNode>();
    for (const n of delta.addedNodes) {
      if (!removedNodeSet.has(n.id)) addedNodesMap.set(n.id, n);
    }
    const addedNodeIds = new Set(addedNodesMap.keys());

    const updatedNodesMap = new Map<string, WikiNode>();
    for (const n of delta.updatedNodes) {
      if (!addedNodeIds.has(n.id) && !removedNodeSet.has(n.id)) updatedNodesMap.set(n.id, n);
    }

    const addedEdgesMap = new Map<string, WikiEdge>();
    for (const e of delta.addedEdges) {
      if (!removedEdgeSet.has(e.id)) addedEdgesMap.set(e.id, e);
    }
    const addedEdgeIds = new Set(addedEdgesMap.keys());

    const updatedEdgesMap = new Map<string, WikiEdge>();
    for (const e of delta.updatedEdges) {
      if (!addedEdgeIds.has(e.id) && !removedEdgeSet.has(e.id)) updatedEdgesMap.set(e.id, e);
    }

    const finalAddedNodes     = Array.from(addedNodesMap.values());
    const finalUpdatedNodes   = Array.from(updatedNodesMap.values());
    const finalRemovedNodeIds = [...removedNodeSet];
    const finalAddedEdges     = Array.from(addedEdgesMap.values());
    const finalUpdatedEdges   = Array.from(updatedEdgesMap.values());
    const finalRemovedEdgeIds = [...removedEdgeSet];

    const topologyChanged =
      finalAddedNodes.length > 0 || finalRemovedNodeIds.length > 0 ||
      finalAddedEdges.length > 0 || finalRemovedEdgeIds.length > 0;

    // affectedNodeIds: acumulación explícita + cambios de nodos + endpoints de aristas
    const affectedIds = new Set(explicitIds);
    for (const n of finalAddedNodes)   affectedIds.add(n.id);
    for (const n of finalUpdatedNodes) affectedIds.add(n.id);
    for (const id of finalRemovedNodeIds) affectedIds.add(id);
    for (const e of [...finalAddedEdges, ...finalUpdatedEdges]) {
      affectedIds.add(e.source);
      affectedIds.add(e.target);
    }

    return {
      addedNodes: finalAddedNodes,
      updatedNodes: finalUpdatedNodes,
      removedNodeIds: finalRemovedNodeIds,
      addedEdges: finalAddedEdges,
      updatedEdges: finalUpdatedEdges,
      removedEdgeIds: finalRemovedEdgeIds,
      topologyChanged,
      affectedNodeIds: [...affectedIds],
    };
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  private _reset(): void {
    this.entriesByPath.clear();
    this.outgoingBySource.clear();
    this.incomingByTarget.clear();
    this.unresolvedByTargetKey.clear();
    this.aliasOwnersByKey.clear();
    this.sourcesByLinkKey.clear();
    this._edges.clear();
    this._edgeCounter = 0;
  }

  // ── API pública ────────────────────────────────────────────────────────────

  /**
   * Inicializa el índice desde el estado completo del vault.
   * Única operación O(N·L). Usar en: carga inicial, cambio de vault, recarga manual.
   */
  hydrate(notes: MarkdownFile[], contentMap: Map<string, string>): WikiGraphDelta {
    this._reset();

    // Paso 1: entradas + índice de aliases + índice de fuentes por clave
    for (const note of notes) {
      const content   = contentMap.get(note.relativePath) ?? "";
      const aliasKeys = this._computeAliasKeys(note, content);
      const rawLinks  = this._computeRawLinks(extractWikilinks(content));
      this.entriesByPath.set(note.relativePath, {
        note,
        tags: extractTags(content),
        type: getNoteTypeFromFolder(note.folder),
        aliasKeys,
        rawLinks,
      });
      for (const key of aliasKeys) this._registerAlias(note.relativePath, key);
      this._registerSourceLinks(note.relativePath, rawLinks);
    }

    // Paso 2: aristas usando _deriveDesiredOutgoing (índice de aliases completo)
    for (const [relPath] of this.entriesByPath) {
      for (const d of this._deriveDesiredOutgoing(relPath)) {
        this._addEdge({
          id: this._nextEdgeId(),
          sourceRelPath: relPath,
          targetRelPath: d.targetRelPath,
          label: d.label,
          isBroken: d.isBroken,
        });
      }
    }

    // Construir delta todo-añadido
    const delta       = this._emptyDelta();
    const seenMissing = new Set<string>();

    for (const [relPath] of this.entriesByPath) {
      delta.addedNodes.push(this._buildWikiNode(relPath));
    }
    for (const edge of this._edges.values()) {
      delta.addedEdges.push(this._buildWikiEdge(edge));
      if (edge.isBroken && !seenMissing.has(edge.targetRelPath)) {
        seenMissing.add(edge.targetRelPath);
        delta.addedNodes.push(this._buildMissingNode(edge.targetRelPath));
      }
    }

    return this._finalizeDelta(delta, new Set());
  }

  /**
   * Inserta o actualiza una nota usando contenido ya conocido en memoria.
   * No realiza ninguna lectura de disco.
   *
   * Cubre:
   *   - Nota nueva sin enlaces → 1 nodo huérfano en delta, 0 aristas.
   *   - Nota nueva que es destino de referencias rotas → aristas broken → resolved.
   *   - Actualización con nuevos/eliminados wikilinks → delta exacto de aristas.
   *   - Cambio de título que libera un alias → fallback a siguiente candidato.
   *   - Alias colisionante: posición determinista por relativePath, no por mutación.
   */
  upsertNote(note: MarkdownFile, content: string): WikiGraphDelta {
    const delta    = this._emptyDelta();
    const relPath  = note.relativePath;
    const isNew    = !this.entriesByPath.has(relPath);
    const oldEntry = isNew ? null : this.entriesByPath.get(relPath)!;

    const newAliasKeys = this._computeAliasKeys(note, content);
    const newRawLinks  = this._computeRawLinks(extractWikilinks(content));

    const affectedReal  = new Set<string>();
    const explicitIds   = new Set<string>();
    const missingBefore = new Map<string, WikiNode | null>();

    // ── 1. Actualizar índice de aliases ────────────────────────────────
    // Solo tocar aliases eliminados/agregados. Retenidos no se mueven:
    // unregister+register destruiría la posición ordenada ganada previamente.
    const changedAliasKeys = new Set<string>();
    if (isNew) {
      for (const key of newAliasKeys) {
        if (this._registerAlias(relPath, key)) changedAliasKeys.add(key);
      }
    } else {
      const oldSet = new Set(oldEntry!.aliasKeys);
      const newSet = new Set(newAliasKeys);
      for (const k of oldEntry!.aliasKeys) {
        if (!newSet.has(k) && this._unregisterAlias(relPath, k)) changedAliasKeys.add(k);
      }
      for (const k of newAliasKeys) {
        if (!oldSet.has(k) && this._registerAlias(relPath, k)) changedAliasKeys.add(k);
      }
    }

    // ── 2. Actualizar índice de fuentes por clave ──────────────────────
    if (!isNew) this._unregisterSourceLinks(relPath, oldEntry!.rawLinks);
    this._registerSourceLinks(relPath, newRawLinks);

    // ── 3. Confirmar entrada actualizada ───────────────────────────────
    this.entriesByPath.set(relPath, {
      note,
      tags: extractTags(content),
      type: getNoteTypeFromFolder(note.folder),
      aliasKeys: newAliasKeys,
      rawLinks: newRawLinks,
    });

    // ── 4. Reconciliar aristas salientes de esta nota ──────────────────
    this._reconcileOutgoingForSource(relPath, delta, affectedReal, missingBefore, explicitIds);

    // ── 5. Reconciliar todas las fuentes afectadas por cambios de alias ─
    const sourcesToReconcile = new Set<string>();
    for (const key of changedAliasKeys) {
      for (const src of (this.sourcesByLinkKey.get(key) ?? [])) {
        if (src !== relPath) sourcesToReconcile.add(src);
      }
    }
    for (const src of sourcesToReconcile) {
      this._reconcileOutgoingForSource(src, delta, affectedReal, missingBefore, explicitIds);
    }

    // ── 6. Emitir nodo de esta nota ────────────────────────────────────
    const thisNode = this._buildWikiNode(relPath);
    if (isNew) delta.addedNodes.push(thisNode);
    else       delta.updatedNodes.push(thisNode);
    explicitIds.add(thisNode.id);

    // ── 7. Emitir nodos reales afectados ───────────────────────────────
    for (const rp of affectedReal) {
      if (rp === relPath || rp.startsWith("__missing__/")) continue;
      if (this.entriesByPath.has(rp)) {
        const node = this._buildWikiNode(rp);
        delta.updatedNodes.push(node);
        explicitIds.add(node.id);
      }
    }

    // ── 8. Emitir delta de nodos faltantes ─────────────────────────────
    this._emitMissingNodeDeltas(missingBefore, delta, explicitIds);

    return this._finalizeDelta(delta, explicitIds);
  }

  /**
   * Elimina una nota del índice.
   *
   * Sus aristas salientes desaparecen.
   * Las fuentes con aliases afectados se reconcilian completas:
   * si hay fallback, sus aristas apuntan al nuevo ganador; si no, se rompen.
   */
  removeNote(relativePath: string): WikiGraphDelta {
    const delta = this._emptyDelta();
    const entry = this.entriesByPath.get(relativePath);
    if (!entry) return delta;

    const affectedReal  = new Set<string>();
    const explicitIds   = new Set<string>();
    const missingBefore = new Map<string, WikiNode | null>();

    // Capturar nodos faltantes de aristas salientes ANTES de desregistrar
    for (const edgeId of (this.outgoingBySource.get(relativePath) ?? new Set())) {
      const edge = this._edges.get(edgeId);
      if (edge?.isBroken && !missingBefore.has(edge.targetRelPath)) {
        missingBefore.set(edge.targetRelPath, this._captureMissingNode(edge.targetRelPath));
      }
    }

    // ── 1. Desregistrar aliases ────────────────────────────────────────
    const changedAliasKeys = new Set<string>();
    for (const key of entry.aliasKeys) {
      if (this._unregisterAlias(relativePath, key)) changedAliasKeys.add(key);
    }

    // ── 2. Desregistrar fuentes por clave ──────────────────────────────
    this._unregisterSourceLinks(relativePath, entry.rawLinks);

    // ── 3. Eliminar entrada ANTES de reconciliar ───────────────────────
    this.entriesByPath.delete(relativePath);
    const removedId = sanitizeId(relativePath);
    delta.removedNodeIds.push(removedId);
    explicitIds.add(removedId);

    // ── 4. Reconciliar aristas salientes (entrada ausente → deseadas = []) ─
    this._reconcileOutgoingForSource(relativePath, delta, affectedReal, missingBefore, explicitIds);

    // ── 5. Reconciliar fuentes afectadas por cambios de alias ──────────
    const sourcesToReconcile = new Set<string>();
    for (const key of changedAliasKeys) {
      for (const src of (this.sourcesByLinkKey.get(key) ?? [])) {
        if (src !== relativePath) sourcesToReconcile.add(src);
      }
    }
    for (const src of sourcesToReconcile) {
      this._reconcileOutgoingForSource(src, delta, affectedReal, missingBefore, explicitIds);
    }

    // ── 6. Emitir nodos reales afectados ───────────────────────────────
    for (const rp of affectedReal) {
      if (rp === relativePath || rp.startsWith("__missing__/")) continue;
      if (this.entriesByPath.has(rp)) {
        const node = this._buildWikiNode(rp);
        delta.updatedNodes.push(node);
        explicitIds.add(node.id);
      }
    }

    // ── 7. Emitir delta de nodos faltantes ─────────────────────────────
    this._emitMissingNodeDeltas(missingBefore, delta, explicitIds);

    return this._finalizeDelta(delta, explicitIds);
  }

  /**
   * Retorna el WikiGraph actual derivado del estado del índice.
   * Semánticamente equivalente a buildWikiGraph para el mismo estado del vault.
   */
  getGraph(): WikiGraph {
    const nodes: WikiNode[] = [];
    const edges: WikiEdge[] = [];
    const allTags    = new Set<string>();
    const allFolders = new Set<string>();

    for (const [relPath, entry] of this.entriesByPath) {
      nodes.push(this._buildWikiNode(relPath));
      entry.tags.forEach(t => allTags.add(t));
      allFolders.add(entry.note.folder.split("/")[0] || "notes");
    }

    const seenMissing = new Set<string>();
    for (const edge of this._edges.values()) {
      edges.push(this._buildWikiEdge(edge));
      if (edge.isBroken && !seenMissing.has(edge.targetRelPath)) {
        seenMissing.add(edge.targetRelPath);
        nodes.push(this._buildMissingNode(edge.targetRelPath));
      }
    }

    return {
      nodes,
      edges,
      orphanNodes: nodes.filter(n => n.isOrphan),
      brokenLinks: edges.filter(e => e.isBroken),
      tags: Array.from(allTags).sort(),
      folders: Array.from(allFolders).sort(),
    };
  }
}
