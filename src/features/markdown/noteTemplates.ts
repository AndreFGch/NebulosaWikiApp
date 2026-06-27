export type NoteTemplate = "simple" | "project" | "source" | "skill" | "session" | "index";

export const WIKI_FOLDERS = ["notes", "projects", "sources", "sessions", "skills", "indexes"] as const;

export const TEMPLATE_FOLDER_MAP: Record<NoteTemplate, string> = {
  simple: "notes", project: "projects", source: "sources",
  skill: "skills", session: "sessions", index: "indexes",
};

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildNoteTemplateContent(template: NoteTemplate, title: string, date: string): string {
  switch (template) {
    case "project":
      return `---\ntipo: project\ntitulo: ${title}\nfecha: ${date}\ntags:\n  - proyecto\n  - nebulosa\nestado: activo\n---\n\n# ${title}\n\n## Objetivo\n\n- \n\n## Estado actual\n\n- \n\n## Pendientes\n\n- \n\n## Decisiones\n\n- \n\n## Enlaces\n\n- \n`;
    case "source":
      return `---\ntipo: source\ntitulo: ${title}\nfecha: ${date}\ntags:\n  - fuente\n  - nebulosa\nurl:\nautor:\n---\n\n# ${title}\n\n## Resumen\n\n- \n\n## Ideas clave\n\n- \n\n## Citas / notas\n\n- \n\n## Relacionado\n\n- \n`;
    case "skill":
      return `---\ntipo: skill\ntitulo: ${title}\nfecha: ${date}\ntags:\n  - skill\n  - nebulosa\n---\n\n# ${title}\n\n## Propósito\n\n- \n\n## Cuándo usarla\n\n- \n\n## Reglas\n\n- \n\n## Ejemplos\n\n- \n`;
    case "session":
      return `---\ntipo: session\ntitulo: ${title}\nfecha: ${date}\ntags:\n  - session\n  - nebulosa\n---\n\n# ${title}\n\n## Contexto\n\n- \n\n## Trabajo realizado\n\n- \n\n## Decisiones\n\n- \n\n## Pendientes\n\n- \n\n## Próximo paso\n\n- \n`;
    case "index":
      return `---\ntipo: index\ntitulo: ${title}\nfecha: ${date}\ntags:\n  - index\n  - nebulosa\n---\n\n# ${title}\n\n## Mapa\n\n- \n\n## Proyectos\n\n- \n\n## Notas\n\n- \n\n## Fuentes\n\n- \n\n## Skills\n\n- \n`;
    default:
      return `---\ntipo: note\ntitulo: ${title}\nfecha: ${date}\ntags:\n  - nebulosa\n---\n\n# ${title}\n\n- \n`;
  }
}
