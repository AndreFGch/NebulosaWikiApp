# ADR-GRAPH-01 — Motor modular del grafo de Nebulosa Wiki

| Campo       | Valor                              |
|-------------|------------------------------------|
| **ID**      | GRAPH-ARCH-01                      |
| **Estado**  | PROPUESTA — pendiente de aprobación |
| **Fecha**   | 2026-06-25                         |
| **Autor**   | André Fonseca                      |
| **Contexto**| Post-BUNDLE-02C, pre-implementación |

---

## 1. Problema actual

### 1.1 Síntoma visible

El primer montaje del grafo no es determinista: el layout CoSE termina, la física desplaza los nodos, se llama `applyInitialGraphViewport` y el resultado varía según timing. El usuario necesita presionar **Centrar** para ver el grafo correctamente después del primer render.

### 1.2 Causa estructural

`useWikiGraphLifecycle.ts` mezcla en un único `useEffect` sin separación de responsabilidades:

- Construcción del grafo Cytoscape (`cytoscape({...})`)
- Elección de estrategia de layout (CoSE vs preset)
- Ejecución del layout (`runCoseLayout` / `layoutRun.run()`)
- Reposicionamiento de huérfanos post-CoSE (`buildRadialPositions`)
- Inicio de la simulación de física (`createGraphSimulation`)
- Gestión del viewport inicial (`applyInitialGraphViewport` / `restoreGraphViewport`)
- Watch del settle inicial con RAF (`watchInitialSettle`)
- Captura de estado previo al desmontaje (`captureGraphState`)
- Binding de eventos de interacción (`bindGraphEvents`)
- Gestión de visibilidad de ventana (`visibilitychange`, `blur`, `focus`)

El orden de estas responsabilidades es frágil: cambia el timing de CoSE → cambia cuándo la física empieza → cambia cuándo se hace fit → resultado visual diferente.

### 1.3 Parches que no resolvieron el problema

Durante BUNDLE-02C se intentaron:

- Watchers de alpha para decidir cuándo centrar
- `fit()` con padding variable
- `centerGraph` post-convergencia
- Ajustes de `gravityRange`, `idealEdgeLength`, `numIter` en CoSE

Todos estos parches operan sobre el síntoma. El problema estructural es que **Cytoscape actúa simultáneamente como modelo del grafo, motor de layout, motor de física y renderer**. No hay separación que permita razonar sobre cada capa independientemente.

### 1.4 Deuda técnica identificada

| Archivo actual | Problema |
|---|---|
| `useWikiGraphLifecycle.ts` | Hook dios: 239 líneas, 6+ responsabilidades |
| `physics/createGraphSimulation.ts` | Física acoplada a nodos Cytoscape directamente |
| `layout/runCoseLayout.ts` | Layout delegado a CoSE sin control del resultado |
| `cytoscape/restoreGraphState.ts` | Restauración de viewport mezclada con posiciones |
| `types.ts` | `WikiGraph` es modelo lógico correcto, pero no se usa como fuente de verdad para layout/física |

---

## 2. Objetivo de arquitectura

### 2.1 Principios del nuevo motor

1. **Separación estricta de capas** — datos, proyección, layout, física, renderer e interacción son capas independientes con contratos definidos.
2. **Cytoscape como adaptador, no como modelo** — Cytoscape solo renderiza lo que el motor le dice. No es la fuente de verdad de posiciones ni de estado físico.
3. **Primer montaje determinista** — el layout produce posiciones estables antes de que Cytoscape las reciba. La física parte de un estado conocido.
4. **Local-first y portable** — sin dependencias de red, sin estado de servidor. Todo el motor vive en el proceso Tauri.
5. **Preparado para Worker/Rust sin moverlo todavía** — los contratos de cada capa permiten reemplazar la implementación sin cambiar los consumidores.
6. **Una capa por vez** — la migración no rompe la UI existente en ningún paso intermedio.

### 2.2 Flujo conceptual del motor

