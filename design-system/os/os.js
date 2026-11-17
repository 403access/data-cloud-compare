/* ==========================================================================
   Water OS — desktop interactions
   --------------------------------------------------------------------------
   The explorer, water settings, and command bar mirror the real app in
   app/src/web: same panes, columns, statuses, controls, and command catalog.
   Window management, the dock, and the desktop shell are local to this demo.
   ========================================================================== */

import { WaterSurface } from "../water.js";

const root = document.documentElement;
const desktop = document.querySelector("#os-desktop");
const DESIGN_KEY = "dcc-design-prefs";
const WATER_KEY = "explorer-water-settings";
const THEME_KEY = "explorer-theme";
const COLUMNS_KEY = "explorer-columns";
const SIZE_KEY = "explorer-size-mode";
const PROVIDER_KEY = "explorer-provider";

const TONES = { lagoon: "Lagoon", ocean: "Ocean", deep: "Deep" };
const SPEEDS = ["calm", "flowing", "rapid"];
const INTENSITIES = ["subtle", "balanced", "lively"];
const THEME_MODES = ["system", "light", "dark", "water"];
const THEME_LABELS = { system: "System", light: "Light", dark: "Dark", water: "Water" };

const PROVIDERS = {
  jottacloud: { key: "jottacloud", label: "Jottacloud", root: "Archive", dot: "jottacloud" },
  google_drive: { key: "google_drive", label: "Google Drive", root: "Drive", dot: "google" },
};

const WATER_DEFAULTS = {
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
};

const COLUMN_DEFS = [
  { id: "name", label: "Name", hint: "File or folder name", width: "minmax(0, 1fr)", required: true },
  { id: "type", label: "Type", hint: "Folder or file extension", width: "52px" },
  { id: "status", label: "Status", hint: "Comparison result", width: "96px" },
  { id: "size", label: "Size", hint: "Nested bytes or direct item count", width: "76px" },
  { id: "modified", label: "Modified", hint: "Last modified date", width: "86px" },
];
const DEFAULT_COLUMNS = COLUMN_DEFS.map((col) => col.id);

