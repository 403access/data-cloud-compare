/* Aether OS — key map sheet
   The Keyboard shortcuts window renders from this table. Every action stores
   an array of bindings, and every binding stores an array of key caps, so one
   action can carry several alternatives. Pointer gestures use the same shape,
   which is how the new-instance action lists both middle click and Shift+click. */

import { esc } from "../core/utils.js";

export const KEYMAP_SECTIONS = [
  {
    title: "Apps & windows",
    rows: [
      {
        action: "Open another instance",
        bindings: [["Middle click"], ["Shift", "click"], ["Shift", "↵"]],
        note: "Dock tiles and command palette app results",
      },
      { action: "Open the command bar", bindings: [["⌘", "K"], ["Ctrl", "K"]] },
      { action: "Open Settings", bindings: [["⌘", ","]] },
      { action: "Close the focused window", bindings: [["⌘", "W"]] },
    ],
  },
  {
    title: "Data Cloud Compare",
    rows: [
      { action: "Focus local pane", bindings: [["⌘", "1"]] },
      { action: "Focus remote pane", bindings: [["⌘", "2"]] },
      { action: "Search the active pane", bindings: [["⌘", "F"]] },
      { action: "Open the command bar", bindings: [["⌘", "K"]] },
      { action: "Move selection", bindings: [["↑", "↓"]] },
      { action: "Activate selected item", bindings: [["↵"]] },
      { action: "Up one folder", bindings: [["⌫"]] },
    ],
  },
  {
    title: "Views",
    rows: [
      { action: "Show or hide dotfiles", bindings: [["⌘", "⇧", "."]] },
      { action: "Toggle the legend", bindings: [["⌘", "/"]] },
      { action: "Columns settings", bindings: [["⌘", "⇧", "C"]] },
      { action: "Analytics", bindings: [["⌘", "⇧", "A"]] },
      { action: "Audio", bindings: [["⌘", "⇧", "S"]] },
      { action: "Settings", bindings: [["⌘", ","]] },
      { action: "Close overlay", bindings: [["esc"]] },
    ],
  },
];

function renderBinding(binding, action) {
  const caps = binding
    .map((key) => `<kbd>${esc(key)}</kbd>`)
    .join("");
  return `<span class="osx-keys" aria-label="${esc(binding.join(" + "))} for ${esc(action)}">${caps}</span>`;
}

function renderRow(row) {
  const alternatives = row.bindings
    .map((binding, index) => {
      const separator =
        index > 0 ? '<span class="osx-keys__or" aria-hidden="true">or</span>' : "";
      return `${separator}${renderBinding(binding, row.action)}`;
    })
    .join("");
  const note = row.note
    ? `<small class="osx-shortcut-row__note">${esc(row.note)}</small>`
    : "";
  return `<div class="osx-shortcut-row">
    <span class="osx-shortcut-row__action">${esc(row.action)}${note}</span>
    <span class="osx-shortcut-row__bindings">${alternatives}</span>
  </div>`;
}

export function renderKeymap() {
  const sheet = document.querySelector("[data-shortcuts-sheet]");
  if (!sheet) return;
  sheet.innerHTML = KEYMAP_SECTIONS.map(
    (section) => `<section>
      <h3>${esc(section.title)}</h3>
      ${section.rows.map(renderRow).join("")}
    </section>`,
  ).join("") + `<p class="osx-shortcuts-note">An action can hold more than one binding. Keyboard alternatives work with Ctrl in place of ⌘; pointer gestures are fixed in this demo.</p>`;
}