# UI-V2-FRONTEND-ARCHITECTURE — NebulosaWikiApp

## Estado

Aprobado. Plan de descomposición frontend para UI V2.  
Versión: 1.0 · 2026-06-05  
Prerrequisito completado: `UI-V2-DIRECTION.md`

---

## 1. Estado actual

### Monolito

| Archivo | Líneas | Problema |
|---|---|---|
| `src/App.tsx` | 2815 | Todo el frontend en un archivo: vistas, lógica, handlers, Tauri, grafo, editor, modales |
| `src/App.css` | 2472 | Todo el CSS en un archivo: layout, tokens ad-hoc, componentes, override, animaciones |

### Carpetas vacías

Existen pero no se usan:

```
src/app/      ← vacío
src/core/     ← vacío
src/ui/       ← vacío
src/types/    ← vacío
```

Estas carpetas definen la estructura objetivo. Están listas. Nada se ha movido todavía.

### Riesgo activo

Si se implementa UI V2 directamente sobre `App.tsx`:

- Cada nueva vista aumenta el monolito
- Tokens V2 se agregan sobre nombres CSS viejos sin reemplazarlos
- Conflictos de estilos más difíciles de rastrear
- V2.4 Workspace se vuelve inmanejable sin separación previa
- CodeGraph llega a una base que no tiene estructura real

**Añadir pantallas a `App.tsx` sin este plan aprobado es el anti-patrón más costoso en este momento.**

---

## 2. Objetivo de arquitectura frontend

### Qué queremos lograr

1. Separar UI progresivamente sin romper lógica existente
2. Preparar `src/ui/theme/` para tokens V2.1
3. Preparar `src/ui/home/` para Welcome y Home
4. Preparar `src/ui/layout/` para Workspace V2.4
5. Preparar `src/core/` para lógica pura extraída de App.tsx
6. Dejar `src/types/` como contrato compartido entre UI y core
7. Mantener todo el comportamiento existente estable durante cada fase

### Qué no queremos

- Refactor masivo en una sola microtarea
- Cambiar comportamiento mientras se mueve código
- Mezclar rediseño visual con extracción de estructura
- Introducir dependencias nuevas durante la extracción

---

## 3. Estructura objetivo

No crear estos archivos todavía. Solo documentar destino.

```
src/
├── app/
│   ├── AppShell.tsx          ← raíz de la app: rutas entre vistas, estado global shell
│   └── appState.ts           ← estado compartido de nivel app (vault activo, tema)
│
├── ui/
│   ├── theme/
│   │   ├── tokens.css        ← variables CSS semánticas (--nw-bg, --nw-accent, etc.)
│   │   ├── themeTypes.ts     ← tipos: Theme, Density, AccentColor
│   │   └── themeUtils.ts     ← helpers: applyTheme, cssVarFromAccent
│   │
│   ├── layout/
│   │   ├── Shell.tsx         ← contenedor principal: sidebar + área central
│   │   ├── Sidebar.tsx       ← rail / navegación lateral
│   │   └── Ribbon.tsx        ← barra superior o command bar (si existe)
│   │
│   ├── home/
│   │   ├── WelcomeLanding.tsx   ← vault landing: identidad + CTAs + knowledge pulse
│   │   ├── HomeView.tsx         ← home funcional: recientes, accesos, estado
│   │   ├── KnowledgePulse.tsx   ← señal ambiental: notas · conexiones · salud
│   │   └── RecentNotesSurface.tsx ← cards de notas recientes
│   │
│   ├── graph/
│   │   └── WikiGraphView.tsx    ← wrapper visual del WikiGraph real (Cytoscape.js)
│   │
│   ├── editor/
│   │   ├── EditorView.tsx       ← área de edición Markdown
│   │   └── PreviewPane.tsx      ← panel de preview renderizado
│   │
│   ├── settings/
│   │   └── AppearancePanel.tsx  ← panel de personalización visual
│   │
│   └── components/
│       ├── Button.tsx           ← botón con variantes semánticas
│       ├── Pill.tsx             ← etiqueta / badge
│       ├── Card.tsx             ← card de nota
│       └── CommandInput.tsx     ← entrada command palette
│
├── core/
│   ├── markdown/    ← parsing, rendering helpers
│   ├── graph/       ← buildWikiGraph y lógica de construcción de grafo
│   ├── search/      ← interfaz con búsqueda Rust via Tauri
│   ├── indexing/    ← lógica de índice de notas
│   └── safety/      ← validación de rutas, confirmaciones destructivas
│
└── types/
    ├── wiki.ts       ← Note, WikiLink, NoteMetadata, VaultInfo
    ├── graph.ts      ← GraphNode, GraphEdge, WikiGraph
    ├── settings.ts   ← AppSettings, VaultConfig, ThemeSettings
    └── theme.ts      ← Theme, Density, AccentColor, FontFamily
```