```
Archivos Markdown
  → [domain/indexing]   Parser + índice de metadatos
  → [domain/graph]      Grafo lógico dirigido y ponderado (WikiGraphStore)
  → [projection]        Proyección visual filtrada (modo Global / Local)
  → [layout]            Posiciones iniciales estables (layout engine)
  → [physics]           Simulación incremental sobre posiciones, no sobre Cytoscape
  → [renderer]          RendererAdapter aplica posiciones a Cytoscape
  → [interaction]       Eventos de usuario devueltos como acciones al store
```

Cada flecha es un contrato TypeScript. Ninguna capa conoce la implementación de la siguiente.

---

## 3. Arquitectura propuesta

### 3.1 Árbol de carpetas

```
src/features/wiki-graph/
│
├── domain/                    # Modelo lógico puro — sin UI, sin Cytoscape
│   ├── WikiGraphStore.ts      # Estado canónico del grafo lógico
│   ├── LogicalNode.ts
│   └── LogicalEdge.ts
│
├── indexing/                  # Construcción del grafo desde MarkdownFile[]
│   └── buildWikiGraphStore.ts # Reemplaza buildWikiGraph.ts actual
│
├── projection/                # Filtrado y transformación para vista
│   ├── GraphProjection.ts     # Contrato
│   └── projectGlobalGraph.ts  # Modo global: todos los nodos
│   └── projectLocalGraph.ts   # Modo local: nota seleccionada + vecinos
│
├── layout/                    # Cálculo de posiciones — no toca Cytoscape
│   ├── LayoutPosition.ts      # Contrato: Map<nodeId, {x,y}>
│   ├── radialLayout.ts        # Layout radial para primer montaje
│   └── presetLayout.ts        # Layout preset para remontaje con posiciones guardadas
│
├── physics/                   # Simulación incremental sobre posiciones
│   ├── PhysicsState.ts        # Contrato: velocidades, alpha
│   ├── physicsEngine.ts       # Loop de simulación — recibe posiciones, devuelve posiciones
│   └── reconcilePhysicsState.ts # Reutiliza velocidades previas si hay
│
├── renderer/                  # Adaptador Cytoscape — única capa que importa cytoscape
│   ├── RendererAdapter.ts     # Contrato de la interfaz del renderer
│   ├── CytoscapeAdapter.ts    # Implementación Cytoscape del contrato
│   └── graphStyle.ts          # Estilos visuales (movido de cytoscape/)
│
├── interaction/               # Eventos de usuario → acciones del store
│   ├── GraphInteraction.ts    # Contrato: onNodeClick, onDrag, onBackground
│   └── bindCytoscapeEvents.ts # Implementación Cytoscape (movido de cytoscape/)
│
├── components/                # Componentes React — consumen hooks, no el motor directamente
│   ├── WikiGraphPanel.tsx
│   └── WikiGraphView.tsx
│
└── hooks/                     # Orquestación React — coordina capas, no las implementa
    ├── useWikiGraph.ts        # Hook principal (reemplaza useWikiGraphLifecycle)
    ├── useGraphProjection.ts  # Suscripción al modo Global/Local
    ├── useGraphLayout.ts      # Solicita layout a la capa de layout
    └── useGraphPhysics.ts     # Coordina el loop de física con RAF
```

### 3.2 Archivos que desaparecen (en migración completa)

| Archivo actual | Reemplazado por |
|---|---|
| `cytoscape/buildGraphElements.ts` | `indexing/buildWikiGraphStore.ts` + `renderer/CytoscapeAdapter.ts` |
| `cytoscape/centerGraph.ts` | `hooks/useGraphLayout.ts` (fit determinista) |
| `cytoscape/captureGraphState.ts` | `physics/PhysicsState.ts` + `layout/LayoutPosition.ts` |
| `cytoscape/restoreGraphState.ts` | `layout/presetLayout.ts` + `renderer/CytoscapeAdapter.ts` |
| `cytoscape/bindGraphEvents.ts` | `interaction/bindCytoscapeEvents.ts` |
| `hooks/useWikiGraphLifecycle.ts` | `hooks/useWikiGraph.ts` (orquestador liviano) |

