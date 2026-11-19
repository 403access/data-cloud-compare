/* Aether OS — command bar
   Owns the overlay, selection model, fuzzy result rendering, and keyboard
   navigation. The catalog knows what exists; this module shows and runs it. */

import { state } from "../core/state.js";
import { esc } from "../core/utils.js";
import {
  clearPaneFilters, renderAll, selectEntry, setActiveSide,
} from "../compare/view.js";
import { buildCommandItems, commandIcon } from "./command-catalog.js";
import { openCommandSettings } from "./command-settings.js";
import { openWindowInstance } from "./windows.js";
import { closeTrays } from "./popovers.js";

const overlay = document.querySelector("[data-command-overlay]");
const commandInput = document.querySelector("[data-command-input]");
const commandResults = document.querySelector("[data-command-results]");
const commandEmpty = document.querySelector("[data-command-empty]");
const commandSpinner = document.querySelector("[data-command-spinner]");
let previousFocus = null;
function highlight(text, query) {
  if (!query) return esc(text);
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return esc(text);
  return `${esc(text.slice(0, index))}<mark>${esc(text.slice(index, index + query.length))}</mark>${esc(text.slice(index + query.length))}`;
}

function renderCommands() {
  if (!commandResults) return;
  const {
    items, raw, commandsOnly, settings, fileThreshold, commandsOn, filesOn,
  } = buildCommandItems();
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
      if (!commandsOn && !filesOn) {
        title = "Command bar is empty";
        hint = "Enable commands or files in Settings · Command palette.";
      } else if (commandsOnly) {
        title = "No command matches";
        hint = "Remove the > to search files and folders too.";
      } else if (filesOn && raw.length > 0 && raw.length < fileThreshold) {
        const remaining = fileThreshold - raw.length;
        title = `Type ${remaining} more character${remaining === 1 ? "" : "s"}`;
        hint = `File and folder search starts after ${fileThreshold} character${fileThreshold === 1 ? "" : "s"}.`;
      } else if (!raw) {
        title = settings.showCommands ? "No commands are shown" : "Search files and folders";
        hint = settings.showCommands
          ? "Enable command groups in Settings · Command palette."
          : `File and folder search starts after ${fileThreshold} character${fileThreshold === 1 ? "" : "s"}.`;
      } else if (raw) {
        title = filesOn ? `No matches for “${raw}”` : `No command matches “${raw}”`;
        hint = filesOn
          ? "Try a different word or check the enabled command groups."
          : "File search is off. Enable it in Settings · Command palette.";
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

function runCommandItem(item, { instance = false } = {}) {
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
  if (instance && item.app) {
    openWindowInstance(item.app);
    return;
  }
  item.run?.();
}

function syncCommandPlaceholder() {
  if (!commandInput) return;
  const settings = state.commandSettings;
  const hasFiles = settings.localFiles || settings.remoteFiles;
  if (settings.showCommands && hasFiles) {
    commandInput.placeholder = "Search files and folders, or run a command…";
  } else if (settings.showCommands) {
    commandInput.placeholder = "Run a command…";
  } else if (hasFiles) {
    commandInput.placeholder = "Search files and folders…";
  } else {
    commandInput.placeholder = "Open Settings · Command palette to enable sources";
  }
}

export function openCommand() {
  if (!overlay) return;
  closeTrays();
  previousFocus = document.activeElement;
  overlay.hidden = false;
  state.command.query = "";
  state.command.index = 0;
  if (commandInput) commandInput.value = "";
  syncCommandPlaceholder();
  renderCommands();
  requestAnimationFrame(() => {
    commandInput?.focus();
    commandInput?.select();
  });
}

export function closeCommand() {
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
    runCommandItem(state.command.items[state.command.index], {
      instance: event.shiftKey,
    });
  } else if ((event.metaKey || event.ctrlKey) && event.key === ",") {
    event.preventDefault();
    event.stopPropagation();
    closeCommand();
    openCommandSettings();
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
  runCommandItem(state.command.items[index], { instance: event.shiftKey });
});

/* Middle-click an app result to open another instance of that app. */
commandResults?.addEventListener("auxclick", (event) => {
  if (event.button !== 1) return;
  const item = event.target.closest("[data-command-index]");
  if (!item) return;
  const index = Number(item.dataset.commandIndex);
  const command = state.command.items[index];
  if (!command?.app) return;
  event.preventDefault();
  state.command.index = index;
  runCommandItem(command, { instance: true });
});

document.querySelector("[data-command-close]")?.addEventListener("click", closeCommand);

document.querySelector("[data-command-settings]")?.addEventListener("click", () => {
  closeCommand();
  openCommandSettings();
});

overlay?.addEventListener("click", (event) => {
  if (event.target === overlay) closeCommand();
});

overlay?.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const focusables = [
    commandInput,
    document.querySelector("[data-command-settings]"),
    document.querySelector("[data-command-close]"),
  ].filter((node) => node && node.offsetParent !== null);
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

export function isCommandOpen() {
  return Boolean(overlay && !overlay.hidden);
}
