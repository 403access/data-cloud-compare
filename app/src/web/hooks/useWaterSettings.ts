/** Water-theme settings with local persistence. */

import { useCallback, useRef, useState } from "react";
import {
  readWaterSettings,
  saveWaterSettings,
  WATER_DEFAULTS,
  type WaterSettings,
} from "../lib/water";

export function useWaterSettings(toast: (message: string) => void) {
  const [waterSettings, setWaterSettings] = useState<WaterSettings>(readWaterSettings);
  const waterRef = useRef(waterSettings);
  waterRef.current = waterSettings;

  const updateWaterSettings = useCallback((patch: Partial<WaterSettings>) => {
    const next = { ...waterRef.current, ...patch };
    waterRef.current = next;
    setWaterSettings(next);
    saveWaterSettings(next);
  }, []);

  const resetWaterSettings = useCallback(() => {
    const next = { ...WATER_DEFAULTS };
    waterRef.current = next;
    setWaterSettings(next);
    saveWaterSettings(next);
    toast("Water settings reset.");
  }, [toast]);

  return { waterSettings, waterRef, updateWaterSettings, resetWaterSettings };
}
