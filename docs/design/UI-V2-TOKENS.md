# UI-V2-TOKENS — NebulosaWikiApp

## Estado

Propuesto. Contrato de tokens semánticos para UI V2.  
Versión: 0.1 · 2026-06-05  
Prerrequisitos:
- `docs/design/UI-V2-DIRECTION.md`
- `docs/design/UI-V2-FRONTEND-ARCHITECTURE.md`
- `docs/design/UI-V2-APPMAP.md`

---

## Objetivo

Definir el contrato visual base de NebulosaWikiApp V2 antes de implementar Welcome, Home, Workspace o Appearance Panel.

Este documento NO implementa código.  
Este documento define nombres, roles, reglas y orden de migración para tokens visuales.

---

## Decisión principal

NebulosaWikiApp V2 debe usar tokens semánticos con prefijo `--nw-*`.

No se deben seguir agregando colores, sombras, radius o spacing hardcodeados sobre `App.css`.

El usuario debe poder personalizar:

- tema: dark / light / system
- color principal libre
- tipografía
- densidad
- motion / reduced motion

---

## Problema actual detectado en AppMap

`App.css` ya tiene variables globales, pero no forman un sistema V2 completo.

Variables actuales detectadas:

```css
--bg
--surface
--surface-hover
--surface-elevated
--border
--border-subtle
--accent
--accent-dim
--accent-cyan
--accent-emerald
--accent-amber
--accent-rose
--text
--text-muted
--text-dim
--badge-bg
--code-bg
--code-text
--ok
--error
```

Problemas:

- No tienen prefijo `--nw-*`.
- Mezclan rol visual con color específico.
- Hay dos RGB distintos usados como acento:
  - `rgba(124, 106, 247, ...)`
  - `rgba(139, 92, 246, ...)`
- Hay colores hex hardcodeados en Graph, Sidebar, Ribbon, Command Palette y Markdown.
- Hay spacing, radius y font-size repetidos sin tokens.
- La sección `/* v2 additions */` muestra que se ha agregado CSS encima sin sistema.

---

## Principios de tokens

### 1. Tokens semánticos

Usar nombres por rol, no por color.

Correcto:

```css
--nw-bg-primary
--nw-surface
--nw-text-primary
--nw-accent
--nw-border-subtle
```

Incorrecto:

```css
--purple
--cyan
--dark-card
--linear-green
```

### 2. Acento libre

`--nw-accent` debe poder venir de un color elegido por el usuario.

No limitar a 4 swatches fijos.

El sistema debe soportar cualquier color válido:

```json
{
  "accentColor": "#6ea46f"
}
```

### 3. Derivados del acento

Las variantes alpha no deben usar RGB hardcodeado.

Objetivo futuro:

```css
--nw-accent-rgb: 110 164 111;
--nw-accent-alpha-08: rgb(var(--nw-accent-rgb) / 0.08);
--nw-accent-alpha-12: rgb(var(--nw-accent-rgb) / 0.12);
--nw-accent-alpha-20: rgb(var(--nw-accent-rgb) / 0.20);
```

### 4. Dark-first, light-ready

Dark mode es base principal.  
Light mode debe existir como variante real, no como parche.

### 5. Tokens antes de rediseño visual

No implementar Welcome, Home o Workspace V2 antes de tener tokens mínimos.

---

## Contrato de settings visuales

Estructura sugerida:

```ts
export type ThemeMode = "dark" | "light" | "system";
export type DensityMode = "comfortable" | "compact";
export type MotionMode = "default" | "reduced";

export interface ThemeSettings {
  theme: ThemeMode;
  accentColor: string;
  fontFamily: string;
  density: DensityMode;
  motion: MotionMode;
}
```

JSON esperado:

```json
{
  "theme": "dark",
  "accentColor": "#6ea46f",
  "fontFamily": "system",
  "density": "comfortable",
  "motion": "default"
}
```

---

## Tokens base

### Background

| Token V2 | Rol | Dark inicial | Light inicial |
|---|---|---|---|
| `--nw-bg-primary` | Fondo general app | `#090908` | `#f7f5f0` |
| `--nw-bg-secondary` | Fondo secundario | `#0f100e` | `#efede7` |
| `--nw-bg-inset` | Fondo hundido / input | `#080806` | `#e7e3da` |

### Surfaces

| Token V2 | Rol | Dark inicial | Light inicial |
|---|---|---|---|
| `--nw-surface` | Panel normal | `#12130f` | `#ffffff` |
| `--nw-surface-hover` | Hover de surface | `#191b15` | `#f4f1ea` |
| `--nw-surface-elevated` | Modal, popover, toast | `#181a14` | `#ffffff` |
| `--nw-surface-subtle` | Card suave | `#10110d` | `#faf8f3` |

