export const FOLDER_COLORS: Record<string, string> = {
  notes:    "#8b7cf6",
  projects: "#34d399",
  sources:  "#38bdf8",
  skills:   "#f472b6",
  sessions: "#f59e0b",
  indexes:  "#facc15",
};

export const GRAPH_TYPE_LABELS: { type: string; label: string }[] = [
  { type: "notes",     label: "Notas" },
  { type: "projects",  label: "Proyectos" },
  { type: "sources",   label: "Fuentes" },
  { type: "sessions",  label: "Sesiones" },
  { type: "skills",    label: "Skills" },
  { type: "indexes",   label: "Índices" },
  { type: "missing",   label: "Faltantes" },
];

export const ALL_GRAPH_TYPES = GRAPH_TYPE_LABELS.map(t => t.type);
