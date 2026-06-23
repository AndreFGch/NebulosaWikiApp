import { DEFAULT_UI_PREFERENCES } from "./design.defaults";
import { UI_ACCENTS, UI_DENSITIES, UI_THEMES } from "./design.limits";
import type { UiAccent, UiDensity, UiPreferences, UiTheme } from "./design.types";

function isUiTheme(value: unknown): value is UiTheme {
  return UI_THEMES.includes(value as UiTheme);
}

function isUiAccent(value: unknown): value is UiAccent {
  return UI_ACCENTS.includes(value as UiAccent);
}

function isUiDensity(value: unknown): value is UiDensity {
  return UI_DENSITIES.includes(value as UiDensity);
}

/** No confía en la validación de Rust: trata cualquier dato externo como desconocido. */
export function sanitizeUiPreferences(data: unknown): UiPreferences {
  const raw = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  return {
    theme: isUiTheme(raw.theme) ? raw.theme : DEFAULT_UI_PREFERENCES.theme,
    accent: isUiAccent(raw.accent) ? raw.accent : DEFAULT_UI_PREFERENCES.accent,
    density: isUiDensity(raw.density) ? raw.density : DEFAULT_UI_PREFERENCES.density,
  };
}