---

## 4. Responsabilidad por capa

### 4.1 `domain/`

| | |
|---|---|
| **Qué hace** | Define el modelo lógico del grafo: nodos, aristas, propiedades semánticas. Es el vocabulario compartido de todo el motor. |
| **Qué NO hace** | No calcula posiciones. No conoce Cytoscape. No renderiza. No filtra por modo de vista. |
| **Deps permitidas** | Ninguna dependencia externa. Solo TypeScript puro. |
| **Deps prohibidas** | `cytoscape`, React, cualquier librería de UI o física. |

### 4.2 `indexing/`

| | |
|---|---|
| **Qué hace** | Transforma `MarkdownFile[]` (del backend Tauri) en un `WikiGraphStore`. Detecta huérfanos, enlaces rotos, backlinks, peso de aristas. |
| **Qué NO hace** | No aplica filtros de vista. No calcula posiciones. No sabe de modos Global/Local. |
| **Deps permitidas** | `domain/`. Tipos de `src/domain/markdown/`. |
| **Deps prohibidas** | `cytoscape`, React, `projection/`, `layout/`, `physics/`, `renderer/`. |

### 4.3 `projection/`

| | |
|---|---|
| **Qué hace** | Toma el `WikiGraphStore` y una configuración de vista (modo, nota seleccionada, filtros) y produce un subgrafo visual (`GraphProjection`) con los nodos y aristas que deben mostrarse. |
| **Qué NO hace** | No calcula posiciones. No toca Cytoscape. No gestiona estado de UI. |
| **Deps permitidas** | `domain/`. |
| **Deps prohibidas** | `cytoscape`, React, `layout/`, `physics/`, `renderer/`. |

### 4.4 `layout/`

| | |
|---|---|
| **Qué hace** | Recibe un `GraphProjection` y devuelve `LayoutPosition` (Map de posiciones x,y por nodeId). Hay dos estrategias: radial (primer montaje) y preset (remontaje con posiciones guardadas). |
| **Qué NO hace** | No toca Cytoscape. No conoce el DOM. No aplica física. No decide cuándo aplicar las posiciones. |
| **Deps permitidas** | `domain/`, `projection/`. Algoritmos de layout puros (d3-force conceptualmente, radial propio). |
| **Deps prohibidas** | `cytoscape`, React, `physics/`, `renderer/`. |

### 4.5 `physics/`

| | |
|---|---|
| **Qué hace** | Recibe posiciones (`LayoutPosition`) y estado previo (`PhysicsState`) y calcula posiciones actualizadas tick a tick. Gestiona alpha, velocidades y convergencia. |
| **Qué NO hace** | No toca Cytoscape directamente. No mueve nodos en el DOM. No sabe de React. |
| **Deps permitidas** | `domain/`, `layout/` (tipos de posición). |
| **Deps prohibidas** | `cytoscape`, React, `renderer/`. |

### 4.6 `renderer/`

| | |
|---|---|
| **Qué hace** | Implementa `RendererAdapter`: inicializa Cytoscape, aplica posiciones, aplica estilos, gestiona viewport (zoom/pan), expone `fit()`, `center()`, `destroy()`. Es el único lugar donde se importa `cytoscape`. |
| **Qué NO hace** | No calcula posiciones. No ejecuta física. No gestiona selección ni eventos (eso es `interaction/`). |
| **Deps permitidas** | `domain/`, `layout/` (tipos), `cytoscape`. |
| **Deps prohibidas** | React (el adaptador es vanilla JS/TS). `physics/` no se importa directamente; el adaptador solo recibe posiciones ya calculadas. |

### 4.7 `interaction/`

| | |
|---|---|
| **Qué hace** | Vincula eventos de Cytoscape (click en nodo, drag, click en fondo, zoom) a callbacks tipados. Devuelve acciones al orquestador. |
| **Qué NO hace** | No modifica el grafo lógico. No recalcula posiciones. No gestiona state de React. |
| **Deps permitidas** | `domain/`, `cytoscape` (para tipos de evento). |
| **Deps prohibidas** | React state directo. `physics/`, `layout/`, `projection/`. |

