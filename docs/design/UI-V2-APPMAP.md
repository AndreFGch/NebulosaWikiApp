# UI-V2-APPMAP — NebulosaWikiApp

## Estado

Completo. Mapa de App.tsx y App.css para descomposición UI V2.  
Versión: 1.0 · 2026-06-05  
Prerrequisito completado: `UI-V2-FRONTEND-ARCHITECTURE.md`

---

## 1. Estado actual

| Archivo | Líneas | Problema |
|---|---|---|
| `src/App.tsx` | 2815 | Tipos, helpers, estado, efectos, handlers Tauri, grafo, editor, modales, JSX: todo junto |
| `src/App.css` | 2472 | Layout, variables raíz, componentes, markdown, grafo, modales, toasts, responsive: todo junto |

**Riesgo activo:** cada pantalla nueva de UI V2 que se agregue a `App.tsx` sin extracción previa incrementa el monolito. Tokens implementados sobre variables existentes sin renombrar van a crear duplicación. La sección `/* ── v2 additions ──` al final de App.css (líneas 2426–2472) es evidencia de este patrón ya ocurriendo.

---

## 2. Mapa de App.tsx por regiones

### Resumen visual

```
Líneas 1–6       → Imports
Líneas 8–59      → Tipos e interfaces
Líneas 61–302    → Helpers puros: Markdown y wiki
Líneas 151–279   → buildWikiGraph (función grande, pura)
Líneas 303–323   → Constantes de plantillas
Líneas 325–431   → Helpers de grafo / física de simulación
Líneas 433–617   → FOLDER_COLORS, GRAPH_STYLE (estilos Cytoscape)
Líneas 619–629   → GRAPH_TYPE_LABELS, ALL_GRAPH_TYPES
Líneas 631–1722  → function App() — todo el estado, efectos y handlers
Líneas 1723–2815 → JSX completo
```

### Detalle por región

#### Imports (1–6)
```
react, tauri/core invoke, tauri/plugin-dialog, react-markdown, remark-gfm, cytoscape, App.css
```
Dependencias externas directas: Tauri, Cytoscape, ReactMarkdown. Ninguna es extraíble sin plan.

---

#### Tipos e interfaces (8–59)

| Tipo | Línea | Destino futuro |
|---|---|---|
| `MarkdownFile` | 8 | `src/types/wiki.ts` |
| `WikiNode` | 15 | `src/types/graph.ts` |
| `WikiEdge` | 28 | `src/types/graph.ts` |
| `WikiGraph` | 39 | `src/types/graph.ts` |
| `DetailMode` | 48 | `src/types/wiki.ts` |
| `MainView` | 49 | `src/types/wiki.ts` |
| `NoteTemplate` | 50 | `src/types/wiki.ts` |
| `ToastKind`, `ToastMessage` | 51–52 | `src/types/wiki.ts` |
| `ContentSearchResult` | 54–59 | `src/types/wiki.ts` |

**Riesgo de extracción:** Bajo. Son solo declaraciones de tipos. No tienen lógica. Mover en ARCH-03.

---

#### Helpers puros — Markdown y wiki (61–302, excepto buildWikiGraph)

| Función | Línea | Destino futuro |
|---|---|---|
| `sanitizeId` | 61 | `src/core/graph/` |
| `normalizeKey` | 65 | `src/core/markdown/` o `src/core/graph/` |
| `extractFrontmatterTitle` | 77 | `src/core/markdown/` |
| `getNoteTypeFromFolder` | 86 | `src/core/markdown/` |
| `stripFrontmatter` | 92 | `src/core/markdown/` |
| `stripCodeBlocks` | 99 | `src/core/markdown/` |
| `stripInlineCode` | 103 | `src/core/markdown/` |
| `extractTags` | 107 | `src/core/markdown/` |
| `extractWikilinks` | 130 | `src/core/markdown/` |
| `preprocessWikilinks` | 141 | `src/core/markdown/` |
| `findNoteByWikilink` | 281 | `src/core/graph/` |
| `slugify` | 291 | `src/core/markdown/` |
| `buildNoteTemplateContent` | 308 | `src/core/markdown/` |

