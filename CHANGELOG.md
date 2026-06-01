# Changelog

Todos los cambios notables de Nebulosa Wiki se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [Unreleased]

### Added
- Ctrl+S para guardar notas en modo edición.
- Indicador visual de cambios sin guardar en el panel de detalle.
- Checklist manual de smoke test para validar releases (`docs/smoke-test.md`).

### Changed
- `walk_dir` ahora omite directorios ocultos (`.nebulosa`, `.git`, `.codegraph`, etc.).

### Fixed
- Las notas dentro de carpetas ocultas ya no aparecen en el sidebar ni en el grafo.
- Se muestra advertencia de confirmación antes de navegar si hay cambios sin guardar.

### Security
- Content Security Policy activada en Tauri. La app ya no corre con `csp: null`.

---

## [0.1.0] - 2026-05-20

Primera versión pública portable de Nebulosa Wiki para Windows.

### Added
- Crear, editar, guardar y eliminar notas Markdown.
- Wiki local-first: los archivos `.md` son la fuente de verdad, sin base de datos externa.
- Plantillas de nota: simple, proyecto, fuente, skill, sesión e índice.
- Grafo visual de la wiki con nodos por carpeta y enlaces entre notas.
- Wikilinks (`[[Nombre de nota]]`) con resolución y backlinks entrantes.
- Búsqueda por título, ruta, tag y contenido full-text (Rust).
- Importar archivos Markdown externos a la wiki.
- Exportar nota individual a una ruta personalizada.
- Exportar wiki completa a una carpeta destino.
- Backup manual con timestamp.
- Paleta de comandos (Ctrl+P).
- Nota diaria (`sessions/YYYY-MM-DD.md`) y nota rápida.
- Ruta de wiki configurable desde la UI (persiste en JSON local vía Tauri).
- Distribución portable en ZIP para Windows: sin instalador, sin registro, sin dependencias de sistema.

### Security
- Limpieza de metadata y caché del build portable antes de publicar.
- ZIP portable verificado para no incluir perfil de WebView2, Crashpad ni ShaderCache.
