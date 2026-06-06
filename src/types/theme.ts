// UI-V2 theme contract - not connected to app yet (ARCH-03)
export type ThemeMode = "dark" | "light" | "system";
export type DensityMode = "comfortable" | "compact";
export type MotionMode = "default" | "reduced";

export interface ThemeSettings {
  theme: ThemeMode;
  accentColor: string;
  fontFamily: string;
  density: DensityMode;
  motion: MotionMode;
}
