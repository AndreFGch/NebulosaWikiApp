# Changelog

Todos los cambios notables de Nebulosa Wiki se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [Unreleased]

### Added
- Ctrl+S para guardar notas en modo edición.
- Indicador visual de cambios sin guardar en el panel de detalle.
- Checklist manual de smoke test para validar releases (`docs/smoke-test.md`).
- Botón Recargar wiki para sincronizar manualmente cambios realizados desde editores externos.
- Empty state con acciones de onboarding cuando la wiki está vacía.
- Mensaje de error amigable con acción directa a Ajustes cuando la wiki no puede cargarse.
- Selectores nativos del sistema operativo para ruta de wiki, importar Markdown, exportar nota, exportar wiki y backup (`@tauri-apps/plugin-dialog`).
- Modo grafo local depth-1: toggle Global/Local para ver solo la nota seleccionada y sus vecinos directos sin reconstruir el grafo.
- Búsqueda con normalización de acentos (árbol/arbol, André/Andre, acción/accion, etc.) y ranking por título, tags, ruta, wikilinks y contenido.
- Tests unitarios Rust para validación de rutas y lógica de acceso a la wiki.

### Changed
- `walk_dir` ahora omite directorios ocultos (`.nebulosa`, `.git`, `.codegraph`, etc.).
- README actualizado con atajos de teclado, notas sobre Windows SmartScreen, screenshots y limitaciones conocidas.
- Helper `validate_within_wiki_root` extraído para centralizar la validación de rutas dentro de la wiki root.
- Grafo: resaltado visual del nodo seleccionado y sus vecinos directos al seleccionar una nota.
- Grafo: radio dinámico en el layout inicial para wikis grandes.
- Búsqueda rápida y global con mayor claridad visual entre modos.

### Fixed
- Las notas dentro de carpetas ocultas ya no aparecen en el sidebar ni en el grafo.
- Se muestra advertencia de confirmación antes de navegar si hay cambios sin guardar.
- Recargar wiki actualiza también el contenido de la nota seleccionada si todavía existe en disco.
- Evita reconstrucción de Cytoscape al seleccionar nodos, eliminando parpadeo y pérdida de posición del grafo.
- Cierre accidental de modales al seleccionar texto dentro de ellos corregido con backdrops seguros.

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
