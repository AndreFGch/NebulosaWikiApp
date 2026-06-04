# ADR-0001 — Nebulosa CodeGraph integrado en NebulosaWikiApp v2

## Estado

Propuesto.

## Contexto

NebulosaWikiApp ya existe como una aplicación local-first para wiki Markdown, Knowledge Graph y memoria visual. La versión `v0.1.1` ya fue publicada y validada como ZIP portable.

La siguiente visión no es crear otra aplicación separada. La decisión propuesta es evolucionar NebulosaWikiApp hacia una versión 2 donde la app integre un nuevo módulo llamado **Nebulosa CodeGraph / Project Graph** dentro del mismo ecosistema visual y operativo.

La idea principal es que NebulosaWikiApp deje de ser solo una wiki visual y pase a ser una plataforma local-first donde convivan:

- WikiGraph / Knowledge Graph.
- CodeGraph / Project Graph.
- Context Exporter para Claude/agentes.
- Project Memory.
- Sesiones, ADRs, documentación y rutas de lectura.

El objetivo es que tanto el humano como Claude/agentes puedan entender proyectos grandes sin leer todo el repositorio.

## Decisión

Nebulosa CodeGraph será una integración futura dentro de NebulosaWikiApp v2, no una app separada.

La aplicación deberá permitir que el usuario visualice y conecte dos mundos:

1. **WikiGraph**
   - Notas Markdown.
   - Wikilinks.
   - Tags.
   - Backlinks.
   - ADRs.
   - Sesiones.
   - Roadmaps.
   - Documentación.

2. **CodeGraph**
   - Proyectos de código.
   - Carpetas.
   - Archivos.
   - Clases.
   - Interfaces.
   - Métodos.
   - Funciones.
   - Stored Procedures.
   - Tablas SQL.
   - Imports/usings.
   - Dependencias.
   - Relaciones entre módulos.
   - Rutas de ejecución.
   - Puntos de entrada.

3. **Relaciones cruzadas**
   - Una nota Markdown puede documentar una clase.
   - Un ADR puede justificar cambios en archivos.
   - Una sesión puede explicar decisiones tomadas en un módulo.
   - Un Stored Procedure puede relacionarse con reglas de negocio.
   - Un proyecto puede tener su grafo propio y conectarse con la wiki.

## Principio central

NebulosaWikiApp v2 debe ser útil para humano + IA:

- El usuario ve y explora visualmente WikiGraph y CodeGraph.
- Claude/agentes leen Markdown, índices y exportaciones estructuradas.
- La app ayuda a decidir qué leer primero.
- La app reduce tokens y lectura innecesaria.
- La app mantiene el conocimiento como archivos locales y auditables.

## Inspiración externa

La idea toma señales de herramientas y patrones existentes, pero no los copia literalmente.

### Graphify

Graphify se presenta como una skill open source para asistentes de código que convierte proyectos completos en un knowledge graph consultable. La idea relevante para Nebulosa no es copiar su implementación, sino aprender del enfoque:

- Generar grafo desde código, documentación y otros artefactos.
- Permitir consultar el grafo en vez de hacer grep sobre todo.
- Exportar artefactos legibles por humanos y agentes.
- Usar el grafo para reducir tokens y mejorar contexto.

Nebulosa debe diferenciarse en que no será solo una skill para asistentes, sino una experiencia integrada visual + Markdown + contexto persistente.

### LLM Wiki / Markdown Knowledge Base

El patrón LLM Wiki refuerza que el valor no está únicamente en un grafo visual, sino en mantener una base Markdown estructurada que el agente pueda leer y actualizar con instrucciones claras.

Para Nebulosa esto confirma una decisión importante:

- El grafo visual es para el usuario.
- Los Markdown, índices y exportaciones son para Claude/agentes.
- Ambos deben representar la misma verdad desde perspectivas distintas.

### Refero Styles / diseño asistido por IA

Refero Styles sirve como referencia para construir un `DESIGN.md` legible por IA y mejorar el criterio visual de la interfaz.

Para NebulosaWikiApp v2, antes de rediseñar componentes, conviene documentar un lenguaje visual propio:

