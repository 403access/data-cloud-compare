/* Aether OS — command dispatcher
   Maps data-cmd attributes from menus, the dock, and the command bar to the
   feature that performs the action. */

import { resolvedTheme, state } from "../core/state.js";
import { toast } from "../core/toast.js";
import { providerLabel, providerRoot } from "../compare/model.js";
import {
  mirrorPanes, openSelected, renderAll, revealSelected, toggleLegend,
  toggleSidePanel,
} from "../compare/view.js";
import { verifySnapshot } from "../compare/verify.js";
import {
  resetWaterSettings, setThemeMode, setWaterSetting,
} from "../features/appearance.js";
import { openCalendarApp } from "../apps/calendar.js";
import { openDevices } from "../apps/devices.js";
import { openBuilder } from "../apps/gui-builder.js";
import { changeTrack, togglePlay } from "../apps/music.js";
import { openTaskManager } from "../apps/task-manager.js";
import { focusTerminalInput, rerunTerminal } from "../apps/terminal.js";
import { openCommand } from "./command-bar.js";
import { openSettings } from "../apps/settings.js";
import { openCommandSettings, resetCommandSettings } from "./command-settings.js";
import { closeMenus, closeTrays } from "./popovers.js";
import { closeWindow, focusedWindow, openWindow } from "./windows.js";

/* ------------------------------------------------------------ commands */

export function runCommand(command) {
  switch (command) {
    case "open-explorer":
      openWindow("explorer");
      break;
    case "open-compare":
      openWindow("compare");
      break;
    case "open-settings":
      openSettings();
      break;
    case "open-settings-network":
      openSettings("network");
      break;
    case "open-settings-bluetooth":
      openSettings("bluetooth");
      break;
    case "open-settings-battery":
      openSettings("battery");
      break;
    case "open-settings-displays":
      openSettings("displays");
      break;
    case "open-settings-security":
      openSettings("security");
      break;
    case "open-command-settings":
      openCommandSettings();
      break;
    case "reset-command-settings":
      resetCommandSettings();
      break;
    case "open-network":
      openWindow("network");
      break;
    case "open-devices":
      openDevices();
      break;
    case "open-battery":
      openWindow("battery");
      break;
    case "open-calendar":
      openCalendarApp();
      break;
    case "open-taskmanager":
      openTaskManager();
      break;
    case "open-builder":
      openBuilder();
      break;
    case "open-terminal":
      openWindow("terminal");
      focusTerminalInput();
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
      openWindow("compare");
      toggleSidePanel("analytics");
      break;
    case "columns":
      openWindow("compare");
      toggleSidePanel("columns");
      break;
    case "shortcuts":
      openWindow("shortcuts");
      break;
    case "mirror":
      openWindow("compare");
      mirrorPanes();
      break;
    case "up":
      openWindow("compare");
      toast("Already at the snapshot root", "warn");
      break;
    case "local-root":
      openWindow("compare");
      toast("Local root · /mnt/tank");
      break;
    case "remote-root":
      openWindow("compare");
      toast(`${providerLabel()} root · ${providerRoot()}`);
      break;
    case "verify":
      verifySnapshot();
      break;
    case "reveal-selected":
      openWindow("compare");
      revealSelected();
      break;
    case "open-selected":
      openWindow("compare");
      openSelected();
      break;
    case "toggle-hidden": {
      openWindow("compare");
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
      openWindow("compare");
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
