# .claude/commands

Esta carpeta contiene comandos para Claude Code en el proyecto Nebulosa Wiki.

## Propósito

Los comandos son puntos de entrada nombrados que el usuario puede invocar directamente desde Claude Code. Cada comando tiene una responsabilidad clara y acotada.

## Comandos planeados

| Comando | Propósito |
|---|---|
| `init-wiki` | Crear la estructura inicial de `D:\NebulosaWiki` si no existe |
| `lint-wiki` | Verificar consistencia de wikilinks, frontmatter y formato Markdown |
| `stats-wiki` | Mostrar estadísticas de la wiki: notas, wikilinks, backlinks, tamaño |
| `rebuild-index` | Regenerar `index.json` y `graph-cache.json` en `.nebulosa/` |
| `create-note` | Crear una nueva nota con frontmatter correcto en la carpeta indicada |
| `project-memory` | Actualizar la memoria del proyecto en `.claude/` con el estado actual |

Todavía no hay comandos implementados.

## Reglas para todo comando

- Explicar antes de ejecutar qué archivos o rutas se tocarán.
- Al finalizar, reportar siempre:
  - **Archivos tocados**
  - **Qué cambió**
  - **Cómo probarlo**
  - **Riesgos**
  - **Siguiente paso**
- No realizar acciones destructivas sin confirmación explícita del usuario.
- No instalar dependencias sin justificación aprobada.
