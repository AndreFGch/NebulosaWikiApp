import { DEFAULT_UI_PREFERENCES } from "./design.defaults";
import type { UiPreferences } from "./design.types";

export interface UiPreset {
  id: string;
  label: string;
  preferences: UiPreferences;
}

/**
 * Solo combinaciones con estilo propio verificado en CSS. Theme/accent/density
 * son ejes independientes (tokens.css/themes.css/density.css): no existen hoy
 * combos con CSS dedicado distinto de la composición de ejes, por eso el único
 * preset real es el que reproduce el comportamiento actual de la app.
 */
export const UI_PRESETS: UiPreset[] = [
  { id: "default", label: "Predeterminado", preferences: DEFAULT_UI_PREFERENCES },
];
