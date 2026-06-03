# Roadmap — NebulosaWikiApp

## Estado actual

NebulosaWikiApp se encuentra en una etapa post-release estable después de la publicación de la versión `v0.1.1`.

Estado confirmado:

- `v0.1.1` publicada.
- Wiki Markdown portable.
- Grafo Global/Local.
- Búsqueda con normalización de acentos.
- Selectores nativos.
- CSP configurada.
- Tests Rust básicos.
- Release portable validado.

La prioridad inmediata es proteger la estabilidad del release publicado y evitar cambios grandes sin una etapa previa de documentación, diseño y validación.

## Visión general

NebulosaWikiApp es la primera pieza del ecosistema Nebulosa.

Su rol inicial es funcionar como una base local-first para conocimiento personal y técnico mediante archivos Markdown, permitiendo construir una memoria explorable, portable y mantenible.

En esta etapa, NebulosaWikiApp representa principalmente:

- Knowledge Graph.
- Wiki local-first.
- Memoria Markdown.
- Base para contexto persistente.
- Exploración visual de notas, relaciones, tags y backlinks.
- Fundamento para flujos futuros asistidos por Claude/agentes.

La visión de Nebulosa no se limita a una wiki. La wiki es la primera capa estable sobre la que se puede construir un ecosistema más amplio de grafos conectados, orientado a conocimiento, código, documentación, sesiones de trabajo y contexto técnico reutilizable.

## Evolución del ecosistema

Nebulosa puede evolucionar hacia un ecosistema compuesto por varios módulos conectados, cada uno con responsabilidades claras.

Módulos posibles:

- Nebulosa Wiki / Knowledge Graph.
- Nebulosa CodeGraph / Project Graph.
- Nebulosa Context Exporter para Claude/agentes.
- Nebulosa Local Index para búsqueda e indexación.
- Nebulosa Project Memory para conectar código con documentación.

La idea central es que Nebulosa pueda representar conocimiento y proyectos como grafos navegables. Esto permitiría entender relaciones entre notas, código, decisiones, sesiones, documentación y reglas de negocio sin depender de una nube obligatoria ni de herramientas externas como requisito principal.

## v0.1.x — Estabilidad post-release

Objetivo: mantener estable el release publicado y mejorar la higiene del proyecto sin introducir cambios riesgosos.

Alcance:

- Mantener ZIP portable limpio.
- Documentar proceso manual de release.
- Mejorar documentación pública.
- Confirmar release hygiene.
- Preparar CI mínimo.
- Evitar refactors grandes inmediatamente después del release.
- Evitar cambios en el flujo de distribución sin validación previa.

Esta fase debe enfocarse en documentación, validaciones pequeñas y preparación del proyecto para crecer de forma segura.

## v0.2 — Calidad, búsqueda e índice

Objetivo: fortalecer la base técnica de NebulosaWikiApp antes de crecer hacia módulos más grandes.

Alcance propuesto:

- CI mínimo con TypeScript y Rust.
- Índice local de búsqueda.
- Operadores de búsqueda.
- Backup ZIP.
- File watcher opcional.
- Mejoras controladas del grafo.
- Preparar split parcial de `App.tsx` después de CI.

Esta versión debe mejorar confiabilidad, búsqueda y mantenibilidad sin cambiar la naturaleza portable y local-first de la aplicación.

## v0.3 — Arquitectura interna

Objetivo: reducir la complejidad interna y preparar la aplicación para crecimiento sostenido.

Alcance propuesto:

- Separar `App.tsx` por fases.
- Extraer componentes visuales.
- Extraer hooks reutilizables.
- Extraer lógica de búsqueda/grafo.
- Evaluar mover `buildWikiGraph` a Rust.
- Agregar E2E después de CI estable.

Esta etapa debe tratarse como refactor controlado. No debe mezclarse con features grandes ni con cambios de release.

## v2 — Nebulosa CodeGraph / Project Graph

Objetivo: crear una evolución futura de Nebulosa orientada a proyectos de código.

Nebulosa CodeGraph / Project Graph permitiría analizar proyectos de software y generar grafos navegables de su estructura interna.

El objetivo no es solo visualizar archivos. El objetivo es ayudar al usuario, a Claude y a otros agentes a explorar proyectos grandes sin leer todo el repositorio innecesariamente.

El módulo debería poder representar:

- Proyectos de código.
- Carpetas.
- Archivos.
- Clases.
- Interfaces.
- Métodos.
- Funciones.
- Stored Procedures.
- Tablas SQL.
- Imports/usings.
- Dependencias.
- Relaciones entre módulos.
- Rutas de ejecución.
- Puntos de entrada.

También debería permitir una vista global y local del proyecto, diferenciar nodos por tipo, mostrar un panel de detalle por nodo y, eventualmente, permitir edición controlada bajo reglas de seguridad.

Ejemplo de uso futuro:

> Usuario: “Quiero entender cómo funciona el pago BCR”.

Nebulosa CodeGraph debería poder:

