/* Aether OS — command palette settings
   Binds the Command palette section of Settings to the saved preferences that
   decide which sources, groups, and conditions the command bar uses. */

import {
  COMMAND_DEFAULTS, saveCommandSettings, state,
} from "../core/state.js";
import { toast } from "../core/toast.js";
import { openWindow } from "./windows.js";

function cloneDefaults() {
  return {
    ...COMMAND_DEFAULTS,
    groups: { ...COMMAND_DEFAULTS.groups },
  };
}

function syncCommandSettings() {
  document.querySelectorAll("[data-command-setting]").forEach((input) => {
    const key = input.dataset.commandSetting;
    const value = state.commandSettings[key];
    if (input.type === "checkbox") input.checked = Boolean(value);
    else input.value = String(value);
  });
  document.querySelectorAll("[data-command-group]").forEach((input) => {
    input.checked = state.commandSettings.groups[input.dataset.commandGroup] !== false;
  });
  const note = document.querySelector("[data-command-settings-note]");
  if (!note) return;
  const settings = state.commandSettings;
  const sources = [];
  if (settings.showCommands) sources.push("commands");
  if (settings.localFiles) sources.push("local files");
  if (settings.remoteFiles) sources.push("remote files");
  const enabledGroups = Object.values(settings.groups).filter(Boolean).length;
  note.textContent = sources.length
    ? `Showing ${sources.join(", ")} · ${enabledGroups} command groups on.`
    : "Command bar is empty until a source is enabled.";
}

export function setCommandSetting(key, value) {
  if (!(key in COMMAND_DEFAULTS) || key === "groups") return;
  state.commandSettings = { ...state.commandSettings, [key]: value };
  saveCommandSettings();
  syncCommandSettings();
}

export function setCommandGroup(group, enabled) {
  if (!(group in COMMAND_DEFAULTS.groups)) return;
  state.commandSettings = {
    ...state.commandSettings,
    groups: { ...state.commandSettings.groups, [group]: Boolean(enabled) },
  };
  saveCommandSettings();
  syncCommandSettings();
}

export function resetCommandSettings() {
  state.commandSettings = cloneDefaults();
  saveCommandSettings();
  syncCommandSettings();
  toast("Command palette settings reset.");
}

function activateCommandsTab() {
  const tab = document.querySelector('[data-settings-tab="commands"]');
  if (!tab) return;
  if (tab.getAttribute("aria-selected") !== "true") tab.click();
  const pane = document.querySelector('[data-settings-pane="commands"]');
  if (!pane || !pane.hidden) return;
  document.querySelectorAll("[data-settings-pane]").forEach((item) => {
    const active = item === pane;
    item.classList.toggle("is-active", active);
    item.hidden = !active;
  });
  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    const active = button === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
}

export function openCommandSettings() {
  openWindow("settings");
  requestAnimationFrame(() => {
    activateCommandsTab();
    const section = document.querySelector('[data-settings-section="command"]');
    if (!section) return;
    section.scrollIntoView({ block: "start", behavior: "smooth" });
    section.classList.add("is-highlighted");
    window.setTimeout(() => section.classList.remove("is-highlighted"), 1200);
  });
}

function bindToggleRows() {
  document.querySelectorAll("[data-command-setting]").forEach((input) => {
    if (input.type !== "checkbox") return;
    const row = input.closest(".os-settings-row");
    if (!row || input.closest("label") || row.dataset.commandToggle === "on") return;
    row.dataset.commandToggle = "on";
    row.addEventListener("click", (event) => {
      if (event.target.closest("input, select, button, a")) return;
      input.click();
    });
  });
}

syncCommandSettings();
bindToggleRows();

document.querySelectorAll("[data-command-setting]").forEach((input) => {
  input.addEventListener("change", () => {
    const key = input.dataset.commandSetting;
    const value = input.type === "checkbox"
      ? input.checked
      : Number(input.value);
    setCommandSetting(key, value);
  });
});

document.querySelectorAll("[data-command-group]").forEach((input) => {
  input.addEventListener("change", () => {
    setCommandGroup(input.dataset.commandGroup, input.checked);
  });
});