const STATUS_COLORS = {
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

const REMOTE_STATUS = {
  exact: { label: "Same", className: "st-exact" },
  moved: { label: "Moved", className: "st-moved" },
  possible: { label: "Maybe", className: "st-possible" },
  partial: { label: "Partial", className: "st-partial" },
  missing: { label: "Missing", className: "st-missing" },
  type_mismatch: { label: "Type differs", className: "st-type_mismatch" },
};

const FILTER_OPTIONS = {
  local: ["exact", "moved_match", "local_only", "unmatched", "type_mismatch"],
  remote: ["exact", "moved", "possible", "partial", "missing"],
};

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const prefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches;

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

const gb = (value) => value * 1024 ** 3;
const mb = (value) => value * 1024 ** 2;
const kb = (value) => value * 1024;
const date = (iso) =>
  new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${iso}T12:00:00`),
  );

/* ------------------------------------------------------------- data */

const DATA = {
  local: [
    { name: "_LikedSongs", isDir: true, status: "local_only", folderSize: "7.13 GB", sizeValue: gb(7.13), childCount: 5, modified: "2025-06-18", path: "/mnt/tank/_LikedSongs", note: "Local folder with no archive counterpart." },
    { name: "_macos_2025-05-26", isDir: true, status: "partial", folderSize: "88.0 GB", sizeValue: gb(88), childCount: 4, modified: "2026-01-04", path: "/mnt/tank/_macos_2025-05-26", note: "Some children are missing from the archive." },
    { name: "_order_me", isDir: true, status: "exact", folderSize: "91.0 GB", sizeValue: gb(91), childCount: 613, modified: "2025-06-18", path: "/mnt/tank/_order_me" },
    { name: "_Sounds_Videos_Unsorted", isDir: true, status: "exact", folderSize: "18.1 MB", sizeValue: mb(18.1), childCount: 73, modified: "2025-06-19", path: "/mnt/tank/_Sounds_Videos_Unsorted" },
    { name: "_windows_backup_28-05-2025", isDir: true, status: "exact", folderSize: "658 GB", sizeValue: gb(658), childCount: 14, modified: "2025-06-19", path: "/mnt/tank/_windows_backup_28-05-2025" },
    { name: "Audio", isDir: true, status: "exact", folderSize: "1.28 MB", sizeValue: mb(1.28), childCount: 4, modified: "2025-06-19", path: "/mnt/tank/Audio" },
    { name: "Authenticator - Google", isDir: true, status: "exact", folderSize: "1.76 MB", sizeValue: mb(1.76), childCount: 2, modified: "2025-06-19", path: "/mnt/tank/Authenticator - Google" },
    { name: "Backup-C", isDir: true, status: "exact", folderSize: "155 GB", sizeValue: gb(155), childCount: 36, modified: "2025-06-19", path: "/mnt/tank/Backup-C" },
    { name: "Backup.16.10.2020", isDir: true, status: "exact", folderSize: "4.23 GB", sizeValue: gb(4.23), childCount: 12, modified: "2025-06-24", path: "/mnt/tank/Backup.16.10.2020" },
    { name: "Benedikt Pilz", isDir: true, status: "exact", folderSize: "21.5 MB", sizeValue: mb(21.5), childCount: 8, modified: "2025-06-19", path: "/mnt/tank/Benedikt Pilz" },
    { name: "Bewerbung", isDir: true, status: "exact", folderSize: "8.24 MB", sizeValue: mb(8.24), childCount: 22, modified: "2025-06-19", path: "/mnt/tank/Bewerbung" },
    { name: "Bilder_Videos", isDir: true, status: "exact", folderSize: "62.8 GB", sizeValue: gb(62.8), childCount: 112, modified: "2025-06-19", path: "/mnt/tank/Bilder_Videos" },
    { name: "Bonuz", isDir: true, status: "exact", folderSize: "22.7 GB", sizeValue: gb(22.7), childCount: 7, modified: "2025-06-27", path: "/mnt/tank/Bonuz" },
    { name: "CHANGELOG.md", type: "MD", size: "6.7 KB", sizeValue: kb(6.7), status: "exact", modified: "2025-06-19", path: "/mnt/tank/CHANGELOG.md" },
    { name: "notes.md", type: "MD", size: "3.2 KB", sizeValue: kb(3.2), status: "local_only", modified: "2026-11-12", path: "/mnt/tank/Projects/Aurora/notes.md", note: "Kept locally; no archive counterpart." },
    { name: "package.json", type: "JSON", size: "2.1 KB", sizeValue: kb(2.1), status: "exact", modified: "2026-11-11", path: "/mnt/tank/package.json" },
    { name: "README.md", type: "MD", size: "11.4 KB", sizeValue: kb(11.4), status: "moved_match", modified: "2026-11-12", path: "/mnt/tank/Projects/Aurora/README.md", foundAt: "/Archive/Projects/Aurora/README.md", note: "Same size and content hash, found at a different archive path." },
    { name: ".env.local", type: "ENV", size: "412 B", sizeValue: 412, status: "local_only", modified: "2026-11-09", path: "/mnt/tank/.env.local", note: "Dotfile. Enable Hidden to show it by default." },
    { name: ".DS_Store", type: "FILE", size: "8 KB", sizeValue: kb(8), status: "unmatched", modified: "2025-06-20", path: "/mnt/tank/.DS_Store" },
  ],
  remote: [
    { name: "2026-07-17", isDir: true, status: "partial", folderSize: "74.5 GB", sizeValue: gb(74.5), childCount: 5, modified: "2025-06-19", path: "/Archive/2026-07-17", note: "Some children are missing from the local index." },
    { name: "__becker", isDir: true, status: "missing", folderSize: "81.9 MB", sizeValue: mb(81.9), childCount: 9, modified: "2025-06-19", path: "/Archive/__becker" },
    { name: "_macos_2025-05-26", isDir: true, status: "partial", folderSize: "130 GB", sizeValue: gb(130), childCount: 4, modified: "2025-06-19", path: "/Archive/_macos_2025-05-26" },
    { name: "_macos_2025-06-25", isDir: true, status: "missing", folderSize: "0 B", sizeValue: 0, childCount: 0, modified: "2025-06-25", path: "/Archive/_macos_2025-06-25" },
    { name: "_order_me", isDir: true, status: "exact", folderSize: "91.0 GB", sizeValue: gb(91), childCount: 613, modified: "2025-06-19", path: "/Archive/_order_me" },
    { name: "_Sounds_Videos_Unsorted", isDir: true, status: "exact", folderSize: "18.1 MB", sizeValue: mb(18.1), childCount: 73, modified: "2025-06-19", path: "/Archive/_Sounds_Videos_Unsorted" },
    { name: "_temp_games", isDir: true, status: "missing", folderSize: "11.2 MB", sizeValue: mb(11.2), childCount: 3, modified: "2025-06-19", path: "/Archive/_temp_games" },
    { name: "_windows_backup_28-05-2025", isDir: true, status: "exact", folderSize: "659 GB", sizeValue: gb(659), childCount: 14, modified: "2025-06-19", path: "/Archive/_windows_backup_28-05-2025" },
    { name: "Audio", isDir: true, status: "exact", folderSize: "1.28 MB", sizeValue: mb(1.28), childCount: 4, modified: "2025-06-19", path: "/Archive/Audio" },
    { name: "Authenticator - Google", isDir: true, status: "exact", folderSize: "1.76 MB", sizeValue: mb(1.76), childCount: 2, modified: "2025-06-19", path: "/Archive/Authenticator - Google" },
    { name: "Backup-C", isDir: true, status: "exact", folderSize: "155 GB", sizeValue: gb(155), childCount: 36, modified: "2025-06-19", path: "/Archive/Backup-C" },
    { name: "Backup.16.10.2020", isDir: true, status: "exact", folderSize: "4.35 GB", sizeValue: gb(4.35), childCount: 12, modified: "2025-06-19", path: "/Archive/Backup.16.10.2020" },
    { name: "Benedikt Pilz", isDir: true, status: "exact", folderSize: "21.5 MB", sizeValue: mb(21.5), childCount: 8, modified: "2025-06-19", path: "/Archive/Benedikt Pilz" },
    { name: "Bewerbung", isDir: true, status: "exact", folderSize: "8.24 MB", sizeValue: mb(8.24), childCount: 22, modified: "2025-06-19", path: "/Archive/Bewerbung" },
    { name: "Bilder_Videos", isDir: true, status: "exact", folderSize: "62.8 GB", sizeValue: gb(62.8), childCount: 112, modified: "2025-06-19", path: "/Archive/Bilder_Videos" },
    { name: "Bonuz", isDir: true, status: "exact", folderSize: "26.7 GB", sizeValue: gb(26.7), childCount: 7, modified: "2025-06-27", path: "/Archive/Bonuz" },
    { name: "CHANGELOG.md", type: "MD", size: "6.7 KB", sizeValue: kb(6.7), status: "exact", modified: "2025-06-19", path: "/Archive/CHANGELOG.md" },
    { name: "package.json", type: "JSON", size: "2.1 KB", sizeValue: kb(2.1), status: "exact", modified: "2025-06-19", path: "/Archive/package.json" },
    { name: "README.md", type: "MD", size: "11.4 KB", sizeValue: kb(11.4), status: "moved", modified: "2026-11-12", path: "/Archive/Projects/Aurora/README.md", foundAt: "/mnt/tank/Projects/Aurora/README.md", note: "Moved from the local path; same name and size." },
    { name: ".cache", isDir: true, status: "missing", folderSize: "412 MB", sizeValue: mb(412), childCount: 12, modified: "2025-06-21", path: "/Archive/.cache" },
    { name: ".DS_Store", type: "FILE", size: "8 KB", sizeValue: kb(8), status: "missing", modified: "2025-06-20", path: "/Archive/.DS_Store" },
  ],
};

const SUMMARY = {
  local: { items: 19, dirs: 13, files: 6, size: "6.41 TB" },
  remote: { items: 21, dirs: 17, files: 4, size: "6.50 TB" },
};

/* ------------------------------------------------------------- prefs */

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function readWater() {
  const saved = readJSON(WATER_KEY);
  const design = readJSON(DESIGN_KEY) || {};
  if (!saved || typeof saved !== "object") {
    return {
      ...WATER_DEFAULTS,
      tone: TONES[design.tone] ? design.tone : WATER_DEFAULTS.tone,
      speed: SPEEDS.includes(design.speed) ? design.speed : WATER_DEFAULTS.speed,
      background: design.background === "sea" ? "sea" : WATER_DEFAULTS.background,
      effects: design.effects !== false,
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

const state = {
  water: readWater(),
  themeMode: readThemeMode(),
  provider: readProvider(),
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

/* ------------------------------------------------------------- water */

const canvas = document.getElementById("os-water");
const activeWater = () => state.water.effects && state.themeMode === "water";

const surface = canvas
  ? new WaterSurface(canvas, {
      scope: desktop,
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

function resolvedTheme() {
  if (state.themeMode === "system") return prefersDark() ? "dark" : "light";
  return state.themeMode === "light" ? "light" : "dark";
}

function saveWater() {
  writeJSON(WATER_KEY, state.water);
}

function saveDesignPrefs() {
  writeJSON(DESIGN_KEY, {
    tone: state.water.tone,
    background: state.water.background,
    effects: state.water.effects,
    speed: state.water.speed,
    theme: resolvedTheme(),
  });
}

function saveTheme() {
  try {
    localStorage.setItem(THEME_KEY, state.themeMode);
  } catch {
    /* ignore */
  }
}

function saveColumns() {
  writeJSON(COLUMNS_KEY, [...state.columns]);
}

function saveProvider() {
  try {
    localStorage.setItem(PROVIDER_KEY, state.provider);
  } catch {
    /* ignore */
  }
}

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
}

function syncWaterControls() {
  document.querySelectorAll("[data-water-setting]").forEach((input) => {
    const key = input.dataset.waterSetting;
    if (input.type === "checkbox") input.checked = Boolean(state.water[key]);
    else input.value = state.water[key];
  });
}

function syncThemeStatus() {
  const panel = document.querySelector(".osx-theme-panel");
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

function applyAppearance({ save = true } = {}) {
  const water = state.water;
  const resolved = resolvedTheme();
  root.dataset.theme = resolved;
  root.dataset.waterTone = water.tone;
  root.dataset.waterSpeed = water.speed;
  root.dataset.waterIntensity = water.intensity;
  root.dataset.waterBackground = water.background;
  root.dataset.waterGlass = water.glass ? "on" : "off";
  root.dataset.waterRowMotion = water.rowMotion ? "on" : "off";
  root.dataset.waterMode = state.themeMode;
  root.dataset.waterEffects = activeWater() ? "on" : "off";

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
    saveTheme();
    saveDesignPrefs();
  }
}

function setThemeMode(mode) {
  if (!THEME_MODES.includes(mode)) return;
  state.themeMode = mode;
  applyAppearance();
  renderAll();
  toast(`${THEME_LABELS[mode]} theme`);
}

function setWaterSetting(key, value) {
  if (!(key in WATER_DEFAULTS)) return;
  state.water = { ...state.water, [key]: value };
  applyAppearance();
  renderAll();
}

function resetWaterSettings() {
  state.water = { ...WATER_DEFAULTS };
  applyAppearance();
  renderAll();
  toast("Water settings reset.");
}

applyAppearance({ save: false });

/* -------------------------------------------------------------- clock */

const shortDate = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
const clockTime = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

function tickClock() {
  const now = new Date();
  const time = clockTime.format(now);
  document.querySelectorAll("[data-clock-time]").forEach((node) => (node.textContent = time));
  document.querySelectorAll("[data-clock-big]").forEach((node) => (node.textContent = time));
  document.querySelectorAll("[data-clock-date]").forEach((node) => (node.textContent = shortDate.format(now)));
  document.querySelectorAll("[data-clock-long]").forEach((node) => (node.textContent = longDate.format(now)));
  document.querySelectorAll("[data-calendar-time]").forEach((node) => (node.textContent = time));
  document.querySelectorAll("[data-calendar-today-label]").forEach((node) => (node.textContent = longDate.format(now)));
}

tickClock();
window.setInterval(tickClock, 20_000);

/* ------------------------------------------------------------ tray menus */

const trayPanels = Array.from(document.querySelectorAll("[data-tray]"));
const trayToggles = new Map();
const trayHooks = new Map();
let openTrayName = null;

trayPanels.forEach((panel) => {
  const toggle = document.querySelector(`[data-tray-toggle="${panel.dataset.tray}"]`);
  if (toggle) trayToggles.set(panel.dataset.tray, toggle);
});

function registerTray(name, hooks = {}) {
  trayHooks.set(name, hooks);
}

function setTrayOpen(name, open) {
  const panel = trayPanels.find((item) => item.dataset.tray === name);
  if (!panel) return;
  const toggle = trayToggles.get(name);
  if (open) {
    trayPanels.forEach((other) => {
      if (other === panel || other.hidden) return;
      other.hidden = true;
      trayToggles.get(other.dataset.tray)?.setAttribute("aria-expanded", "false");
      trayHooks.get(other.dataset.tray)?.close?.();
    });
    panel.hidden = false;
    toggle?.setAttribute("aria-expanded", "true");
    openTrayName = name;
    trayHooks.get(name)?.open?.();
    panel.focus({ preventScroll: true });
  } else {
    panel.hidden = true;
    toggle?.setAttribute("aria-expanded", "false");
    if (openTrayName === name) openTrayName = null;
    trayHooks.get(name)?.close?.();
  }
}

function closeTrays() {
  if (openTrayName) setTrayOpen(openTrayName, false);
}

trayPanels.forEach((panel) => {
  const name = panel.dataset.tray;
  const toggle = trayToggles.get(name);
  toggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeMenus();
    setTrayOpen(name, panel.hidden);
  });
});

document.addEventListener("click", (event) => {
  if (!openTrayName) return;
  if (event.target.closest(".os-tray-wrap")) return;
  closeTrays();
});

/* ------------------------------------------------------------ calendar */

const calendarPop = document.querySelector("[data-calendar]");
const calendarGrid = document.querySelector("[data-calendar-grid]");
const calendarWeekdays = document.querySelector("[data-calendar-weekdays]");
const calendarMonth = document.querySelector("[data-calendar-month]");
const calendarSelected = document.querySelector("[data-calendar-selected]");
const calendarFullDate = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const calendarMonthFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const calendarDayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const calendarWeekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short" });

let calendarView = startOfMonth(new Date());
let calendarSelectedDate = new Date();

function startOfMonth(value) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function dayKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekStartIndex() {
  try {
    const locale = new Intl.Locale(document.documentElement.lang || navigator.language);
    return (locale.weekInfo?.firstDay ?? 7) % 7;
  } catch {
    return 0;
  }
}

function renderCalendar() {
  if (!calendarPop || !calendarGrid || !calendarWeekdays || !calendarMonth) return;
  const now = new Date();
  document.querySelectorAll("[data-calendar-time]").forEach((node) => (node.textContent = clockTime.format(now)));
  document.querySelectorAll("[data-calendar-today-label]").forEach((node) => (node.textContent = longDate.format(now)));
  const firstWeekday = weekStartIndex();
  const month = calendarView.getMonth();
  const year = calendarView.getFullYear();

  calendarMonth.textContent = calendarMonthFormat.format(calendarView);

  const sunday = new Date(2024, 0, 7);
  calendarWeekdays.innerHTML = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + ((firstWeekday + index) % 7));
    return `<span>${calendarWeekdayFormat.format(date)}</span>`;
  }).join("");

  const firstOfMonth = new Date(year, month, 1);
  const offset = (firstOfMonth.getDay() - firstWeekday + 7) % 7;
  const start = new Date(year, month, 1 - offset);
  const todayKey = dayKey(now);
  const selectedKey = dayKey(calendarSelectedDate);

  calendarGrid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dayKey(date);
    const classes = ["os-calendar__day"];
    if (date.getMonth() !== month) classes.push("is-other-month");
    if (key === todayKey) classes.push("is-today");
    if (key === selectedKey) classes.push("is-selected");
    return `<button type="button" class="${classes.join(" ")}" data-calendar-day="${key}" aria-label="${calendarDayFormat.format(date)}"${key === todayKey ? ' aria-current="date"' : ""}${key === selectedKey ? ' aria-pressed="true"' : ""}>${date.getDate()}</button>`;
  }).join("");

  if (calendarSelected) {
    const isToday = selectedKey === todayKey;
    calendarSelected.textContent = `${isToday ? "Today · " : ""}${calendarFullDate.format(calendarSelectedDate)}`;
  }
}

registerTray("calendar", {
  open() {
    const now = new Date();
    calendarView = startOfMonth(now);
    calendarSelectedDate = now;
    renderCalendar();
  },
});

calendarGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-calendar-day]");
  if (!button) return;
  const [year, month, day] = button.dataset.calendarDay.split("-").map(Number);
  calendarSelectedDate = new Date(year, month - 1, day);
  renderCalendar();
});

document.querySelector("[data-calendar-prev]")?.addEventListener("click", () => {
  calendarView = new Date(calendarView.getFullYear(), calendarView.getMonth() - 1, 1);
  renderCalendar();
});

document.querySelector("[data-calendar-next]")?.addEventListener("click", () => {
  calendarView = new Date(calendarView.getFullYear(), calendarView.getMonth() + 1, 1);
  renderCalendar();
});

document.querySelector("[data-calendar-today-btn]")?.addEventListener("click", () => {
  const now = new Date();
  calendarView = startOfMonth(now);
  calendarSelectedDate = now;
  renderCalendar();
});

/* ------------------------------------------------------------- toasts */

const toastHost = document.querySelector("[data-toast-host]");

function toast(message, kind = "default") {
  if (!toastHost) return;
  while (toastHost.children.length >= 3) toastHost.firstElementChild?.remove();
  const node = document.createElement("div");
  node.className = "ds-toast";
  if (kind === "warn") node.dataset.kind = "warn";
  node.innerHTML = '<span class="ds-dot"></span><span></span>';
  node.lastElementChild.textContent = message;
  toastHost.appendChild(node);
  window.setTimeout(() => {
    node.classList.add("is-leaving");
    window.setTimeout(() => node.remove(), 240);
  }, 2800);
}

/* ------------------------------------------------------------ windows */

const windows = Array.from(document.querySelectorAll("[data-window]"));
const activeApp = document.querySelector("[data-active-app]");
let zCounter = 20;

const dockMap = {
  "open-explorer": "explorer",
  "open-settings": "settings",
  "open-terminal": "terminal",
  "open-music": "music",
  "open-about": "about",
  "open-shortcuts": "shortcuts",
};

function windowById(id) {
  return windows.find((win) => win.dataset.window === id) || null;
}

function isOpen(win) {
  return Boolean(win) && !win.hidden && !win.classList.contains("is-minimized");
}

function syncDock() {
  document.querySelectorAll(".os-dock__item[data-cmd]").forEach((button) => {
    const id = dockMap[button.dataset.cmd];
    if (!id) return;
    const open = isOpen(windowById(id));
    button.classList.toggle("is-open", open);
    button.classList.toggle("is-running", open);
    button.setAttribute("aria-pressed", String(open));
  });
}

function focusedWindow() {
  return windows.find((win) => win.classList.contains("is-focused") && isOpen(win)) || null;
}

function focusWindow(win) {
  if (!win) return;
  windows.forEach((other) => other.classList.toggle("is-focused", other === win));
  win.style.zIndex = String(++zCounter);
  if (activeApp) activeApp.textContent = win.dataset.title || "Desktop";
  syncDock();
}

function topmostWindow() {
  return windows
    .filter(isOpen)
    .sort((a, b) => (parseInt(b.style.zIndex || "0", 10) || 0) - (parseInt(a.style.zIndex || "0", 10) || 0))[0];
}

function openWindow(id) {
  const win = windowById(id);
  if (!win) return;
  win.hidden = false;
  win.classList.remove("is-minimized");
  win.classList.add("is-open");
  focusWindow(win);
  win.focus({ preventScroll: true });
  if (window.innerWidth <= 820) {
    win.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }
  syncDock();
}

function closeWindow(win) {
  if (!win) return;
  const wasFocused = win.classList.contains("is-focused");
  restoreMaximized(win);
  win.hidden = true;
  win.classList.remove("is-open", "is-focused", "is-minimized", "is-dragging");
  if (wasFocused) {
    const next = topmostWindow();
    if (next) focusWindow(next);
    else {
      if (activeApp) activeApp.textContent = "Desktop";
      windows.forEach((other) => other.classList.remove("is-focused"));
    }
  }
  syncDock();
}

function minimizeWindow(win) {
  if (!win) return;
  const wasFocused = win.classList.contains("is-focused");
  win.classList.add("is-minimized");
  win.classList.remove("is-focused");
  if (wasFocused) {
    const next = topmostWindow();
    if (next) focusWindow(next);
    else if (activeApp) activeApp.textContent = "Desktop";
  }
  syncDock();
}

function restoreMaximized(win) {
  if (!win.classList.contains("is-maximized")) return;
  const previous = win.dataset.restore;
  if (previous) {
    try {
      const saved = JSON.parse(previous);
      for (const [prop, value] of Object.entries(saved)) {
        if (value == null || value === "") win.style.removeProperty(prop);
        else win.style.setProperty(prop, value);
      }
    } catch {
      /* ignore */
    }
  }
  delete win.dataset.restore;
  win.classList.remove("is-maximized");
}

function maximizeWindow(win) {
  if (!win) return;
  if (win.classList.contains("is-maximized")) {
    restoreMaximized(win);
    focusWindow(win);
    return;
  }
  const saved = {};
  for (const prop of ["left", "top", "right", "bottom", "width", "height"]) {
    saved[prop] = win.style.getPropertyValue(prop) || "";
  }
  win.dataset.restore = JSON.stringify(saved);
  win.classList.add("is-maximized");
  win.style.left = "8px";
  win.style.top = "8px";
  win.style.right = "8px";
  win.style.bottom = "8px";
  win.style.width = "auto";
  win.style.height = "auto";
  focusWindow(win);
}

function startDrag(event, win) {
  if (window.innerWidth <= 820) return;
  if (event.button !== 0 || win.classList.contains("is-maximized")) return;
  if (event.target.closest("button, a, input, select, .os-eq")) return;
  focusWindow(win);

  const desktopRect = desktop.getBoundingClientRect();
  const rect = win.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  const width = rect.width;
  const height = rect.height;

  win.style.left = `${rect.left - desktopRect.left}px`;
  win.style.top = `${rect.top - desktopRect.top}px`;
  win.style.right = "auto";
  win.style.bottom = "auto";
  win.style.width = `${width}px`;
  win.style.height = `${height}px`;
  win.classList.add("is-dragging");

  function move(moveEvent) {
    const rawLeft = moveEvent.clientX - desktopRect.left - offsetX;
    const rawTop = moveEvent.clientY - desktopRect.top - offsetY;
    const left = Math.max(160 - width, Math.min(desktopRect.width - 140, rawLeft));
    const top = Math.max(0, Math.min(desktopRect.height - 42, rawTop));
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
  }

  function end() {
    win.classList.remove("is-dragging");
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", end);
    syncDock();
  }

  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  event.preventDefault();
}

windows.forEach((win) => {
  win.addEventListener("pointerdown", () => focusWindow(win), true);

  win.querySelectorAll("[data-drag-handle]").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => startDrag(event, win));
    handle.addEventListener("dblclick", (event) => {
      if (event.target.closest("button, a, input")) return;
      maximizeWindow(win);
    });
  });

  win.querySelectorAll("[data-window-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const action = button.dataset.windowAction;
      if (action === "close") closeWindow(win);
      else if (action === "minimize") minimizeWindow(win);
      else if (action === "maximize") maximizeWindow(win);
    });
  });
});

window.addEventListener("resize", () => {
  if (window.innerWidth <= 820) return;
  const rect = desktop.getBoundingClientRect();
  windows.forEach((win) => {
    if (!isOpen(win) || win.classList.contains("is-maximized")) return;
    const bounds = win.getBoundingClientRect();
    if (!bounds.width) return;
    const left = bounds.left - rect.left;
    const top = bounds.top - rect.top;
    if (left > rect.width - 140) win.style.left = `${Math.max(0, rect.width - 140)}px`;
    if (top > rect.height - 42) win.style.top = `${Math.max(0, rect.height - 42)}px`;
  });
});

/* -------------------------------------------------------------- menus */

const menuWraps = Array.from(document.querySelectorAll(".os-menu-wrap"));

function closeMenus(except = null) {
  menuWraps.forEach((wrap) => {
    if (wrap === except) return;
    wrap.querySelector(".os-menu")?.setAttribute("aria-expanded", "false");
    const pop = wrap.querySelector(".os-menu__pop");
    if (pop) pop.hidden = true;
  });
}

function toggleMenu(wrap) {
  const button = wrap.querySelector(".os-menu");
  const pop = wrap.querySelector(".os-menu__pop");
  if (!button || !pop) return;
  closeTrays();
  if (pop.hidden) {
    closeMenus(wrap);
    pop.hidden = false;
    button.setAttribute("aria-expanded", "true");
  } else {
    pop.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }
}

function openMenu(wrap) {
  const button = wrap.querySelector(".os-menu");
  const pop = wrap.querySelector(".os-menu__pop");
  if (!button || !pop || !pop.hidden) return;
  closeTrays();
  closeMenus(wrap);
  pop.hidden = false;
  button.setAttribute("aria-expanded", "true");
}

menuWraps.forEach((wrap) => {
  const button = wrap.querySelector(".os-menu");
  button?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu(wrap);
  });
  wrap.addEventListener("mouseenter", () => {
    if (!menuWraps.some((other) => other.querySelector(".os-menu__pop")?.hidden === false)) return;
    openMenu(wrap);
  });
});

/* ------------------------------------------------------------ explorer */

const providerLabel = () => PROVIDERS[state.provider].label;
const providerRoot = () => PROVIDERS[state.provider].root;

function statusMeta(entry, side) {
  if (side === "remote") {
    return REMOTE_STATUS[entry.status] || { label: entry.status, className: "st-unmatched" };
  }
  if (entry.status === "exact") return { label: `In ${providerLabel()}`, className: "st-exact" };
  if (entry.status === "moved_match" || entry.status === "moved") {
    return { label: "Moved match", className: "st-moved_match" };
  }
  if (entry.status === "local_only") return { label: "Local only", className: "st-local_only" };
  if (entry.status === "type_mismatch") return { label: "Type differs", className: "st-type_mismatch" };
  if (entry.status === "unmatched") return { label: `Not in ${providerLabel()}`, className: "st-unmatched" };
  if (entry.status === "possible") return { label: "Maybe", className: "st-possible" };
  if (entry.status === "partial") return { label: "Partial", className: "st-partial" };
  if (entry.status === "missing") return { label: "Missing", className: "st-missing" };
  return { label: entry.status, className: "st-unmatched" };
}

function entryPath(entry) {
  return entry.path || "";
}

function entryParent(entry) {
  const path = entryPath(entry);
  const cut = path.lastIndexOf("/");
  return cut > 0 ? path.slice(0, cut) : "/";
}

function sizeDisplay(entry) {
  if (!entry.isDir) return entry.size || "—";
  if (state.sizeMode === "files") {
    return entry.childCount != null ? `${entry.childCount.toLocaleString()} items` : "—";
  }
  if (state.sizeMode === "both") {
    return `${entry.folderSize || "—"} · ${(entry.childCount ?? 0).toLocaleString()} items`;
  }
  return entry.folderSize || "—";
}

function iconForEntry(entry) {
  if (entry.isDir) return { id: "i-folder", className: "is-folder" };
  const name = entry.name.toLowerCase();
  if (name.endsWith(".md")) return { id: "i-file-text", className: "is-text" };
  if (name.endsWith(".json") || name.endsWith(".sh")) return { id: "i-code-file", className: "is-code" };
  if (name.startsWith(".")) return { id: "i-code-file", className: "is-env" };
  return { id: "i-file", className: "is-text" };
}

function iconHtml(entry) {
  const icon = iconForEntry(entry);
  return `<span class="osx-row-icon ${icon.className}"><svg class="icon"><use href="#${icon.id}"/></svg></span>`;
}

function visibleColumns() {
  return COLUMN_DEFS.filter((col) => state.columns.has(col.id));
}

function columnTemplate() {
  return visibleColumns().map((col) => col.width).join(" ");
}

function statusFilters(side) {
  return state.filters[side];
}

function filterOptions(side) {
  return FILTER_OPTIONS[side].map((value) => {
    const entry = DATA[side].find((item) => item.status === value) || { status: value };
    return { value, ...statusMeta(entry, side) };
  });
}

function baseEntries(side) {
  return state.hidden ? DATA[side] : DATA[side].filter((entry) => !entry.name.startsWith("."));
}

function compareEntries(a, b, sort) {
  const factor = sort.dir === "desc" ? -1 : 1;
  const id = sort.id;
  let result = 0;
  if (id === "name") result = a.name.localeCompare(b.name, undefined, { numeric: true });
  else if (id === "type") {
    const typeA = a.isDir ? "Folder" : a.type || "File";
    const typeB = b.isDir ? "Folder" : b.type || "File";
    result = typeA.localeCompare(typeB) || a.name.localeCompare(b.name);
  } else if (id === "status") {
    result = statusMeta(a, sort.side).label.localeCompare(statusMeta(b, sort.side).label) || a.name.localeCompare(b.name);
  } else if (id === "size") {
    result = (a.sizeValue || 0) - (b.sizeValue || 0);
  } else if (id === "modified") {
    result = String(a.modified || "").localeCompare(String(b.modified || ""));
  }
  return result * factor;
}

function currentEntries(side) {
  let rows = baseEntries(side);
  const query = (state.search[side] || "").trim().toLowerCase();
  if (query) {
    rows = rows.filter(
      (entry) =>
        entry.name.toLowerCase().includes(query) ||
        entryPath(entry).toLowerCase().includes(query),
    );
  }
  const filters = statusFilters(side);
  if (filters.size) rows = rows.filter((entry) => filters.has(entry.status));
  const sort = { ...state.sort[side], side };
  return [...rows].sort((a, b) => compareEntries(a, b, sort));
}

function isSelected(side, entry) {
  return state.selected?.side === side && state.selected?.name === entry.name;
}

function rowHtml(entry, side) {
  const status = statusMeta(entry, side);
  const selected = isSelected(side, entry);
  const cell = (id, content, className, extra = "") =>
    `<div class="osx-cell ${className}"${state.columns.has(id) ? "" : " hidden"}${extra}>${content}</div>`;
  return `<div class="osx-row${selected ? " is-selected" : ""}" role="option" aria-selected="${selected}" data-entry="${esc(entry.name)}" data-side="${side}" title="${esc(entryPath(entry))}">
    ${cell("name", `${iconHtml(entry)}<span class="osx-name" title="${esc(entryPath(entry))}">${esc(entry.name)}</span>`, "osx-cell-name")}
    ${cell("type", esc(entry.isDir ? "Folder" : entry.type || "File"), "osx-cell-type")}
    ${cell("status", `<span class="osx-status-chip ${status.className}" title="${esc(entry.note || status.label)}"><span class="dot"></span><span>${esc(status.label)}</span></span>`, "osx-cell-status")}
    ${cell("size", esc(sizeDisplay(entry)), "osx-cell-size")}
    ${cell("modified", entry.modified ? esc(date(entry.modified)) : "—", "osx-cell-mod")}
  </div>`;
}

function renderColumns(side) {
  const pane = document.querySelector(`[data-pane="${side}"]`);
  const head = document.querySelector(`[data-column-head="${side}"]`);
  if (!pane || !head) return;
  pane.style.setProperty("--osx-cols", columnTemplate());
  head.querySelectorAll("button[data-sort]").forEach((button) => {
    const id = button.dataset.sort;
    button.hidden = !state.columns.has(id);
    const sort = state.sort[side];
    button.classList.toggle("is-sorted", sort.id === id);
    button.classList.toggle("is-desc", sort.id === id && sort.dir === "desc");
  });
}

function renderFilterPop(side) {
  const pop = document.querySelector(`[data-filter-pop="${side}"]`);
  if (!pop) return;
  const active = statusFilters(side);
  pop.innerHTML = `<div class="osx-filter-head"><span>Show only</span><button type="button" data-filter-clear="${side}">Clear all</button></div>${filterOptions(side)
    .map(
      (option) => `<label class="osx-filter-option"><input type="checkbox" value="${option.value}" ${active.has(option.value) ? "checked" : ""}><span class="dot" style="background:${STATUS_COLORS[option.value] || "var(--ds-gray)"}"></span><span>${esc(option.label)}</span></label>`,
    )
    .join("")}`;
  pop.querySelectorAll("input[type=checkbox]").forEach((box) => {
    box.addEventListener("change", () => {
      const filters = statusFilters(side);
      if (box.checked) filters.add(box.value);
      else filters.delete(box.value);
      renderPane(side);
      renderStatusbar();
    });
  });
  pop.querySelector(`[data-filter-clear="${side}"]`)?.addEventListener("click", () => {
    statusFilters(side).clear();
    renderPane(side);
    renderStatusbar();
    renderFilterPop(side);
    pop.hidden = false;
  });
}

function renderPaneFoot(side) {
  const summary = document.querySelector(`[data-pane-summary="${side}"]`);
  const chips = document.querySelector(`[data-pane-chips="${side}"]`);
  if (!summary || !chips) return;
  const base = baseEntries(side);
  const visible = currentEntries(side);
  const filters = statusFilters(side);
  const filtering = Boolean(state.search[side].trim()) || filters.size > 0;
  if (filtering) {
    summary.textContent = `${visible.length} of ${base.length} items · ${filters.size ? filterLabel(side) : "search"}`;
  } else {
    const meta = SUMMARY[side];
    summary.textContent = `${meta.items} items · ${meta.dirs} folders · ${meta.files} files · ${meta.size}`;
  }
  const counts = new Map();
  for (const entry of base) counts.set(entry.status, (counts.get(entry.status) || 0) + 1);
  const order = ["missing", "partial", "possible", "moved", "type_mismatch", "moved_match", "local_only", "unmatched", "exact"];
  chips.innerHTML = order
    .filter((status) => status !== "exact" && counts.get(status))
    .map((status) => {
      const meta = statusMeta(base.find((entry) => entry.status === status) || { status }, side);
      return `<button type="button" class="osx-mini-chip ${meta.className}${filters.has(status) ? " is-active" : ""}" data-mini-filter="${side}" data-status="${status}" title="Toggle ${esc(meta.label)} in the filter"><span class="dot"></span><span>${esc(meta.label)} ${counts.get(status)}</span></button>`;
    })
    .join("");
}

function filterLabel(side) {
  const filters = statusFilters(side);
  if (!filters.size) return "Filter";
  if (filters.size === 1) {
    const value = [...filters][0];
    const entry = DATA[side].find((item) => item.status === value) || { status: value };
    return statusMeta(entry, side).label;
  }
  return `Filter · ${filters.size}`;
}

function renderPane(side) {
  const rowsEl = document.querySelector(`[data-rows="${side}"]`);
  if (!rowsEl) return;
  const rows = currentEntries(side);
  rowsEl.innerHTML = rows.length
    ? rows.map((entry) => rowHtml(entry, side)).join("")
    : `<div class="osx-empty">${
        state.search[side].trim()
          ? `No items match “${esc(state.search[side].trim())}”.`
          : statusFilters(side).size
            ? "No items match the selected status filters."
            : "This folder is empty."
      }</div>`;
  renderColumns(side);
  renderPaneFoot(side);

  const filterButton = document.querySelector(`[data-filter-toggle="${side}"]`);
  if (filterButton) {
    filterButton.classList.toggle("is-active", statusFilters(side).size > 0);
    const label = filterButton.querySelector("span");
    if (label) label.textContent = filterLabel(side);
  }
}

function renderStatusbar() {
  const selection = document.querySelector("[data-selection]");
  const reveal = document.querySelector('.osx-statusbar [data-cmd="reveal-selected"]');
  if (!selection || !reveal) return;
  const entry = selectedEntry();
  if (!entry) {
    selection.innerHTML = '<span class="muted">Select an item to see details.</span>';
    reveal.disabled = true;
    reveal.textContent = "Reveal counterpart";
    return;
  }
  const side = state.selected.side;
  const status = statusMeta(entry, side);
  const meta = entry.isDir ? `Folder · ${sizeDisplay(entry)}` : `File · ${entry.size || "—"}`;
  const modified = entry.modified ? ` · ${date(entry.modified)}` : "";
  selection.innerHTML = `<span class="osx-sel-name" title="${esc(entryPath(entry))}">${esc(entry.name)}</span>
    <span class="osx-sel-meta">${esc(meta)}${esc(modified)}</span>
    <span class="osx-status-chip ${status.className}" title="${esc(entry.note || status.label)}"><span class="dot"></span><span>${esc(status.label)}</span></span>
    ${entry.foundAt ? `<button type="button" class="osx-sel-found" data-found-at="${esc(entry.foundAt)}" title="${esc(entry.foundAt)}">Found at: ${esc(entry.foundAt)}</button>` : ""}`;
  const target = counterpartTarget(entry, side);
  reveal.disabled = !target;
  reveal.textContent = side === "remote" ? "Show in local index" : `Show in ${providerLabel()}`;
}

function renderProviderUi() {
  const provider = PROVIDERS[state.provider];
  document.querySelectorAll("[data-provider-label]").forEach((node) => (node.textContent = provider.label));
  document.querySelectorAll("[data-provider-name]").forEach((node) => (node.textContent = provider.label));
  document.querySelectorAll("[data-provider-root]").forEach((node) => (node.textContent = provider.root));
  document.querySelectorAll(".osx-provider-choice").forEach((button) => {
    const active = button.dataset.provider === state.provider;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  const remoteSearch = document.querySelector('[data-search="remote"]');
  if (remoteSearch) {
    remoteSearch.placeholder = `Search ${provider.label}…`;
    remoteSearch.setAttribute("aria-label", `Search ${provider.label}`);
  }
  const crumb = document.querySelector('[data-crumb="remote"]');
  if (crumb) crumb.textContent = provider.root;
  const remotePane = document.querySelector('[data-pane="remote"] .osx-pane-icon--remote');
  if (remotePane) remotePane.style.color = provider.key === "google_drive" ? "#4285f4" : "#a78bfa";
}

function renderAll() {
  renderProviderUi();
  renderPane("local");
  renderPane("remote");
  renderStatusbar();
  if (state.sidePanel) renderSidePanel();
}

function selectedEntry() {
  if (!state.selected) return null;
  return DATA[state.selected.side].find((entry) => entry.name === state.selected.name) || null;
}

function setActiveSide(side) {
  state.activeSide = side;
  document.querySelectorAll(".osx-pane").forEach((pane) => {
    pane.classList.toggle("is-active", pane.dataset.pane === side);
  });
  updateFilterButtonLabels();
}

function updateFilterButtonLabels() {
  for (const side of ["local", "remote"]) {
    const button = document.querySelector(`[data-filter-toggle="${side}"]`);
    if (!button) continue;
    button.classList.toggle("is-active", statusFilters(side).size > 0);
    const label = button.querySelector("span");
    if (label) label.textContent = filterLabel(side);
  }
}

function selectEntry(side, name, { scroll = false } = {}) {
  const entry = DATA[side].find((item) => item.name === name);
  if (!entry) return;
  state.selected = { side, name };
  setActiveSide(side);
  document.querySelectorAll(".osx-row").forEach((row) => {
    const active = row.dataset.side === side && row.dataset.entry === name;
    row.classList.toggle("is-selected", active);
    row.setAttribute("aria-selected", String(active));
  });
  renderStatusbar();
  if (state.sidePanel === "detail") renderSidePanel();
  if (scroll) {
    const row = Array.from(document.querySelectorAll(`[data-rows="${side}"] .osx-row`)).find(
      (item) => item.dataset.entry === name,
    );
    row?.scrollIntoView({ block: "nearest" });
  }
}

function counterpartTarget(entry, side) {
  if (!entry) return null;
  if (side === "remote") {
    if (entry.status === "missing") return null;
    if (entry.status === "moved" || entry.status === "possible") return entry.foundAt || null;
    return entry.path;
  }
  if (entry.status === "local_only" || entry.status === "unmatched") return null;
  if (entry.status === "moved_match" || entry.status === "moved") return entry.foundAt || null;
  if (entry.status === "type_mismatch") return entry.path;
  return entry.foundAt || entry.path;
}

function revealSelected() {
  openWindow("explorer");
  const entry = selectedEntry();
  if (!entry || !state.selected) {
    toast("Select a file or folder first", "warn");
    return;
  }
  const side = state.selected.side;
  const target = counterpartTarget(entry, side);
  if (!target) {
    toast(`No counterpart for ${entry.name}`, "warn");
    return;
  }
  const other = side === "local" ? "remote" : "local";
  const match = DATA[other].find((item) => item.path === target || item.name === entry.name);
  if (match) {
    const base = baseEntries(other);
    if (!base.some((item) => item.name === match.name)) {
      state.hidden = true;
      const input = document.querySelector("[data-hidden-toggle]");
      if (input) input.checked = true;
    }
    clearPaneFilters(other);
    renderAll();
    selectEntry(other, match.name, { scroll: true });
    const row = Array.from(document.querySelectorAll(`[data-rows="${other}"] .osx-row`)).find(
      (item) => item.dataset.entry === match.name,
    );
    if (row) {
      row.classList.remove("is-flash");
      void row.offsetWidth;
      row.classList.add("is-flash");
      window.setTimeout(() => row.classList.remove("is-flash"), 1200);
    }
    toast(`Counterpart · ${target}`);
  } else {
    toast(`Counterpart · ${target}`);
  }
}

function openSelected() {
  openWindow("explorer");
  const entry = selectedEntry();
  if (!entry) {
    toast("Select a file or folder first", "warn");
    return;
  }
  if (entry.isDir) {
    toast(`Opened folder · ${entry.name}`);
  } else {
    setSidePanel("detail", state.selected.side, entry.name);
  }
}

function mirrorPanes() {
  openWindow("explorer");
  document.querySelectorAll(".osx-pane").forEach((pane) => {
    pane.classList.remove("is-flash");
    void pane.offsetWidth;
    pane.classList.add("is-flash");
    window.setTimeout(() => pane.classList.remove("is-flash"), 1000);
  });
  toast(`Both panes pinned to ${state.activeSide === "local" ? "/mnt/tank" : providerRoot()}`);
}

/* ------------------------------------------------------------- side panel */

function setSidePanel(mode, side = state.activeSide, entryName = state.selected?.name) {
  const panel = document.querySelector("[data-side-panel]");
  const win = windowById("explorer");
  if (!panel || !win) return;
  if (mode) openWindow("explorer");
  if (!mode) {
    state.sidePanel = null;
    panel.hidden = true;
    win.classList.remove("has-side");
    return;
  }
  state.sidePanel = mode;
  state.sidePanelSide = side;
  panel.hidden = false;
  win.classList.add("has-side");
  renderSidePanel();
}

function toggleSidePanel(mode, side = state.activeSide, entryName = state.selected?.name) {
  if (state.sidePanel === mode) setSidePanel(null);
  else setSidePanel(mode, side, entryName);
}

function sidePanelData() {
  return {
    columns: {
      title: "Columns",
      subtitle: "Choose what both panes show and how folder sizes read.",
    },
    detail: {
      title: "Details",
      subtitle: "Right-click a file or folder to inspect it.",
    },
    analytics: {
      title: "Analytics",
      subtitle: `${providerLabel()} snapshot totals and index coverage.`,
    },
    source: {
      title: state.sidePanelSide === "local" ? "Local index" : `${providerLabel()} snapshot`,
      subtitle: state.sidePanelSide === "local" ? "Reference side for every comparison." : "Remote side of the comparison.",
    },
  };
}

function renderSidePanel() {
  const panel = document.querySelector("[data-side-panel]");
  if (!panel || !state.sidePanel) return;
  const meta = sidePanelData()[state.sidePanel];
  panel.querySelector("[data-side-title]").textContent = meta.title;
  panel.querySelector("[data-side-subtitle]").textContent = meta.subtitle;
  const body = panel.querySelector("[data-side-body]");
  if (!body) return;

  if (state.sidePanel === "columns") {
    body.innerHTML = `<div class="osx-columns-options">${COLUMN_DEFS.map(
      (col) => `<label class="osx-columns-option"><input type="checkbox" data-column-toggle="${col.id}" ${state.columns.has(col.id) ? "checked" : ""} ${col.required ? "disabled" : ""}><span class="osx-columns-text"><span class="osx-columns-title">${col.label}</span><span class="osx-columns-hint">${col.required ? "Always shown" : col.hint}</span></span></label>`,
    ).join("")}
      <label class="osx-columns-setting"><span class="osx-columns-text"><span class="osx-columns-title">Folder size</span><span class="osx-columns-hint">Choose how the Size column shows folders.</span></span><select class="osx-select" data-size-mode aria-label="Folder size display"><option value="bytes" ${state.sizeMode === "bytes" ? "selected" : ""}>Size in bytes</option><option value="files" ${state.sizeMode === "files" ? "selected" : ""}>Item count</option><option value="both" ${state.sizeMode === "both" ? "selected" : ""}>Bytes + item count</option></select></label>
    </div>
    <div class="osx-side-foot"><button type="button" class="osx-btn osx-btn--ghost" data-columns-reset>Reset columns</button><p>Right-click a table header any time to reopen this sidebar.</p></div>`;
    body.querySelectorAll("[data-column-toggle]").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) state.columns.add(input.dataset.columnToggle);
        else state.columns.delete(input.dataset.columnToggle);
        state.columns.add("name");
        saveColumns();
        renderAll();
      });
    });
    body.querySelector("[data-size-mode]")?.addEventListener("change", (event) => {
      state.sizeMode = event.target.value;
      try {
        localStorage.setItem(SIZE_KEY, state.sizeMode);
      } catch {
        /* ignore */
      }
      renderAll();
    });
    body.querySelector("[data-columns-reset]")?.addEventListener("click", () => {
      state.columns = new Set(DEFAULT_COLUMNS);
      state.sizeMode = "bytes";
      saveColumns();
      try {
        localStorage.setItem(SIZE_KEY, state.sizeMode);
      } catch {
        /* ignore */
      }
      renderAll();
    });
    return;
  }

  if (state.sidePanel === "detail") {
    const key = state.selected?.name;
    const side = state.selected?.side || state.sidePanelSide;
    const entry = key ? DATA[side].find((item) => item.name === key) : null;
    if (!entry) {
      body.innerHTML = '<p class="osx-detail-note">Right-click a file or folder to inspect it.</p>';
      return;
    }
    const status = statusMeta(entry, side);
    const facts = [
      entry.isDir
        ? ["Folder size", entry.folderSize || "—"]
        : ["Size", entry.size || "—"],
      entry.isDir ? ["Items", entry.childCount != null ? `${entry.childCount.toLocaleString()} direct` : "—"] : null,
      entry.modified ? ["Modified", date(entry.modified)] : null,
      entry.path ? ["Folder", entryParent(entry)] : null,
      entry.foundAt ? ["Found at", entry.foundAt] : null,
      ["Source", side === "local" ? "Local index" : providerLabel()],
    ].filter(Boolean);
    body.innerHTML = `<div class="osx-detail-body">
      <div class="osx-detail-hero"><span class="osx-detail-icon">${iconHtml(entry)}</span><div style="min-width:0"><h3>${esc(entry.name)}</h3><p class="osx-detail-path">${esc(entryPath(entry))}</p></div></div>
      <div class="osx-detail-badges"><span class="osx-detail-type">${entry.isDir ? "Folder" : esc(entry.type || "File")}</span><span class="osx-status-chip ${status.className}"><span class="dot"></span><span>${esc(status.label)}</span></span></div>
      <div class="osx-detail-facts">${facts.map(([label, value]) => `<div class="osx-detail-fact${label === "Found at" || label === "Folder" ? " is-mono" : ""}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join("")}</div>
      ${entry.note ? `<p class="osx-detail-note">${esc(entry.note)}</p>` : ""}
      <div class="osx-detail-actions">${entry.isDir ? `<button type="button" class="osx-btn osx-btn--primary" data-detail-open>Open folder</button>` : ""}<button type="button" class="osx-btn" data-detail-reveal ${counterpartTarget(entry, side) ? "" : "disabled"}>${side === "remote" ? "Show in local index" : `Show in ${providerLabel()}`}</button></div>
    </div>`;
    body.querySelector("[data-detail-open]")?.addEventListener("click", openSelected);
    body.querySelector("[data-detail-reveal]")?.addEventListener("click", revealSelected);
    return;
  }

  if (state.sidePanel === "analytics") {
    const remote = SUMMARY.remote;
    const coverage = 87.7;
    const counts = new Map();
    for (const entry of DATA.remote) counts.set(entry.status, (counts.get(entry.status) || 0) + 1);
    body.innerHTML = `<div class="osx-detail-body">
      <div class="osx-detail-hero"><span class="osx-detail-icon"><svg class="icon"><use href="#i-chart"/></svg></span><div><h3>${providerLabel()} analytics</h3><p class="osx-detail-path">explorer-water-settings · snapshot</p></div></div>
      <div class="osx-analytics-stats">
        <div class="osx-analytics-stat"><span>Files</span><b>${remote.files.toLocaleString()}</b></div>
        <div class="osx-analytics-stat"><span>Folders</span><b>${remote.dirs.toLocaleString()}</b></div>
        <div class="osx-analytics-stat"><span>Total size</span><b>${remote.size}</b></div>
        <div class="osx-analytics-stat good"><span>Coverage</span><b>${coverage.toFixed(1)}%</b></div>
      </div>
      <div class="osx-analytics-coverage"><span class="osx-analytics-track"><span class="osx-analytics-fill" style="width:${coverage}%"></span></span><span class="osx-analytics-pct">${coverage.toFixed(1)}%</span></div>
      <h4 class="osx-side-section-title">Snapshot</h4>
      <div class="osx-detail-facts">
        <div class="osx-detail-fact"><span>Version</span><b>2026-11-17</b></div>
        <div class="osx-detail-fact"><span>Date</span><b>17 Nov 2026</b></div>
        <div class="osx-detail-fact"><span>Root</span><b>${esc(providerRoot())}</b></div>
        <div class="osx-detail-fact is-mono"><span>Archive file</span><b>archive.json</b></div>
      </div>
      <h4 class="osx-side-section-title">Status breakdown</h4>
      <div>${[["Same path", "exact", "good"], ["Moved", "moved", "ok"], ["Maybe", "possible", "warn"], ["Missing", "missing", "low"]].map(([label, status, tone]) => `<div class="osx-analytics-row"><span><span class="dot ${tone}"></span>${label}</span><b>${(counts.get(status) || 0).toLocaleString()} files</b><b>—</b></div>`).join("")}</div>
      <p class="osx-side-note">Computed from the snapshot and file_indexer.db · not a live mount</p>
    </div>`;
    return;
  }

  if (state.sidePanel === "source") {
    const local = state.sidePanelSide === "local";
    const facts = local
      ? [
          ["Source", "file_indexer.db"],
          ["Root", "/mnt/tank"],
          ["Index date", "26 Aug 2026"],
          ["Entries", "2,431,882"],
          ["Database size", "614 MB"],
        ]
      : [
          ["Provider", providerLabel()],
          ["Snapshot version", "2026-11-17"],
          ["Snapshot date", "17 Nov 2026"],
          ["Archive file", "archive.json"],
          ["Root", providerRoot()],
          ["Coverage", "87.7%"],
        ];
    body.innerHTML = `<div class="osx-detail-body">
      <div class="osx-detail-hero"><span class="osx-detail-icon">${local ? '<svg class="icon"><use href="#i-local"/></svg>' : '<svg class="icon"><use href="#i-cloud"/></svg>'}</span><div><h3>${local ? "Local index" : `${providerLabel()} snapshot`}</h3><p class="osx-detail-path">${local ? "file_indexer.db" : "archive.json"}</p></div></div>
      <div class="osx-detail-badges"><span class="osx-detail-type">${local ? "SQLite index" : "Remote listing"}</span><span class="osx-status-chip st-exact"><span class="dot"></span><span>Snapshot</span></span><span class="osx-status-chip st-unmatched"><span class="dot"></span><span>Read-only</span></span></div>
      <div class="osx-detail-facts">${facts.map(([label, value]) => `<div class="osx-detail-fact${label === "Source" || label === "Root" || label === "Archive file" ? " is-mono" : ""}"><span>${label}</span><b>${esc(value)}</b></div>`).join("")}</div>
      <div class="osx-source-compare">local index <b>(26 Aug 2026)</b> <i>⇄</i> ${providerLabel().toLowerCase()} snapshot <b>(17 Nov 2026)</b></div>
      <p class="osx-detail-note">${local ? "file_indexer.db snapshot · not a live mount" : "Snapshot · virtual read-only view"}</p>
    </div>`;
  }
}

/* rows and pane interaction */

document.querySelectorAll("[data-rows]").forEach((rows) => {
  const side = rows.dataset.rows;
  rows.addEventListener("click", (event) => {
    const row = event.target.closest(".osx-row");
    if (!row) return;
    setActiveSide(side);
    selectEntry(side, row.dataset.entry);
  });
  rows.addEventListener("dblclick", (event) => {
    const row = event.target.closest(".osx-row");
    if (!row) return;
    selectEntry(side, row.dataset.entry);
    openSelected();
  });
  rows.addEventListener("contextmenu", (event) => {
    const row = event.target.closest(".osx-row");
    if (!row) return;
    event.preventDefault();
    selectEntry(side, row.dataset.entry);
    setSidePanel("detail", side, row.dataset.entry);
  });
  rows.addEventListener("keydown", (event) => {
    const visible = Array.from(rows.querySelectorAll(".osx-row"));
    if (!visible.length) return;
    const index = visible.findIndex((row) => row.classList.contains("is-selected"));
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = visible[Math.min(visible.length - 1, index < 0 ? 0 : index + 1)];
      selectEntry(side, next.dataset.entry);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = visible[Math.max(0, index < 0 ? 0 : index - 1)];
      selectEntry(side, next.dataset.entry);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectEntry(side, visible[0].dataset.entry);
    } else if (event.key === "End") {
      event.preventDefault();
      selectEntry(side, visible[visible.length - 1].dataset.entry);
    } else if (event.key === "Enter") {
      event.preventDefault();
      openSelected();
    } else if (event.key === "Backspace") {
      event.preventDefault();
      toast("Already at the snapshot root", "warn");
    }
  });
  rows.addEventListener("focus", () => setActiveSide(side));
});

