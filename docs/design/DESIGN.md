# DESIGN — NebulosaWikiApp v2

## Estado

Propuesto.

## Propósito

Este documento define el lenguaje visual y de experiencia para NebulosaWikiApp v2 antes de modificar código, CSS o estructura de componentes.

La meta es llevar NebulosaWikiApp de una wiki funcional con grafo a una experiencia visual más profesional, memorable y open source premium, preparada para integrar WikiGraph + CodeGraph dentro del mismo ecosistema.

Este documento no implementa UI. Sirve como guía para futuras microtareas de diseño e implementación.

## Inspiración visual

NebulosaWikiApp v2 debe tomar inspiración de sistemas modernos de diseño como Refero / Refero Styles, especialmente en la forma de documentar referencias visuales para agentes de IA mediante archivos tipo `DESIGN.md`.

No se debe copiar una marca, interfaz o producto existente. La intención es adoptar principios de diseño:

- Referencias visuales concretas antes de generar UI.
- Paleta definida.
- Tipografía clara.
- Ritmo visual consistente.
- Componentes reutilizables.
- Espaciado controlado.
- Experiencia premium sin perder densidad técnica.

## Identidad visual

NebulosaWikiApp v2 debe sentirse como:

- Un cockpit de conocimiento.
- Un mapa visual de memoria y código.
- Una herramienta local-first seria.
- Una app técnica pero elegante.
- Un producto open source con acabado profesional.
- Un puente visual entre humano, Markdown y agentes de IA.

Palabras clave:

```txt
local-first
portable
graph-native
knowledge cockpit
technical premium
dark interface
calm density
visual intelligence
human + AI
```

## Principios UX

### 1. Humano + IA

La interfaz debe servir para dos audiencias:

- El usuario humano, que necesita explorar visualmente grafos, nodos, relaciones y documentación.
- Claude/agentes, que necesitan leer Markdown, índices, rutas de lectura y exportaciones estructuradas.

La UI no debe depender de que Claude entienda el canvas visual. Claude debe consumir salidas Markdown/JSON generadas por la app.

### 2. Primero claridad, luego estética

La app debe verse profesional, pero nunca sacrificar comprensión.

Cada pantalla debe responder:

- ¿Dónde estoy?
- ¿Qué nodo está seleccionado?
- ¿Qué relaciones tiene?
- ¿Qué puedo leer?
- ¿Qué puedo exportar?
- ¿Qué cambió?
- ¿Qué está conectado con qué?

### 3. Densidad controlada

NebulosaWikiApp puede ser técnica y densa, pero debe evitar sentirse saturada.

Usar:

- Paneles bien separados.
- Jerarquía visual clara.
- Badges pequeños.
- Tooltips.
- Estados visuales.
- Colores funcionales por tipo de nodo.
- Espaciado consistente.

### 4. Local-first visible

El usuario debe percibir que controla sus archivos.

La UI debe comunicar:

- Carpeta activa.
- Estado de wiki.
- Estado de proyecto.
- Archivos cargados.
- Índices generados.
- Exportaciones locales.
- Sin nube obligatoria.

### 5. Cambios seguros

La app debe reforzar confianza:

- Indicador de cambios sin guardar.
- Confirmación antes de acciones destructivas.
- Diff antes de escritura futura.
- Backups antes de sobrescribir.
- Estados claros de solo lectura vs editable.

## Layout general v2

La interfaz v2 debe organizarse como workspace.

Estructura base:

```txt
┌─────────────────────────────────────────────────────────────┐
│ Top Bar                                                     │
│ Proyecto / Wiki / Estado / Acciones rápidas                 │
├───────────────┬───────────────────────────────┬─────────────┤
│ Sidebar       │ Canvas / Editor / Dual Graph  │ Inspector   │
│ Navegación    │ Área principal                │ Detalle     │
│ Búsqueda      │                               │ Contexto    │
└───────────────┴───────────────────────────────┴─────────────┘
```

### Top Bar

Debe mostrar:

- Nombre de la app.
- Wiki activa.
- Proyecto activo si existe.
- Estado del índice.
- Botón de búsqueda rápida.
- Acciones principales:
  - Recargar wiki.
  - Exportar contexto.
  - Cambiar modo.
  - Ajustes.

### Sidebar

Debe contener navegación de alto nivel:

- Wiki.
- Graph.
- CodeGraph.
- Dual Graph.
- Sessions.
- ADRs.
- Context Export.
- Settings.

También puede mostrar:

- Árbol de notas.
- Árbol de proyecto.
- Filtros.
- Tags.
- Tipos de nodos.

### Área principal

Debe soportar varios modos:

- Editor Markdown.
- Preview Markdown.
- WikiGraph.
- CodeGraph.
- Dual Graph.
- Búsqueda global.
- Context Exporter.
- Dashboard de proyecto.

### Inspector derecho

