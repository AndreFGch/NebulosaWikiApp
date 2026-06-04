# Release Process — NebulosaWikiApp

Documento técnico operativo para preparar, validar y publicar releases portables de NebulosaWikiApp.

---

## Propósito

Este archivo documenta el proceso manual para preparar, validar y publicar releases portables de NebulosaWikiApp. Sirve como checklist operativo para no omitir pasos críticos entre versión y versión.

No automatiza nada. No reemplaza el criterio del responsable del release. Es una referencia viva que debe actualizarse cuando el proceso cambie.

---

## Principios del release

- **Release portable limpio** — el ZIP debe funcionar en cualquier máquina Windows sin instalación.
- **Local-first** — la app no requiere internet ni servicios externos.
- **Sin datos personales** — ningún archivo del ZIP debe contener rutas, nombres ni datos del entorno de desarrollo.
- **Sin cachés** — `data/webview` no va en el ZIP; se genera en la máquina del usuario al ejecutar la app.
- **Sin rutas locales** — ninguna ruta absoluta del entorno de build debe quedar embebida en el ZIP.
- **Sin `data/webview`** — el directorio de caché de WebView2 es generado por la app, no distribuido.
- **Sin `settings.json`** — la configuración del usuario se genera la primera vez que se ejecuta la app.
- **Sin archivos temporales** — builds de desarrollo, logs y artefactos intermedios no van al ZIP.
- **Validación antes de publicar** — ningún release sin smoke test manual aprobado.
- **Smoke test manual obligatorio** — cada release debe probarse en una carpeta limpia antes de subir el asset.

---

## Precondiciones

Antes de iniciar el proceso de release, verificar que se cumplan todas estas condiciones:

- [ ] Working tree limpio (`git status` no muestra cambios sin commitear).
- [ ] Branch correcto (normalmente `main`).
- [ ] Versión definida y consensuada (ej. `v0.1.2`).
- [ ] `CHANGELOG.md` actualizado con la versión nueva.
- [ ] `README.md` actualizado si aplica (badges, instrucciones, capturas).
- [ ] `CONTRIBUTING.md` actualizado si aplica.
- [ ] `ROADMAP.md` actualizado si aplica.
- [ ] Ausencia de archivos temporales en el repo.
- [ ] Ausencia de datos personales en el repo (wikis de prueba, settings personales, etc.).
- [ ] Ausencia de ZIP viejo en `releases/` que pueda confundirse con el nuevo.

---

## Validaciones mínimas

Para releases que incluyan cambios de código, ejecutar las siguientes validaciones antes de generar el build:

```powershell
# Verificar tipos TypeScript
npx tsc --noEmit

# Verificar que el código Rust compila
cargo check --manifest-path src-tauri/Cargo.toml

# Ejecutar tests Rust
cargo test --manifest-path src-tauri/Cargo.toml
```

> **Nota:** Si el release solo incluye cambios de documentación (Markdown, README, CHANGELOG, etc.), estas validaciones no son estrictamente necesarias. Igual es recomendable verificar que el repo esté en estado limpio.

---

## Revisión de versión

Verificar que la versión sea consistente en todos estos archivos antes de generar el build:

| Archivo | Campo |
|---|---|
| `package.json` | `"version"` |
| `package-lock.json` | `"version"` (raíz y entrada del paquete) |
| `src-tauri/tauri.conf.json` | `"version"` dentro de `"package"` |
| `src-tauri/Cargo.toml` | `version` en `[package]` |
| `src-tauri/Cargo.lock` | entrada del crate principal |

Si alguno no coincide, corregir antes de continuar.

---

## Build portable

