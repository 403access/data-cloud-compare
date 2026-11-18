/* Aether OS — Settings
   Tabbed system settings window. Panes reuse the live feature state owned by
   Network, Devices, Battery, Sound, Appearance, and the window manager; the
   remaining demo preferences are stored locally. */

import { readJSON, root, state, writeJSON } from "../core/state.js";
import { toast } from "../core/toast.js";
import { setThemeMode } from "../features/appearance.js";
import { setSoundOutput } from "./sound.js";
import { applyWindowLayout, openWindow } from "../shell/windows.js";

const SETTINGS_KEY = "explorer-os-settings-v1";
const TAB_KEY = "explorer-os-settings-tab";

const SETTINGS_DEFAULTS = {
  autoUpdate: true,
  autoTime: true,
  hour24: true,
  language: "en-GB",
  region: "eu-oslo",
  autoBrightness: true,
  trueTone: true,
  nightShift: false,
  nightShiftSchedule: "sunset",
  displayResolution: "default",
  mirrorDisplays: false,
  brightness: 72,
  dockEnabled: false,
  dockSize: 48,
  dockMagnify: false,
  dockPosition: "bottom",
  minimizeEffect: "genie",
  desktopWidgets: false,
  desktopIcons: false,
  stageManager: false,
  notifications: true,
  notificationPreviews: "always",
  doNotDisturb: false,
  appExplorer: true,
  appRadio: true,
  appCalendar: true,
  uiSounds: true,
  alertSound: "droplet",
  fileVault: true,
  firewall: true,
  locationServices: true,
  analytics: false,
  allowApps: "appstore",
  lockDelay: "5",
  reduceMotion: false,
  increaseContrast: false,
  reduceTransparency: false,
  stereoAsMono: false,
  flashAlerts: false,
  stickyKeys: false,
  keyRepeat: 6,
  keyDelay: 3,
};

const RANGE_SUFFIX = {
  brightness: "%",
  dockSize: " px",
  keyRepeat: "/s",
  keyDelay: "",
};

const DOCK_POSITIONS = ["bottom", "left", "right"];
const DOCK_MIN_SIZE = 32;
const DOCK_MAX_SIZE = 72;
const DESKTOP_SETTING_KEYS = new Set([
  "desktopIcons",
  "desktopWidgets",
  "dockEnabled",
  "dockSize",
  "dockMagnify",
  "dockPosition",
]);

const settingsWindow = document.querySelector('[data-window="settings"]');
const desktopRail = document.querySelector(".os-rail");
const desktopIcons = document.querySelector(".os-desk-icons");
const desktopWidget = document.querySelector(".os-widget");
const dockWrap = document.querySelector(".os-dock-wrap");
const tabButtons = Array.from(document.querySelectorAll("[data-settings-tab]"));
const navGroups = Array.from(document.querySelectorAll("[data-settings-nav-group]"));
const panes = Array.from(document.querySelectorAll("[data-settings-pane]"));
const searchInput = document.querySelector("[data-settings-search]");
const searchClear = document.querySelector("[data-settings-search-clear]");
const titleSub = document.querySelector("[data-settings-sub]");

const savedPreferences = readJSON(SETTINGS_KEY);
const preferences = {
  ...SETTINGS_DEFAULTS,
  ...(savedPreferences && typeof savedPreferences === "object" ? savedPreferences : {}),
};

function savePreferences() {
  writeJSON(SETTINGS_KEY, preferences);
}

function readTab() {
  try {
    return localStorage.getItem(TAB_KEY);
  } catch {
    return null;
  }
}

function storeTab(id) {
  try {
    localStorage.setItem(TAB_KEY, id);
  } catch {
    /* ignore */
  }
}

function settingValue(key) {
  return preferences[key] ?? SETTINGS_DEFAULTS[key];
}

function rangeLabel(input) {
  const key = input.dataset.osSetting;
  const suffix = input.dataset.settingsSuffix ?? RANGE_SUFFIX[key] ?? "";
  return `${input.value}${suffix}`;
}

function syncRange(input) {
  const key = input.dataset.osSetting;
  input.value = String(settingValue(key));
  const output = document.querySelector(`[data-settings-value="${key}"]`);
  if (output) output.textContent = rangeLabel(input);
  if (key === "brightness") {
    document
      .querySelector("[data-settings-display-preview]")
      ?.style.setProperty("--settings-brightness", `${input.value}%`);
  }
}

