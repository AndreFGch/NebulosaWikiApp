# Home Vision — NebulosaWikiApp

## Estado

Documento de diseño. No implementa código. No define componentes finales.  
Sirve como ancla visual para la serie de microtareas UI-02.  
Complementa [`DESIGN.md`](./DESIGN.md), que define el sistema visual global.

---

## Concepto

> Nebulosa Wiki es un punto de entrada elegante para explorar una wiki local viva.  
> No es un panel administrativo con números y botones.

---

## Problema actual

La home funciona, pero comunica las cosas equivocadas:

- **5 KPI idénticos en fila** — admin panel, no wiki product; los números no tienen jerarquía ni contexto
- **7 botones planos en fila** — toolbar de settings, no entrada a un workspace; el usuario escanea opciones en lugar de navegar conocimiento
- **Recientes como `<ul>` plana** — explorador de archivos disfrazado; cero peso visual, cero invitación
- **Path técnico en el hero** — `D:\NebulosaWiki` como texto principal = dato de sistema, no identidad
- **Sin narrativa visual** — la home informa, no invita; no se siente como producto

---

## Principios visuales

**Local-first visible.**  
La wiki existe en tu máquina. Eso es una fortaleza, no un detalle técnico. El vault debe ser identidad, no ruta de archivo.

**Calma visual.**  
Sin colores agresivos. Sin neón. Sin sombras de cajón de herramientas. El espaciado respira. El foco es nítido.

**Jerarquía fuerte.**  
Una cosa importa más que otra. Siempre. El título > el subtítulo. La acción primaria > la secundaria. El conocimiento > el control.

**Menos botones en superficie.**  
Dos acciones principales visibles. El resto existe, pero no compite. Command palette o zona secundaria.

**Números como señales, no como dashboard.**  
Un número relevante dice más que cinco números iguales. "342 notas · 1.2k conexiones" es una señal. Cinco cajas con labels son un panel de admin.

**Superficies amplias.**  
Cards con respiro. Padding generoso. No llenar cada pixel de información.

**Cards útiles, no decoración.**  
Cada card tiene un propósito: mostrar una señal real, habilitar una acción, representar contenido vivo. Sin bento decorativo.

**Dark mode elegante primero.**  
Sistema de tokens limpio. Light mode preparado después, no parchado encima.

---

## Inspiración conceptual

### Qué tomamos de Linear

- Tipografía limpia con jerarquía clara y letter-spacing ajustado
- Sidebar funcional sin ruido decorativo
- Acciones secundarias fuera de la superficie principal
- Estado de la app comunicado de forma ambiental, no como alerta
- Sensación de producto construido con intención

### Qué tomamos de Refero

- Documentar referencias visuales antes de implementar
- Identificar el vocabulario del producto antes de diseñar componentes
- Distinción entre ornamento y estructura

### Qué debe ser propio de Nebulosa

- El vault como identidad: nombre de carpeta, no ruta de sistema
- El WikiGraph como superficie de conocimiento, no como diagrama técnico
- La salud de la wiki como señal ambiental, no como panel de errores
- Las notas como objetos conectados, no como archivos en un explorador

### Qué no se debe copiar

- El layout exacto de Linear (sidebar + main + detalle)
- El sistema de iconos de Linear
- La paleta literal de cualquier referencia
- Cualquier cosa que haga que Nebulosa "parezca" otro producto

---

## Vocabulario visual de Nebulosa

| Término | Qué representa |
|---|---|
| **Vault** | La wiki activa: su nombre, su estado, su identidad. No es una ruta. |
| **Pulse** | Una señal ambiental del estado de la wiki: notas, conexiones, salud. No son KPIs. |
| **Surface** | Una zona visual donde el conocimiento se vuelve navegable. Recientes, notas destacadas. |
| **Signal** | Un indicador útil: broken links, huérfanas, última nota. Ambiental, no alarma. |
| **Entry** | La acción de entrar al workspace: nueva nota, explorar grafo. Solo dos. |
| **Graph** | El WikiGraph: representación visual de conexiones reales entre notas. |
| **Context** | La nota seleccionada, sus backlinks, sus relaciones. El panel derecho. |
| **Health** | El estado de integridad de la wiki: enlaces rotos, nodos sin conectar. |

---

## Anatomía propuesta de la home

```
┌─────────────────────────────────────────────┐
│  IDENTITY ZONE                              │
│  Vault pill (nombre + estado) + wordmark    │
│  Subtítulo claro                            │
├─────────────────────────────────────────────┤
│  ENTRY ZONE                                 │
│  CTA primaria: Nueva nota                   │
│  CTA secundaria: Explorar grafo             │
├─────────────────────────────────────────────┤
│  KNOWLEDGE PULSE                            │
│  Una línea: notas · conexiones · salud      │
│  Ambiental, no dashboard                    │
├─────────────────────────────────────────────┤
│  KNOWLEDGE SURFACE                          │
│  Recientes como cards premium               │
│  3–5 notas, folder badge + título           │
├─────────────────────────────────────────────┤
│  NAVIGATION CARDS  (fase posterior)         │
│  Explorar grafo · Salud · Búsqueda          │
├─────────────────────────────────────────────┤
│  SECONDARY ACTIONS  (zona baja o colapsada) │
│  Import · Export · Backup · Recargar        │
└─────────────────────────────────────────────┘
```

