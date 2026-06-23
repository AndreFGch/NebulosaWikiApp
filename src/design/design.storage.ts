import { invoke } from "@tauri-apps/api/core";
import type { UiPreferences } from "./design.types";

/** Devuelve el dato crudo de Rust sin asumir su forma; sanitizar antes de usar. */
export function loadUiPreferences(): Promise<unknown> {
  return invoke("get_ui_preferences");
}

export function saveUiPreferences(preferences: UiPreferences): Promise<unknown> {
  return invoke("set_ui_preferences", { preferences });
}
