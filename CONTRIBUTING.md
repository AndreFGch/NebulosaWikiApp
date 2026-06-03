# Contributing to Nebulosa Wiki

Gracias por tu interés en contribuir. Este documento describe cómo configurar el entorno, validar cambios y enviar contribuciones.

---

## Requisitos

- Node.js v18 o superior
- npm
- Rust y Cargo (stable)
- [Tauri prerequisites para Windows](https://tauri.app/start/prerequisites/) — incluye Visual Studio Build Tools 2022 con **Desarrollo para el escritorio con C++** y WebView2 Runtime
- Windows recomendado (la app es portable Windows-first por ahora)

---

## Setup local

```bash
git clone https://github.com/AndreFGch/NebulosaWikiApp.git
cd NebulosaWikiApp
npm install
```

---

## Desarrollo

Para evitar conflictos de compilación con otros proyectos Rust, se recomienda usar un directorio de build dedicado:

```powershell
$env:CARGO_TARGET_DIR="C:\Temp\NebulosaWikiTarget"
npm run tauri:dev
```

---

## Validaciones antes de abrir un PR

Ejecutar manualmente antes de enviar:

```bash
npx tsc --noEmit
```

```powershell
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

No hay CI automatizado todavía. Las validaciones son responsabilidad del colaborador.

---

## Reglas de contribución

- Cambios pequeños y enfocados. Un PR, una cosa.
- No mezclar features, refactors grandes y docs en el mismo PR.
- No agregar dependencias npm o crates sin justificar el motivo en el PR.
- Mantener el enfoque local-first: sin servicios externos, sin bases de datos remotas.
- No subir `data/webview/`, cachés de WebView2, `ShaderCache` ni `Crashpad`.

---

## Convención de commits

```
feat:      nueva funcionalidad
fix:       corrección de bug
docs:      cambios en documentación
refactor:  refactor sin cambio de comportamiento
test:      agrega o ajusta tests
chore:     tareas de mantenimiento, dependencias, build
```

---

## Seguridad

- No incluir rutas personales del sistema en código ni en ejemplos.
- No subir datos reales de una wiki personal.
- No incluir perfiles de WebView2, cachés ni configuraciones locales del sistema.
- Verificar el ZIP portable antes de publicar releases para asegurarse de que no incluye datos privados.

---

## Releases

El proceso de release es manual por ahora:

1. Compilar con `npm run tauri:build`.
2. Generar el ZIP portable con `.\scripts\build-portable.ps1`.
3. Verificar el contenido del ZIP antes de publicar.
4. Publicar en la sección de Releases del repositorio.
