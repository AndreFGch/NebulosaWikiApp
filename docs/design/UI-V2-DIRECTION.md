# UI-V2-DIRECTION — NebulosaWikiApp

## Estado

Aprobado. Ancla de dirección para rediseño UX/UI V2 completo.  
Versión: 1.0 · 2026-06-05

---

## Objetivo

Definir la dirección de diseño UX/UI V2 antes de implementar código o iniciar CodeGraph.

Este documento reemplaza los roadmaps sueltos de `HOME-VISION.md` y `DESIGN.md` como guía de fases.  
`DESIGN.md` y `HOME-VISION.md` siguen siendo válidos como referencia visual y de vocabulario.  
Este documento los supersede en cuanto a **qué hacer, en qué orden y por qué**.

---

## Contexto

NebulosaWikiApp es una app local-first y portable para gestionar una wiki Markdown local.  
Tiene: WikiGraph real (Cytoscape.js), búsqueda full-text en Rust, editor/preview, notas, backlinks, import/export y backups.

**No es:** un asistente personal, una app de notas genérica, un clon de Obsidian ni una demo de diseño.

El problema: la app funciona, pero no tiene dirección visual consistente.  
Los cambios han sido CSS sueltos sin sistema. El resultado es incoherente.

**Decisión:** hacer rediseño UX/UI V2 completo, por fases, antes de seguir con CodeGraph.

---

## Decisión principal

> Rediseño UX/UI V2 completo antes de integrar CodeGraph.

Motivo: sin dirección visual sólida, cada feature nueva queda desconectada.  
CodeGraph necesita workspace real con tokens, densidad y layout definidos.  
Empezar por CodeGraph sobre base visual rota es deuda que no se puede pagar después.

---

## Referencia: prototipo Claude Design

Se usó un prototipo de Claude Design como referencia conceptual para evaluar dirección.

### Qué tomamos

- Pantalla welcome / vault landing con identidad fuerte
- Sensación de app desktop premium (no web app pegada a browser)
- Centro visual claro con jerarquía definida
- Sistema dark / light desde tokens, no parche de CSS
- Acento de color editable por el usuario
- Tipografía editable
- Densidad editable (cómoda / compacta)
- Panel de Apariencia / Tweaks configurable
- Command palette como centro de acciones secundarias
- Transiciones suaves entre pantallas (welcome → home → workspace)
- Personalización visual como parte central del producto, no como afterthought

### Qué no tomamos

- Color dorado/ámbar como identidad principal de Nebulosa
- Grafo decorativo gigante como si fuera el grafo real
- Mock de workspace que simule o reemplace Cytoscape / WikiGraph actual
- Datos inventados (palabras, backlinks, conteos) que no existen todavía
- Estilo demasiado "demo de diseño" desconectado de la app real
- Copia literal de Linear, Refero o Claude Design

---

## Concepto visual final

NebulosaWikiApp V2 debe sentirse como entrar a un **vault de conocimiento local**.

No es un dashboard. No es un panel de admin. No es una wiki genérica.  
Es un espacio de trabajo para conocimiento conectado, propio, portable y serio.

Sensación objetivo:

```
Local. Conectado. Tuyo. Serio sin ser frío. Elegante sin ser decorativo.
```

Palabras clave del producto:

```
vault · local-first · knowledge · graph · calm · dense · portable · premium · yours
```

---

## Principios visuales

**1. Vault como identidad.**  
El nombre de la wiki es el protagonista, no la ruta del sistema operativo.  
`NebulosaWikiGraphTest` es identidad. `D:\NebulosaWiki` es un dato de sistema.

**2. Jerarquía sobre decoración.**  
Una sola cosa importa más que otra en cada pantalla, siempre.  
El título supera al subtítulo. La acción primaria supera a la secundaria. El contenido supera al control.

**3. Tokens, no valores hardcodeados.**  
Ningún color visual va directo a un componente si puede ser token.  
Variables CSS en `:root` / `body` / `.nw-shell`. Separar tokens semánticos de valores concretos.

**4. Superficie mínima en primera vista.**  
Dos acciones principales visibles. El resto existe en command palette o zona secundaria.

**5. Números como señal ambiental, no KPI.**  
`342 notas · 1.2k conexiones · Salud OK` dice más que cinco cajas iguales.

**6. Dark-first.**  
Sistema de tokens limpio para dark. Light mode preparado como variante real, no parche encima.

**7. Grafo real, no decorativo.**  
El WikiGraph actual es la feature principal. No reemplazar con mock. No duplicar con decoración.

---

## Experiencia esperada por pantalla

### Welcome / Vault Landing

Pantalla de entrada al vault. Aparece al abrir la app o al elegir otro vault.

**Debe tener:**
- Identidad fuerte: nombre del vault, estado (OK / loading / error)
- CTA principal: Nueva nota
- CTA secundaria: Explorar grafo
- Knowledge pulse: `121 notas · 480 conexiones · Salud OK`
- Entrada a command palette: `Buscar o saltar a... Ctrl+K`
- Fondo visual sutil (CSS/SVG liviano inspirado en conocimiento conectado)

