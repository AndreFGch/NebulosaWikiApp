import type { WikiGraph, GraphHealth } from "../types";

export function getGraphHealth(wikiGraph: WikiGraph | null): GraphHealth {
  if (!wikiGraph) {
    return {
      tone: "pending",
      headline: "Evaluando salud de la wiki…",
      actionNote: null,
      connections: 0,
      brokenCount: 0,
      orphanCount: 0,
    };
  }
  const brokenCount = wikiGraph.brokenLinks.length;
  const orphanCount = wikiGraph.orphanNodes.length;
  const connections = wikiGraph.edges.filter((e) => !e.isBroken).length;
  const tone = brokenCount > 0 ? "warning" : "healthy";
  const headline = brokenCount > 0 ? "Wiki con enlaces rotos" : "Wiki saludable";
  const actionNote = brokenCount > 0
    ? `${brokenCount} enlace${brokenCount === 1 ? "" : "s"} roto${brokenCount === 1 ? "" : "s"} requiere${brokenCount === 1 ? "" : "n"} atención`
    : "Sin acciones críticas";
  return { tone, headline, actionNote, connections, brokenCount, orphanCount };
}