### 4.8 `hooks/`

| | |
|---|---|
| **Qué hace** | Orquesta las capas anteriores desde React: observa cambios de `WikiGraphStore`, decide cuándo proyectar, cuándo hacer layout, cuándo iniciar física, cuándo actualizar el renderer. |
| **Qué NO hace** | No implementa lógica de ninguna capa. No importa `cytoscape` directamente. |
| **Deps permitidas** | Todas las capas anteriores (solo sus contratos públicos). React hooks. |
| **Deps prohibidas** | Implementaciones internas de cada capa (ej. no importa internals de `CytoscapeAdapter`). |

### 4.9 `components/`

| | |
|---|---|
| **Qué hace** | Componentes React que renderizan el panel del grafo. Consumen hooks, no el motor directamente. |
| **Qué NO hace** | No importa `cytoscape`. No gestiona posiciones ni física. |
| **Deps permitidas** | `hooks/`. React. CSS/estilos. |
| **Deps prohibidas** | `renderer/`, `physics/`, `layout/`, `projection/`, `domain/` (solo a través de hooks). |

---

## 5. Contratos TypeScript conceptuales

> Estos contratos son la fuente de verdad de la interfaz entre capas.
> No son implementación. Se verificarán contra `types.ts` existente al inicio de GRAPH-CORE-01.

```typescript
// domain/LogicalNode.ts
export interface LogicalNode {
  id: string;
  title: string;
  relativePath: string;
  folder: string;
  tags: string[];
  type: string;           // "note" | "missing" | "orphan"
  exists: boolean;
  outgoingCount: number;
  backlinkCount: number;
}

// domain/LogicalEdge.ts
export interface LogicalEdge {
  id: string;
  source: string;         // nodeId
  target: string;         // nodeId
  label: string;
  weight: number;
  isBroken: boolean;
  isBacklink: boolean;
}

// domain/WikiGraphStore.ts
export interface WikiGraphStore {
  nodes: LogicalNode[];
  edges: LogicalEdge[];
  orphanNodes: LogicalNode[];
  brokenLinks: LogicalEdge[];
  tags: string[];
  folders: string[];
  rootId: string | null;  // nodo raíz para layout radial
}

// projection/GraphProjection.ts
export interface GraphProjection {
  nodes: LogicalNode[];
  edges: LogicalEdge[];
  rootId: string | null;
  mode: "global" | "local";
  centerId: string | null; // para modo local: nota seleccionada
}

// layout/LayoutPosition.ts
export type LayoutPositionMap = Map<string, { x: number; y: number }>;

export interface LayoutResult {
  positions: LayoutPositionMap;
  strategy: "radial" | "preset" | "cose";
}

// physics/PhysicsState.ts
export interface NodeVelocity {
  vx: number;
  vy: number;
}

export interface PhysicsState {
  velocities: Map<string, NodeVelocity>;
  alpha: number;           // 0 = reposo, 1 = máxima energía
  isSettled: boolean;
}

// renderer/RendererAdapter.ts
export interface RendererAdapter {
  /** Monta el renderer en el contenedor DOM dado. */
  mount(container: HTMLDivElement): void;
  /** Aplica nodos y aristas de la proyección. */
  applyProjection(projection: GraphProjection): void;
  /** Aplica posiciones calculadas por layout/física. */
  applyPositions(positions: LayoutPositionMap): void;
  /** Aplica viewport guardado (zoom + pan). */
  applyViewport(viewport: ViewportState): void;
  /** Fit automático al contenido visible. */
  fitToContent(padding?: number): void;
  /** Captura posiciones y viewport actuales antes de desmontar. */
  captureState(): { positions: LayoutPositionMap; viewport: ViewportState };
  /** Destruye el renderer y libera recursos. */
  destroy(): void;
}

export interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
}

// interaction/GraphInteraction.ts
export interface GraphInteractionCallbacks {
  onNodeClick: (nodeId: string) => void;
  onBackgroundClick: () => void;
  onNodeDragEnd: (nodeId: string, position: { x: number; y: number }) => void;
}
```

