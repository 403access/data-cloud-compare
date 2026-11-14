/** Animated sea backdrop and water ripple canvas. */

import { useEffect, useRef } from "react";
import { WaterFX, type WaterSettings } from "../lib/water";
import type { ThemeMode } from "../lib/types";

interface Props {
  settings: WaterSettings;
  themeMode: ThemeMode;
}

export function WaterBackdrop({ settings, themeMode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waterFX = useRef<WaterFX | null>(null);

  useEffect(() => {
    waterFX.current = new WaterFX(canvasRef.current);
    return () => {
      waterFX.current?.destroy();
      waterFX.current = null;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.waterTone = settings.tone;
    root.dataset.waterSpeed = settings.speed;
    root.dataset.waterIntensity = settings.intensity;
    root.dataset.waterBackground = settings.background;
    root.dataset.waterGlass = settings.glass ? "on" : "off";
    root.dataset.waterEffects = settings.effects ? "on" : "off";
    root.dataset.waterCaustics = settings.caustics ? "on" : "off";
    root.dataset.waterRowMotion = settings.rowMotion ? "on" : "off";
    waterFX.current?.configure(settings, themeMode === "water" && settings.effects);
  }, [settings, themeMode]);

  return (
    <>
      <div id="sea-bg" aria-hidden="true">
        <svg
          className="sea-wave sea-wave-far"
          viewBox="0 0 2880 320"
          preserveAspectRatio="none"
          focusable="false"
        >
          <path d="M0 150 C 240 96 480 204 720 150 C 960 96 1200 204 1440 150 C 1680 96 1920 204 2160 150 C 2400 96 2640 204 2880 150 L 2880 320 L 0 320 Z" />
        </svg>
        <svg
          className="sea-wave sea-wave-mid"
          viewBox="0 0 2880 320"
          preserveAspectRatio="none"
          focusable="false"
        >
          <path d="M0 170 C 240 126 480 214 720 170 C 960 126 1200 214 1440 170 C 1680 126 1920 214 2160 170 C 2400 126 2640 214 2880 170 L 2880 320 L 0 320 Z" />
        </svg>
        <svg
          className="sea-wave sea-wave-near"
          viewBox="0 0 2880 320"
          preserveAspectRatio="none"
          focusable="false"
        >
          <path d="M0 190 C 240 156 480 224 720 190 C 960 156 1200 224 1440 190 C 1680 156 1920 224 2160 190 C 2400 156 2640 224 2880 190 L 2880 320 L 0 320 Z" />
        </svg>
      </div>

      <canvas id="water-fx" aria-hidden="true" ref={canvasRef} />
    </>
  );
}
