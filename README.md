# Nebulosa Wiki

Aplicación local-first, portable y visual para gestionar una wiki Markdown en Windows. Pensada para humanos y para Claude Code.

---

## Funcionalidades actuales

- **Notas Markdown** — crear, editar, guardar y eliminar notas con frontmatter
- **Plantillas** — note, project, source, skill, session, index
- **Nota diaria y nota rápida** con un click
- **Grafo visual** con Cytoscape.js — nodos por carpeta, edges por wikilinks
  - Filtros por tipo de nota (notes, projects, sources, sessions, skills, indexes, missing)
  - Física interactiva, centrado, controles de vista
- **Wikilinks** `[[Nombre de nota]]` — navegables desde el Preview
  - Click en enlace faltante crea la nota directamente
- **Backlinks** — panel de relaciones con entrantes y salientes
- **Búsqueda** por título, ruta y tag desde el sidebar
  - Filtro por tag (`tag:nombre` o chips en sidebar)
  - Búsqueda full-text en contenido (ejecutada en Rust)
- **Historial de recientes** — últimas 6 notas abiertas, persistido en localStorage
- **Importar** archivo Markdown externo a la wiki
- **Exportar** nota individual a ruta del sistema
- **Exportar wiki** completa a carpeta destino
- **Backup de wiki** — copia con timestamp a carpeta base elegida
- **Paleta de comandos** Ctrl+P
- **Toasts** de feedback para operaciones clave
- **Ruta de wiki configurable** desde Ajustes (persiste en JSON local de Tauri)

---

## Requisitos

- [Node.js](https://nodejs.org/) v18 o superior
- [Rust y Cargo](https://rustup.rs/)
- [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/visual-cpp-build-tools/) — componente **Desarrollo para el escritorio con C++**
- WebView2 Runtime (incluido en Windows 11; en Windows 10 puede requerirse instalación manual)

---

## Instalación local

```bash
git clone https://github.com/AndreFGch/NebulosaWikiApp.git
cd NebulosaWikiApp
npm install
```

---

## Ejecutar en desarrollo

```bash
npm run tauri:dev
```

La primera compilación de Rust puede tardar varios minutos. Las siguientes son incrementales.

---

## Carpeta wiki local

La ruta por defecto es:

```
D:\NebulosaWiki
```

Se puede cambiar desde el panel de Ajustes dentro de la app. La ruta elegida se persiste en un archivo de configuración JSON local gestionado por Tauri. Los archivos `.md` son la fuente de verdad — no hay base de datos externa.

---

## Stack

| Capa | Tecnología |
|---|---|
| Shell de escritorio | Tauri 2 (Rust + WebView2) |
| UI | React 19 + TypeScript |
| Grafo visual | Cytoscape.js |
| Búsqueda full-text | Rust (búsqueda en contenido de archivos) |
| Renderizado Markdown | react-markdown + remark-gfm |
| Configuración | JSON local vía Tauri |

Ver decisión completa en [`ADR-0001.md`](ADR-0001.md).

---

## Forma de trabajo

- Cambios pequeños, un paso a la vez
- Máximo 3–5 archivos modificados por iteración
- Reportar siempre los archivos tocados
- No tocar datos reales de la wiki sin permiso explícito

Ver reglas completas en [`CLAUDE.md`](CLAUDE.md).