---

## 6. Plan por fases

### GRAPH-CORE-01 — Dominio y store

| | |
|---|---|
| **Objetivo** | Crear `domain/` con contratos `LogicalNode`, `LogicalEdge`, `WikiGraphStore`. Verificar alineación con `types.ts` actual. |
| **Archivos esperados** | `domain/LogicalNode.ts`, `domain/LogicalEdge.ts`, `domain/WikiGraphStore.ts` |
| **Qué se valida** | `tsc --noEmit` pasa. Los tipos son compatibles con `WikiGraph` existente o se documenta la diferencia. |
| **Riesgo** | `WikiGraph` actual puede tener campos no representados → resolver en esta fase antes de avanzar. |
| **Qué no toca** | `src/features/wiki-graph/types.ts` — no se borra hasta GRAPH-RENDER-01. |

### GRAPH-PROJECTION-01 — Proyección filtrada

| | |
|---|---|
| **Objetivo** | Implementar `projection/` con `projectGlobalGraph` y `projectLocalGraph`. Reemplaza la lógica de filtrado que hoy vive dispersa en `WikiGraphView.tsx` y `buildGraphElements.ts`. |
| **Archivos esperados** | `projection/GraphProjection.ts`, `projection/projectGlobalGraph.ts`, `projection/projectLocalGraph.ts` |
| **Qué se valida** | Tests unitarios puros (sin DOM, sin Cytoscape). Modo Global devuelve todos los nodos. Modo Local devuelve nota + vecinos directos. |
| **Riesgo** | Definición de "vecinos" para modo Local puede diferir del comportamiento actual → revisar `WikiGraphView.tsx` antes de implementar. |
| **Qué no toca** | `components/`, `hooks/`, `renderer/`. La UI sigue usando el código actual. |

### GRAPH-LAYOUT-01 — Layout determinista

| | |
|---|---|
| **Objetivo** | Implementar `layout/radialLayout.ts` y `layout/presetLayout.ts`. El layout radial debe producir posiciones estables sin depender de CoSE ni del DOM. |
| **Archivos esperados** | `layout/LayoutPosition.ts`, `layout/radialLayout.ts`, `layout/presetLayout.ts` |
| **Qué se valida** | Dado el mismo `WikiGraphStore`, `radialLayout` produce el mismo `LayoutPositionMap` en cualquier ejecución (determinismo). No se llama a Cytoscape en esta fase. |
| **Riesgo** | El layout radial actual (`buildRadialPositions.ts`) usa lógica de componentes Cytoscape → extraer algoritmo puro antes de mover. |
| **Qué no toca** | `layout/coseLayoutConfig.ts`, `layout/runCoseLayout.ts`, `layout/buildRadialPositions.ts` — se mantienen activos hasta GRAPH-RENDER-01. |

### GRAPH-RENDER-01 — Adaptador Cytoscape

| | |
|---|---|
| **Objetivo** | Implementar `renderer/RendererAdapter.ts` (interfaz) y `renderer/CytoscapeAdapter.ts` (implementación). Cytoscape deja de ser el modelo; solo renderiza posiciones recibidas. |
| **Archivos esperados** | `renderer/RendererAdapter.ts`, `renderer/CytoscapeAdapter.ts`, `renderer/graphStyle.ts` |
| **Qué se valida** | El adaptador monta Cytoscape, aplica una proyección de prueba con posiciones fijas y muestra el grafo sin física activa. Primer montaje estable. |
| **Riesgo** | El adaptador debe manejar el ciclo mount/destroy correctamente para no crear instancias Cytoscape huérfanas en hot-reload. |
| **Qué no toca** | `hooks/useWikiGraphLifecycle.ts` — sigue activo en paralelo hasta que el adaptador esté validado. |

### GRAPH-PHYSICS-01 — Motor de física desacoplado