Debe mostrar detalle contextual del nodo seleccionado.

Para una nota:

- Título.
- Ruta.
- Tags.
- Backlinks.
- Wikilinks.
- Sesiones relacionadas.
- ADRs relacionados.
- Acciones.

Para un nodo de código:

- Tipo.
- Archivo.
- Namespace/módulo.
- Firma.
- Dependencias entrantes.
- Dependencias salientes.
- Relaciones con notas.
- Ruta de lectura sugerida.
- Exportar contexto.

## Modos principales

### Modo Wiki

Enfocado en Markdown.

Debe permitir:

- Leer nota.
- Editar nota.
- Ver backlinks.
- Ver tags.
- Ver relaciones.
- Buscar contenido.
- Abrir grafo local de la nota.

### Modo WikiGraph

Enfocado en relaciones de conocimiento.

Debe mostrar:

- Nodos Markdown.
- Tags.
- ADRs.
- Sesiones.
- Roadmaps.
- Fuentes.
- Relaciones entre notas.

### Modo CodeGraph

Enfocado en estructura de proyecto.

Debe mostrar:

- Carpetas.
- Archivos.
- Clases.
- Interfaces.
- Métodos.
- Stored Procedures.
- Tablas SQL.
- Dependencias.
- Imports/usings.
- Relaciones de lectura/escritura.

### Modo Dual Graph

Vista clave para NebulosaWikiApp v2.

Debe permitir ver dos grafos a la vez:

```txt
┌───────────────────────────┬───────────────────────────┐
│ WikiGraph                 │ CodeGraph                 │
│ Notas / ADRs / sesiones   │ Código / SPs / tablas     │
└───────────────────────────┴───────────────────────────┘
```

Objetivo:

- Ver conocimiento y código lado a lado.
- Detectar qué nota documenta qué archivo.
- Detectar qué ADR justifica qué módulo.
- Ver qué sesión explica un cambio.
- Exportar contexto cruzado.

### Modo Context Exporter

Debe permitir crear paquetes de contexto para Claude/agentes.

Salidas futuras:

```txt
.nebulosa/context/PROJECT_CONTEXT.md
.nebulosa/context/WIKIGRAPH_INDEX.md
.nebulosa/context/CODEGRAPH_INDEX.md
.nebulosa/context/READING_PATH-*.md
.nebulosa/context/context-pack.json
```

## Lenguaje visual

### Tema base

El tema principal debe ser oscuro, técnico y elegante.

Sensación esperada:

- Fondo profundo.
- Paneles con contraste bajo/medio.
- Bordes sutiles.
- Glow controlado solo para foco.
- Acentos tipo neón sobrios, no exagerados.
- Texto claro y legible.

### Paleta sugerida

```txt
Background primary:   #070A12
Background surface:   #0D1220
Surface elevated:     #111827
Surface soft:         #172033
Border subtle:        #263247
Text primary:         #F4F7FB
Text secondary:       #AAB6C8
Text muted:           #6F7D91
Accent cyan:          #4DE1FF
Accent violet:        #8B5CF6
Accent emerald:       #35D399
Accent amber:         #FBBF24
Accent rose:          #FB7185
Danger:               #EF4444
```

### Uso de color

El color no debe ser decorativo solamente.

Debe comunicar tipo de nodo, estado o acción.

Ejemplo:

```txt
MarkdownNote      cyan
ADR               violet
Session           amber
Project           emerald
Folder            slate
File              blue
Class             violet
Method            cyan
StoredProcedure   rose
Table             amber
Config            gray
```

## Tipografía

### Estilo

Usar una combinación sobria:

- Sans para UI.
- Mono para rutas, código, firmas y metadatos.

Sugerencia conceptual:

```txt
UI: Inter / system-ui / Segoe UI
Code: JetBrains Mono / Consolas / monospace
```

### Jerarquía

```txt
Title large: 24-28px
Section title: 18-20px
Panel title: 14-16px
Body: 13-15px
Metadata: 12-13px
Badge: 11-12px
Code: 12-14px
```

## Componentes base

### Cards

Usar cards para:

- Notas recientes.
- Nodos importantes.
- Resultados de búsqueda.
- Exportaciones.
- Estado del proyecto.
- Warnings.

Las cards deben tener:

- Fondo elevado.
- Borde sutil.
- Título claro.
- Metadata compacta.
- Acción primaria opcional.
- Hover suave.

### Badges

Usar badges para:

- Tipo de nodo.
- Estado.
- Fuente.
- Modo.
- Profundidad.
- Riesgo.

Ejemplos:

```txt
MarkdownNote
ADR
Session
Class
SP
Table
Local depth-1
Indexed
Stale
Draft
Read-only
```

### Inspector panels

El inspector debe parecer una consola de detalle, no una lista genérica.

Debe incluir:

