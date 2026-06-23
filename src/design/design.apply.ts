import type { UiPreferences } from "./design.types";

/**
 * Aplica en document.documentElement (no en .nw-shell): los tokens en
 * tokens.css/themes.css/density.css cascadean por herencia de variables CSS,
 * y solo el elemento raíz garantiza que ancestros de .nw-shell (ej. body)
 * también reciban los valores correctos.
 */
export function applyUiPreferences(
  preferences: UiPreferences,
  target: HTMLElement = document.documentElement,
): void {
  target.dataset.theme = preferences.theme;
  target.dataset.accent = preferences.accent;
  target.dataset.density = preferences.density;
}