**Riesgo de extracción:** Bajo. Son funciones puras sin side effects ni imports de Tauri. Mover en ARCH-04.  
**Excepción:** `buildNoteTemplateContent` tiene templates hardcodeados en español. Mover con cuidado.

---

#### `buildWikiGraph` (151–279)

Función pura grande que toma `notes: MarkdownFile[]` y `contentMap: Map<string, string>` y devuelve `WikiGraph`. No hace invoke Tauri. No tiene efectos secundarios.

**Destino futuro:** `src/core/graph/buildWikiGraph.ts`  
**Riesgo:** Medio. La función usa todos los tipos definidos arriba. Requiere que ARCH-03 (tipos) se complete primero. Depende de `normalizeKey`, `sanitizeId`, `extractTags`, `extractWikilinks` — todos deben estar en el mismo módulo o importados correctamente.  
**Cuándo mover:** ARCH-04, después de ARCH-03.

---

#### Helpers de grafo y física (325–431)

| Función | Línea | Destino futuro |
|---|---|---|
| `getNodeConnections` | 325 | `src/core/graph/` |
| `getRootGraphNode` | 329 | `src/core/graph/` |
| `clampZoom` | 348 | `src/core/graph/` o `src/ui/graph/` |
| `buildRadialPositions` | 354 | `src/core/graph/` |

**Riesgo de extracción:** Bajo (puras). `buildRadialPositions` es largo (~77 líneas) pero autocontenida.  
**Nota:** `clampZoom` toca `cytoscape.Core` — si se mueve, necesita el import de cytoscape.

---

#### Constantes de Cytoscape (433–617, 619–629)

| Constante | Línea | Destino futuro |
|---|---|---|
| `FOLDER_COLORS` | 433 | `src/core/graph/` o `src/ui/graph/` |
| `GRAPH_STYLE` | 442 | `src/ui/graph/` |
| `GRAPH_TYPE_LABELS` | 619 | `src/core/graph/` |
| `ALL_GRAPH_TYPES` | 629 | `src/core/graph/` |

**Riesgo:** Bajo para mover. `GRAPH_STYLE` tiene colores hardcodeados que deben convertirse a tokens antes de mover — si se mueven antes, los valores hardcodeados se entierran más lejos.  
**Recomendación:** mover `GRAPH_STYLE` en ARCH-06 o después de ARCH-08 (tokens).

---

#### Estado de App() (631–744)

```
Estado de notas y carga (632–634):
  notes, loading, error

Estado de nota seleccionada (636–653):
  selectedNote, recentNotePaths, noteContent,
  contentLoading, contentError, detailMode,
  editContent, editError, editSaving

Estado de grafo (654–660):
  wikiGraph, graphLoading, graphError, graphReady

Estado de controles de grafo (659–674):
  visibleGraphTypes, graphViewMode
  isSidebarOpen, isDetailOpen, showGraphControls, mainView

Estado de modales (677–729):
  showNewNoteModal (+ newNote*)
  deleteConfirmText, deleteError, deleteDeleting, showDeleteModal
  importSourcePath, importTargetFolder, importError, importImporting, showImportModal
  exportTargetPath, exportError, exportSuccess, exportExporting, showExportModal
  exportWikiTargetDir, exportWikiError, exportWikiSuccess, exportWikiExporting, showExportWikiModal
  backupTargetBaseDir, backupError, backupSuccess, backupCreating, showBackupModal
  wikiRoot, wikiRootDraft, wikiRootError, wikiRootSaving, showSettingsModal

Estado de UI global (730–736):
  toasts, showToast callback
  isCommandPaletteOpen, commandQuery

Refs (738–744):
  graphContainerRef, cyRef, rafRef,
  selectedNoteRef, rootIdRef, velocitiesRef, alphaRef
```

**Observación:** El estado de modales podría separarse del estado de notas y del estado de grafo, pero todos están en el mismo `useState`. Separar requiere levantar estado o usar contexto — NO hacer ahora.

---

#### Efectos (746–1635)

