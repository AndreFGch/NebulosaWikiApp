---
name: ui-ux-pro-max
description: Diagnóstico y mejora visual/UX premium para interfaces de Nebulosa, priorizando cambios pequeños, consistentes y sin romper lógica existente.
---

# UI UX Pro Max

Usá esta skill cuando el usuario pida mejorar la experiencia visual, interfaz, layout, paneles, navegación, jerarquía visual, estados hover/active/disabled, responsive, legibilidad, espaciado o sensación premium de la app.

## Principios

- No reescribir toda la interfaz si no es necesario.
- No cambiar lógica de negocio.
- No tocar backend salvo que el usuario lo pida explícitamente.
- Priorizar cambios pequeños y verificables.
- Respetar la estructura actual del proyecto.
- Mantener consistencia visual con Nebulosa: oscuro, técnico, sobrio, moderno.
- Evitar diseño genérico.
- Evitar saturar con brillos, sombras o colores excesivos.
- Preferir claridad, jerarquía y buen espaciado.

## Flujo de trabajo

Antes de modificar:

1. Revisar archivos relevantes.
2. Identificar el problema visual real.
3. Proponer un plan corto.
4. Tocar la menor cantidad de archivos posible.

Después de modificar:

1. Reportar archivos tocados.
2. Explicar qué cambió.
3. Explicar cómo probar.
4. Indicar riesgos.
5. Sugerir siguiente paso.

## Reglas para código

- En React/TypeScript, mantener nombres y estructura actuales.
- En CSS, preferir variables existentes si ya existen.
- No agregar dependencias.
- No meter librerías de iconos si se puede resolver con texto, símbolos o CSS.
- No mezclar cambios visuales con cambios funcionales grandes.
- Si una mejora requiere backend, separarla en otra fase.

## Checklist visual

Revisar siempre:

- Jerarquía visual.
- Tamaños de fuente.
- Contraste.
- Espaciado.
- Estados hover, active, disabled y selected.
- Bordes y sombras.
- Scrollbars.
- Responsive.
- Empty states.
- Accesibilidad básica.
- Consistencia entre panel izquierdo, grafo y panel derecho.

## Para NebulosaWikiApp

Priorizar:

- Grafo central como protagonista.
- Sidebar/ribbon limpia.
- Panel derecho legible.
- Markdown preview cómodo.
- Edición clara y segura.
- Controles visibles solo cuando aportan.
- Sensación tipo herramienta profesional, no demo.

Al finalizar ejecutá:
npx tsc --noEmit

Reportá solo:
- archivo creado
- resumen de la skill
- resultado de npx tsc --noEmit si aplica
