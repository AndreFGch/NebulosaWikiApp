export type UiTheme = "dark" | "light";
export type UiAccent = "violet" | "amber" | "sage" | "terracotta";
export type UiDensity = "comfortable" | "compact";

export interface UiPreferences {
  theme: UiTheme;
  accent: UiAccent;
  density: UiDensity;
}