- Layout de consola/cockpit.
- Paneles tipo workspace.
- Tarjetas de nodos.
- Badges por tipo.
- Vista dividida WikiGraph + CodeGraph.
- Estados visuales claros.
- Densidad alta pero legible.
- Estética open source premium.

## Alcance funcional v2

### Vista principal

NebulosaWikiApp v2 debería permitir cambiar entre modos:

- Wiki.
- CodeGraph.
- Dual Graph.
- Context Export.
- Project Memory.

### Dual Graph

La vista Dual Graph debe permitir ver:

- WikiGraph a la izquierda.
- CodeGraph a la derecha.
- Relaciones cruzadas entre ambos.
- Nodo seleccionado con panel de detalle.
- Exportación del contexto del subgrafo.

Ejemplo:

```txt
WikiGraph: nota "Pago BCR"
CodeGraph: PagoBCRService.cs, PagoBCRViewModel.cs, paP_GuardaAutorizacionesICG.sql
Relaciones: documents, references, calls, reads, writes
```

### Context Exporter

El usuario debe poder seleccionar un nodo o subgrafo y exportar contexto para Claude/agentes.

Formatos posibles:

- Markdown.
- JSON.
- Paquete de lectura.
- Ruta de lectura sugerida.
- Resumen ejecutivo del módulo.

Ejemplo de salida:

```txt
.nebulosa/context/PROJECT_CONTEXT.md
.nebulosa/context/CODEGRAPH_INDEX.md
.nebulosa/context/WIKIGRAPH_INDEX.md
.nebulosa/context/READING_PATH-pago-bcr.md
```

## Integración con Claude/agentes

El objetivo no es depender de que Claude vea el grafo visual. Claude debe poder leer archivos generados por Nebulosa.

NebulosaWikiApp debe poder generar instrucciones y archivos que se integren con:

- `CLAUDE.md` global.
- `CLAUDE.md` del proyecto.
- `CLAUDE.local.md`.
- Índices Markdown.
- Archivos `.nebulosa/context/*.md`.
- Futuro MCP si se justifica.

### Estado actual del usuario

El `CLAUDE.md` global del usuario ya está bien encaminado porque:

- Define idioma y estilo.
- Apunta a `D:\NebulosaWiki`.
- Usa un índice principal.
- Explica cuándo consultar la wiki.
- Tiene reglas para editar Markdown.
- Incluye una sección de CodeGraph MCP.

Esto significa que ya existe la base conceptual para que Claude lea una wiki Markdown y use contexto persistente.

### Lo que falta

NebulosaWikiApp todavía no genera automáticamente un paquete formal de contexto para Claude.

Faltan capacidades como:

- Exportar índice de proyecto.
- Exportar índice de CodeGraph.
- Exportar relaciones WikiGraph + CodeGraph.
- Exportar ruta de lectura.
- Generar snippet para pegar en `CLAUDE.md`.
- Generar `CLAUDE.local.md` sugerido para un repo.
- Generar documentación tipo `PROJECT_CONTEXT.md`.

## Formato propuesto para contexto de Claude

Nebulosa podría generar un bloque como este para `CLAUDE.md` del proyecto:

```md
## Nebulosa Context

Este proyecto usa NebulosaWikiApp como fuente local-first de contexto.

Antes de responder preguntas de arquitectura, reglas de negocio, decisiones técnicas o flujos complejos, revisar:

@.nebulosa/context/PROJECT_CONTEXT.md
@.nebulosa/context/CODEGRAPH_INDEX.md
@.nebulosa/context/WIKIGRAPH_INDEX.md

Para entender una funcionalidad específica, buscar primero rutas de lectura en:

@.nebulosa/context/reading-paths/
```

## Tipos de nodos iniciales

### WikiGraph

- `MarkdownNote`
- `Tag`
- `ADR`
- `Session`
- `Roadmap`
- `Decision`
- `Source`

### CodeGraph

- `Project`
- `Folder`
- `File`
- `Namespace`
- `Class`
- `Interface`
- `Method`
- `Property`
- `Component`
- `Route`
- `StoredProcedure`
- `Table`
- `Config`

## Tipos de relaciones iniciales

