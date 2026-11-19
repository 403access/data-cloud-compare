/* Aether OS — entry point
   Imports every feature for its listener registration, then brings the desktop
   to its initial state. Import order is the app boot order. */

import { applyAppearance } from "./features/appearance.js";
import { initPlaceholderWaves } from "../../inputs.js";
import { renderAll } from "./compare/view.js";
import { startClock } from "./shell/clock.js";
import { renderKeymap } from "./shell/keymap.js";
import { applyResourceDisplay } from "./shell/menu-bar-usage.js";
import { initTaskManager } from "./apps/task-manager.js";
import { initBuilder } from "./apps/gui-builder.js";
import { initSidebarResize } from "./shell/sidebar-resize.js";
import { playerWindow } from "./apps/music.js";
import {
  applyWindowLayout, closeWindow, focusWindow, openWindow, syncDock, windowById,
  windowsFor,
} from "./shell/windows.js";
import "./compare/interactions.js";
import "./apps/calendar.js";
import "./apps/network.js";
import "./apps/devices.js";
import "./apps/battery.js";
import "./apps/sound.js";
import "./apps/audio.js";
import "./apps/settings.js";
import "./apps/terminal.js";
import "./apps/explorer.js";
import "./shell/commands.js";
import "./shell/command-settings.js";
import "./shell/shortcuts.js";

const embedTarget = new URLSearchParams(window.location.search).get("embed");
const embedded = Boolean(embedTarget);

startClock();
renderKeymap();
applyAppearance({ save: false });
initPlaceholderWaves();
renderAll();
applyResourceDisplay();
initTaskManager();
initBuilder();
initSidebarResize();

if (playerWindow) closeWindow(playerWindow);

if (embedded) {
  const target = windowById(embedTarget);
  if (target) {
    document.documentElement.classList.add("os-embed");
    windowsFor(embedTarget).forEach((win) => {
      if (win !== target) closeWindow(win);
    });
    document.querySelectorAll("[data-window]").forEach((win) => {
      if (win !== target) closeWindow(win);
    });
    target.classList.add("is-embed-target");
    openWindow(embedTarget);
  }
} else {
  const compareStart = windowById("compare");
  if (compareStart) {
    compareStart.classList.add("is-open");
    focusWindow(compareStart);
  }
}

applyWindowLayout();
syncDock();
