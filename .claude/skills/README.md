# .claude/skills

Esta carpeta contiene skills internas para Claude Code en el proyecto Nebulosa Wiki.

## Propósito

Las skills encapsulan comportamientos reutilizables que Claude Code puede invocar para operar sobre la wiki o el repositorio. Cada skill tiene un alcance específico y declarado.

## Skills planeadas

| Skill | Propósito |
|---|---|
| `ingest-note` | Incorporar una nota nueva a la wiki con formato correcto |
| `query-wiki` | Consultar notas por contenido, tags o wikilinks |
| `lint-wiki` | Verificar consistencia de wikilinks, frontmatter y formato |
| `rebuild-graph` | Regenerar el grafo de conexiones entre notas |
| `maintain-index` | Actualizar el índice local de la wiki |

Todavía no hay skills implementadas.

## Reglas para toda skill

- Respetar todas las reglas definidas en [`CLAUDE.md`](../../CLAUDE.md).
- Proteger `D:\NebulosaWiki` — nunca borrar ni mover sin confirmación explícita.
- Declarar al inicio qué archivos o rutas tocará.
- Reportar resultado al finalizar: archivos tocados, qué cambió, riesgos.
- No operar sobre rutas fuera de `D:\NebulosaWiki` sin permiso explícito.
