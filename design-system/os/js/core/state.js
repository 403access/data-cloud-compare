/* Aether OS — shared state and preferences
   Static option catalogs, saved preferences, and the mutable state every
   feature reads. Change properties on `state`; do not replace the object. */

import { prefersDark } from "./utils.js";

export const root = document.documentElement;
const DESIGN_KEY = "dcc-design-prefs";
const WATER_KEY = "explorer-water-settings";
const THEME_KEY = "explorer-theme";
const COLUMNS_KEY = "explorer-columns";
export const SIZE_KEY = "explorer-size-mode";
const PROVIDER_KEY = "explorer-provider";
const FONT_SIZE_KEY = "explorer-os-font-size";
const WINDOW_WAVE_KEY = "explorer-os-window-wave";
const WINDOW_LAYOUT_KEY = "explorer-os-window-layout";

export const TONES = { lagoon: "Lagoon", ocean: "Ocean", deep: "Deep" };
const SPEEDS = ["calm", "flowing", "rapid"];
const INTENSITIES = ["subtle", "balanced", "lively"];
export const WINDOW_WAVES = ["off", "calm", "tide", "surge"];
export const WINDOW_LAYOUTS = ["split", "overlap"];
export const FONT_SIZES = ["compact", "comfortable", "large"];
export const THEME_MODES = ["system", "light", "dark", "water"];
export const THEME_LABELS = { system: "System", light: "Light", dark: "Dark", water: "Water" };

export const PROVIDERS = {
  jottacloud: { key: "jottacloud", label: "Jottacloud", root: "Archive", dot: "jottacloud" },
  google_drive: { key: "google_drive", label: "Google Drive", root: "Drive", dot: "google" },
};

export const WATER_DEFAULTS = {
  effects: true,
  drips: true,
  clickRipples: true,
  caustics: true,
  rowMotion: true,
  glass: true,
  background: "still",
  tone: "ocean",
  speed: "flowing",
  intensity: "subtle",
  windowWave: "tide",
  fontSize: "comfortable",
};

export const COLUMN_DEFS = [
  { id: "name", label: "Name", hint: "File or folder name", width: "minmax(0, 1fr)", required: true },
  { id: "type", label: "Type", hint: "Folder or file extension", width: "52px" },
  { id: "status", label: "Status", hint: "Comparison result", width: "calc(96px * var(--os-font-scale, 1))" },
  { id: "size", label: "Size", hint: "Nested bytes or direct item count", width: "76px" },
  { id: "modified", label: "Modified", hint: "Last modified date", width: "86px" },
];
export const DEFAULT_COLUMNS = COLUMN_DEFS.map((col) => col.id);

export const STATUS_COLORS = {
  exact: "var(--ds-green)",
  moved: "var(--ds-blue)",
  moved_match: "var(--ds-blue)",
  possible: "var(--ds-amber)",
  partial: "var(--ds-orange)",
  missing: "var(--ds-red)",
  local_only: "var(--ds-violet)",
  type_mismatch: "var(--ds-amber)",
  unmatched: "var(--ds-gray)",
};

export const REMOTE_STATUS = {
  exact: { label: "Same", className: "st-exact" },
  moved: { label: "Moved", className: "st-moved" },
  possible: { label: "Maybe", className: "st-possible" },
  partial: { label: "Partial", className: "st-partial" },
  missing: { label: "Missing", className: "st-missing" },
  type_mismatch: { label: "Type differs", className: "st-type_mismatch" },
};

export const FILTER_OPTIONS = {
  local: ["exact", "moved_match", "local_only", "unmatched", "type_mismatch"],
  remote: ["exact", "moved", "possible", "partial", "missing"],
};

/* ------------------------------------------------------------- prefs */

