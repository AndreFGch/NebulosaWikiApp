import type { NoteTemplate } from "../../types/wiki";

export function normalizeKey(s: string): string {
  return s
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[-_/\\]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractFrontmatterTitle(rawContent: string): string | null {
  if (!rawContent.startsWith("---\n") && !rawContent.startsWith("---\r\n")) return null;
  const closeIdx = rawContent.indexOf("\n---", 4);
  if (closeIdx === -1) return null;
  const fm = rawContent.slice(4, closeIdx);
  const m = fm.match(/^(?:titulo|title):\s*(.+)/mi);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : null;
}

export function getNoteTypeFromFolder(folder: string): string {
  const top = folder.split("/")[0].toLowerCase();
  const known = ["notes", "projects", "sources", "skills", "sessions", "indexes", "inbox", "templates"];
  return known.includes(top) ? top : "notes";
}

export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) return content;
  const closeIdx = content.indexOf("\n---", 4);
  if (closeIdx === -1) return content;
  return content.slice(closeIdx + 4).replace(/^[\n\r]+/, "");
}

export function stripCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, " ");
}

export function stripInlineCode(content: string): string {
  return content.replace(/`[^`\n]+`/g, " ");
}

export function extractTags(rawContent: string): string[] {
  if (!rawContent.startsWith("---\n") && !rawContent.startsWith("---\r\n")) return [];
  const closeIdx = rawContent.indexOf("\n---", 4);
  if (closeIdx === -1) return [];
  const fm = rawContent.slice(4, closeIdx);

  const inline = fm.match(/^tags:\s*\[([^\]]*)\]/m);
  if (inline) {
    return inline[1].split(",").map(t => t.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  }

  const block = fm.match(/^tags:\s*\n((?:[ \t]*-[ \t]*.+\n?)*)/m);
  if (block) {
    return block[1]
      .split("\n")
      .map(line => { const m = line.match(/^[ \t]*-[ \t]*(.+)/); return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : ""; })
      .filter(Boolean);
  }

  return [];
}

export function extractWikilinks(content: string): string[] {
  const cleaned = stripInlineCode(stripCodeBlocks(content));
  const links: string[] = [];
  const re = /\[\[([^\]|\n]+?)(?:\|[^\]\n]*)?\]\]/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    links.push(m[1].trim());
  }
  return links;
}

export function preprocessWikilinks(content: string): string {
  return content
    .replace(/\[\[([^\]|\n]+)\|([^\]\n]+)\]\]/g, (_, name, alias) =>
      `[${alias.trim()}](#wikilink/${encodeURIComponent(name.trim())})`
    )
    .replace(/\[\[([^\]\n]+)\]\]/g, (_, name) =>
      `[${name.trim()}](#wikilink/${encodeURIComponent(name.trim())})`
    );
}

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