### Borders

| Token V2 | Rol | Dark inicial | Light inicial |
|---|---|---|---|
| `--nw-border` | Borde estándar | `#2b2d25` | `#ded8cc` |
| `--nw-border-subtle` | Borde sutil | `#202219` | `#ebe6dc` |
| `--nw-border-strong` | Borde destacado | `#3b3e32` | `#cfc7b9` |

### Text

| Token V2 | Rol | Dark inicial | Light inicial |
|---|---|---|---|
| `--nw-text-primary` | Texto principal | `#f2f0e8` | `#171814` |
| `--nw-text-secondary` | Texto secundario | `#b8b3a7` | `#555044` |
| `--nw-text-muted` | Texto apagado | `#7d776a` | `#8b8375` |
| `--nw-text-disabled` | Texto deshabilitado | `#555044` | `#b5ada0` |

### Accent

| Token V2 | Rol | Valor inicial |
|---|---|---|
| `--nw-accent` | Color principal dinámico | `#6ea46f` |
| `--nw-accent-rgb` | RGB dinámico para alpha | `110 164 111` |
| `--nw-accent-contrast` | Texto sobre acento | `#061007` |
| `--nw-accent-soft` | Surface con acento suave | `rgb(var(--nw-accent-rgb) / 0.10)` |
| `--nw-accent-border` | Borde con acento | `rgb(var(--nw-accent-rgb) / 0.22)` |

### States

| Token V2 | Rol | Dark inicial | Light inicial |
|---|---|---|---|
| `--nw-success` | OK / éxito | `#7ccf8a` | `#2f7d3f` |
| `--nw-warning` | Warning | `#d8b35e` | `#9a6b17` |
| `--nw-error` | Error | `#e06c75` | `#b8333a` |
| `--nw-info` | Información | `#7aa2f7` | `#2e5aac` |

### Radius

| Token V2 | Valor | Uso |
|---|---|---|
| `--nw-radius-xs` | `4px` | badges pequeños |
| `--nw-radius-sm` | `6px` | chips, buttons pequeños |
| `--nw-radius-md` | `8px` | buttons, inputs |
| `--nw-radius-lg` | `12px` | cards |
| `--nw-radius-xl` | `16px` | panels grandes |
| `--nw-radius-pill` | `999px` | pills |

### Spacing

| Token V2 | Comfortable | Compact |
|---|---|---|
| `--nw-space-1` | `4px` | `3px` |
| `--nw-space-2` | `8px` | `6px` |
| `--nw-space-3` | `12px` | `10px` |
| `--nw-space-4` | `16px` | `12px` |
| `--nw-space-5` | `20px` | `16px` |
| `--nw-space-6` | `24px` | `20px` |
| `--nw-space-8` | `32px` | `24px` |

### Typography

| Token V2 | Valor inicial | Uso |
|---|---|---|
| `--nw-font-sans` | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | UI general |
| `--nw-font-mono` | `"Cascadia Code", "Fira Code", "Consolas", monospace` | paths, code, metadata |
| `--nw-font-size-xs` | `0.68rem` | micro labels |
| `--nw-font-size-sm` | `0.75rem` | labels, badges |
| `--nw-font-size-md` | `0.84rem` | UI base |
| `--nw-font-size-lg` | `0.95rem` | body destacado |
| `--nw-font-size-xl` | `1.2rem` | titles secundarios |
| `--nw-font-size-hero` | `2.25rem` | welcome title |

### Shadows

| Token V2 | Uso | Valor inicial |
|---|---|---|
| `--nw-shadow-soft` | cards sutiles | `0 10px 30px rgb(0 0 0 / 0.18)` |
| `--nw-shadow-elevated` | popover/modal | `0 18px 60px rgb(0 0 0 / 0.35)` |
| `--nw-shadow-focus` | focus ring | `0 0 0 3px rgb(var(--nw-accent-rgb) / 0.18)` |

### Motion

