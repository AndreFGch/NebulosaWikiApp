import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { applyUiPreferences } from "./design.apply";
import { DEFAULT_UI_PREFERENCES } from "./design.defaults";
import { sanitizeUiPreferences } from "./design.sanitize";
import { loadUiPreferences, saveUiPreferences } from "./design.storage";
import type { UiAccent, UiDensity, UiPreferences, UiTheme } from "./design.types";

interface DesignContextValue {
  preferences: UiPreferences;
  setTheme: (theme: UiTheme) => void;
  setAccent: (accent: UiAccent) => void;
  setDensity: (density: UiDensity) => void;
  savePreferences: () => Promise<void>;
}

const DesignContext = createContext<DesignContextValue | null>(null);

export function DesignProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UiPreferences>(DEFAULT_UI_PREFERENCES);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  useEffect(() => {
    applyUiPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    loadUiPreferences()
      .then((raw) => setPreferences(sanitizeUiPreferences(raw)))
      .catch((err) => { console.warn("No se pudieron cargar preferencias visuales:", err); });
  }, []);

  const setTheme = useCallback((theme: UiTheme) => {
    setPreferences((prev) => ({ ...prev, theme }));
  }, []);

  const setAccent = useCallback((accent: UiAccent) => {
    setPreferences((prev) => ({ ...prev, accent }));
  }, []);

  const setDensity = useCallback((density: UiDensity) => {
    setPreferences((prev) => ({ ...prev, density }));
  }, []);

  const savePreferences = useCallback(async () => {
    await saveUiPreferences(preferencesRef.current);
  }, []);

  const value = useMemo<DesignContextValue>(() => ({
    preferences,
    setTheme,
    setAccent,
    setDensity,
    savePreferences,
  }), [preferences, setTheme, setAccent, setDensity, savePreferences]);

  return <DesignContext.Provider value={value}>{children}</DesignContext.Provider>;
}

export function useDesign(): DesignContextValue {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error("useDesign debe usarse dentro de <DesignProvider>");
  return ctx;
}
