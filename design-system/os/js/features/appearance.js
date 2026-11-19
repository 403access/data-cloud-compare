/* Aether OS — appearance and water effects
   Turns saved preferences into root data attributes, drives the WaterSurface,
   and owns the Water settings controls. */

import { WaterSurface } from "../../../water.js";
import {
  FONT_SIZES, THEME_LABELS, THEME_MODES, TONES, WATER_DEFAULTS, WINDOW_WAVES,
  resolvedTheme, root, saveDesignPrefs, saveFontSize, saveTheme, saveWater,
  saveWindowWave, state,
} from "../core/state.js";
import { toast } from "../core/toast.js";
import { renderAll } from "../compare/view.js";

/* ------------------------------------------------------------- water */

const canvas = document.getElementById("os-water");
const embedded = new URLSearchParams(window.location.search).has("embed");
const activeWater = () => state.water.effects && state.themeMode === "water";

const surface = !embedded && canvas
  ? new WaterSurface(canvas, {
      // Listen on the window, not just the desktop, so drips and ripples also
      // follow the cursor across windows, the menu bar, and the dock.
      scope: window,
      tone: state.water.tone,
      speed: state.water.speed,
      intensity: state.water.intensity,
      effects: activeWater(),
      drips: state.water.drips,
      clickRipples: state.water.clickRipples,
      caustics: state.water.caustics,
      enabled: activeWater(),
    })
  : null;

function syncThemeControls() {
  const resolved = resolvedTheme();
  document.querySelectorAll("[data-theme-select]").forEach((select) => {
    select.value = state.themeMode;
  });
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    const light = resolved === "light";
    button.setAttribute("aria-pressed", String(light));
    button.setAttribute("aria-label", light ? "Switch to the Water theme" : "Switch to the Light theme");
    const use = button.querySelector("use");
    if (use) use.setAttribute("href", light ? "#i-sun" : "#i-moon");
  });
  document.querySelectorAll("[data-settings-theme]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.settingsTheme === state.themeMode),
    );
  });
}

function syncWaterControls() {
  document.querySelectorAll("[data-water-setting]").forEach((input) => {
    const key = input.dataset.waterSetting;
    if (input.type === "checkbox") input.checked = Boolean(state.water[key]);
    else input.value = state.water[key];
  });
}

function syncThemeStatus() {
  const panel = document.querySelector('[data-settings-pane="appearance"]');
  const text = document.querySelector("[data-theme-status-text]");
  const action = document.querySelector('[data-cmd="use-water-theme"]');
  if (!panel || !text) return;
  const waterMode = state.themeMode === "water";
  const paused = !waterMode || !state.water.effects;
  panel.classList.toggle("is-paused", paused);
  let message = "Water effects are active. Drips follow your cursor.";
  if (!waterMode) message = "Water effects are paused while another theme is active.";
  else if (!state.water.effects) message = "Water effects are off. The theme stays calm and still.";
  else if (!state.water.drips) message = "Water effects are active. Cursor drips are off.";
  text.textContent = message;
  if (action) action.hidden = waterMode;
}

export function applyAppearance({ save = true } = {}) {
  const water = state.water;
  const resolved = resolvedTheme();
  root.dataset.theme = resolved;
  root.dataset.waterTone = water.tone;
  root.dataset.waterSpeed = water.speed;
  root.dataset.waterIntensity = water.intensity;
  root.dataset.waterBackground = water.background;
  root.dataset.waterGlass = water.glass ? "on" : "off";
  root.dataset.waterRowMotion = water.rowMotion ? "on" : "off";
  root.dataset.waterWindowWave = WINDOW_WAVES.includes(water.windowWave)
    ? water.windowWave
    : WATER_DEFAULTS.windowWave;
  root.dataset.waterMode = state.themeMode;
  root.dataset.waterEffects = activeWater() ? "on" : "off";
  root.dataset.fontSize = FONT_SIZES.includes(water.fontSize) ? water.fontSize : WATER_DEFAULTS.fontSize;

  surface?.setTone(water.tone);
  surface?.setSpeed(water.speed);
  surface?.setIntensity(water.intensity);
  surface?.configure({
    effects: activeWater(),
    enabled: activeWater(),
    drips: water.drips,
    clickRipples: water.clickRipples,
    caustics: water.caustics,
  });

  syncWaterControls();
  syncThemeControls();
  syncThemeStatus();
  document.querySelectorAll("[data-tone-label]").forEach((node) => {
    node.textContent = TONES[water.tone] || "Ocean";
  });
  if (save) {
    saveWater();
    saveFontSize();
    saveWindowWave();
    saveTheme();
    saveDesignPrefs();
  }
}

export function setThemeMode(mode) {
  if (!THEME_MODES.includes(mode)) return;
  state.themeMode = mode;
  applyAppearance();
  renderAll();
  toast(`${THEME_LABELS[mode]} theme`);
}

export function setWaterSetting(key, value) {
  if (!(key in WATER_DEFAULTS)) return;
  state.water = { ...state.water, [key]: value };
  applyAppearance();
  renderAll();
}

export function resetWaterSettings() {
  state.water = { ...WATER_DEFAULTS };
  applyAppearance();
  renderAll();
  toast("Water settings reset.");
}

applyAppearance({ save: false });
document.querySelectorAll("[data-theme-select]").forEach((select) => {
  select.addEventListener("change", () => setThemeMode(select.value));
});

/* ------------------------------------------------------- water settings */

document.querySelectorAll("[data-water-setting]").forEach((input) => {
  input.addEventListener("change", () => {
    const key = input.dataset.waterSetting;
    const value = input.type === "checkbox" ? input.checked : input.value;
    setWaterSetting(key, value);
  });
});

document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    setThemeMode(resolvedTheme() === "light" ? "water" : "light");
  });
});
