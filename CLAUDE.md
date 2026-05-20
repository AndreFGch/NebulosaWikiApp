# CLAUDE.md — Nebulosa Wiki

Memoria operativa del repositorio para Claude Code.

---

## Nombre del proyecto

Nebulosa Wiki

## Propósito

Aplicación local-first, portable y visual para manejar una wiki Markdown local en Windows.

## Visión general

La app trabaja con una carpeta de wiki configurable desde el panel de Ajustes. La ruta por defecto/fallback es:

```
D:\NebulosaWiki
```

La ruta elegida se persiste en un archivo JSON local gestionado por Tauri y puede cambiarse en cualquier momento desde la UI. Los archivos `.md` son la fuente de verdad. No hay base de datos externa. Claude Code puede leer y escribir en esa carpeta siguiendo las reglas de seguridad definidas aquí.

---

## Principios

- **Local-first** — todo funciona sin internet
- **Portable** — sin dependencias de sistema operativo ni servicios externos
- **Markdown real como fuente de verdad** — los `.md` son el dato, no un export
- **Compatible con Claude Code** — el repositorio y la wiki están diseñados para ser navegables por Claude
- **Seguro por defecto** — ninguna acción destructiva sin confirmación
- **Cambios pequeños y revisables** — una cosa a la vez, siempre reportada
- **No copiar Obsidian** — inspirarse está bien, clonar no
- **No copiar literalmente la LLM Wiki de Karpathy** — referencia útil, no plantilla

---

## Stack elegido

| Capa | Tecnología |
|---|---|
| Shell de escritorio | Tauri 2 (Rust + WebView2) |
| UI | React 19 + TypeScript |
| Grafo visual | Cytoscape.js |
| Búsqueda full-text | Rust (implementada en backend, sin MiniSearch) |
| Renderizado Markdown | react-markdown + remark-gfm |
| Configuración | JSON local vía Tauri |

Ver decisión completa en [`ADR-0001.md`](ADR-0001.md).

---

## Reglas de seguridad

- No borrar notas sin confirmación explícita del usuario.
- No mover carpetas de la wiki sin confirmación explícita.
- No tocar rutas fuera de la wiki root configurada sin permiso.
- No modificar datos reales de la wiki sin explicar primero qué se cambiará y por qué.
- Antes de cambios masivos, crear backup o proponer cómo hacerlo.
- Validar rutas antes de escribir cualquier archivo.
- No usar datos reales de la wiki en ejemplos públicos ni en contextos de prueba.

---

## Reglas para cambios de código

- No modificar más de 3–5 archivos por iteración salvo justificación explícita.
- No instalar dependencias sin explicar para qué sirven y por qué son necesarias.
- No hacer refactors grandes sin un plan revisado y aprobado.
- No reescribir todo si se puede ajustar lo existente.
- Reportar siempre los archivos tocados al final de cada intervención.

---

## Reglas para Markdown

- Preservar el contenido del usuario tal como está.
- Preservar el frontmatter si existe; no modificarlo sin razón.
- No inventar datos, fechas ni referencias.
- Marcar información dudosa o incompleta como `<!-- pendiente -->` o similar.
- Mantener wikilinks consistentes con el formato `[[Nombre de nota]]`.

---

## Estructura esperada del repositorio

```
D:\Aplicaciones\NebulosaWikiApp\
├── ADR-0001.md
├── CLAUDE.md
├── README.md
├── .gitignore
├── .claude/
│   ├── skills/
│   ├── commands/
│   └── scripts/
├── docs/
├── src/
└── src-tauri/
```

---

## Estructura esperada de la wiki

```
D:\NebulosaWiki\
├── notes/
├── projects/
├── sources/
├── inbox/
├── attachments/
├── indexes/
├── templates/
└── .nebulosa/
    ├── config.json
    ├── index.json
    ├── graph-cache.json
    ├── logs/
    └── backups/
```

---

## Flujo de trabajo

### Antes de modificar

1. Explicar qué archivos o rutas se tocarán.
2. Explicar por qué es necesario.
3. Limitar el alcance al mínimo necesario.

### Después de modificar

Reportar siempre:

- **Archivos tocados** — lista exacta
- **Qué cambió** — descripción concisa
- **Cómo probarlo** — pasos concretos
- **Riesgos** — qué podría salir mal
- **Siguiente paso** — qué viene después

---

## Qué no debe hacer Claude sin permiso explícito

- Borrar notas o archivos de la wiki
- Mover o renombrar carpetas de la wiki
- Tocar rutas fuera de la wiki root configurada
- Instalar dependencias
- Cambiar el stack definido en ADR-0001.md
- Hacer cambios masivos en múltiples archivos sin plan aprobado
- Publicar, exponer o compartir datos reales de la wiki