- `contains`
- `imports`
- `uses`
- `calls`
- `reads`
- `writes`
- `depends_on`
- `implements`
- `extends`
- `documents`
- `references`
- `generated_from`
- `related_to`
- `explains`
- `decided_by`

## Fases propuestas

### Fase 1 — Diseño visual v2

Objetivo: mejorar la interfaz antes de agregar complejidad.

Alcance:

- Crear `docs/design/DESIGN.md`.
- Definir lenguaje visual.
- Definir layout de workspace.
- Definir vista Dual Graph.
- Definir panel de detalle.
- Definir estados visuales por tipo de nodo.
- Inspirarse en sistemas visuales modernos sin copiar marcas.

No implementar todavía.

### Fase 2 — ADR CodeGraph

Objetivo: formalizar arquitectura y alcance.

Alcance:

- Confirmar que CodeGraph vive dentro de NebulosaWikiApp v2.
- Definir qué se analiza primero.
- Definir límites.
- Definir riesgos.
- Definir salida Markdown/JSON.
- Definir relación con Claude/agentes.

### Fase 3 — Prototipo Project Graph solo lectura

Objetivo: leer una carpeta de proyecto y mostrar estructura.

Alcance:

- Project.
- Folder.
- File.
- Extensiones.
- Ignorar carpetas pesadas.
- Grafo global.
- Panel de detalle básico.

No analizar símbolos todavía.

### Fase 4 — Símbolos de código

Objetivo: detectar estructura interna.

Alcance inicial:

- C# / TypeScript / SQL.
- Clases.
- Métodos.
- Imports.
- Stored Procedures.
- Tablas leídas/escritas.

### Fase 5 — Integración WikiGraph + CodeGraph

Objetivo: conectar notas y código.

Alcance:

- Relacionar notas con archivos.
- Relacionar ADRs con clases/módulos.
- Relacionar sesiones con cambios.
- Relacionar SPs con reglas de negocio documentadas.

### Fase 6 — Context Exporter

Objetivo: generar contexto para Claude/agentes.

Alcance:

- Exportar subgrafo.
- Exportar ruta de lectura.
- Exportar resumen Markdown.
- Exportar JSON.
- Generar snippet para `CLAUDE.md`.

## Fuera de alcance por ahora

- No crear una app separada.
- No instalar Graphify dentro del proyecto.
- No copiar Graphify.
- No crear MCP todavía.
- No analizar todo el código con IA todavía.
- No usar embeddings todavía.
- No crear base vectorial todavía.
- No editar código desde el grafo todavía.
- No hacer refactor grande de `App.tsx` todavía.
- No romper v0.1.1.
- No tocar release.

## Riesgos

### Riesgo: mezclar demasiadas ideas en una sola versión

Mitigación:

- Separar en ADR, DESIGN y prototipos.
- Implementar por fases pequeñas.
- Mantener CI verde.

### Riesgo: grafo visual bonito pero poco útil para Claude

Mitigación:

- Exportar Markdown e índices estructurados.
- Diseñar primero para humano + IA.
- No depender solo de canvas/visualización.

### Riesgo: performance en repos grandes

Mitigación:

- Empezar con Project Graph solo lectura.
- Ignorar carpetas pesadas.
- Cachear índices.
- Agregar análisis incremental después.

### Riesgo: generar demasiado contexto

Mitigación:

- Exportar subgrafos locales.
- Generar rutas de lectura.
- Priorizar archivos relevantes.
- Evitar exportar todo el repo.

## Consecuencia

NebulosaWikiApp v2 se posiciona como una herramienta local-first para conocimiento + código.

La app no compite solamente con una wiki Markdown ni con una skill de grafo. Su valor diferencial es integrar:

- Visualización humana.
- Markdown persistente.
- Knowledge Graph.
- CodeGraph.
- Contexto para Claude/agentes.
- Memoria de proyecto.
- Arquitectura open source entendible.

## Próxima microtarea sugerida

Crear un documento de diseño visual antes de tocar UI:

```txt
DESIGN-01 — Crear docs/design/DESIGN.md para NebulosaWikiApp v2
```

Luego:

```txt
ROADMAP-02 — Crear ADR formal de CodeGraph integrado
```

Este ADR puede servir como base inicial para esa microtarea.