Cada zona tiene una sola responsabilidad. Ninguna compite con la que está encima.

---

## Estados de la home

### `connected`

Estado normal. Vault activo con notas cargadas.  
Identity zone: dot verde + nombre de carpeta.  
Entry zone: botones activos.  
Pulse: datos reales.  
Surface: recientes reales.

### `loading`

Wiki cargando. No mostrar datos vacíos ni errores prematuros.  
Identity zone: dot pulsante + "Cargando…".  
Pulse: skeleton muted.  
Surface: skeleton de cards.

### `empty`

Wiki configurada pero sin notas.  
Identity zone: dot ámbar + nombre de carpeta.  
Entry zone: "Crear primera nota" como CTA destacada.  
Pulse: "Sin notas todavía".  
Surface: mensaje de bienvenida, no error.

### `error`

No se pudo cargar la wiki.  
Identity zone: dot rojo + nombre de carpeta (o "Error").  
Entry zone: "Abrir ajustes" como única acción.  
Pulse y surface: ocultos.  
Mensaje: claro y sin stack trace en la UI.

---

## Botones visibles en superficie

- **Nueva nota** — primary filled, siempre visible
- **Explorar grafo** — secondary ghost, siempre visible

Nada más compite con estas dos acciones en la home.

---

## Acciones secundarias

Estas acciones existen pero no pertenecen a la surface principal:

- Importar Markdown
- Exportar wiki
- Exportar nota actual
- Backup de wiki
- Recargar wiki
- Nota rápida
- Nota diaria

Destino apropiado: ribbon lateral, command palette (`Ctrl+P`), o zona colapsable al pie de la home.

---

## Anti-patrones prohibidos

**KPI grid.**  
Cinco cajas con números idénticos sin jerarquía no son información, son ruido. Reemplazar siempre por una señal ambiental.

**Fila larga de botones.**  
Siete botones del mismo peso visual anulan la jerarquía. Si todo es igual de importante, nada importa.

**Tabla de recientes.**  
`<ul>` con border-bottom entre filas = explorador de archivos. Las notas recientes son objetos de conocimiento, no entradas de un log.

**Neón excesivo.**  
Gradientes cyan, glows azules, sombras de color agresivo. Permite el acento en lugares precisos, no como decoración.

**Dashboard gamer.**  
Fondo con grid, efectos de scanline, esquinas decorativas, glassmorphism innecesario. Nebulosa es calmado y preciso.

**Bento decorativo sin función.**  
Cards que solo tienen un ícono y un label sin señal real, sin acción útil, sin contenido vivo. Cada card debe justificar su existencia.

**Copiar Linear literal.**  
Tomar el layout, los iconos, los colores exactos, el header idéntico. La inspiración debe ser invisible al usuario final.

**Inventar metadata.**  
No mostrar fechas que no existen, tags que no están en frontmatter, previews de contenido sin read real, conteos que no corresponden a datos reales.

**Meter CodeGraph antes del diseño.**  
CodeGraph visual requiere diseño propio. No insertar visualizaciones de código en la wiki home sin una microtarea específica aprobada.

---

## Roadmap visual

| ID | Tarea | Alcance |
|---|---|---|
| UI-02A | Home Vision Document | Este documento |
| UI-02B | Hero + vault identity + reducción inicial de acciones | `App.tsx`, `App.css` |
| UI-02C | Knowledge pulse (reemplaza KPI grid) | `App.tsx`, `App.css` |
| UI-02D | Knowledge surface (recientes como cards premium) | `App.tsx`, `App.css` |
| UI-02E | Navigation cards (explorar grafo, salud, búsqueda) | `App.tsx`, `App.css` |
| UI-02F | Responsive polish | `App.css` |
| UI-02G | Tokens dark/light como sistema | `App.css` |
| UI-03 | WikiGraph visual polish | `App.tsx`, `App.css` |
| UI-04 | Detail panel y relationship UX | `App.tsx`, `App.css` |

Cada microtarea toca máximo 2 archivos. Ninguna rompe lógica existente. Cada una es reversible.

---

## Qué NO implementar todavía

- Cytoscape live en home (performance, scope creep)
- Preview de contenido de notas en cards (requiere reads adicionales)
- Tags surface en home (no hay diseño para eso todavía)
- Light mode completo (esperar tokens UI-02G)
- Animaciones complejas o transiciones de página
- CodeGraph visual
- Dual Graph
- Context Exporter
- Refactor grande de `App.tsx` (separar en componentes)
- Nuevas dependencias

---

## Criterios de aceptación de este documento

- Cualquier microtarea UI-02 puede referenciarse en este documento para tomar decisiones de diseño.
- Si alguien propone un cambio que viola un anti-patrón de esta lista, este documento lo detecta.
- Cada zona de la anatomía tiene responsabilidad única: si una propuesta mezcla zonas, este documento lo señala.
- Los estados loading/empty/error/connected tienen tratamiento definido: ninguna implementación debería improvisar.
- El vocabulario visual es consistente: "vault" no se llama "wiki root" en la UI, "pulse" no se llama "stats".