---

## 4. Orden de extracción recomendado

Cada ARCH-XX es una microtarea separada. Máximo 3–5 archivos por tarea.

### ARCH-01 — Documento de arquitectura *(este archivo)*
**Estado:** Completo.  
Documenta estado actual, estructura objetivo y plan de fases.

---

### ARCH-02 — Mapear regiones de App.tsx y App.css
**Sin mover código. Solo identificar y documentar.**

Producir:
- Lista de regiones funcionales en App.tsx (handlers Tauri, vistas, helpers, estado)
- Lista de secciones en App.css (layout, tokens existentes, overrides por componente)
- Identificar qué variables CSS ya existen en App.css (candidatas a tokens reales)
- Identificar valores hardcodeados frecuentes (candidatos a tokens nuevos)

Entregable: documento `docs/design/UI-V2-APPMAP.md`.

> **Por qué ARCH-02 va antes que tokens:**  
> App.css tiene 2472 líneas. Sin mapearlas, los nombres de tokens V2 pueden duplicar o  
> contradecir variables CSS ya existentes. ARCH-02 revela qué existe, dónde y con qué nombre.  
> Eso informa directamente la nomenclatura y organización de `tokens.css`.  
> Ver sección 7 para detalle sobre relación con UI-V2-DOC-02.

---

### ARCH-03 — Extraer tipos a src/types
Mover o crear:
- `src/types/wiki.ts`
- `src/types/graph.ts`
- `src/types/settings.ts`
- `src/types/theme.ts`

Solo tipos e interfaces. Sin lógica. Sin efectos secundarios.

---

### ARCH-04 — Extraer helpers puros a src/core
Mover funciones puras sin efectos de UI:
- Helpers de Markdown
- `buildWikiGraph` (si se puede mover sin romper handlers)
- Validación de rutas (safety)

No mover handlers Tauri todavía.

---

### ARCH-05 — Extraer componentes visuales sin lógica
Mover componentes que solo renderizan:
- `Button`, `Pill`, `Card`, `CommandInput`
- Componentes sin `invoke`, sin `useState` de lógica de negocio

---

### ARCH-06 — Mover vistas grandes
Mover vistas completas a `src/ui/`:
- `HomeView` / `WelcomeLanding`
- `WikiGraphView` (wrapper del grafo Cytoscape)
- `EditorView` / `PreviewPane`

Cada vista es una microtarea separada.

---

### ARCH-07 — Separar CSS por módulos o secciones
Dividir App.css en archivos por responsabilidad:
- `tokens.css` ← variables semánticas
- `layout.css` ← shell, sidebar, ribbon
- `home.css` ← welcome, home, cards
- `graph.css` ← wikigraph, cytoscape overrides
- `editor.css` ← editor, preview
- `components.css` ← botones, pills, modales

No cambiar valores. Solo reorganizar.

---

### ARCH-08 — Preparar tokens V2
Implementar `src/ui/theme/tokens.css` con variables semánticas completas.  
Basado en mapa de App.css de ARCH-02 y sistema definido en UI-V2-DOC-02.

Este paso habilita UI-V2.1 de `UI-V2-DIRECTION.md`.

---

## 5. Qué NO mover todavía

Protegido durante todas las fases ARCH-XX:

| Qué | Por qué protegerlo |
|---|---|
| Handlers Tauri `invoke` | Tocarlos rompe flujo local-first |
| Lectura/escritura de archivos | Lógica crítica, sin tests automáticos |
| `buildWikiGraph` (si está estable) | Mueve solo en ARCH-04 con plan explícito |
| Búsqueda full-text (interfaz Rust) | Dependencia de backend, no refactorizable sin plan |
| Editor Markdown | Vista compleja, mover solo en ARCH-06 |
| Modales críticos | Requieren contexto de estado; mover último |
| Grafo Cytoscape (lógica) | Solo wrapper visual en ARCH-06; lógica no se toca |