| | |
|---|---|
| **Objetivo** | Implementar `physics/physicsEngine.ts` que opera sobre `LayoutPositionMap` y `PhysicsState`, sin conocer Cytoscape. El renderer recibe posiciones actualizadas por RAF externo. |
| **Archivos esperados** | `physics/PhysicsState.ts`, `physics/physicsEngine.ts`, `physics/reconcilePhysicsState.ts` |
| **Qué se valida** | Dado un `LayoutPositionMap` inicial, el motor converge (alpha → 0) en tiempo finito. Se puede pausar y resumir sin perder estado. |
| **Riesgo** | La física actual está calibrada para el grafo de Nebulosa Wiki específico → migrar parámetros y validar visualmente. |
| **Qué no toca** | `physics/createGraphSimulation.ts` — se mantiene activo hasta validación completa de GRAPH-PHYSICS-01. |

### GRAPH-INCREMENTAL-01 — Orquestador y migración final

| | |
|---|---|
| **Objetivo** | Reemplazar `useWikiGraphLifecycle.ts` con los hooks modulares (`useWikiGraph`, `useGraphProjection`, `useGraphLayout`, `useGraphPhysics`). Eliminar archivos legacy de `cytoscape/`. |
| **Archivos esperados** | `hooks/useWikiGraph.ts`, `hooks/useGraphProjection.ts`, `hooks/useGraphLayout.ts`, `hooks/useGraphPhysics.ts` |
| **Qué se valida** | Todos los criterios de aceptación del §8. Eliminación de `useWikiGraphLifecycle.ts` sin regresión. |
| **Riesgo** | Fase más arriesgada: integra todas las capas anteriores. Requiere que GRAPH-CORE-01 a GRAPH-PHYSICS-01 estén completamente validadas. |
| **Qué no toca** | `components/WikiGraphPanel.tsx`, `components/WikiGraphView.tsx` — la interfaz pública de los componentes no cambia. |

---

## 7. Estrategia de migración

### 7.1 Principio general

**Las capas nuevas y las capas antiguas coexisten hasta que la nueva es validada.** No se borra código antiguo hasta que el nuevo está funcionando y `tsc` pasa.

### 7.2 Tabla de convivencia por fase

| Fase | Código nuevo activo | Código antiguo activo | Cuándo se elimina el antiguo |
|---|---|---|---|
| GRAPH-CORE-01 | `domain/` | `types.ts` | Al inicio de GRAPH-RENDER-01 |
| GRAPH-PROJECTION-01 | `projection/` | Lógica en `WikiGraphView.tsx` | Al inicio de GRAPH-INCREMENTAL-01 |
| GRAPH-LAYOUT-01 | `layout/radialLayout`, `layout/presetLayout` | `layout/buildRadialPositions.ts`, `layout/coseLayoutConfig.ts`, `layout/runCoseLayout.ts` | Al inicio de GRAPH-RENDER-01 |
| GRAPH-RENDER-01 | `renderer/CytoscapeAdapter` | `cytoscape/*` (todos los archivos) | Al inicio de GRAPH-INCREMENTAL-01 |
| GRAPH-PHYSICS-01 | `physics/physicsEngine` | `physics/createGraphSimulation.ts` | Al inicio de GRAPH-INCREMENTAL-01 |
| GRAPH-INCREMENTAL-01 | `hooks/useWikiGraph.*` | `hooks/useWikiGraphLifecycle.ts` | Al cierre de GRAPH-INCREMENTAL-01 |

### 7.3 Invariantes de UI durante toda la migración

Cada fase debe preservar sin excepción:

| Invariante | Dónde se verifica |
|---|---|
| La UI actual del grafo sigue funcionando | Render visual en la app |
| Modo Global muestra todos los nodos | Selector de modo en `WikiGraphPanel` |
| Modo Local muestra nota seleccionada + vecinos | Seleccionar una nota y cambiar a Local |
| Selección de nodo abre la nota correspondiente | Click en nodo |
| Filtros activos se mantienen al cambiar de modo | Panel de filtros |
| Botón **Centrar** funciona en todo momento | Click en el botón |
| Bundle lazy de WikiGraph/Cytoscape se mantiene | Network tab en devtools |
| Cambio de wiki root reconstruye el grafo | Cambiar ruta en Ajustes |

