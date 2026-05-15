# .claude/scripts

Esta carpeta contiene scripts auxiliares para el proyecto Nebulosa Wiki.

## Propósito

Los scripts realizan operaciones puntuales sobre la wiki o el repositorio: escaneo, indexación, lint, backup y estadísticas. Son invocados por comandos o directamente por el usuario.

## Scripts planeados

| Script | Propósito |
|---|---|
| `scan-wiki` | Recorrer `D:\NebulosaWiki` y listar todas las notas `.md` encontradas |
| `rebuild-index` | Regenerar `index.json` y `graph-cache.json` a partir del escaneo |
| `lint-wiki` | Detectar wikilinks rotos, frontmatter faltante o formato inconsistente |
| `backup-wiki` | Crear copia de seguridad en `.nebulosa/backups/` antes de cambios masivos |
| `stats-wiki` | Calcular estadísticas: total de notas, wikilinks, backlinks, tamaño en disco |

Todavía no hay scripts implementados.

## Reglas para todo script

- Ningún script debe borrar ni mover archivos sin confirmación explícita del usuario.
- Ningún script debe tocar rutas fuera de `D:\NebulosaWiki` sin permiso explícito.
- Todo script debe validar que la ruta de la wiki existe antes de operar.
- Todo script debe ser revisable antes de ejecutarse en datos reales.
- Los backups deben crearse antes de cualquier operación que modifique múltiples archivos.