document.querySelectorAll("[data-pane]").forEach((pane) => {
  pane.addEventListener("pointerdown", () => setActiveSide(pane.dataset.pane));
});

document.querySelectorAll("[data-search]").forEach((input) => {
  input.addEventListener("input", () => {
    const side = input.dataset.search;
    state.search[side] = input.value;
    renderPane(side);
    renderStatusbar();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      input.value = "";
      state.search[input.dataset.search] = "";
      renderPane(input.dataset.search);
      renderStatusbar();
    }
  });
});

document.querySelectorAll("[data-scope]").forEach((select) => {
  select.addEventListener("change", () => {
    state.scope[select.dataset.scope] = select.value;
  });
});

document.querySelectorAll("[data-filter-toggle]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const side = button.dataset.filterToggle;
    const pop = document.querySelector(`[data-filter-pop="${side}"]`);
    const opening = pop?.hidden;
    document.querySelectorAll("[data-filter-pop]").forEach((other) => (other.hidden = true));
    document.querySelectorAll("[data-filter-toggle]").forEach((other) => other.setAttribute("aria-expanded", "false"));
    if (opening && pop) {
      renderFilterPop(side);
      pop.hidden = false;
      button.setAttribute("aria-expanded", "true");
    }
  });
});

document.querySelectorAll("[data-column-head]").forEach((head) => {
  head.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-sort]");
    if (!button) return;
    const side = head.dataset.columnHead;
    const id = button.dataset.sort;
    const current = state.sort[side];
    if (current.id === id) current.dir = current.dir === "asc" ? "desc" : "asc";
    else {
      current.id = id;
      current.dir = "asc";
    }
    renderPane(side);
    renderStatusbar();
  });
});

