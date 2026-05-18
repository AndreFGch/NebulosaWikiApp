# graph-first-architect

Guiar decisiones de arquitectura visual del grafo de Nebulosa Wiki.

Invocar con: `/graph-first-architect`

---

## Propósito

Evitar decisiones visuales que contradigan la arquitectura central del proyecto. El grafo es la vista principal, no un accesorio. Esta skill actúa como árbitro cuando hay decisiones de diseño o estructura en tensión.

---

## Principios inamovibles

### 1. El grafo es la vista principal

El grafo no es un tab adicional ni una vista secundaria. Es el punto de entrada al conocimiento de la wiki. El usuario debe ver el grafo primero y navegar desde ahí.

**Viola este principio si:**
- El grafo está detrás de un botón o tab al mismo nivel que Preview/Raw
- El grafo ocupa menos espacio visual que el panel de texto por defecto
- Se abre la app y no hay grafo visible

### 2. Markdown es panel de detalle

El contenido de una nota es el detalle de un nodo seleccionado. No es la vista principal. Aparece cuando el usuario hace clic en un nodo.

**Viola este principio si:**
- La lista de notas tiene más peso visual que el grafo
- El panel de texto empuja al grafo hacia un lado

### 3. Modelo de datos antes que UI

No tunear colores, tamaños ni layouts si el problema es que los datos del grafo son incorrectos. Primero corregir `buildWikiGraph`, luego mejorar la presentación.

**Orden correcto:**
1. `WikiNode`, `WikiEdge`, `WikiGraph` correctos
2. Resolución de wikilinks limpia
3. Conteos precisos (backlinks, orphans, broken)
4. Luego: layout, colores, interacciones

### 4. No copiar Obsidian exacto

Obsidian es referencia, no plantilla. Copiar su layout pixel a pixel no es el objetivo. Nebulosa Wiki tiene identidad propia:
- Paleta oscura nebular (púrpura, azul profundo, fondo casi negro)
- Tipografía Inter + monospace para paths
- Nodos diferenciados por carpeta y estado
- Sin plugins, sin settings complejos — interfaz directa

### 5. CSS no resuelve arquitectura

Si el grafo se ve mal porque está en el lugar equivocado → mover el componente, no tunear márgenes. Si los nodos no comunican su estado → cambiar el modelo de datos, no solo el color.

---

## Checklist antes de proponer cambios visuales

Responder estas preguntas antes de sugerir cualquier cambio de UI al grafo:

1. ¿El problema es de datos o de presentación?
2. ¿El grafo ocupa el lugar principal en el layout?
3. ¿Los nodos reflejan correctamente `exists`, `isOrphan`, `nodeType`?
4. ¿Los edges reflejan correctamente `isBroken`?
5. ¿El cambio propuesto crea identidad Nebulosa o copia Obsidian?
6. ¿Se toca `buildWikiGraph` o solo el render de Cytoscape?

---

## Decisiones ya tomadas

No reabrir sin razón sólida:

| Decisión | Razón |
|---|---|
| Cytoscape.js para el grafo | Ya integrado, funciona, buen API |
| Layout `cose` como default | Agrupa nodos relacionados naturalmente |
| `WikiGraph` como modelo central | Permite orphans, broken links, tags, folders |
| `normalizeKey` para resolución | Maneja tildes, guiones, variantes de mayúscula |
| Nodos virtuales `exists=false` para links rotos | Visualiza deuda de conocimiento sin romper la app |

---

## Output esperado al invocar

Responder con:

### Evaluación de la propuesta
Si hay una propuesta de cambio: ¿cumple los principios? ¿viola alguno?

### Recomendación de arquitectura
Qué cambiar primero, qué diferir, qué no hacer.

### Próximo paso concreto
Un solo cambio específico para avanzar en la dirección correcta.

---

## Reglas

- No proponer cambios que rompan la primacía del grafo.
- No tunear CSS si el problema es estructura de componentes.
- No agregar dependencias para resolver problemas de diseño.
- No rediseñar todo de una sola vez — un cambio significativo a la vez.
