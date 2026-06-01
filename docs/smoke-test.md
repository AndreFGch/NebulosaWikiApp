# Smoke Test Manual — Nebulosa Wiki

Checklist de pruebas mínimas antes de cada release.
Ejecutar en su totalidad antes de publicar una nueva versión.

**Versión objetivo:** v0.1.1  
**Plataforma:** Windows 11  
**Tiempo estimado:** 20–30 min

Leyenda: `[ ]` pendiente · `[x]` aprobado · `[!]` falla bloqueante · `[~]` known issue

---

## 1. Preparación

Antes de iniciar cualquier prueba:

- [ ] Tener una **wiki de prueba separada** en una ruta distinta a `D:\NebulosaWiki` (ej.: `D:\NebulosaWiki-test`)
- [ ] La wiki de prueba debe tener al menos: 3 notas en `notes/`, 1 en `projects/`, 1 en `indexes/` con wikilinks
- [ ] Confirmar que `D:\NebulosaWiki-test` tiene una nota con wikilink a otra existente y una a una nota inexistente
- [ ] Cerrar cualquier instancia anterior de la app

### Modo desarrollo

```
npm run tauri:dev
```

Esperar a que el WebView cargue completamente antes de empezar.

### Modo portable

Ver sección [8. Validación portable](#8-validación-portable).

### Configurar wiki de prueba

En la app: botón ⚙ → cambiar ruta wiki → ingresar ruta de la wiki de prueba → guardar.

> **IMPORTANTE:** Al terminar las pruebas, restaurar la ruta a `D:\NebulosaWiki`.

---

## 2. Validación de arranque

| # | Prueba | Resultado |
|---|--------|-----------|
| 2.1 | App abre sin pantalla en blanco ni crash | `[ ]` |
| 2.2 | Estilos cargan correctamente (colores oscuros, ribbon visible) | `[ ]` |
| 2.3 | Sidebar muestra lista de notas de la wiki configurada | `[ ]` |
| 2.4 | Home (vista principal) carga sin errores visibles en pantalla | `[ ]` |
| 2.5 | Abrir DevTools (F12) → pestaña Console → sin errores rojos en arranque | `[ ]` |
| 2.6 | La ruta de wiki activa es la wiki de prueba (visible en ⚙ Ajustes) | `[ ]` |

---

## 3. Validación de notas

| # | Prueba | Resultado |
|---|--------|-----------|
| 3.1 | Hacer clic en una nota del sidebar → se abre en panel derecho en modo Preview | `[ ]` |
| 3.2 | El contenido Markdown renderiza correctamente (encabezados, listas, negrita) | `[ ]` |
| 3.3 | Botón **+** (nueva nota) → se abre modal → ingresar título → crear | `[ ]` |
| 3.4 | La nota creada aparece en el sidebar y se abre automáticamente en modo Editar | `[ ]` |
| 3.5 | Editar el contenido de la nota → guardar → pasar a modo Preview → contenido actualizado | `[ ]` |
| 3.6 | Botón **◷** (nota diaria) → crea o abre `sessions/YYYY-MM-DD.md` | `[ ]` |
| 3.7 | Botón **✦** (nota rápida) → crea nota en `notes/quick-…` y la abre en modo Editar | `[ ]` |
| 3.8 | Eliminar nota: abrir nota → buscar opción eliminar → confirmar escribiendo `ELIMINAR` → nota desaparece del sidebar | `[ ]` |

---

## 4. Validación de edición segura

Estas pruebas cubren MT-03, MT-04 y MT-05.

| # | Prueba | Resultado |
|---|--------|-----------|
| 4.1 | Abrir nota en modo Editar → modificar texto → aparece indicador "Sin guardar" (punto o texto en la UI) | `[ ]` |
| 4.2 | Presionar **Ctrl+S** → nota se guarda → indicador desaparece → modo vuelve a Preview | `[ ]` |
| 4.3 | Abrir nota en modo Editar → modificar texto → hacer clic en otra nota del sidebar → aparece diálogo de advertencia | `[ ]` |
| 4.4 | En el diálogo de advertencia → hacer clic en **Cancelar** → permanece en la nota actual con los cambios intactos | `[ ]` |
| 4.5 | Repetir 4.3 → en el diálogo → hacer clic en **Aceptar** (descartar) → se abre la otra nota y se pierden los cambios | `[ ]` |
| 4.6 | Sin cambios pendientes → hacer clic en otra nota → no aparece diálogo | `[ ]` |

---

## 5. Validación de búsqueda

| # | Prueba | Resultado |
|---|--------|-----------|
| 5.1 | Abrir buscador (botón ⌕ o Ctrl+P) → escribir parte del título de una nota → aparece en resultados | `[ ]` |
| 5.2 | Buscar por ruta parcial (ej.: `notes/`) → filtra correctamente | `[ ]` |
| 5.3 | Buscar `tag:nebulosa` → muestra solo notas con ese tag | `[ ]` |
| 5.4 | Hacer clic en un chip de tag → filtra lista por ese tag | `[ ]` |
| 5.5 | Búsqueda full-text (⏎): escribir palabra que esté en el contenido de una nota → aparece en resultados con snippet | `[ ]` |
| 5.6 | Búsqueda con acentos: buscar `sesion` → también encuentra notas con `sesión` (o viceversa) | `[ ]` |
| 5.7 | Limpiar búsqueda (✕) → lista vuelve a mostrar todas las notas | `[ ]` |

---

## 6. Validación de wikilinks y backlinks

Requisito: la wiki de prueba debe tener notas con `[[wikilinks]]`.

| # | Prueba | Resultado |
|---|--------|-----------|
| 6.1 | Abrir nota en Preview → wikilink existente aparece como enlace clickeable | `[ ]` |
| 6.2 | Hacer clic en wikilink existente → navega a la nota correcta | `[ ]` |
| 6.3 | Wikilink a nota inexistente → aparece visualmente diferenciado (roto/inactivo) | `[ ]` |
| 6.4 | Desde el panel de relaciones → opción "Crear nota" para enlace roto → crea nota y navega a ella | `[ ]` |
| 6.5 | Abrir nota que es destino de un wikilink → sección de backlinks muestra la nota de origen | `[ ]` |
| 6.6 | Sección de enlaces salientes muestra las notas a las que apunta la nota abierta | `[ ]` |

---

## 7. Validación del grafo

| # | Prueba | Resultado |
|---|--------|-----------|
| 7.1 | Hacer clic en ◎ (grafo) → grafo carga sin pantalla en blanco | `[ ]` |
| 7.2 | Nodos visibles con colores por carpeta (notas, projects, etc.) | `[ ]` |
| 7.3 | Líneas de conexión entre nodos con wikilinks | `[ ]` |
| 7.4 | Hover sobre un nodo → se destacan sus conexiones, el resto se atenúa | `[ ]` |
| 7.5 | Hacer clic en un nodo existente → se abre la nota en el panel | `[ ]` |
| 7.6 | Filtros por tipo (Notas, Proyectos, etc.) → activar/desactivar cada uno → grafo responde | `[ ]` |
| 7.7 | Archivos dentro de `.nebulosa/` **no aparecen** como nodos en el grafo (MT-02) | `[ ]` |
| 7.8 | Archivos en carpetas ocultas (nombre empieza con `.`) **no aparecen** en sidebar ni grafo | `[ ]` |

---

## 8. Validación portable

| # | Prueba | Resultado |
|---|--------|-----------|
| 8.1 | Ejecutar `.\scripts\build-portable.ps1` → termina sin errores | `[ ]` |
| 8.2 | ZIP generado en `dist-portable/` con nombre `NebulosaWiki-portable-vX.X.X.zip` | `[ ]` |
| 8.3 | Descomprimir ZIP en una carpeta limpia (ej.: `C:\Temp\nebulosa-test\`) | `[ ]` |
| 8.4 | Ejecutar `NebulosaWiki.exe` desde esa carpeta → app abre | `[ ]` |
| 8.5 | Carpeta `data/wiki/` existe dentro de la instalación portable | `[ ]` |
| 8.6 | Carpeta `data/webview/` existe y contiene datos del WebView (perfil de Edge) | `[ ]` |
| 8.7 | Crear una nota nueva en el portable → cerrar app → volver a abrir → nota persiste | `[ ]` |
| 8.8 | Mover la carpeta completa a otra ruta → ejecutar `.exe` desde nueva ruta → app funciona | `[ ]` |

---

## 9. Validación de seguridad básica

Cubre MT-01 (CSP).

| # | Prueba | Resultado |
|---|--------|-----------|
| 9.1 | App carga con CSP activa → ningún componente visual falta o rompe | `[ ]` |
| 9.2 | DevTools → Console → sin errores del tipo `Content Security Policy` al cargar | `[ ]` |
| 9.3 | DevTools → Console → sin errores CSP al navegar entre notas ni al renderizar Markdown | `[ ]` |
| 9.4 | DevTools → Console → sin errores CSP al abrir el grafo | `[ ]` |
| 9.5 | Abrir el ZIP portable y verificar que **no contiene** `data/webview/` | `[ ]` |
| 9.6 | ZIP portable **no contiene** carpeta `Crashpad/` | `[ ]` |
| 9.7 | ZIP portable **no contiene** carpeta `ShaderCache/` o `GPUCache/` | `[ ]` |

---

## 10. Criterio de aprobación

### ✅ Aprobado para release si:

- Todas las pruebas de las secciones 2, 3 y 4 pasan sin `[!]`
- Al menos 80% de las pruebas de las secciones 5, 6 y 7 pasan
- Sección 9: pruebas 9.1, 9.2, 9.3 y 9.4 pasan (CSP no rompe nada)
- Sección 8 (portable): pruebas 8.1–8.4 y 8.7 pasan

### ❌ Bloquea release si:

- La app no abre (2.1)
- Los estilos no cargan (2.2)
- No se puede crear, editar o guardar una nota (3.3, 3.5)
- Ctrl+S no guarda (4.2)
- La advertencia de cambios sin guardar no aparece (4.3)
- El portable no compila o no abre (8.1, 8.4)
- Hay errores CSP que rompen funcionalidad visible (9.1)
- El ZIP contiene datos del perfil de usuario (9.5, 9.6, 9.7)

### 〜 Known issues aceptables para v0.1.1:

- Búsqueda con acentos parcial (5.6) si el resto de búsqueda funciona
- Nodos del grafo con posiciones inestables en wikis muy grandes
- El portable tarda más en arrancar la primera vez (inicialización WebView)

---

## Notas del revisor

**Fecha de ejecución:**  
**Versión testeada:**  
**Wiki de prueba usada:**  
**Tester:**  
**Resultado general:** `[ ] Aprobado` / `[ ] Bloqueado`

**Observaciones:**

<!-- Completar después de ejecutar el smoke test -->
