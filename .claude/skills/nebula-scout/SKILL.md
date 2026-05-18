# nebula-scout

Revisar estado real del repositorio antes de tocar código.

Invocar con: `/nebula-scout`

---

## Propósito

Evitar cambios ciegos. Antes de cualquier modificación, levantar contexto completo del estado actual: código, git, riesgos.

---

## Pasos de ejecución

Ejecutar en orden. No saltear pasos.

### 1. Leer CLAUDE.md

Releer reglas activas del proyecto. Confirmar límites de alcance.

Archivo: `D:\Aplicaciones\NebulosaWikiApp\CLAUDE.md`

### 2. Estado git

Ejecutar:
```
git status
git diff --name-only
git log --oneline -5
```

Reportar:
- Archivos modificados sin commitear
- Archivos staged
- Últimos 5 commits

### 3. Estructura src/

Listar archivos en `src/`. Reportar cuáles existen actualmente.

### 4. Estructura src-tauri/

Listar archivos clave en `src-tauri/src/`. Verificar si `lib.rs` existe y si fue modificado recientemente.

### 5. Leer archivos activos

Leer siempre:
- `src/App.tsx`
- `src/App.css`

Si `src-tauri/src/lib.rs` fue modificado según git: leerlo también.

### 6. Identificar tipos y funciones clave en App.tsx

Extraer y reportar:
- Interfaces TypeScript definidas
- Funciones definidas fuera del componente
- Estado (useState) del componente
- useEffects activos

---

## Output esperado

Responder con secciones:

### Estado actual
Resumen de qué existe y qué está modificado.

### Archivos tocados actualmente
Lista exacta de archivos con cambios sin commitear.

### Riesgo
- BAJO: nada modificado, código limpio
- MEDIO: archivos modificados pero cambios coherentes
- ALTO: cambios sin commitear + funciones core tocadas + sin tests

### Recomendación
Una de:
- **CONTINUAR** — estado limpio, contexto claro
- **PEDIR CONTEXTO** — hay cambios sin explicación o estructura inesperada
- **REVERTIR** — cambios peligrosos o inconsistentes detectados
- **IMPLEMENTAR** — todo en orden, proceder con la tarea

---

## Reglas

- No modificar ningún archivo durante este scout.
- No tocar `D:\NebulosaWiki`.
- Si algo en el estado es inesperado, reportarlo antes de continuar.
- Si hay archivos modificados no relacionados con la tarea actual, marcarlos como riesgo.
