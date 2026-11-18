/* Aether OS — entry point
   Imports every feature for its listener registration, then brings the desktop
   to its initial state. Import order is the app boot order. */

import { applyAppearance } from "./features/appearance.js";
import { renderAll } from "./explorer/view.js";
import { startClock } from "./shell/clock.js";
import { applyResourceDisplay } from "./shell/menu-bar-usage.js";
import { initTaskManager } from "./apps/task-manager.js";
import { playerWindow } from "./apps/music.js";
import { closeWindow, focusWindow, syncDock, windowById } from "./shell/windows.js";
import "./explorer/interactions.js";
import "./apps/calendar.js";
import "./apps/network.js";
import "./apps/devices.js";
import "./apps/battery.js";
import "./apps/sound.js";
import "./apps/terminal.js";
import "./shell/commands.js";
import "./shell/shortcuts.js";

startClock();
applyAppearance({ save: false });
renderAll();
applyResourceDisplay();
initTaskManager();

if (playerWindow) closeWindow(playerWindow);

const explorerStart = windowById("explorer");
if (explorerStart) {
  explorerStart.classList.add("is-open");
  focusWindow(explorerStart);
}

syncDock();