**No debe tener:**
- Grafo real de Cytoscape en esta pantalla (performance, scope)
- Datos inventados que no vengan del vault real
- Animaciones pesadas o efectos de carga innecesarios
- Más de dos CTAs primarias en superficie

**Boceto conceptual:**
```
Nebulosa Wiki
Tu conocimiento local, conectado y explorable.

Vault activo: NebulosaWikiGraphTest
121 notas · 480 conexiones · Salud OK

[ Nueva nota ]    [ Explorar grafo ]

[ Buscar o saltar a...              Ctrl+K ]
```

Fondo: CSS/SVG decorativo liviano. No reemplaza el grafo real.

---

### Home (funcional de conocimiento)

Pantalla principal después de welcome. Centro operativo del vault.

**Debe tener:**
- Vault identity (nombre + estado ambiental)
- Knowledge pulse (notas · conexiones · salud)
- Recientes como cards (3–5 notas, folder badge + título + señal de conexión)
- Accesos principales claros (Nueva nota, Explorar grafo)
- Estado de salud ambiental (broken links, huérfanas, stale index)
- Command palette visible o accesible

**No debe tener:**
- 5 KPI boxes con números del mismo peso visual
- 7 botones en fila sin jerarquía
- Tabla de recientes (`<ul>` plana)
- Panel de administración disfrazado de home
- Bento decorativo sin función
- Conteos o metadata que no venga de datos reales

Referencia: vocabulario de `HOME-VISION.md` — Vault, Pulse, Surface, Signal, Entry, Health.

---

### Workspace

Pantalla de trabajo principal. Editor, explorador y contexto.

**Debe tener:**
- Sidebar / rail mejorado con navegación clara
- Explorer de notas (árbol o lista filtrable)
- Área principal: editor Markdown, preview, o alternancia
- Panel derecho contextual (backlinks, wikilinks, metadata de nota)
- Tokens V2 aplicados consistentemente

**Mantener intacto:**
- Lógica existente de lectura/escritura de notas
- Handlers actuales
- Flujo local-first
- Búsqueda full-text existente

**Nota de riesgo:** Esta pantalla requiere sub-phasing. Ver V2.4 en roadmap.

---

### Graph

Vista del WikiGraph real. No reemplazar. Adaptar visualmente.

**Adaptar:**
- Fondo con tokens V2 (no fondo blanco ni color genérico)
- Nodos más premium: diferenciación por tipo, labels limpios
- Bordes y colores de nodos desde tokens semánticos
- Selección, hover y estado vecino mejorados
- Conservar modos global / local actuales

**No hacer:**
- Reemplazar Cytoscape por otra librería
- Agregar grafo decorativo adicional
- Cambiar lógica de WikiGraph

---

### Appearance / Tweaks

Panel de personalización visual. Accesible desde sidebar o settings.

**Configurable:**
- Tema: dark / light / system
- Color principal: **libre** (color picker completo, no 4 swatches fijos)
- Tipografía: seleccionable (Inter / system-ui / opciones futuras)
- Densidad: cómoda / compacta
- Motion / reduced motion: sí / no

**Comportamiento:**
- Cambios aplicados en tiempo real vía CSS variables en `:root`
- Preferencias persistidas en settings existentes o contrato nuevo de settings JSON
- No hardcodear valores en componentes

---

## Sistema de personalización

El usuario controla la experiencia visual. No es un feature opcional, es parte del concepto.

**Accent color libre:**  
El usuario elige cualquier color principal. No se limita a 4 opciones predefinidas.  
El sistema aplica ese color como token dinámico `--nw-accent` en `:root`.

**Implementación técnica probable (para fases futuras):**
- Guardar `{ theme, accentColor, fontFamily, density, reducedMotion }` en settings JSON
- Aplicar en `:root` o `.nw-shell` como variables CSS dinámicas desde React
- Tokens semánticos (`--nw-accent`, `--nw-surface`, `--nw-text-primary`) separados de valores concretos
- No mezclar tokens visuales con lógica de componentes

---

## Reglas del grafo

El WikiGraph actual de NebulosaWikiApp **se mantiene y no se reemplaza**.

Reglas no negociables:
- No reemplazar Cytoscape.js por otra librería sin microtarea específica y plan aprobado
- No insertar grafo decorativo que simule el grafo real
- No romper modos global / local actuales
- No cambiar `buildWikiGraph` ni la lógica de construcción del grafo
- La adaptación visual del grafo es una fase separada (V2.4) y solo afecta CSS / tokens de Cytoscape

---

## Relación con documentos existentes

| Documento | Rol | Estado |
|---|---|---|
| `DESIGN.md` | Sistema visual: paleta, tipografía, componentes, estados | Vigente como referencia visual |
| `HOME-VISION.md` | Concepto de home, vocabulario, anatomía, anti-patrones | Vigente como referencia de home |
| `UI-V2-DIRECTION.md` | Ancla de dirección y roadmap de fases | **Este documento. Supersede roadmaps anteriores.** |

Los roadmaps UI-02A–UI-04 de `HOME-VISION.md` quedan **supersedidos por el roadmap V2.x de este documento**.  
Las definiciones visuales y vocabulario de `HOME-VISION.md` siguen siendo válidos.

