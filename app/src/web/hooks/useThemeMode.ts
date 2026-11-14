/** Theme selection, persistence and the document-level theme attribute. */

import { useCallback, useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "../lib/config";
import type { ThemeMode } from "../lib/types";

interface Options {
  onWaterPanel?: () => void;
}

export function useThemeMode({ onWaterPanel }: Options = {}) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(
    () => (document.documentElement.dataset.theme as ThemeMode) || "system",
  );

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === "system") delete root.dataset.theme;
    else root.dataset.theme = themeMode;
  }, [themeMode]);

  const applyThemeMode = useCallback(
    (mode: ThemeMode, opts: { persist?: boolean; openPanel?: boolean } = {}) => {
      const { persist = true, openPanel = false } = opts;
      setThemeModeState(mode);
      if (persist) {
        try {
          localStorage.setItem(THEME_STORAGE_KEY, mode);
        } catch {
          /* ignore */
        }
      }
      if (openPanel && mode === "water") onWaterPanel?.();
    },
    [onWaterPanel],
  );

  return { themeMode, applyThemeMode };
}
