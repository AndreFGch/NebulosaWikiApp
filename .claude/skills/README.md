# .claude/skills

Skills internas para Claude Code en el proyecto Nebulosa Wiki.

## Propósito

Encapsulan comportamientos reutilizables. Cada skill tiene alcance específico y declarado.

---

## Skills activas

| Skill | Invocar | Cuándo usar |
|---|---|---|
| `nebula-scout` | `/nebula-scout` | Antes de cualquier tarea: revisar estado real del repo, archivos tocados, riesgo |
| `graph-first-architect` | `/graph-first-architect` | Antes de proponer cambios visuales o de layout al grafo: verificar que no violen la arquitectura central |

### nebula-scout

Revisa CLAUDE.md, git status, estructura de `src/` y `src-tauri/`, lee App.tsx y App.css, identifica riesgos. Produce una recomendación: CONTINUAR, PEDIR CONTEXTO, REVERTIR o IMPLEMENTAR.

**Usar siempre** al inicio de una sesión de trabajo nueva o cuando el contexto no está claro.

### graph-first-architect

Árbitro de decisiones de diseño del grafo. Aplica los principios inamovibles: grafo como vista principal, Markdown como panel de detalle, modelo de datos antes que UI, identidad Nebulosa sobre copia de Obsidian.

**Usar antes de** proponer cambios de layout, reorganización de paneles, rediseño visual del grafo, o cuando hay tensión entre lo que se quiere visualmente y lo que la arquitectura permite.

---

## Skills planeadas (no implementadas)

| Skill | Propósito |
|---|---|
| `ingest-note` | Incorporar nota nueva a la wiki con formato correcto |
| `query-wiki` | Consultar notas por contenido, tags o wikilinks |
| `lint-wiki` | Verificar consistencia de wikilinks, frontmatter y formato |
| `rebuild-graph` | Regenerar grafo de conexiones entre notas |
| `maintain-index` | Actualizar índice local de la wiki |

---

## Reglas para toda skill

- Respetar todas las reglas de [`CLAUDE.md`](../../CLAUDE.md).
- Proteger `D:\NebulosaWiki` — nunca borrar ni mover sin confirmación explícita.
- Declarar al inicio qué archivos o rutas tocará.
- Reportar al finalizar: archivos tocados, qué cambió, riesgos.
- No operar sobre rutas fuera de `D:\NebulosaWiki` sin permiso explícito.