| Rango | Efecto | Riesgo de tocar |
|---|---|---|
| 746–750 | Init: cargar notas vía `invoke("list_markdown_files")` | Alto — Tauri |
| 752–761 | Sync recent notes con notas existentes | Bajo |
| 763–767 | Init: obtener wiki root vía `invoke("get_wiki_root")` | Alto — Tauri |
| 848–859 | Keyboard: Ctrl+S para guardar | Bajo |
| 1237–1259 | Build WikiGraph cuando notes cambian | Medio — lógica core |
| 1261–1522 | **Init Cytoscape** — el efecto más grande (261 líneas) | Muy alto — no tocar |
| 1524–1556 | Sync selección de nodo en Cytoscape | Alto — Cytoscape |
| 1558–1560 | Resetear local mode si no hay nota | Bajo |
| 1562–1618 | Filtrar nodos por tipo y modo (global/local) | Alto — Cytoscape |
| 1620–1635 | Keyboard: Ctrl+P para command palette | Bajo |

**El efecto de Cytoscape (1261–1522) incluye:** init de cytoscape, layout preset, física con `requestAnimationFrame`, handlers de hover/tap en nodos, drag handlers. Es el fragmento más acoplado del archivo. No mover en ninguna fase hasta V2.4 con plan específico.

---

#### Handlers – notas (769–1009)

| Handler | Línea | Tauri invoke | Destino futuro |
|---|---|---|---|
| `handleNoteClick` | 769 | Sí (`read_markdown_file`) | NO mover todavía |
| `clearRecentNotes` | 795 | No | `src/ui/home/` eventualmente |
| `handleSave` | 800 | Sí (`update_markdown_file`) | NO mover |
| `handleReloadWiki` | 820 | Sí (`list_markdown_files`) | NO mover |
| `openNewNoteModal` | 861 | No | `src/ui/components/` eventualmente |
| `handleCreateNote` | 869 | Sí (`create_markdown_file`) | NO mover |
| `handleCreateMissingNote` | 907 | Sí (`create_markdown_file`) | NO mover |
| `handleCreateDailyNote` | 939 | Sí (`create_markdown_file`) | NO mover |
| `handleCreateQuickNote` | 976 | Sí (`create_markdown_file`) | NO mover |

---

#### Handlers – importación, exportación, backup, settings (1011–1229)

Todos usan `invoke` de Tauri o `openDialog`/`saveDialog`. No mover todavía.

| Handler | Línea |
|---|---|
| `openImportModal` | 1011 |
| `handleImportNote` | 1018 — `invoke("import_markdown_file")` |
| `handleContentSearch` | 1045 — `invoke("search_markdown_content")` |
| `openExportWikiModal` | 1064 |
| `openBackupModal` | 1071 |
| `handleBrowseBackupDir` | 1078 — `openDialog` |
| `handleBackup` | 1087 — `invoke("backup_wiki")` |
| `handleExportWiki` | 1105 — `invoke("export_wiki")` |
| `handleSaveWikiRoot` | 1123 — `invoke("set_wiki_root")` |
| `handleBrowseWikiRoot` | 1146 — `openDialog` |
| `handleBrowseImportFile` | 1151 — `openDialog` |
| `handleBrowseExportFile` | 1160 — `saveDialog` |
| `handleBrowseExportWikiDir` | 1168 — `openDialog` |
| `openExportModal` | 1177 |
| `handleExportNote` | 1184 — `invoke("export_markdown_file")` |
| `handleDeleteNote` | 1206 — `invoke("delete_markdown_file")` ⚠ destructivo |

---

#### Datos derivados y command palette (1637–1722)

Cálculos en render:
- `commands` (useMemo) — lista de comandos para palette
- `filteredCommands` (useMemo) — filtro por `commandQuery`
- `selectedNodeMeta` — nodo del grafo para nota seleccionada
- `availableTags` — tags únicos de todos los nodos
- `filteredNotes` — notas filtradas por búsqueda/tag
- `outgoingRelations`, `backlinkRelations`, `brokenOutgoing` — relaciones de la nota seleccionada
- `hasUnsavedChanges` — estado de edición pendiente

**Riesgo:** Bajo para extraer `commands` y `filteredCommands` eventualmente a `src/ui/` cuando exista un componente de command palette. No extraer todavía.

---

#### JSX (1723–2815)

