# Nebulosa Wiki

Nebulosa Wiki es una aplicación local-first, portable y visual para manejar una wiki Markdown local en Windows, pensada para humanos y para Claude Code.

---

## Estado actual

- Base Tauri + React + TypeScript integrada
- Pantalla inicial propia (sin logos genéricos de Tauri/Vite/React)
- Estructura `.claude/` lista para Claude Code
- Documentación inicial completa (`ADR-0001.md`, `CLAUDE.md`)
- Todavía no hay lectura real de archivos Markdown
- Todavía no hay grafo visual ni detección de wikilinks

---

## Objetivo

- Leer y escribir notas Markdown locales
- Detectar wikilinks (`[[Nombre de nota]]`)
- Detectar backlinks entre notas
- Generar índice local de la wiki
- Mostrar grafo visual de conexiones
- Servir como memoria persistente para Claude Code

---

## Requisitos

- [Node.js](https://nodejs.org/) (v18 o superior)
- npm (incluido con Node.js)
- [Rust y Cargo](https://rustup.rs/)
- [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/visual-cpp-build-tools/) con el componente **Desarrollo para el escritorio con C++**
- [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (incluido en Windows 11; en Windows 10 puede requerirse instalación manual)

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
npm run tauri dev
```

Esto abre la ventana de escritorio Tauri con recarga en caliente. La primera compilación de Rust puede tardar varios minutos.

---

## Carpeta wiki local

La wiki real vive por defecto en:

```
D:\NebulosaWiki
```

Esa carpeta no forma parte de este repositorio. Los archivos `.md` dentro de ella son la fuente de verdad de las notas; la app los lee directamente sin base de datos externa.

---

## Stack

| Capa | Tecnología |
|---|---|
| Shell de escritorio | Tauri (Rust + WebView) |
| UI | React + TypeScript |
| Grafo visual | Cytoscape.js |
| Búsqueda local | MiniSearch (fase 2) |
| Parser Markdown | Por definir (remark / markdown-it) |
| Configuración | JSON local |

Ver decisión completa en [`ADR-0001.md`](ADR-0001.md).

---

## Próximos pasos

- [ ] Crear layout base (sidebar + panel de nota)
- [ ] Leer carpeta `D:\NebulosaWiki` desde Tauri (comando Rust)
- [ ] Listar notas Markdown en el sidebar
- [ ] Detectar wikilinks en el contenido de las notas
- [ ] Detectar backlinks (qué notas apuntan a cada nota)
- [ ] Construir grafo visual con Cytoscape.js

---

## Roadmap completado

- [x] Crear base documental (`ADR-0001.md`, `CLAUDE.md`, `README.md`, `.gitignore`)
- [x] Crear estructura `.claude/` (skills, commands, scripts)
- [x] Crear proyecto Tauri + React + TypeScript base
- [x] Pantalla inicial propia de Nebulosa Wiki

---

## Forma de trabajo

- Cambios pequeños, un paso a la vez
- Máximo 3–5 archivos modificados por iteración
- Reportar siempre los archivos tocados
- Explicar cómo probar cada cambio
- No tocar datos reales de la wiki sin permiso explícito

Ver reglas completas en [`CLAUDE.md`](CLAUDE.md).