document.querySelectorAll("[data-nav]").forEach((button) => {
  button.addEventListener("click", () => {
    toast("Already at the snapshot root", "warn");
  });
});

document.querySelectorAll("[data-provider]").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.provider === button.dataset.provider) return;
    state.provider = button.dataset.provider;
    saveProvider();
    renderAll();
    toast(`Remote provider · ${providerLabel()}`);
  });
});

document.querySelectorAll("[data-crumb]").forEach((button) => {
  button.addEventListener("click", () => {
    toast(button.dataset.crumb === "local" ? "Local root · /mnt/tank" : `${providerLabel()} root · ${providerRoot()}`);
  });
});

document.querySelector("[data-hidden-toggle]")?.addEventListener("change", (event) => {
  state.hidden = event.target.checked;
  renderAll();
});

document.querySelectorAll("[data-source-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    const side = button.dataset.sourcePanel;
    setSidePanel("source", side);
  });
});

document.querySelector("[data-side-close]")?.addEventListener("click", () => setSidePanel(null));

document.querySelector("[data-selection]")?.addEventListener("click", (event) => {
  if (event.target.closest("[data-found-at]")) revealSelected();
});

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

/* ------------------------------------------------------------ command bar */

const overlay = document.querySelector("[data-command-overlay]");
const commandInput = document.querySelector("[data-command-input]");
const commandResults = document.querySelector("[data-command-results]");
const commandEmpty = document.querySelector("[data-command-empty]");
const commandSpinner = document.querySelector("[data-command-spinner]");
let previousFocus = null;