| Rango | Bloque JSX | CSS class principal |
|---|---|---|
| 1724–1775 | Ribbon nav | `.nw-ribbon` |
| 1776–1884 | Sidebar: header, search, tags, nota list, content search | `.nw-sidebar` |
| 1884–1988 | Home view (condicional, `mainView === "home"`) | `.nw-home` |
| 1990–2085 | Graph header (siempre visible) | `.nw-graph-header` |
| 2086–2140 | Graph canvas wrapper + controles + leyenda | `.nw-graph-canvas-wrapper` |
| 2141–2183 | Detail panel: header, view toggle, botones | `.nw-detail-panel` |
| 2183–2221 | Node meta (info de nodo Cytoscape) | `.nw-node-meta` |
| 2222–2284 | Relations panel (salientes, backlinks, rotos) | `.nw-relations` |
| 2285–2367 | Content viewer (preview, raw, edit) | `.nw-detail-content` |
| 2370–2535 | Modales: backup, export wiki | `.nw-modal-backdrop` |
| 2536–2638 | Modal: delete | `.nw-modal--danger` |
| 2640–2718 | Modal: nueva nota | `.nw-modal` |
| 2719–2726 | Toast stack | `.nw-toast-stack` |
| 2727–2775 | Modal: settings | `.nw-modal` |
| 2776–2810 | Command palette | `.nw-command-backdrop` |

---

## 3. Candidatos a extracción desde App.tsx

### src/types/

| Qué | Por qué | Riesgo | Cuándo (ARCH) |
|---|---|---|---|
| `MarkdownFile`, `WikiNode`, `WikiEdge`, `WikiGraph` | Contrato compartido entre UI y core | Bajo | ARCH-03 |
| `DetailMode`, `MainView`, `NoteTemplate` | Tipos de estado de UI, no lógica | Bajo | ARCH-03 |
| `ToastKind`, `ToastMessage`, `ContentSearchResult` | Tipos de datos simples | Bajo | ARCH-03 |

### src/core/markdown/

| Qué | Por qué | Riesgo | Cuándo |
|---|---|---|---|
| `extractFrontmatterTitle`, `stripFrontmatter`, `extractTags` | Parsing Markdown puro | Bajo | ARCH-04 |
| `extractWikilinks`, `preprocessWikilinks` | Transformación de wikilinks | Bajo | ARCH-04 |
| `stripCodeBlocks`, `stripInlineCode` | Utilidades de texto | Bajo | ARCH-04 |
| `slugify`, `normalizeKey` | Transformación de strings | Bajo | ARCH-04 |
| `getNoteTypeFromFolder` | Mapeo de folder a tipo | Bajo | ARCH-04 |
| `buildNoteTemplateContent` | Templates de notas | Bajo-Medio | ARCH-04 (cuidado con strings hardcodeados) |

### src/core/graph/

| Qué | Por qué | Riesgo | Cuándo |
|---|---|---|---|
| `sanitizeId`, `findNoteByWikilink` | Helpers de resolución de nodos | Bajo | ARCH-04 |
| `buildWikiGraph` | Función de construcción de grafo (pura) | Medio — requiere tipos primero | ARCH-04, después de ARCH-03 |
| `getNodeConnections`, `getRootGraphNode` | Lógica de selección de nodo raíz | Bajo | ARCH-04 |
| `buildRadialPositions` | Cálculo de posición radial | Bajo | ARCH-04 |
| `FOLDER_COLORS`, `GRAPH_TYPE_LABELS` | Datos de metadatos del grafo | Bajo | ARCH-04 |
| `clampZoom` | Helper de zoom | Bajo-Medio (usa cytoscape.Core) | ARCH-06 |

### src/ui/graph/

| Qué | Por qué | Riesgo | Cuándo |
|---|---|---|---|
| `GRAPH_STYLE` | Estilos Cytoscape — solo deben moverse después de tokens | Bajo | ARCH-08 / después de tokens |
| JSX del graph panel | Vista de grafo con canvas | Alto — ciclo Cytoscape | ARCH-06 |

### src/ui/home/

| Qué | Por qué | Riesgo | Cuándo |
|---|---|---|---|
| JSX del home (líneas 1888–1988) | Vista home está bien delimitada en `mainView === "home"` | Medio — depende de ~12 handlers | ARCH-06, después de ARCH-05 |