### 7.4 Estrategia para el primer montaje estable

El problema central (primer montaje no determinista) se resuelve en GRAPH-LAYOUT-01 + GRAPH-RENDER-01:

1. `radialLayout` calcula posiciones finales **antes** de inicializar Cytoscape.
2. `CytoscapeAdapter.applyProjection` recibe las posiciones ya calculadas → Cytoscape las aplica con `layout: preset`.
3. `CytoscapeAdapter.fitToContent` se llama **una sola vez**, sincrónicamente, después de aplicar posiciones.
4. La física empieza con alpha bajo (ambient) porque las posiciones ya son estables.
5. No hay RAF de vigilancia del settle. No hay segundo fit.

---

## 8. Criterios de aceptación

El rediseño se considera **completo** cuando se cumplen todos estos criterios verificables:

### 8.1 Compilación

- [ ] `tsc --noEmit` pasa sin errores ni warnings.
- [ ] No hay imports de `cytoscape` fuera de `renderer/` e `interaction/`.

### 8.2 Primer montaje

- [ ] El grafo abre y es visualmente legible sin presionar **Centrar**.
- [ ] El mismo grafo producido del mismo directorio tiene el mismo layout visual en cualquier montaje.
- [ ] No hay RAF de vigilancia de settle en el código (`watchInitialSettle` o equivalente eliminado).

### 8.3 Funcionalidad preservada

- [ ] Modo Global muestra todos los nodos y aristas.
- [ ] Modo Local muestra la nota seleccionada y sus vecinos directos.
- [ ] Click en nodo abre la nota correspondiente en el editor.
- [ ] Selección de nodo se mantiene al cambiar entre modos.
- [ ] Filtros activos se aplican correctamente al cambiar de modo.
- [ ] Botón **Centrar** funciona en cualquier estado del grafo.
- [ ] Cambiar la wiki root en Ajustes destruye el grafo actual y construye uno nuevo con los datos nuevos.

### 8.4 Rendimiento y estabilidad

- [ ] El grafo no se reconstruye al seleccionar una nota (solo actualiza la selección visual).
- [ ] No hay instancias Cytoscape huérfanas en hot-reload (verificar con `cy.destroy()` correcto).
- [ ] La física se pausa cuando la ventana no tiene foco y se reanuda al recuperarlo.
- [ ] El bundle lazy de Cytoscape se mantiene: Cytoscape no aparece en el chunk principal.

### 8.5 Código

- [ ] `useWikiGraphLifecycle.ts` ha sido eliminado.
- [ ] No hay `alpha` como parámetro de `fitToContent` ni de `centerGraph`.
- [ ] No hay watchers experimentales de CoSE, gravityRange, numIter en código productivo.
- [ ] Ningún archivo de `cytoscape/` (carpeta original) existe en el árbol final.

---

## Notas de implementación

- **CoSE en GRAPH-LAYOUT-01**: El layout radial reemplaza CoSE para el primer montaje. Si en el futuro se necesita un layout más sofisticado para grafos grandes, se puede agregar como estrategia adicional en `layout/` sin cambiar las otras capas.

- **Worker/Rust en el futuro**: Cuando se quiera mover layout o física a un Worker o a Rust, solo se reemplaza la implementación de `layout/radialLayout.ts` o `physics/physicsEngine.ts`. El contrato (`LayoutPositionMap`, `PhysicsState`) no cambia. Los hooks en `hooks/` no necesitan modificarse.

- **Divergencia de `types.ts`**: Al iniciar GRAPH-CORE-01, comparar `WikiGraphStore` propuesto con `WikiGraph` en `types.ts`. Si hay campos adicionales en `WikiGraph` que no están en los contratos propuestos aquí, agregarlos al dominio antes de avanzar.

- **Test de regresión visual**: Antes de GRAPH-INCREMENTAL-01, tomar screenshot del grafo con el código actual como referencia. Comparar visualmente después de cada paso de la fase final.