function syncPreferences() {
  document.querySelectorAll("[data-os-setting]").forEach((input) => {
    const key = input.dataset.osSetting;
    const value = settingValue(key);
    if (input.type === "checkbox") input.checked = Boolean(value);
    else if (input.type === "range") syncRange(input);
    else input.value = String(value);
  });

  document.querySelectorAll("[data-settings-choice]").forEach((group) => {
    const key = group.dataset.settingsChoice;
    const chosen = settingValue(key);
    group.querySelectorAll("[data-settings-choice-value]").forEach((button) => {
      const active = button.dataset.settingsChoiceValue === String(chosen);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
  });

  applyDesktopVisibility();
  applyDockSettings();
  syncThemeCards();
  updateMotionPreference();
}

function applyDockSettings() {
  const enabled = Boolean(settingValue("dockEnabled"));
  const magnify = Boolean(settingValue("dockMagnify"));
  const savedPosition = settingValue("dockPosition");
  const position = DOCK_POSITIONS.includes(savedPosition)
    ? savedPosition
    : SETTINGS_DEFAULTS.dockPosition;
  const savedSize = Number(settingValue("dockSize"));
  const size = Math.min(
    DOCK_MAX_SIZE,
    Math.max(DOCK_MIN_SIZE, Number.isFinite(savedSize) ? savedSize : SETTINGS_DEFAULTS.dockSize),
  );

  root.dataset.dock = enabled ? "on" : "off";
  root.dataset.dockMagnify = magnify ? "on" : "off";
  root.dataset.dockPosition = position;
  root.style.setProperty("--os-dock-size", `${size}px`);
  if (dockWrap) dockWrap.hidden = !enabled;
}

function applyDesktopVisibility() {
  const showIcons = Boolean(settingValue("desktopIcons"));
  const showWidgets = Boolean(settingValue("desktopWidgets"));
  document.documentElement.dataset.desktopIcons = showIcons ? "on" : "off";
  document.documentElement.dataset.desktopWidgets = showWidgets ? "on" : "off";
  if (desktopIcons) desktopIcons.hidden = !showIcons;
  if (desktopWidget) desktopWidget.hidden = !showWidgets;
  if (desktopRail) desktopRail.hidden = !showIcons && !showWidgets;
}

function syncThemeCards() {
  document.querySelectorAll("[data-settings-theme]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.settingsTheme === state.themeMode),
    );
  });
}

function updateMotionPreference() {
  document.documentElement.dataset.settingsMotion = preferences.reduceMotion
    ? "reduced"
    : "full";
  document.documentElement.dataset.settingsContrast = preferences.increaseContrast
    ? "increased"
    : "normal";
  document.documentElement.dataset.settingsTransparency = preferences.reduceTransparency
    ? "reduced"
    : "full";
}

function setPreference(key, value) {
  if (!(key in SETTINGS_DEFAULTS)) return;
  preferences[key] = value;
  savePreferences();
  syncPreferences();
  if (DESKTOP_SETTING_KEYS.has(key)) applyWindowLayout();
}

function activeTab() {
  return tabButtons.find((button) => button.getAttribute("aria-selected") === "true") || tabButtons[0];
}