### src/ui/layout/

| Qué | Por qué | Riesgo | Cuándo |
|---|---|---|---|
| JSX del ribbon (1724–1775) | Nav lateral, autocontenido | Medio — pasa muchos handlers como props | ARCH-05/06 |
| JSX del sidebar (1776–1884) | Panel lateral con search, tags, note list | Alto — muchos handlers, estado | ARCH-06 |

### src/ui/components/

| Qué | Por qué | Riesgo | Cuándo |
|---|---|---|---|
| Modales (estructura visual) | Patrón `.nw-modal-backdrop + .nw-modal` repetido 6 veces | Medio — cada modal tiene lógica propia | ARCH-05/06 |
| Toast stack (2719–2726) | Renderizado aislado | Bajo | ARCH-05 |

### src/ui/settings/

| Qué | Por qué | Riesgo | Cuándo |
|---|---|---|---|
| Modal de settings (2727–2775) | Settings tiene su propio scope | Medio — invoke Tauri | ARCH-06+ |

---

## 4. Mapa de App.css por secciones

```
Líneas 1–30       → :root — variables CSS (tokens actuales)
Líneas 32–52      → Global: *, body
Líneas 47–67      → .nw-shell — layout raíz de 3 columnas
Líneas 54–113     → Ribbon: .nw-ribbon, .nw-ribbon-btn, estados
Líneas 115–256    → Sidebar: .nw-sidebar, nota list
Líneas 258–346    → Graph panel: .nw-graph-panel, header, canvas
Líneas 347–444    → Detail panel: .nw-detail-panel, header, animaciones
Líneas 445–498    → View toggle + estados del viewer
Líneas 499–717    → Markdown preview: todos los elementos + wikilinks
Líneas 721–886    → Graph controls: chips, type filter, panel de controles
Líneas 887–990    → Graph legend + node metadata card
Líneas 991–1356   → Home: stats, actions, cards, recent, empty states
Líneas 1357–1447  → Edit mode: textarea, botones de acción
Líneas 1448–1663  → Modales compartidos: backdrop, modal, inputs, botones
Líneas 1664–1799  → Search bar + tag filter
Líneas 1802–1910  → Content search results
Líneas 1911–2036  → Relations panel
Líneas 2038–2091  → Delete modal específico
Líneas 2092–2235  → Responsive: @media max-width 900px
Líneas 2237–2425  → Command palette, toasts, settings
Líneas 2426–2472  → v2 additions (agregados encima — patrón que hay que evitar)
```

---

## 5. Variables CSS existentes en `:root`

Todas en líneas 1–30. Prefijo actual: sin prefijo (solo `--nombre`).

| Variable actual | Valor | Rol semántico | Acción V2 |
|---|---|---|---|
| `--bg` | `#08090f` | Fondo principal de la app | Renombrar → `--nw-bg-primary` |
| `--surface` | `#0e1117` | Superficie de componentes | Renombrar → `--nw-surface` |
| `--surface-hover` | `#151b28` | Superficie en hover | Renombrar → `--nw-surface-hover` |
| `--surface-elevated` | `#111827` | Superficie elevada (toasts) | Renombrar → `--nw-surface-elevated` |
| `--border` | `#1e2535` | Borde estándar | Renombrar → `--nw-border` |
| `--border-subtle` | `#263247` | Borde sutil | Renombrar → `--nw-border-subtle` |
| `--accent` | `#8b5cf6` | Color de acento principal — **será dinámico** | Renombrar → `--nw-accent` (dinámico desde settings) |
| `--accent-dim` | `#4e3d9e` | Acento oscuro | Renombrar → `--nw-accent-dim` (derivado de `--nw-accent`) |
| `--accent-cyan` | `#4de1ff` | Cyan secundario | Renombrar → `--nw-accent-secondary` |
| `--accent-emerald` | `#35d399` | Verde secundario | Renombrar → `--nw-ok-accent` o `--nw-accent-tertiary` |
| `--accent-amber` | `#fbbf24` | Ámbar (warning) | Renombrar → `--nw-warning` |
| `--accent-rose` | `#fb7185` | Rosa (danger suave) | Renombrar → `--nw-danger-soft` |
| `--text` | `#f0f2f8` | Texto principal | Renombrar → `--nw-text-primary` |
| `--text-muted` | `#8899b0` | Texto secundario | Renombrar → `--nw-text-secondary` |
| `--text-dim` | `#4e5a70` | Texto apagado | Renombrar → `--nw-text-muted` |
| `--badge-bg` | `#131724` | Fondo de badges, headers internos | Renombrar → `--nw-surface-inset` |
| `--code-bg` | `#0f1220` | Fondo de bloques de código | Renombrar → `--nw-editor-bg` |
| `--code-text` | `#b8c4ff` | Color de texto de código | Renombrar → `--nw-editor-text` |
| `--ok` | `#4ade80` | Estado OK / success | Renombrar → `--nw-ok` |
| `--error` | `#f87171` | Estado error | Renombrar → `--nw-error` |

