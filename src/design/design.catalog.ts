import type { UiAccent, UiDensity, UiTheme } from "./design.types";

export interface DesignCatalogOption<T extends string> {
  value: T;
  label: string;
}

export interface DesignCatalogEntry<T extends string> {
  id: string;
  label: string;
  description: string;
  impact: string;
  options: DesignCatalogOption<T>[];
}

export const THEME_CATALOG: DesignCatalogEntry<UiTheme> = {
  id: "theme",
  label: "Tema",
  description: "Paleta clara u oscura de toda la interfaz.",
  impact: "Fondo, superficies y color de texto.",
  options: [
    { value: "dark", label: "Oscuro" },
    { value: "light", label: "Claro" },
  ],
};

export const ACCENT_CATALOG: DesignCatalogEntry<UiAccent> = {
  id: "accent",
  label: "Acento",
  description: "Color de énfasis para botones, selección y enlaces activos.",
  impact: "Color de acento y su variante atenuada.",
  options: [
    { value: "violet", label: "Violeta" },
    { value: "amber", label: "Ámbar" },
    { value: "sage", label: "Salvia" },
    { value: "terracotta", label: "Terracota" },
  ],
};

export const DENSITY_CATALOG: DesignCatalogEntry<UiDensity> = {
  id: "density",
  label: "Densidad",
  description: "Espaciado y radios de botones y tarjetas.",
  impact: "Padding, gap y radius de acciones y cards.",
  options: [
    { value: "comfortable", label: "Cómoda" },
    { value: "compact", label: "Compacta" },
  ],
};