export function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function readFontSize() {
  try {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    return FONT_SIZES.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

function readWindowWave() {
  try {
    const saved = localStorage.getItem(WINDOW_WAVE_KEY);
    return WINDOW_WAVES.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

function readWindowLayout() {
  try {
    const saved = localStorage.getItem(WINDOW_LAYOUT_KEY);
    return WINDOW_LAYOUTS.includes(saved) ? saved : "split";
  } catch {
    return "split";
  }
}

function readWater() {
  const saved = readJSON(WATER_KEY);
  const design = readJSON(DESIGN_KEY) || {};
  const storedFontSize = readFontSize();
  const storedWindowWave = readWindowWave();
  if (!saved || typeof saved !== "object") {
    return {
      ...WATER_DEFAULTS,
      tone: TONES[design.tone] ? design.tone : WATER_DEFAULTS.tone,
      speed: SPEEDS.includes(design.speed) ? design.speed : WATER_DEFAULTS.speed,
      background: design.background === "sea" ? "sea" : WATER_DEFAULTS.background,
      effects: design.effects !== false,
      windowWave: storedWindowWave || WATER_DEFAULTS.windowWave,
      fontSize:
        storedFontSize ||
        (FONT_SIZES.includes(design.fontSize) ? design.fontSize : WATER_DEFAULTS.fontSize),
    };
  }
  const pick = (value, allowed, fallback) =>
    typeof value === "string" && allowed.includes(value) ? value : fallback;
  return {
    effects: saved.effects !== false,
    drips: saved.drips !== false,
    clickRipples: saved.clickRipples !== false,
    caustics: saved.caustics !== false,
    rowMotion: saved.rowMotion !== false,
    glass: saved.glass !== false,
    background: pick(saved.background, ["still", "sea"], WATER_DEFAULTS.background),
    tone: pick(saved.tone, Object.keys(TONES), WATER_DEFAULTS.tone),
    speed: pick(saved.speed, SPEEDS, WATER_DEFAULTS.speed),
    intensity: pick(saved.intensity, INTENSITIES, WATER_DEFAULTS.intensity),
    windowWave:
      storedWindowWave ||
      pick(saved.windowWave, WINDOW_WAVES, WATER_DEFAULTS.windowWave),
    fontSize: storedFontSize || pick(saved.fontSize, FONT_SIZES, WATER_DEFAULTS.fontSize),
  };
}

function readThemeMode() {
  const saved = localStorage.getItem(THEME_KEY);
  return THEME_MODES.includes(saved) ? saved : "water";
}

function readColumns() {
  const saved = readJSON(COLUMNS_KEY);
  if (!Array.isArray(saved)) return new Set(DEFAULT_COLUMNS);
  const valid = new Set(DEFAULT_COLUMNS);
  const chosen = new Set(saved.filter((id) => valid.has(id)));
  chosen.add("name");
  return chosen;
}

function readSizeMode() {
  const saved = localStorage.getItem(SIZE_KEY);
  return ["bytes", "files", "both"].includes(saved) ? saved : "bytes";
}

function readProvider() {
  const saved = localStorage.getItem(PROVIDER_KEY);
  return PROVIDERS[saved] ? saved : "jottacloud";
}

export const state = {
  water: readWater(),
  themeMode: readThemeMode(),
  provider: readProvider(),
  windowLayout: readWindowLayout(),
  hidden: false,
  legendOpen: false,
  activeSide: "local",
  selected: null,
  sort: {
    local: { id: "name", dir: "asc" },
    remote: { id: "name", dir: "asc" },
  },
  filters: { local: new Set(), remote: new Set() },
  search: { local: "", remote: "" },
  scope: { local: "all", remote: "all" },
  columns: readColumns(),
  sizeMode: readSizeMode(),
  sidePanel: null,
  sidePanelSide: "local",
  command: { query: "", index: 0, items: [] },
};

export function resolvedTheme() {
  if (state.themeMode === "system") return prefersDark() ? "dark" : "light";
  return state.themeMode === "light" ? "light" : "dark";
}

export function saveWater() {
  writeJSON(WATER_KEY, state.water);
}

export function saveFontSize() {
  try {
    localStorage.setItem(FONT_SIZE_KEY, state.water.fontSize);
  } catch {
    /* ignore */
  }
}

export function saveWindowWave() {
  try {
    localStorage.setItem(WINDOW_WAVE_KEY, state.water.windowWave);
  } catch {
    /* ignore */
  }
}

export function saveWindowLayout() {
  try {
    localStorage.setItem(WINDOW_LAYOUT_KEY, state.windowLayout);
  } catch {
    /* ignore */
  }
}

export function saveDesignPrefs() {
  writeJSON(DESIGN_KEY, {
    tone: state.water.tone,
    background: state.water.background,
    effects: state.water.effects,
    speed: state.water.speed,
    fontSize: state.water.fontSize,
    theme: resolvedTheme(),
  });
}

export function saveTheme() {
  try {
    localStorage.setItem(THEME_KEY, state.themeMode);
  } catch {
    /* ignore */
  }
}

export function saveColumns() {
  writeJSON(COLUMNS_KEY, [...state.columns]);
}

export function saveProvider() {
  try {
    localStorage.setItem(PROVIDER_KEY, state.provider);
  } catch {
    /* ignore */
  }
}