function fuzzyScore(text, query) {
  const hay = String(text || "").toLowerCase();
  const needle = String(query || "").toLowerCase();
  if (!needle) return 0;
  if (!hay) return -1;
  const direct = hay.indexOf(needle);
  if (direct >= 0) return 100 - Math.min(direct, 50) - Math.min(hay.length, 200) * 0.08;
  let pos = 0;
  let previous = -2;
  let streak = 0;
  let score = 0;
  for (const ch of needle) {
    const found = hay.indexOf(ch, pos);
    if (found < 0) return -1;
    streak = found === previous + 1 ? streak + 1 : 0;
    score += 4 + streak * 3 - Math.min(found - pos, 8);
    previous = found;
    pos = found + 1;
  }
  return score - Math.min(hay.length, 200) * 0.05;
}

function scoreCommand(item, query) {
  const title = fuzzyScore(item.title, query);
  const extra = Math.max(
    fuzzyScore(item.subtitle || "", query),
    fuzzyScore(item.keywords || "", query),
    fuzzyScore(item.group, query),
  );
  if (title < 0 && extra < 0) return -1;
  return (title < 0 ? 0 : title * 2) + (extra < 0 ? 0 : extra);
}

function commandIcon(name) {
  const ids = {
    local: "i-local",
    remote: "i-cloud",
    home: "i-folder",
    back: "i-chevron-left",
    forward: "i-chevron-right",
    up: "i-chevron-up",
    mirror: "i-sync",
    search: "i-search",
    hidden: "i-file",
    legend: "i-info",
    keyboard: "i-keyboard",
    columns: "i-columns",
    analytics: "i-chart",
    details: "i-info",
    reset: "i-sync",
    sort: "i-sort",
    filter: "i-filter",
    theme: "i-sun",
    water: "i-drop",
    provider: "i-cloud",
    check: "i-check",
    settings: "i-gear",
  };
  return ids[name] || "i-command";
}