**Total:** 20 variables. Todas deben renombrarse con prefijo `--nw-` en tokens V2.

---

## 6. Valores hardcodeados frecuentes

### Colores hex sin variable (candidatos a token o valor derivado)

| Valor | Dónde | Frecuencia | Semántica probable |
|---|---|---|---|
| `#07090e` | `.nw-graph-panel` background (CSS ~265) | 1 | Fondo de panel central — cercano a `--bg` pero distinto |
| `#03040a` | `.nw-graph-container` background (CSS ~328) | 1 | Fondo del canvas del grafo |
| `#0f1117` | `.nw-command-palette` bg (CSS ~2250) | 1 | Same que `--surface` pero hardcodeado |
| `#0d1019`, `#090c13` | Sidebar gradient (CSS ~121) | 1 c/u | Gradiente del sidebar |
| `#06070d`, `#08090f` | Ribbon gradient (CSS ~60) | 1 c/u | Gradiente del ribbon |
| `#c4b5fd` | GRAPH_STYLE nodos + CSS | ~6 | Acento claro — token `--nw-accent-light` |
| `#956030` | Nodo huérfana border (App.tsx ~494, CSS ~299) | 2 | Color de warning gráfico |
| `#303655` | Node background GRAPH_STYLE (~446) | 1 | Background nodo base |
| `#424870` | Border nodo base (~457) | 1 | Border nodo base |
| `#5c2020` | Edge rota (~583) | 1 | Broken link color |

### Rgba con opacidad (patron muy frecuente)

| Patrón | Frecuencia estimada | Semántica |
|---|---|---|
| `rgba(124, 106, 247, 0.X)` | ~35+ en CSS | Variante alpha del accent (diferente RGB que `--accent`) |
| `rgba(139, 92, 246, 0.X)` | ~12+ en CSS | Variante alpha de `--accent` |
| `rgba(255, 255, 255, 0.0X)` | ~15+ en CSS | Overlay blanco sutil |
| `rgba(77, 225, 255, 0.X)` | ~4 en CSS | Cyan con alpha |
| `rgba(248, 113, 113, 0.X)` | ~8 en CSS | Error con alpha |

**Problema:** `rgba(124, 106, 247, ...)` y `rgba(139, 92, 246, ...)` son dos valores distintos para el mismo rol semántico (acento). Hay inconsistencia en el RGB usado. Cuando `--nw-accent` sea dinámico, todas las variantes alpha deben derivar del mismo valor.

### Spacing y border-radius repetidos

| Valor | Patrón | Candidato a token |
|---|---|---|
| `6px` border-radius (botones pequeños) | ~20+ veces | `--nw-radius-sm` |
| `8px`, `10px` border-radius | ~10+ veces c/u | `--nw-radius-md` |
| `12px`, `14px` border-radius | ~8+ veces c/u | `--nw-radius-lg` |
| `4px` padding vertical de chips | patrón | `--nw-spacing-xs` |
| `8px` padding estándar | patrón | `--nw-spacing-sm` |
| `14px`, `16px` padding de paneles | patrón | `--nw-spacing-md` |

### Font-size repetidos