| Token V2 | Default | Reduced |
|---|---|---|
| `--nw-motion-fast` | `120ms` | `0ms` |
| `--nw-motion-base` | `180ms` | `0ms` |
| `--nw-motion-slow` | `260ms` | `0ms` |
| `--nw-ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | `linear` |

---

## Mapeo desde variables actuales

| Actual | Token V2 |
|---|---|
| `--bg` | `--nw-bg-primary` |
| `--surface` | `--nw-surface` |
| `--surface-hover` | `--nw-surface-hover` |
| `--surface-elevated` | `--nw-surface-elevated` |
| `--border` | `--nw-border` |
| `--border-subtle` | `--nw-border-subtle` |
| `--accent` | `--nw-accent` |
| `--accent-dim` | derivado de `--nw-accent` |
| `--accent-cyan` | eliminar o renombrar solo si se justifica como `--nw-info` |
| `--accent-emerald` | `--nw-success` |
| `--accent-amber` | `--nw-warning` |
| `--accent-rose` | `--nw-error` o `--nw-danger-soft` |
| `--text` | `--nw-text-primary` |
| `--text-muted` | `--nw-text-secondary` |
| `--text-dim` | `--nw-text-muted` |
| `--badge-bg` | `--nw-bg-inset` |
| `--code-bg` | `--nw-bg-inset` o `--nw-editor-bg` |
| `--code-text` | `--nw-editor-text` |
| `--ok` | `--nw-success` |
| `--error` | `--nw-error` |

---

## Reglas para implementación futura

### Permitido

- Crear `src/ui/theme/tokens.css`.
- Importar tokens desde `main.tsx` o `App.tsx` en fase controlada.
- Mantener variables antiguas temporalmente como alias.
- Reemplazar hardcoded colors por tokens gradualmente.
- Usar CSS variables dinámicas para `--nw-accent`.

### Prohibido

- Rediseñar Welcome/Home antes de tokens mínimos.
- Usar nuevos colores hex directamente en componentes.
- Crear 4 swatches fijos como única personalización.
- Convertir tokens en clases utilitarias tipo Tailwind manual.
- Cambiar lógica de App.tsx durante migración de tokens.
- Tocar Cytoscape lifecycle mientras se implementan tokens base.

---

## Estrategia de migración

### Paso 1 — Documento actual

Definir contrato de tokens.

### Paso 2 — Implementar tokens.css mínimo

Crear:

```txt
src/ui/theme/tokens.css
```

Con:

- dark theme
- light theme
- accent base
- typography
- spacing
- radius
- shadows
- motion

### Paso 3 — Alias temporales

Mantener compatibilidad con CSS viejo:

```css
:root {
  --bg: var(--nw-bg-primary);
  --surface: var(--nw-surface);
  --text: var(--nw-text-primary);
  --accent: var(--nw-accent);
}
```

### Paso 4 — Reemplazo progresivo

Migrar secciones por orden:

1. shell/layout
2. sidebar/ribbon
3. home
4. command palette/toasts
5. editor/preview
6. graph visual tokens
7. modales

### Paso 5 — Eliminar alias viejos

Solo cuando App.css ya no use variables antiguas.

---

## Orden recomendado después de este documento

1. `UI-V2.1A` — Crear `src/ui/theme/tokens.css` con alias temporales
2. `ARCH-03` — Extraer tipos a `src/types`
3. `UI-V2.1B` — Aplicar tokens mínimos a shell/layout sin rediseño
4. `UI-V2.1C` — Agregar contrato TS para theme settings
5. `UI-V2.2` — Welcome / Vault Landing

---

## Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Acento libre no genera buenas variantes alpha | Alta | Usar `--nw-accent-rgb` junto con `--nw-accent` |
| Light mode queda como parche | Alta | Definir tokens light desde el inicio |
| CSS viejo sigue creciendo | Alta | No más `v2 additions`; todo nuevo debe usar tokens |
| Alias viejos se quedan para siempre | Media | Crear fase explícita para eliminarlos |
| Tokens demasiado genéricos | Media | Usar roles reales de Nebulosa: vault, graph, editor, surface |
| Implementar tokens y rediseño juntos | Alta | Separar: tokens primero, diseño después |

---

## Criterios de aceptación

Este documento cumple si:

- Define nombres de tokens V2 con prefijo `--nw-*`.
- Resuelve el problema de dos RGB diferentes para acento.
- Permite color principal libre elegido por usuario.
- Incluye dark y light desde el inicio.
- Define spacing, radius, typography, shadows y motion.
- Da una estrategia de alias temporal para no romper App.css.
- Permite implementar tokens sin cambiar lógica.
- Deja claro que Welcome/Home vienen después.

---

## Qué NO implementar todavía

- Welcome / Vault Landing
- Home V2
- Appearance Panel funcional
- Persistencia real de settings
- Color picker
- Migración completa de App.css
- Grafo visual V2
- Light mode perfecto
- Eliminación de alias antiguos