---

## Roadmap por fases

### UI-V2.0 — Congelar dirección visual
**Entregable:** Este documento.  
Decisión aprobada. Dirección visual definida. Anti-patrones registrados. Fases ordenadas.

---

### UI-V2.1 — Sistema de tokens real
**Prerequisito para todas las fases siguientes.**

Crear sistema CSS de tokens semánticos:
- `--nw-bg-primary`, `--nw-surface`, `--nw-surface-elevated`, `--nw-border-subtle`
- `--nw-text-primary`, `--nw-text-secondary`, `--nw-text-muted`
- `--nw-accent` (dinámico, desde settings)
- Variantes dark / light / system
- Variables de densidad: `--nw-spacing-base`, `--nw-font-size-base`
- Variable de acento libre: cualquier color válido como `--nw-accent`

Sin este paso, V2.2–V2.6 no tienen base consistente.

---

### UI-V2.2 — Pantalla Welcome / Vault Landing
Crear pantalla de entrada al vault.  
Boceto aprobado en sección "Welcome / Vault Landing".  
Fondo CSS/SVG liviano. Sin grafo real en esta pantalla.  
Datos reales del vault (notas, conexiones, salud).

---

### UI-V2.3 — Home funcional
Rediseñar home según anatomía de `HOME-VISION.md` + tokens V2.1.  
Recientes como cards. Knowledge pulse. Accesos principales.  
Eliminar KPI grid y fila de botones.

---

### UI-V2.4 — Workspace real
**Fase grande. Requiere sub-phasing antes de implementar.**

Sub-fases sugeridas (cada una es microtarea separada):
- V2.4a: Sidebar / rail
- V2.4b: Explorer de notas
- V2.4c: Editor / preview
- V2.4d: Panel derecho contextual
- V2.4e: Adaptación visual del WikiGraph (tokens, nodos, fondo)

**Riesgo:** App.tsx actual es monolito. Esta fase requiere separar componentes.  
Definir plan de descomposición antes de V2.4. No iniciar V2.4 sin ese plan aprobado.

---

### UI-V2.5 — Panel Apariencia
Implementar panel configurable.  
Color picker libre (no 4 swatches).  
Persistir en settings JSON.  
Aplicar en tiempo real vía CSS variables.

---

### UI-V2.6 — Pulido general
- Estados empty / loading / error en todas las pantallas
- Responsive básico (pantallas Windows medianas/grandes)
- Transiciones suaves entre pantallas
- Command palette completo
- Tooltips consistentes
- Revisión de consistencia de tokens en toda la app

---

## Anti-patrones prohibidos

**KPI grid uniforme.**  
Cinco cajas con números del mismo peso visual = panel de admin. Usar señal ambiental.

**Fila de botones sin jerarquía.**  
Siete botones igual de importantes = ninguno importa. Máximo dos CTAs en superficie.

**Tabla de recientes.**  
`<ul>` con filas = explorador de archivos. Recientes son cards de conocimiento, no entradas de log.

**Grafo decorativo.**  
No agregar visualización de grafo que no sea el WikiGraph real.

**Datos inventados.**  
No mostrar conteos, fechas, tags o backlinks que no vengan de datos reales del vault.

**Neón excesivo.**  
No gradientes cyan agresivos, no glows de color en toda la UI. Acento en lugares precisos.

**Dashboard gamer.**  
No glassmorphism innecesario, no scanlines, no esquinas decorativas. Nebulosa es preciso y calmo.

**Copiar Linear literal.**  
Inspiración es invisible al usuario. No tomar layout, iconos ni colores exactos de ninguna referencia.

**Hardcodear colores.**  
No `color: #4DE1FF` directo en componente. Usar tokens. Siempre.

**App.tsx monolito creciendo.**  
No agregar más pantallas a App.tsx sin plan de descomposición aprobado.

**4 acentos fijos.**  
El usuario elige cualquier color. No limitar a swatches predefinidos.

---

## Criterios de aceptación

Este documento cumple su función si:

- Cualquier microtarea UI-V2.x puede referenciarse aquí para tomar decisiones
- Si alguien propone un cambio que viola un anti-patrón, este documento lo detecta
- Está claro que Claude Design fue referencia conceptual, no plantilla
- Está claro que el grafo real actual se mantiene y no se reemplaza
- Está claro que el acento de color es libre, no limitado a opciones fijas
- El orden de fases es correcto: tokens antes de pantallas
- El riesgo de App.tsx monolito está documentado antes de llegar a V2.4

---

## Qué NO implementar todavía

- CodeGraph visual (requiere workspace V2 terminado primero)
- Dual Graph (requiere CodeGraph)
- Context Exporter (requiere ambos grafos)
- Preview de contenido de notas en cards (requiere reads adicionales, scope diferente)
- Light mode completo (esperar tokens V2.1)
- Animaciones complejas de página
- Refactor de App.tsx (esperar plan aprobado antes de V2.4)
- Nuevas dependencias de UI
- MCP, embeddings, base vectorial
- Edición de código desde grafo