function addCommand(items, groups, group, title, opts = {}) {
  if (!groups.has(group)) groups.set(group, groups.size);
  items.push({
    kind: "command",
    key: `cmd:${opts.key || `${group}:${title}`}`,
    group,
    groupIndex: groups.get(group),
    seq: items.length,
    title,
    subtitle: opts.subtitle || "",
    keywords: opts.keywords || "",
    icon: opts.icon || "settings",
    check: Boolean(opts.check),
    aside: opts.aside || "",
    run: opts.run || (() => {}),
  });
}

function commandCatalog() {
  const items = [];
  const groups = new Map();
  const provider = providerLabel();
  const active = state.activeSide;
  const entry = selectedEntry();
  const target = entry ? counterpartTarget(entry, state.selected?.side) : null;

  addCommand(items, groups, "Navigation", "Focus local pane", {
    key: "focus-local",
    icon: "local",
    subtitle: "Move keyboard focus to the local index",
    keywords: "left side",
    run: () => {
      openWindow("explorer");
      setActiveSide("local");
      document.querySelector('[data-rows="local"]')?.focus();
    },
  });
  addCommand(items, groups, "Navigation", `Focus ${provider} pane`, {
    key: "focus-remote",
    icon: "remote",
    subtitle: "Move keyboard focus to the remote snapshot",
    keywords: "right side cloud",
    run: () => {
      openWindow("explorer");
      setActiveSide("remote");
      document.querySelector('[data-rows="remote"]')?.focus();
    },
  });
  addCommand(items, groups, "Navigation", "Go to local root", {
    icon: "home",
    subtitle: "/mnt/tank",
    keywords: "start home top",
    run: () => toast("Local root · /mnt/tank"),
  });
  addCommand(items, groups, "Navigation", `Go to ${provider} root`, {
    icon: "home",
    subtitle: providerRoot(),
    keywords: "start home top cloud",
    run: () => toast(`${provider} root · ${providerRoot()}`),
  });
  addCommand(items, groups, "Navigation", "Go back", {
    icon: "back",
    subtitle: `${active === "local" ? "Local index" : provider} · ${active === "local" ? "/mnt/tank" : providerRoot()}`,
    keywords: "history previous",
    run: () => toast("No history in this snapshot view", "warn"),
  });
  addCommand(items, groups, "Navigation", "Go forward", {
    icon: "forward",
    subtitle: `${active === "local" ? "Local index" : provider} · ${active === "local" ? "/mnt/tank" : providerRoot()}`,
    keywords: "history next",
    run: () => toast("No history in this snapshot view", "warn"),
  });
  addCommand(items, groups, "Navigation", "Go up one folder", {
    icon: "up",
    subtitle: "Already at the root",
    keywords: "parent directory",
    run: () => toast("Already at the snapshot root", "warn"),
  });
  addCommand(items, groups, "Navigation", "Show this path in the other pane", {
    icon: "mirror",
    subtitle: `Mirror ${active === "local" ? "/mnt/tank" : providerRoot()}`,
    keywords: "same path compare",
    run: mirrorPanes,
  });
  if (entry) {
    addCommand(items, groups, "Navigation", entry.isDir ? "Open selected folder" : "Open selected item", {
      key: "open-selected",
      icon: entry.isDir ? "local" : "remote",
      subtitle: entry.path,
      keywords: "enter selected",
      run: openSelected,
    });
    if (target) {
      addCommand(items, groups, "Navigation", "Reveal selected counterpart", {
        key: "reveal-selected",
        icon: "mirror",
        subtitle: target,
        keywords: "find other side match",
        run: revealSelected,
      });
    }
  }

  addCommand(items, groups, "Search", "Search the active pane", {
    icon: "search",
    subtitle: "Focus the search field in the active pane",
    keywords: "find filter",
    run: () => {
      openWindow("explorer");
      const input = document.querySelector(`[data-search="${active}"]`);
      input?.focus();
      input?.select();
    },
  });
  addCommand(items, groups, "Search", "Search the local index", {
    icon: "search",
    subtitle: "Look for files and folders under /mnt/tank",
    keywords: "find local",
    run: () => {
      openWindow("explorer");
      setActiveSide("local");
      const input = document.querySelector('[data-search="local"]');
      input?.focus();
      input?.select();
    },
  });
  addCommand(items, groups, "Search", `Search ${provider}`, {
    icon: "search",
    subtitle: "Look for files and folders in the remote snapshot",
    keywords: "find remote cloud",
    run: () => {
      openWindow("explorer");
      setActiveSide("remote");
      const input = document.querySelector('[data-search="remote"]');
      input?.focus();
      input?.select();
    },
  });

  addCommand(items, groups, "View", state.hidden ? "Hide dotfiles" : "Show dotfiles", {
    key: "toggle-hidden",
    icon: "hidden",
    subtitle: "Include files and folders whose names start with a dot",
    keywords: "hidden files visibility",
    check: state.hidden,
    run: () => {
      openWindow("explorer");
      state.hidden = !state.hidden;
      const input = document.querySelector("[data-hidden-toggle]");
      if (input) input.checked = state.hidden;
      renderAll();
    },
  });
  addCommand(items, groups, "View", "Refresh the current folder", {
    icon: "reset",
    subtitle: `Reload ${active === "local" ? "the local index" : provider}`,
    keywords: "reload update",
    run: () => toast(`Reloaded ${active === "local" ? "local index" : provider} snapshot`),
  });
  addCommand(items, groups, "View", state.legendOpen ? "Hide the legend" : "Show the legend", {
    key: "toggle-legend",
    icon: "legend",
    subtitle: "Explain the comparison status colours",
    keywords: "help key colours colors",
    check: state.legendOpen,
    run: () => {
      openWindow("explorer");
      toggleLegend();
    },
  });
  addCommand(items, groups, "View", "Open keyboard shortcuts", {
    key: "toggle-shortcuts-window",
    icon: "keyboard",
    subtitle: "Review the current key map",
    keywords: "shortcut cheat sheet keys bindings keyboard",
    run: () => openWindow("shortcuts"),
  });
  addCommand(items, groups, "View", state.sidePanel === "columns" ? "Close the columns sidebar" : "Open the columns sidebar", {
    key: "toggle-columns-panel",
    icon: "columns",
    subtitle: "Choose which table columns both panes show",
    keywords: "table layout settings",
    run: () => toggleSidePanel("columns"),
  });
  addCommand(items, groups, "View", state.sidePanel === "analytics" ? "Close the analytics view" : "Open the analytics view", {
    key: "toggle-analytics-panel",
    icon: "analytics",
    subtitle: "Snapshot totals, local index entries, and coverage",
    keywords: "stats statistics metrics summary report numbers",
    run: () => toggleSidePanel("analytics"),
  });
  if (entry) {
    addCommand(items, groups, "View", "Show details for the selected item", {
      icon: "details",
      subtitle: entry.path,
      keywords: "inspector info selected",
      run: () => setSidePanel("detail", state.selected.side, entry.name),
    });
  }

  COLUMN_DEFS.filter((col) => !col.required).forEach((col) => {
    const shown = state.columns.has(col.id);
    addCommand(items, groups, "Columns", `Toggle the ${col.label} column`, {
      key: `column:${col.id}`,
      icon: "columns",
      subtitle: shown ? "Currently visible" : "Currently hidden",
      keywords: `columns table ${col.id}`,
      check: shown,
      run: () => {
        if (state.columns.has(col.id)) state.columns.delete(col.id);
        else state.columns.add(col.id);
        state.columns.add("name");
        saveColumns();
        renderAll();
      },
    });
  });
  addCommand(items, groups, "Columns", "Reset the columns", {
    icon: "reset",
    subtitle: "Show all columns again",
    keywords: "table layout default",
    run: () => {
      state.columns = new Set(DEFAULT_COLUMNS);
      state.sizeMode = "bytes";
      saveColumns();
      renderAll();
    },
  });

  COLUMN_DEFS.forEach((col) => {
    const sort = state.sort[active];
    addCommand(items, groups, "Sort", `Sort by ${col.label}`, {
      key: `sort:${col.id}`,
      icon: "sort",
      subtitle:
        sort.id === col.id
          ? `Active · ${sort.dir === "asc" ? "ascending" : "descending"} — choose again to reverse`
          : "Sort the active pane",
      keywords: `order ${col.id} column`,
      check: sort.id === col.id,
      aside: sort.id === col.id ? (sort.dir === "asc" ? "Asc" : "Desc") : "",
      run: () => {
        if (sort.id === col.id) sort.dir = sort.dir === "asc" ? "desc" : "asc";
        else {
          sort.id = col.id;
          sort.dir = "asc";
        }
        renderAll();
      },
    });
  });

  filterOptions(active).forEach((option) => {
    const on = statusFilters(active).has(option.value);
    addCommand(items, groups, "Filters", `Filter: ${option.label}`, {
      key: `filter:${option.value}`,
      icon: "filter",
      subtitle: on ? "Currently filtered" : "Only show this status in the active pane",
      keywords: `status show only ${option.value}`,
      check: on,
      run: () => {
        const filters = statusFilters(active);
        if (filters.has(option.value)) filters.delete(option.value);
        else filters.add(option.value);
        renderAll();
      },
    });
  });
  if (statusFilters(active).size) {
    addCommand(items, groups, "Filters", "Clear status filters", {
      icon: "reset",
      subtitle: "Show every status in the active pane",
      keywords: "remove filter status all",
      run: () => {
        statusFilters(active).clear();
        renderAll();
      },
    });
  }

  THEME_MODES.forEach((mode) => {
    const hints = {
      system: "Follow the operating system",
      light: "Bright surfaces",
      dark: "Low-light surfaces",
      water: "Animated water effects",
    };
    addCommand(items, groups, "Appearance", `Use the ${THEME_LABELS[mode]} theme`, {
      key: `theme:${mode}`,
      icon: mode === "water" ? "water" : "theme",
      subtitle: hints[mode],
      keywords: `appearance color colour ${mode}`,
      check: state.themeMode === mode,
      run: () => setThemeMode(mode),
    });
  });
  const settingsWindow = windowById("settings");
  const settingsOpen = isOpen(settingsWindow);
  addCommand(items, groups, "Appearance", settingsOpen ? "Close water settings" : "Open water settings", {
    key: "toggle-water-panel",
    icon: "water",
    subtitle: "Tune the ripple, caustic, and current effects",
    keywords: "water settings theme",
    check: settingsOpen,
    run: () => {
      if (isOpen(settingsWindow)) closeWindow(settingsWindow);
      else openWindow("settings");
    },
  });
  addCommand(items, groups, "Appearance", "Toggle water effects", {
    key: "toggle-water-effects",
    icon: "water",
    subtitle: "Ripples, drips, and shimmer when the Water theme is active",
    keywords: "water effects animation theme",
    check: state.water.effects,
    run: () => setWaterSetting("effects", !state.water.effects),
  });

  Object.values(PROVIDERS).forEach((info) => {
    addCommand(items, groups, "Provider", `Switch to ${info.label}`, {
      key: `provider:${info.key}`,
      icon: "provider",
      subtitle:
        state.provider === info.key
          ? `${info.root} · currently active`
          : `Right pane · ${info.root}`,
      keywords: `remote cloud ${info.key}`,
      check: state.provider === info.key,
      run: () => {
        if (state.provider === info.key) return;
        state.provider = info.key;
        saveProvider();
        renderAll();
        toast(`Remote provider · ${info.label}`);
      },
    });
  });

  return items;
}

