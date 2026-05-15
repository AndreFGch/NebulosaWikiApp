# Nebulosa Wiki

Nebulosa Wiki es una aplicación local-first, portable y visual para manejar una wiki Markdown local en Windows, pensada para humanos y para Claude Code.

---

## Estado actual

- Proyecto en fase inicial de documentación
- `ADR-0001.md` creado — decisión de stack
- `CLAUDE.md` creado — memoria operativa para Claude Code
- Todavía no hay aplicación funcional

---

## Objetivo

- Leer y escribir notas Markdown locales
- Detectar wikilinks (`[[Nombre de nota]]`)
- Detectar backlinks entre notas
- Generar índice local de la wiki
- Mostrar grafo visual de conexiones
- Servir como memoria persistente para Claude Code

---

## Carpeta wiki por defecto

```
D:\NebulosaWiki
```

---

## Stack propuesto

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

## Roadmap inicial

- [x] Crear base documental (`ADR-0001.md`, `CLAUDE.md`, `README.md`, `.gitignore`)
- [ ] Crear estructura `.claude/` (skills, commands, scripts)
- [ ] Crear estructura inicial del repositorio
- [ ] Crear proyecto Tauri base
- [ ] Escanear archivos Markdown de la carpeta wiki
- [ ] Indexar notas localmente
- [ ] Detectar wikilinks y backlinks
- [ ] Crear UI básica con React
- [ ] Crear grafo visual con Cytoscape.js

---

## Forma de trabajo

- Cambios pequeños, un paso a la vez
- Máximo 3–5 archivos modificados por iteración
- Reportar siempre los archivos tocados
- Explicar cómo probar cada cambio
- No tocar datos reales de la wiki sin permiso explícito

Ver reglas completas en [`CLAUDE.md`](CLAUDE.md).
