export type { UiAccent, UiDensity, UiPreferences, UiTheme } from "./design.types";
export { DEFAULT_UI_PREFERENCES } from "./design.defaults";
export { UI_ACCENTS, UI_DENSITIES, UI_THEMES } from "./design.limits";
export { sanitizeUiPreferences } from "./design.sanitize";
export { loadUiPreferences, saveUiPreferences } from "./design.storage";
export { applyUiPreferences } from "./design.apply";
export {
  ACCENT_CATALOG,
  DENSITY_CATALOG,
  THEME_CATALOG,
  type DesignCatalogEntry,
  type DesignCatalogOption,
} from "./design.catalog";
export { UI_PRESETS, type UiPreset } from "./design.presets";
export { DesignProvider, useDesign } from "./DesignProvider";