function rankFiles(entries, query) {
  return entries
    .map((entry) => {
      const nameScore = fuzzyScore(entry.name, query);
      const pathScore = Math.max(fuzzyScore(entryParent(entry), query), fuzzyScore(entry.path, query));
      return { entry, score: nameScore >= 0 ? nameScore * 2 + Math.max(pathScore, 0) : pathScore };
    })
    .filter((match) => match.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.entry.isDir ? 1 : 0) - (a.entry.isDir ? 1 : 0) ||
        a.entry.name.localeCompare(b.entry.name),
    )
    .slice(0, 24)
    .map((match) => match.entry);
}

function fileItems(side, raw) {
  const group = side === "local" ? "Local index" : providerLabel();
  const groupIndex = side === "local" ? 1000 : 1001;
  return rankFiles(baseEntries(side), raw).map((entry) => {
    const status = statusMeta(entry, side);
    return {
      kind: "file",
      key: `file:${side}:${entry.path}`,
      group,
      groupIndex,
      seq: 0,
      title: entry.name,
      subtitle: `${status.label} · ${entryParent(entry)}`,
      icon: side === "local" ? "local" : "remote",
      iconHtml: iconHtml(entry),
      aside: entry.isDir ? "Folder" : entry.size || "—",
      statusColor: STATUS_COLORS[entry.status] || "var(--ds-gray)",
      entry,
      side,
    };
  });
}

function buildCommandItems() {
  const query = state.command.query;
  const commandsOnly = query.startsWith(">");
  const raw = commandsOnly ? query.slice(1).trim() : query.trim();
  const commands = commandCatalog();
  let matches = commands;
  if (raw) {
    matches = commands
      .map((item) => ({ item, score: scoreCommand(item, raw) }))
      .filter((match) => match.score >= 0)
      .sort(
        (a, b) =>
          a.item.groupIndex - b.item.groupIndex ||
          b.score - a.score ||
          a.item.seq - b.item.seq,
      )
      .map((match) => match.item);
  }
  const items = matches.slice();
  if (!commandsOnly && raw.length >= 2) {
    items.push(...fileItems("local", raw));
    items.push(...fileItems("remote", raw));
  }
  return { items, raw, commandsOnly };
}

function highlight(text, query) {
  if (!query) return esc(text);
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return esc(text);
  return `${esc(text.slice(0, index))}<mark>${esc(text.slice(index, index + query.length))}</mark>${esc(text.slice(index + query.length))}`;
}

function renderCommands() {
  if (!commandResults) return;
  const { items, raw, commandsOnly } = buildCommandItems();
  state.command.items = items;
  if (state.command.index >= items.length) state.command.index = Math.max(0, items.length - 1);
  let lastGroup = null;
  commandResults.innerHTML = items
    .map((item, index) => {
      let prefix = "";
      if (item.group !== lastGroup) {
        lastGroup = item.group;
        prefix = `<div class="osx-command-group">${esc(item.group)}</div>`;
      }
      const active = index === state.command.index;
      const icon =
        item.kind === "file"
          ? item.iconHtml
          : `<svg class="icon"><use href="#${commandIcon(item.icon)}"/></svg>`;
      const sub =
        item.kind === "file"
          ? `<span class="dot" style="background:${item.statusColor}"></span>${esc(item.subtitle)}`
          : esc(item.subtitle);
      return `${prefix}<button type="button" class="osx-command-item${active ? " is-active" : ""}" id="osx-command-option-${index}" data-command-index="${index}" role="option" aria-selected="${active}">
        <span class="osx-command-icon">${icon}</span>
        <span class="osx-command-main"><span class="osx-command-title">${item.kind === "file" ? esc(item.title) : highlight(item.title, raw)}</span>${item.subtitle ? `<span class="osx-command-sub">${sub}</span>` : ""}</span>
        ${item.aside ? `<span class="osx-command-aside">${esc(item.aside)}</span>` : ""}
        ${item.check ? `<span class="osx-command-check"><svg class="icon"><use href="#i-check"/></svg></span>` : ""}
      </button>`;
    })
    .join("");

  if (items.length) {
    commandInput?.setAttribute("aria-activedescendant", `osx-command-option-${state.command.index}`);
  } else {
    commandInput?.removeAttribute("aria-activedescendant");
  }

  if (commandEmpty) {
    const empty = items.length === 0;
    commandEmpty.hidden = !empty;
    if (empty) {
      let title = "No matches";
      let hint = "Try a different word or command.";
      if (commandsOnly) {
        title = "No command matches";
        hint = "Remove the > to search files and folders too.";
      } else if (state.command.query.trim() && raw.length < 2) {
        title = `Type ${2 - raw.length} more character${2 - raw.length === 1 ? "" : "s"}`;
        hint = "File and folder search starts after two characters.";
      } else if (raw) {
        title = `No matches for “${raw}”`;
      }
      commandEmpty.querySelector("[data-command-empty-title]").textContent = title;
      commandEmpty.querySelector("[data-command-empty-hint]").textContent = hint;
    }
  }
}

function setCommandIndex(index) {
  const items = state.command.items;
  if (!items.length) {
    state.command.index = 0;
    return;
  }
  state.command.index = (index + items.length) % items.length;
  commandResults?.querySelectorAll(".osx-command-item").forEach((item, itemIndex) => {
    const active = itemIndex === state.command.index;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-selected", String(active));
  });
  commandInput?.setAttribute("aria-activedescendant", `osx-command-option-${state.command.index}`);
  commandResults
    ?.querySelector(`[data-command-index="${state.command.index}"]`)
    ?.scrollIntoView({ block: "nearest" });
}

function clearPaneFilters(side) {
  state.search[side] = "";
  statusFilters(side).clear();
  const input = document.querySelector(`[data-search="${side}"]`);
  if (input) input.value = "";
}

function runCommandItem(item) {
  if (!item) return;
  if (item.kind === "file") {
    closeCommand();
    clearPaneFilters(item.side);
    if (item.entry.name.startsWith(".")) {
      state.hidden = true;
      const input = document.querySelector("[data-hidden-toggle]");
      if (input) input.checked = true;
    }
    renderAll();
    selectEntry(item.side, item.entry.name, { scroll: true });
    setActiveSide(item.side);
    document.querySelector(`[data-rows="${item.side}"]`)?.focus();
    return;
  }
  closeCommand();
  item.run?.();
}