- Header del nodo.
- Tipo.
- Ruta.
- Relaciones.
- Acciones.
- Preview.
- Exportar contexto.

### Graph nodes

Los nodos deben diferenciarse por:

- Color.
- Icono.
- Forma.
- Tamaño relativo.
- Borde.
- Estado seleccionado.
- Estado relacionado.
- Estado atenuado.

No deben verse como círculos genéricos de canvas.

### Graph edges

Las relaciones deben diferenciarse por:

- Tipo de línea.
- Grosor.
- Color sutil.
- Dirección si aplica.
- Tooltip o label bajo demanda.

Ejemplo:

```txt
contains       línea sólida
references     línea punteada
documents      línea cyan
calls          línea violeta
reads/writes   línea amber/rose
```

## Estados visuales

La UI debe tener estados claros:

```txt
Empty
Loading
Indexed
Index stale
Error
Read-only
Unsaved changes
Export ready
No results
Graph too large
Local graph active
```

Cada estado debe tener:

- Mensaje corto.
- Acción sugerida.
- Detalle técnico opcional.

## Búsqueda

La búsqueda debe sentirse como centro de comando.

Tipos:

- Quick search.
- Búsqueda global.
- Búsqueda por tipo.
- Búsqueda en WikiGraph.
- Búsqueda en CodeGraph.
- Búsqueda cruzada.

Resultado ideal:

```txt
[Tipo] Título
Ruta / módulo
Fragmento relevante
Relaciones principales
Acción: abrir / grafo local / exportar contexto
```

## Context Export UX

El exportador de contexto debe ser una feature premium de Nebulosa.

Flujo esperado:

1. Usuario selecciona nodo o subgrafo.
2. App muestra contexto detectado.
3. Usuario elige profundidad.
4. App muestra estimación de archivos/nodos incluidos.
5. Usuario exporta Markdown/JSON.
6. App genera ruta local.
7. App ofrece snippet para `CLAUDE.md`.

## Visual direction por pantalla

### Home / Dashboard

Debe mostrar:

- Wiki activa.
- Proyecto activo.
- Estado de índices.
- Accesos rápidos.
- Últimas notas.
- Últimas sesiones.
- Acciones sugeridas.

### WikiGraph

Debe sentirse como mapa de conocimiento.

- Fondo oscuro.
- Nodos diferenciados.
- Cluster visual.
- Filtros laterales.
- Inspector contextual.

### CodeGraph

Debe sentirse como mapa técnico.

- Diferenciar carpetas, archivos y símbolos.
- Mostrar hotspots.
- Permitir profundidad local.
- Mostrar relaciones de dependencia.

### Dual Graph

Debe ser la pantalla estrella.

Objetivo visual:

```txt
Knowledge on the left.
Code on the right.
Context bridge in the middle.
Inspector on demand.
```

Debe transmitir inmediatamente que Nebulosa conecta conocimiento y código.

## Reglas para futuras implementaciones

Antes de tocar UI:

- Mantener CI verde.
- Hacer cambios pequeños.
- No reescribir `App.tsx` completo.
- No agregar dependencias visuales sin justificación.
- No copiar componentes externos.
- No romper el release portable.
- Separar documentación, diseño e implementación.
- Probar manualmente la navegación y el grafo.

## No hacer todavía

- No implementar CodeGraph.
- No rediseñar toda la app en una sola tarea.
- No cambiar stack visual.
- No agregar librerías UI pesadas.
- No mover `buildWikiGraph` a Rust todavía.
- No tocar release.
- No crear edición de código desde grafo.
- No crear MCP.
- No crear embeddings.
- No crear base vectorial.

## Próximas microtareas sugeridas

### UI-01 — Pulir layout base v2 sin cambiar arquitectura

Objetivo:

- Mejorar top bar.
- Mejorar sidebar.
- Mejorar paneles.
- Dar más sensación de producto premium.

### GRAPH-UI-01 — Mejorar estética de nodos del WikiGraph

Objetivo:

- Evitar apariencia de círculos simples.
- Agregar nodos por tipo.
- Mejorar selección.
- Mejorar vecinos.
- Agregar badges/tooltips.

### EXPORT-ADR-01 — Diseñar Context Exporter

Objetivo:

- Documentar formato Markdown/JSON.
- Diseñar cómo se exportaría contexto para Claude.

### CODEGRAPH-DESIGN-01 — Diseñar Project Graph solo lectura

Objetivo:

- Definir cómo representar carpetas, archivos y tipos iniciales.

## Criterio de éxito

NebulosaWikiApp v2 debe sentirse como una herramienta que un desarrollador abriría para entender su conocimiento y su código de forma visual.

Debe ser:

- Bonita.
- Técnica.
- Clara.
- Local-first.
- Útil para humanos.
- Útil para Claude/agentes.
- Fácil de explicar como proyecto open source.
- Diferente a una wiki Markdown genérica.