Para generar el ZIP portable, ejecutar el script dedicado:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\build-portable.ps1"
```

Verificar que:

- El script termina sin errores.
- El nombre del ZIP generado coincide exactamente con la versión esperada, por ejemplo:

```
releases\NebulosaWiki-Portable-v0.1.2.zip
```

- No quedan ZIPs de versiones anteriores en `releases/` que puedan confundirse.

> **Nota importante:** Si el script tiene la versión hardcodeada internamente, actualizar esa línea antes de ejecutarlo. Este fue un problema detectado en `v0.1.1`.

---

## Checklist anti-contaminación del ZIP

Antes de publicar el ZIP, verificar que **no contiene**:

- [ ] `data/webview` o cualquier subdirectorio de WebView2.
- [ ] `settings.json` con datos del entorno de desarrollo.
- [ ] Cachés de compilación o carpetas de artefactos de build.
- [ ] Archivos temporales (`.tmp`, `.log`, `.bak`, etc.).
- [ ] Rutas absolutas del entorno de desarrollo embebidas en algún archivo.
- [ ] Carpetas de prueba o wikis locales de prueba.
- [ ] Archivos de usuario o datos personales.
- [ ] Directorios de AppData del entorno de desarrollo.
- [ ] Builds o binarios de versiones anteriores innecesarios.
- [ ] Archivos que no formen parte de la distribución oficial.

Si alguno de estos elementos está presente, regenerar el ZIP limpio antes de continuar.

---

## Smoke test manual

Extraer el ZIP en una carpeta limpia (sin historial de versiones anteriores) y seguir estos pasos:

1. Extraer el ZIP en una carpeta nueva, por ejemplo `C:\Temp\NebulosaTest\`.
2. Ejecutar `NebulosaWiki.exe` directamente desde esa carpeta.
3. Confirmar que la app inicia sin errores.
4. Confirmar que se crea `data/webview` **dentro de la carpeta portable** (no en AppData del sistema).
5. Confirmar que se crea `data/settings.json` **dentro de la carpeta portable**.
6. Seleccionar una wiki de prueba usando el selector nativo.
7. Validar que las notas Markdown cargan correctamente.
8. Validar que la búsqueda global devuelve resultados.
9. Validar que el grafo Global se muestra sin errores.
10. Validar que el grafo Local (por nota) se muestra sin errores.
11. Validar la navegación básica entre notas.
12. Cerrar la app completamente.
13. Abrir la app de nuevo.
14. Confirmar que la wiki seleccionada persiste (la app recuerda la ruta configurada).

Solo aprobar el release si todos estos pasos pasan sin problemas.

---

## SHA256

Calcular el hash del ZIP antes de publicarlo:

```powershell
Get-FileHash ".\releases\NebulosaWiki-Portable-vX.Y.Z.zip" -Algorithm SHA256
```

Reemplazar `X.Y.Z` con la versión real. Guardar el valor del hash para pegarlo en el GitHub Release.

---

## Tag y GitHub Release

### Crear el tag

- Crear el tag **solo cuando el commit final esté validado** y el working tree esté limpio.
- Verificar que el tag apunta al commit correcto con `git log --oneline -5`.
- Usar el formato `vX.Y.Z` (ejemplo: `v0.1.2`).

### Publicar en GitHub

1. Ir a la sección **Releases** del repositorio en GitHub.
2. Crear un nuevo release apuntando al tag creado.
3. Agregar título descriptivo (ejemplo: `v0.1.2 — Nombre del release`).
4. Agregar descripción con los cambios relevantes (puede basarse en `CHANGELOG.md`).
5. Subir el ZIP correcto como asset (verificar nombre y tamaño).
6. Pegar el SHA256 calculado en la descripción del release.
7. Marcar como **Latest release** si corresponde.
8. Revisar visualmente el release publicado antes de cerrar.

> **No subir previews ni ZIPs de versiones anteriores como asset del release nuevo.**

---

## Checklist final

Antes de cerrar el proceso de release, confirmar:

- [ ] Repo limpio (`git status` sin cambios pendientes).
- [ ] Versión correcta y consistente en todos los archivos relevantes.
- [ ] Validaciones de código pasadas (o documentado por qué se omitieron).
- [ ] ZIP generado con el nombre correcto.
- [ ] ZIP verificado como limpio (sin contaminación).
- [ ] Smoke test aprobado en carpeta limpia.
- [ ] SHA256 calculado y guardado.
- [ ] Tag creado apuntando al commit correcto.
- [ ] Asset correcto subido al GitHub Release.
- [ ] SHA256 pegado en la descripción del release.
- [ ] Release publicado y marcado como Latest si corresponde.
- [ ] GitHub Release revisado visualmente en el navegador.

---

## Lecciones aprendidas de v0.1.1

Estas situaciones se detectaron durante el proceso de release de `v0.1.1` y deben tenerse en cuenta en releases futuros:

- **Script portable con versión hardcodeada:** Verificar que `build-portable.ps1` no tiene la versión anterior hardcodeada antes de ejecutarlo. Si la tiene, actualizarla primero.
- **Consistencia de `Cargo.toml` y `Cargo.lock`:** Verificar que ambos estén sincronizados con la versión del release. Un `Cargo.lock` desincronizado puede generar confusión en el historial.
- **Tag apuntando al commit correcto:** Verificar con `git log` que el tag fue creado sobre el commit final del release, no sobre un commit intermedio de preparación.
- **Confusión entre ZIP preview y ZIP final:** No subir como asset ninguna build previa ni provisional. Solo el ZIP generado y validado en el smoke test.
- **AppData vs data/ portable:** Al hacer smoke test, confirmar que `data/webview` y `data/settings.json` se generan dentro de la carpeta portable y no en `AppData` del sistema. Si se mezclan datos de una instalación anterior, el comportamiento puede no reflejar una experiencia de primer uso real.

---

## Fuera de alcance

Este documento **no implementa** ni cubre:

- Integración continua (CI) ni pipelines automatizados.
- Firma digital de binarios o ZIPs.
- Publicación automática en GitHub Releases.
- Generación automática de release notes.
- Cambios en el proceso de build.
- Cambios en el código fuente.
- Cambios en scripts de build.
- Cambios en configuración de CI/CD.

Para cualquiera de estos temas, referirse a la documentación correspondiente o crear un documento específico.

---

## Próximas mejoras sugeridas

Mejoras que podrían incorporarse en el futuro para hacer el proceso más robusto:

- **CI mínimo:** Agregar un workflow de GitHub Actions que ejecute `tsc --noEmit` y `cargo check` en cada PR.
- **Release checklist en PR:** Incluir un template de PR que recuerde los pasos críticos del release.
- **Validación automática del ZIP:** Script que verifique que el ZIP no contiene `data/webview` ni `settings.json`.
- **Script para calcular SHA256:** Integrar el cálculo del hash en `build-portable.ps1` para que se muestre automáticamente al finalizar.
- **Release notes template:** Plantilla Markdown para estandarizar la descripción de cada GitHub Release.
- **Build reproducible:** Investigar si es posible hacer que el build sea determinista (mismo input = mismo output).
- **GitHub Actions futuro:** Automatizar el build portable en un runner de Windows cuando se haga push de un tag `vX.Y.Z`.