function openCommand() {
  if (!overlay) return;
  closeTrays();
  previousFocus = document.activeElement;
  overlay.hidden = false;
  state.command.query = "";
  state.command.index = 0;
  if (commandInput) commandInput.value = "";
  renderCommands();
  requestAnimationFrame(() => {
    commandInput?.focus();
    commandInput?.select();
  });
}

function closeCommand() {
  if (!overlay) return;
  overlay.hidden = true;
  if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
  previousFocus = null;
}

commandInput?.addEventListener("input", () => {
  state.command.query = commandInput.value;
  state.command.index = 0;
  renderCommands();
});

commandInput?.addEventListener("keydown", (event) => {
  const count = state.command.items.length;
  if (!count) {
    if (event.key === "Enter") event.preventDefault();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    setCommandIndex(state.command.index + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    setCommandIndex(state.command.index - 1);
  } else if (event.key === "Home" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    setCommandIndex(0);
  } else if (event.key === "End" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    setCommandIndex(count - 1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    runCommandItem(state.command.items[state.command.index]);
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeCommand();
  }
});

commandResults?.addEventListener("mousemove", (event) => {
  const item = event.target.closest("[data-command-index]");
  if (!item) return;
  const index = Number(item.dataset.commandIndex);
  if (index !== state.command.index) setCommandIndex(index);
});

commandResults?.addEventListener("click", (event) => {
  const item = event.target.closest("[data-command-index]");
  if (!item) return;
  const index = Number(item.dataset.commandIndex);
  state.command.index = index;
  runCommandItem(state.command.items[index]);
});

document.querySelector("[data-command-close]")?.addEventListener("click", closeCommand);

overlay?.addEventListener("click", (event) => {
  if (event.target === overlay) closeCommand();
});

overlay?.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const focusables = [commandInput, document.querySelector("[data-command-close]")].filter(
    (node) => node && node.offsetParent !== null,
  );
  if (!focusables.length) return;
  event.preventDefault();
  const current = focusables.indexOf(document.activeElement);
  const next = event.shiftKey
    ? current <= 0
      ? focusables.length - 1
      : current - 1
    : (current + 1) % focusables.length;
  focusables[next].focus();
});

function toggleLegend() {
  const legend = document.querySelector("[data-legend]");
  const button = document.querySelector("[data-legend-toggle]");
  if (!legend) return;
  state.legendOpen = legend.hidden;
  legend.hidden = !state.legendOpen;
  button?.setAttribute("aria-expanded", String(state.legendOpen));
}

/* --------------------------------------------------------------- music */

const player = document.querySelector("[data-player]");
const playButton = document.querySelector('[data-cmd="toggle-play"]');
const trackTitle = document.querySelector("[data-track-title]");
const trackArtist = document.querySelector("[data-track-artist]");
const trackTime = document.querySelector("[data-track-time]");
const trackFill = document.querySelector("[data-track-fill]");
const equalizer = document.querySelector("[data-eq]");
const playerWindow = windowById("music");
let playing = true;
let trackIndex = 0;

const TRACKS = [
  { title: "Deep Current", artist: "Tide Ensemble", duration: "4:32", at: "1:43" },
  { title: "Glass Reef", artist: "Lagoon Lights", duration: "3:58", at: "0:00" },
  { title: "Caustic Drift", artist: "Ocean Floor", duration: "5:12", at: "0:00" },
];

function syncPlayState() {
  player?.classList.toggle("is-playing", playing);
  equalizer?.classList.toggle("is-paused", !playing);
  if (playButton) {
    playButton.setAttribute("aria-pressed", String(playing));
    playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
    const use = playButton.querySelector("use");
    if (use) use.setAttribute("href", playing ? "#i-pause" : "#i-play");
  }
}

function togglePlay() {
  playing = !playing;
  syncPlayState();
  toast(playing ? "Tide Radio playing" : "Tide Radio paused");
}

function changeTrack(direction) {
  trackIndex = (trackIndex + direction + TRACKS.length) % TRACKS.length;
  const track = TRACKS[trackIndex];
  if (trackTitle) trackTitle.textContent = track.title;
  if (trackArtist) trackArtist.textContent = `${track.artist} · ${track.duration}`;
  if (trackTime) trackTime.textContent = `${track.at} / ${track.duration}`;
  if (trackFill) trackFill.style.width = "38%";
  playing = true;
  syncPlayState();
  toast(`Tide Radio · ${track.title}`);
}

syncPlayState();

/* ------------------------------------------------------------ terminal */

function rerunTerminal() {
  openWindow("terminal");
  const lines = document.querySelectorAll("[data-terminal] .os-term-line");
  lines.forEach((line) => {
    line.style.animation = "none";
    void line.offsetWidth;
    line.style.animation = "";
  });
  toast("Comparison re-run against the read-only snapshot");
}

/* ------------------------------------------------------------ verify */

let verified = false;

function verifySnapshot() {
  if (verified) {
    toast("Snapshot already verified 4 minutes ago");
    return;
  }
  verified = true;
  const values = document.querySelectorAll("[data-verify-value]");
  const fills = document.querySelectorAll("[data-verify-fill]");
  const start = performance.now();
  const duration = prefersReducedMotion() ? 1 : 1500;
  function step(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = 87.7 + 12.3 * eased;
    values.forEach((node) => (node.textContent = `${value.toFixed(1)}%`));
    fills.forEach((node) => (node.style.width = `${value}%`));
    if (progress < 1) requestAnimationFrame(step);
    else toast("Snapshot verified · 1,434,971 files");
  }
  requestAnimationFrame(step);
}

/* ------------------------------------------------------------ commands */

function runCommand(command) {
  switch (command) {
    case "open-explorer":
      openWindow("explorer");
      break;
    case "open-settings":
      openWindow("settings");
      break;
    case "open-terminal":
      openWindow("terminal");
      break;
    case "open-music":
      openWindow("music");
      break;
    case "open-about":
      openWindow("about");
      break;
    case "open-shortcuts":
      openWindow("shortcuts");
      break;
    case "open-command":
      openCommand();
      break;
    case "close-focused": {
      const win = focusedWindow();
      if (win) closeWindow(win);
      break;
    }
    case "analytics":
      openWindow("explorer");
      toggleSidePanel("analytics");
      break;
    case "columns":
      openWindow("explorer");
      toggleSidePanel("columns");
      break;
    case "shortcuts":
      openWindow("shortcuts");
      break;
    case "mirror":
      openWindow("explorer");
      mirrorPanes();
      break;
    case "up":
      openWindow("explorer");
      toast("Already at the snapshot root", "warn");
      break;
    case "local-root":
      openWindow("explorer");
      toast("Local root · /mnt/tank");
      break;
    case "remote-root":
      openWindow("explorer");
      toast(`${providerLabel()} root · ${providerRoot()}`);
      break;
    case "verify":
      verifySnapshot();
      break;
    case "reveal-selected":
      openWindow("explorer");
      revealSelected();
      break;
    case "open-selected":
      openWindow("explorer");
      openSelected();
      break;
    case "toggle-hidden": {
      openWindow("explorer");
      state.hidden = !state.hidden;
      const input = document.querySelector("[data-hidden-toggle]");
      if (input) input.checked = state.hidden;
      renderAll();
      break;
    }
    case "toggle-theme":
      setThemeMode(resolvedTheme() === "light" ? "water" : "light");
      break;
    case "toggle-effects":
      setWaterSetting("effects", !state.water.effects);
      break;
    case "toggle-legend":
      openWindow("explorer");
      toggleLegend();
      break;
    case "reset-water-settings":
      resetWaterSettings();
      break;
    case "use-water-theme":
      setThemeMode("water");
      break;
    case "open-design-system":
      window.location.href = "../";
      break;
    case "trash":
      toast("Trash is empty · nothing was written");
      break;
    case "toggle-play":
      togglePlay();
      break;
    case "next-track":
      changeTrack(1);
      break;
    case "previous-track":
      changeTrack(-1);
      break;
    case "run-terminal":
      rerunTerminal();
      break;
    default:
      break;
  }
}

document.addEventListener("click", (event) => {
  const commandButton = event.target.closest("[data-cmd]");
  if (!commandButton) return;
  if (commandButton.tagName === "BUTTON") event.preventDefault();
  runCommand(commandButton.dataset.cmd);
  closeTrays();
  closeMenus();
});

/* -------------------------------------------------------------- popovers */

document.addEventListener("click", (event) => {
  if (!event.target.closest(".os-menu-wrap")) closeMenus();
  if (!event.target.closest(".osx-filter-wrap")) {
    document.querySelectorAll("[data-filter-pop]").forEach((pop) => (pop.hidden = true));
    document.querySelectorAll("[data-filter-toggle]").forEach((button) => button.setAttribute("aria-expanded", "false"));
  }
  if (!event.target.closest(".osx-legend") && !event.target.closest("[data-legend-toggle]")) {
    const legend = document.querySelector("[data-legend]");
    if (legend) {
      legend.hidden = true;
      state.legendOpen = false;
      document.querySelector("[data-legend-toggle]")?.setAttribute("aria-expanded", "false");
    }
  }
});

document.addEventListener("click", (event) => {
  const mini = event.target.closest("[data-mini-filter]");
  if (!mini) return;
  const side = mini.dataset.miniFilter;
  const status = mini.dataset.status;
  const filters = statusFilters(side);
  if (filters.has(status)) filters.delete(status);
  else filters.add(status);
  renderPane(side);
  renderStatusbar();
});

document.querySelectorAll("[data-legend-toggle]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleLegend();
  });
});

/* --------------------------------------------------------- global keys */

document.addEventListener("keydown", (event) => {
  const modifier = event.metaKey || event.ctrlKey;

  if (modifier && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (overlay?.hidden) openCommand();
    else closeCommand();
    return;
  }

  if (modifier && event.key.toLowerCase() === "f") {
    event.preventDefault();
    openWindow("explorer");
    const input = document.querySelector(`[data-search="${state.activeSide}"]`);
    input?.focus();
    input?.select();
    return;
  }

  if (modifier && event.key === ",") {
    event.preventDefault();
    openWindow("settings");
    return;
  }

  if (modifier && event.key === "1") {
    event.preventDefault();
    openWindow("explorer");
    setActiveSide("local");
    document.querySelector('[data-rows="local"]')?.focus();
    return;
  }

  if (modifier && event.key === "2") {
    event.preventDefault();
    openWindow("explorer");
    setActiveSide("remote");
    document.querySelector('[data-rows="remote"]')?.focus();
    return;
  }

  if (modifier && event.shiftKey && event.key.toLowerCase() === "c") {
    event.preventDefault();
    openWindow("explorer");
    toggleSidePanel("columns");
    return;
  }

  if (modifier && event.shiftKey && event.key.toLowerCase() === "a") {
    event.preventDefault();
    openWindow("explorer");
    toggleSidePanel("analytics");
    return;
  }

  if (modifier && event.shiftKey && event.key === ".") {
    event.preventDefault();
    runCommand("toggle-hidden");
    return;
  }

  if (modifier && event.key === "/") {
    event.preventDefault();
    toggleLegend();
    return;
  }

  if (event.key === "Escape") {
    if (overlay && !overlay.hidden) {
      closeCommand();
      return;
    }
    closeTrays();
    closeMenus();
    document.querySelectorAll("[data-filter-pop]").forEach((pop) => (pop.hidden = true));
    const legend = document.querySelector("[data-legend]");
    if (legend) legend.hidden = true;
  }
});

/* --------------------------------------------------------------- init */

if (playerWindow) closeWindow(playerWindow);

const explorerStart = windowById("explorer");
if (explorerStart) {
  explorerStart.classList.add("is-open");
  focusWindow(explorerStart);
}

applyAppearance({ save: false });
renderAll();
syncDock();