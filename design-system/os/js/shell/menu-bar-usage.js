/* Aether OS — menu bar usage display
   The per-meter visibility and finish preferences used by the CPU, RAM, and
   storage meters in the menu bar. */

import { readJSON, root, writeJSON } from "../core/state.js";
import { toast } from "../core/toast.js";

/* ------------------------------------------------ menu bar usage display */

const RESOURCE_DISPLAY_KEY = "explorer-os-resource-display";
const RESOURCE_DISPLAY_VERSION = 2;
const RESOURCE_DISPLAY_DEFAULTS = {
  visible: true,
  border: false,
  captions: true,
  bars: true,
  values: true,
  dividers: false,
};
const RESOURCE_DISPLAY_LABELS = {
  visible: "Menu bar visibility",
  border: "Border",
  captions: "Captions",
  bars: "Bars",
  values: "Values",
  dividers: "Dividers",
};

function readResourceDisplay() {
  const saved = readJSON(RESOURCE_DISPLAY_KEY);
  if (!saved || typeof saved !== "object") return { ...RESOURCE_DISPLAY_DEFAULTS };
  const current = saved.version === RESOURCE_DISPLAY_VERSION;
  return {
    visible: saved.visible !== false,
    border: saved.border === true,
    captions: saved.captions !== false,
    bars: saved.bars !== false,
    values: saved.values !== false,
    // Older saves wrote the old default (on) even when nobody chose it.
    dividers: current ? saved.dividers === true : false,
  };
}

let resourceDisplay = readResourceDisplay();

export function applyResourceDisplay() {
  root.dataset.resourceVisible = resourceDisplay.visible ? "on" : "off";
  root.dataset.resourceBorder = resourceDisplay.border ? "on" : "off";
  root.dataset.resourceCaptions = resourceDisplay.captions ? "on" : "off";
  root.dataset.resourceBars = resourceDisplay.bars ? "on" : "off";
  root.dataset.resourceValues = resourceDisplay.values ? "on" : "off";
  root.dataset.resourceDividers = resourceDisplay.dividers ? "on" : "off";
  document.querySelectorAll("[data-resource-display-setting]").forEach((input) => {
    input.checked = Boolean(resourceDisplay[input.dataset.resourceDisplaySetting]);
  });
}

function saveResourceDisplay() {
  writeJSON(RESOURCE_DISPLAY_KEY, {
    ...resourceDisplay,
    version: RESOURCE_DISPLAY_VERSION,
  });
}

function setResourceDisplay(key, value) {
  if (!(key in RESOURCE_DISPLAY_DEFAULTS)) return;
  resourceDisplay = { ...resourceDisplay, [key]: Boolean(value) };
  saveResourceDisplay();
  applyResourceDisplay();
  toast(`Menu bar usage · ${RESOURCE_DISPLAY_LABELS[key]} ${value ? "on" : "off"}`);
}

function resetResourceDisplay() {
  resourceDisplay = { ...RESOURCE_DISPLAY_DEFAULTS };
  saveResourceDisplay();
  applyResourceDisplay();
  toast("Menu bar usage display reset");
}

document.querySelectorAll("[data-resource-display-setting]").forEach((input) => {
  input.addEventListener("change", () => {
    setResourceDisplay(input.dataset.resourceDisplaySetting, input.checked);
  });
});
document.querySelector("[data-task-display-reset]")?.addEventListener("click", resetResourceDisplay);