| Valor | Frecuencia | Semántica probable |
|---|---|---|
| `0.6rem`–`0.67rem` | ~12+ | Label micro, uppercase |
| `0.72rem`–`0.75rem` | ~15+ | Label pequeño, badge |
| `0.82rem`–`0.85rem` | ~20+ | Texto UI estándar |
| `0.88rem`–`0.92rem` | ~10+ | Texto contenido |

### Monospace stack repetida

```css
"Cascadia Code", "Fira Code", "Consolas", monospace
```

Aparece en ~8 lugares. Candidato a `--nw-font-mono`.

---

## 7. Qué NO mover todavía

Protegido durante todas las fases ARCH-XX:

| Qué | Riesgo | Por qué |
|---|---|---|
| Todos los `invoke(...)` de Tauri | Muy alto | Interfaz con backend Rust. Sin esta capa la app no funciona. |
| `openDialog`, `saveDialog` | Alto | Integración nativa de diálogos de archivo. |
| Efecto de Cytoscape init (1261–1522) | Muy alto | 261 líneas de ciclo de vida de grafo con física. Mover solo en ARCH-06 con plan explícito. |
| `handleDeleteNote` | Muy alto | Operación destructiva con `invoke`. |
| `handleSave`, `handleReloadWiki` | Alto | Escritura de archivos reales. |
| `buildWikiGraph` | Medio | Puede moverse en ARCH-04 pero requiere tipos primero. |
| Estado de Cytoscape (`cyRef`, `rafRef`, `velocitiesRef`) | Alto | Refs del ciclo de vida de Cytoscape. |
| Estado de modales combinado | Medio | Separar implicaría levantar estado o crear contexto. No hacer ahora. |

---

## 8. Orden recomendado después del mapa

### Recomendación: ir directamente a UI-V2-DOC-02 tokens

**Justificación:**

Con este mapa completo, ya sabemos:
1. Qué variables existen en `:root` (20 variables, nombres y valores exactos)
2. Qué valores hardcodeados hay que tokenizar (sección 6)
3. Dónde vivirán los tokens: `src/ui/theme/tokens.css`
4. El problema de los dos RGB distintos para el acento (`#7c6af7` vs `#8b5cf6`)

UI-V2-DOC-02 tokens puede escribirse ahora con datos reales y precisos.

**Orden recomendado:**

```
UI-V2-DOC-02 → definir tokens (informado por este mapa)
ARCH-03 → extraer tipos a src/types (no depende de tokens)
ARCH-08 → implementar tokens.css
ARCH-04 → extraer helpers puros a src/core (no bloquea nada)
ARCH-05 → extraer componentes visuales sin lógica
ARCH-06 → mover views grandes (Home, Graph, Editor)
ARCH-07 → separar CSS por módulos
```

**ARCH-03 puede ir en paralelo con UI-V2-DOC-02** porque extraer tipos no depende de tokens y no toca CSS.

### Alternativa descartada: ARCH-03 primero

No ofrece beneficio claro sobre ir directo a tokens. Los tipos se pueden extraer en cualquier momento.

---

## 9. Criterios de aceptación

Este mapa cumple su función si:

- [x] UI-V2-DOC-02 puede redactar tokens con nombres precisos basados en variables reales de `:root`
- [x] Los valores hardcodeados frecuentes están identificados y candidateados
- [x] Está claro qué funciones son puras y movibles sin riesgo
- [x] Está claro qué handlers tienen `invoke` Tauri y no deben moverse todavía
- [x] El efecto Cytoscape está explícitamente marcado como intocable hasta ARCH-06
- [x] El problema de los dos RGB del accent está documentado antes de implementar tokens
- [x] El orden entre UI-V2-DOC-02 y ARCH-03 está justificado con datos reales

---

## Relación con documentos existentes

| Documento | Rol |
|---|---|
| `UI-V2-DIRECTION.md` | Ancla visual y roadmap de pantallas |
| `UI-V2-FRONTEND-ARCHITECTURE.md` | Plan de descomposición por fases |
| `UI-V2-APPMAP.md` | **Este documento.** Mapa real de App.tsx y App.css |
| `UI-V2-DOC-02` (por crear) | Definición de tokens — usa sección 5 y 6 de este mapa |