---

## 6. Reglas para futuras extracciones

- Máximo 3–5 archivos por microtarea
- Mantener nombres existentes de funciones y componentes cuando sea posible
- No cambiar handlers si no es necesario para la extracción
- No cambiar comportamiento observable durante ninguna fase ARCH-XX
- Validar con `npx tsc --noEmit` después de cada microtarea (ejecutar manualmente)
- No mezclar refactor estructural con rediseño visual en la misma tarea
- Si una extracción requiere tocar lógica, es señal de que la microtarea es demasiado grande
- Si hay duda sobre si algo se puede mover, no moverlo en esa tarea

---

## 7. Relación con UI-V2-DIRECTION.md y orden de tareas

### Orden recomendado

```
ARCH-01 (este doc)
  → ARCH-02 (mapa de App.tsx y App.css)
    → UI-V2-DOC-02 (definir tokens — informado por mapa)
      → ARCH-03 (extraer tipos)
        → ARCH-08 (implementar tokens.css)
          → UI-V2.1 (sistema de tokens completo)
            → UI-V2.2 (Welcome / Vault Landing)
              → UI-V2.3 (Home funcional)
                → ARCH-04–07 (descomposición para Workspace)
                  → UI-V2.4 (Workspace)
```

### Por qué UI-V2-DOC-02 va después de ARCH-02

UI-V2-DOC-02 define tokens. Para nombrarlos bien necesita:

1. Saber qué variables CSS ya existen en App.css
2. Saber cuáles son valores hardcodeados candidatos a token
3. Saber en qué secciones del CSS hay más acumulación de colores/spacing

Sin ARCH-02, hay riesgo de:
- Nombrar `--nw-surface` cuando ya existe `--bg-secondary` con el mismo rol
- Crear tokens que colisionan con clases existentes
- Implementar `tokens.css` que requiere limpiar App.css inmediatamente para funcionar

ARCH-02 es barato (solo lectura y documentación). UI-V2-DOC-02 es más valioso con ese contexto.

### Qué desbloquea este documento

| Tarea | Desbloqueada |
|---|---|
| ARCH-02 | Sí, inmediato |
| UI-V2-DOC-02 | Después de ARCH-02 |
| UI-V2.1 tokens | Después de UI-V2-DOC-02 y ARCH-08 |
| UI-V2.2 Welcome | Después de UI-V2.1 |
| UI-V2.3 Home | Después de UI-V2.2 |
| UI-V2.4 Workspace | Después de ARCH-04–07 y UI-V2.3 |
| CodeGraph | Después de UI-V2.4 |

---

## 8. Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| App.tsx crece si se agrega UI V2 sin extracción | Alta | No agregar pantallas al monolito. Usar este plan. |
| Tokens implementados sobre CSS viejo sin mapa | Alta | ARCH-02 primero siempre |
| Extracción de lógica rompe comportamiento | Alta | ARCH-03 y ARCH-04 solo mueven sin cambiar |
| Microtareas sin `tsc --noEmit` | Media | Ejecutar después de cada ARCH |
| Mover sin criterio de "qué toca lógica" | Media | Proteger lista de sección 5 |
| ARCH-04–07 en paralelo | Baja | Una microtarea a la vez. Sin paralelo. |

---

## 9. Criterios de aceptación

Este documento cumple su función si:

- Está claro qué mover y cuándo
- Está claro qué nunca mover todavía
- ARCH-02 puede ejecutarse mañana sin preguntas
- UI-V2-DOC-02 sabe que necesita esperar ARCH-02
- Cada microtarea futura puede referenciar este documento para decidir scope
- Ningún ARCH-XX requiere cambiar comportamiento
- CodeGraph sigue esperando hasta que Workspace V2 exista

---

## Relación con documentos existentes

| Documento | Rol |
|---|---|
| `UI-V2-DIRECTION.md` | Ancla de dirección visual y roadmap de pantallas |
| `UI-V2-FRONTEND-ARCHITECTURE.md` | **Este documento.** Plan de descomposición frontend. |
| `UI-V2-APPMAP.md` | Mapa detallado de regiones de App.tsx / App.css *(producido en ARCH-02)* |
| `DESIGN.md` | Referencia visual: paleta, tipografía, componentes |
| `HOME-VISION.md` | Vocabulario y anatomía de home |
