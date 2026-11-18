/* Aether OS — Battery
   Charge, energy mode, and low-power state for the tray and Battery app. */

import { toast } from "../core/toast.js";
import { registerTray } from "../shell/popovers.js";

/* ------------------------------------------------------------- battery */

const BATTERY_MODES = {
  low: { label: "Low power", time: "5h 40m" },
  balanced: { label: "Balanced", time: "4h 12m" },
  high: { label: "High performance", time: "3h 05m" },
};

export const batteryState = {
  level: 78,
  charging: false,
  mode: "balanced",
  lowPower: false,
  optimized: true,
};

const batteryModeNodes = document.querySelectorAll("[data-battery-mode]");
const batteryLowPowerNodes = document.querySelectorAll("[data-battery-lowpower]");
const batteryOptimizedNodes = document.querySelectorAll("[data-battery-optimized]");

export function batteryTime() {
  if (batteryState.charging) return "1h 08m until full";
  if (batteryState.lowPower) return "5h 05m remaining";
  return `${(BATTERY_MODES[batteryState.mode] || BATTERY_MODES.balanced).time} remaining`;
}

function syncBatteryUi() {
  const level = `${batteryState.level}%`;
  const time = batteryTime();
  const stateLabel = batteryState.charging ? "Charging" : "On battery";
  const toggle = document.querySelector('[data-tray-toggle="battery"]');

  toggle?.setAttribute("title", `Battery ${level} · ${time}`);
  toggle?.setAttribute("aria-label", `Battery ${level}`);
  document.querySelectorAll("[data-battery-tray-value]").forEach((node) => (node.textContent = level));
  document.querySelectorAll("[data-battery-state]").forEach((node) => (node.textContent = stateLabel));
  document.querySelectorAll("[data-battery-level]").forEach((node) => (node.textContent = level));
  document.querySelectorAll("[data-battery-time]").forEach((node) => (node.textContent = `About ${time}`));
  document.querySelectorAll("[data-battery-fill], [data-battery-app-fill]").forEach((node) => {
    node.style.width = `${batteryState.level}%`;
  });
  document.querySelectorAll("[data-battery-health-label]").forEach((node) => (node.textContent = "96%"));

  batteryModeNodes.forEach((node) => {
    const active = node.dataset.batteryMode === batteryState.mode;
    node.classList.toggle("is-active", active);
    node.setAttribute("aria-selected", String(active));
  });
  batteryLowPowerNodes.forEach((input) => (input.checked = batteryState.lowPower));
  batteryOptimizedNodes.forEach((input) => (input.checked = batteryState.optimized));

  document.querySelectorAll("[data-battery-app-level]").forEach((node) => (node.textContent = level));
  document.querySelectorAll("[data-battery-app-time]").forEach((node) => (node.textContent = `About ${time}`));
  document.querySelectorAll("[data-battery-app-badge]").forEach((node) => {
    node.classList.toggle("ds-badge--same", batteryState.charging);
    node.classList.toggle("ds-badge--muted", !batteryState.charging);
  });
  document.querySelectorAll("[data-battery-app-badge-text]").forEach((node) => (node.textContent = stateLabel));
  document.querySelectorAll("[data-battery-source]").forEach((node) => {
    node.textContent = batteryState.charging ? "Power adapter" : "Battery";
  });
  document.querySelectorAll("[data-battery-charging]").forEach((node) => {
    node.textContent = batteryState.charging ? "Charging" : "Not charging";
  });
}

function setBatteryMode(mode) {
  if (!BATTERY_MODES[mode] || batteryState.mode === mode) return;
  batteryState.mode = mode;
  syncBatteryUi();
  toast(`Energy mode · ${BATTERY_MODES[mode].label}`);
}

function setLowPower(value) {
  batteryState.lowPower = Boolean(value);
  syncBatteryUi();
  toast(`Low power mode ${batteryState.lowPower ? "on" : "off"}`);
}

function setOptimizedCharging(value) {
  batteryState.optimized = Boolean(value);
  syncBatteryUi();
  toast(`Optimised charging ${batteryState.optimized ? "on" : "off"}`);
}

batteryModeNodes.forEach((node) => node.addEventListener("click", () => setBatteryMode(node.dataset.batteryMode)));
batteryLowPowerNodes.forEach((input) => input.addEventListener("change", () => setLowPower(input.checked)));
batteryOptimizedNodes.forEach((input) => input.addEventListener("change", () => setOptimizedCharging(input.checked)));

registerTray("battery", { open: syncBatteryUi });
syncBatteryUi();