function activateTab(id, { focus = false, store = true } = {}) {
  const tab = tabButtons.find((button) => button.dataset.settingsTab === id);
  if (!tab) return;
  tabButtons.forEach((button) => {
    const active = button === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  panes.forEach((pane) => {
    const active = pane.dataset.settingsPane === id;
    pane.classList.toggle("is-active", active);
    pane.hidden = !active;
  });
  const pane = panes.find((item) => item.dataset.settingsPane === id);
  const heading = pane?.querySelector("[data-settings-pane-title]")?.textContent?.trim();
  if (titleSub) titleSub.textContent = heading || "Settings";
  if (settingsWindow) {
    settingsWindow.dataset.title = heading ? `Settings · ${heading}` : "Settings";
    if (settingsWindow.classList.contains("is-focused")) {
      const activeApp = document.querySelector("[data-active-app]");
      if (activeApp) activeApp.textContent = settingsWindow.dataset.title;
    }
  }
  if (focus) tab.focus({ preventScroll: true });
  const content = document.querySelector("[data-settings-content]");
  if (content) content.scrollTop = 0;
  if (store) storeTab(id);
}

function filterTabs() {
  const query = (searchInput?.value || "").trim().toLowerCase();
  searchClear.hidden = !query;
  tabButtons.forEach((button) => {
    const haystack = `${button.textContent} ${button.dataset.settingsKeywords || ""}`.toLowerCase();
    button.hidden = Boolean(query) && !haystack.includes(query);
  });
  navGroups.forEach((group) => {
    group.hidden = !group.querySelector("[data-settings-tab]:not([hidden])");
  });
  if (!query) return;
  const current = activeTab();
  if (current && !current.hidden) return;
  const first = tabButtons.find((button) => !button.hidden);
  if (first) activateTab(first.dataset.settingsTab, { store: false });
}

function resetPreferences() {
  Object.assign(preferences, SETTINGS_DEFAULTS);
  savePreferences();
  syncPreferences();
  toast("System settings reset.");
}

function runAction(action) {
  switch (action) {
    case "check-updates":
      toast("Aether OS is up to date · 2.4 (26A341)");
      break;
    case "test-sound":
      toast(`Test sound · ${settingsWord("alertSound")}`);
      break;
    case "optimise-storage":
      toast("Optimise storage · demo recommendation accepted");
      break;
    case "reset-settings":
      resetPreferences();
      break;
    default:
      break;
  }
}

function settingsWord(key) {
  const select = document.querySelector(`[data-os-setting="${key}"]`);
  if (!select) return "";
  return select.options[select.selectedIndex]?.textContent || select.value;
}

/* ------------------------------------------------------------- listeners */

tabButtons.forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.settingsTab));
});

document.querySelector("[data-settings-nav]")?.addEventListener("keydown", (event) => {
  const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const visible = tabButtons.filter((button) => !button.hidden);
  if (!visible.length) return;
  const current = visible.indexOf(document.activeElement);
  let next = 0;
  if (event.key === "End") next = visible.length - 1;
  else if (event.key === "ArrowDown") next = current < 0 ? 0 : (current + 1) % visible.length;
  else if (event.key === "ArrowUp") next = current < 0 ? visible.length - 1 : (current - 1 + visible.length) % visible.length;
  event.preventDefault();
  activateTab(visible[next].dataset.settingsTab, { focus: true });
});

document.querySelectorAll("[data-os-setting]").forEach((input) => {
  input.addEventListener("input", () => {
    if (input.type !== "range") return;
    const output = document.querySelector(`[data-settings-value="${input.dataset.osSetting}"]`);
    if (output) output.textContent = rangeLabel(input);
    if (input.dataset.osSetting === "brightness") {
      document
        .querySelector("[data-settings-display-preview]")
        ?.style.setProperty("--settings-brightness", `${input.value}%`);
    }
  });
  input.addEventListener("change", () => {
    const key = input.dataset.osSetting;
    const value = input.type === "checkbox" ? input.checked : input.value;
    setPreference(key, value);
  });
});

document.querySelectorAll("[data-settings-choice]").forEach((group) => {
  group.addEventListener("click", (event) => {
    const button = event.target.closest("[data-settings-choice-value]");
    if (!button) return;
    setPreference(group.dataset.settingsChoice, button.dataset.settingsChoiceValue);
  });
});

document.querySelectorAll("[data-settings-theme]").forEach((button) => {
  button.addEventListener("click", () => {
    setThemeMode(button.dataset.settingsTheme);
    syncThemeCards();
  });
});

document.querySelectorAll("[data-settings-action]").forEach((button) => {
  button.addEventListener("click", () => runAction(button.dataset.settingsAction));
});

document.querySelector("[data-settings-output]")?.addEventListener("change", (event) => {
  setSoundOutput(event.target.value);
  toast(`Output · ${event.target.value}`);
});

searchInput?.addEventListener("input", filterTabs);
searchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && searchInput.value) {
    searchInput.value = "";
    filterTabs();
    event.stopPropagation();
  }
});
searchClear?.addEventListener("click", () => {
  searchInput.value = "";
  filterTabs();
  searchInput.focus();
});

/* ---------------------------------------------------------------- export */

export function openSettings(tab) {
  openWindow("settings");
  activateTab(tab || readTab() || "general");
}

syncPreferences();
activateTab(readTab() || "general", { store: false });