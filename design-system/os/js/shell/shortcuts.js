/* Aether OS — global keyboard shortcuts
   The desktop-level key map. Window and command bar keys are handled by their
   own modules; this file only covers global combinations and Escape. */

import { state } from "../core/state.js";
import {
  setActiveSide, toggleLegend, toggleSidePanel,
} from "../explorer/view.js";
import { closeCommand, isCommandOpen, openCommand } from "./command-bar.js";
import { runCommand } from "./commands.js";
import { closeMenus, closeTrays } from "./popovers.js";
import { openWindow } from "./windows.js";

/* --------------------------------------------------------- global keys */

document.addEventListener("keydown", (event) => {
  const modifier = event.metaKey || event.ctrlKey;

  if (modifier && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (isCommandOpen()) closeCommand();
    else openCommand();
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
    if (isCommandOpen()) {
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