- Detectar archivos relacionados.
- Detectar clases relacionadas.
- Detectar Stored Procedures relacionados.
- Mostrar un subgrafo.
- Sugerir qué leer primero.
- Exportar contexto reducido para Claude.
- Evitar que Claude lea todo el proyecto innecesariamente.

Esta visión debe diseñarse antes de implementarse. No debe mezclarse directamente en NebulosaWikiApp sin un diseño previo.

## Tipos de nodos futuros

Tipos de nodos que podrían existir en el ecosistema Nebulosa:

- `Project`
- `Folder`
- `File`
- `Namespace`
- `Class`
- `Interface`
- `Method`
- `Property`
- `Component`
- `Route`
- `StoredProcedure`
- `Table`
- `Config`
- `MarkdownNote`
- `ADR`
- `Session`

Estos nodos permitirían representar tanto conocimiento Markdown como estructura real de proyectos de software.

## Tipos de relaciones futuras

Tipos de relaciones posibles:

- `contains`
- `imports`
- `uses`
- `calls`
- `reads`
- `writes`
- `depends_on`
- `implements`
- `extends`
- `documents`
- `references`
- `generated_from`
- `related_to`

Estas relaciones permitirían conectar elementos técnicos, documentación, decisiones y sesiones de trabajo.

## Integración Wiki + CodeGraph

Nebulosa debería permitir que el Knowledge Graph y el CodeGraph convivan y se conecten entre sí.

Escenarios esperados:

- El usuario puede ver el grafo de la wiki.
- El usuario puede ver el grafo del proyecto.
- El usuario puede ver relaciones cruzadas entre notas y código.
- Una nota puede documentar una clase.
- Un ADR puede justificar una decisión de código.
- Una sesión puede explicar cambios en archivos.
- Un Stored Procedure puede conectarse con reglas de negocio documentadas.

Ejemplos:

- Una nota Markdown sobre `Pago BCR` puede relacionarse con una clase `PagoBCRService`.
- Un ADR puede relacionarse con archivos modificados por una decisión técnica.
- Una sesión de trabajo puede relacionarse con cambios en un módulo.
- Un Stored Procedure puede conectarse con una nota de negocio.
- Un proyecto puede tener su propio grafo y también convivir con la wiki.

La integración debe mantener separadas las responsabilidades: la wiki gestiona conocimiento Markdown; CodeGraph analiza estructura de proyectos; las relaciones cruzadas conectan ambos mundos.

## Ayuda para Claude/agentes

El objetivo de Nebulosa no es solo visual.

La meta estratégica es que Nebulosa pueda funcionar como mapa semántico y estructural del proyecto para reducir contexto innecesario y mejorar la calidad de las respuestas de Claude/agentes.

Capacidades futuras:

- Exportar subgrafo local.
- Exportar contexto reducido.
- Sugerir ruta de lectura.
- Priorizar archivos relevantes.
- Reducir tokens.
- Evitar lectura completa del repositorio.
- Servir como mapa semántico del proyecto.

Ejemplo:

Si el usuario pide entender una funcionalidad específica, Nebulosa debería ayudar a identificar primero:

- Archivos principales.
- Clases relacionadas.
- Dependencias directas.
- Stored Procedures relacionados.
- Notas de negocio relevantes.
- ADRs asociados.
- Sesiones previas sobre el tema.

Con esto, Claude podría leer primero el contexto correcto en lugar de recorrer todo el repositorio.

## Fuera de alcance por ahora

No forma parte del alcance inmediato:

- No implementar CodeGraph todavía.
- No editar código desde grafo todavía.
- No agregar dependencias nuevas.
- No refactor grande de `App.tsx` todavía.
- No mover `buildWikiGraph` a Rust sin diseño.
- No E2E antes de CI.
- No firma digital por ahora.
- No mezclar CodeGraph directamente dentro de NebulosaWikiApp sin ADR.
- No cambiar el release portable recién publicado.
- No tocar la estructura de distribución actual sin validación.

## Principios

Principios del ecosistema Nebulosa:

- Local-first.
- Portable.
- Sin nube obligatoria.
- Markdown como fuente de conocimiento.
- Código como grafo explorable.
- Seguridad antes de escritura.
- Cambios pequeños y validados.
- Primero documentación y diseño, luego implementación.
- Separar visión, arquitectura e implementación.
- Evitar dependencias innecesarias.
- Mantener el release estable antes de crecer.

## Próximas microtareas sugeridas

Siguientes microtareas recomendadas:

- `POST-REL-02` — Documentar proceso manual de release.
- `CI-01` — Crear GitHub Actions mínimo.
- `ROADMAP-02` — Crear ADR de Nebulosa CodeGraph.
- `DESIGN-01` — Diseñar tipos de nodos y relaciones.
- `PROTO-01` — Prototipo solo lectura de Project Graph.

Orden sugerido:

1. Documentar release manual.
2. Crear CI mínimo.
3. Crear ADR de CodeGraph.
4. Diseñar modelo de nodos y relaciones.
5. Prototipar Project Graph solo lectura.
