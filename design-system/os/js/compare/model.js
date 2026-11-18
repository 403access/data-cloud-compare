/* Aether OS — comparison model
   Pure-ish selectors for comparison status, paths, filters, sorting, and the
   counterpart lookup. No rendering lives here. */

import { DATA } from "../core/data.js";
import {
  COLUMN_DEFS, FILTER_OPTIONS, PROVIDERS, REMOTE_STATUS, state,
} from "../core/state.js";

export const providerLabel = () => PROVIDERS[state.provider].label;
export const providerRoot = () => PROVIDERS[state.provider].root;

export function statusMeta(entry, side) {
  if (side === "remote") {
    return REMOTE_STATUS[entry.status] || { label: entry.status, className: "st-unmatched" };
  }
  if (entry.status === "exact") return { label: `In ${providerLabel()}`, className: "st-exact" };
  if (entry.status === "moved_match" || entry.status === "moved") {
    return { label: "Moved match", className: "st-moved_match" };
  }
  if (entry.status === "local_only") return { label: "Local only", className: "st-local_only" };
  if (entry.status === "type_mismatch") return { label: "Type differs", className: "st-type_mismatch" };
  if (entry.status === "unmatched") return { label: `Not in ${providerLabel()}`, className: "st-unmatched" };
  if (entry.status === "possible") return { label: "Maybe", className: "st-possible" };
  if (entry.status === "partial") return { label: "Partial", className: "st-partial" };
  if (entry.status === "missing") return { label: "Missing", className: "st-missing" };
  return { label: entry.status, className: "st-unmatched" };
}

export function entryPath(entry) {
  return entry.path || "";
}

export function entryParent(entry) {
  const path = entryPath(entry);
  const cut = path.lastIndexOf("/");
  return cut > 0 ? path.slice(0, cut) : "/";
}

export function sizeDisplay(entry) {
  if (!entry.isDir) return entry.size || "—";
  if (state.sizeMode === "files") {
    return entry.childCount != null ? `${entry.childCount.toLocaleString()} items` : "—";
  }
  if (state.sizeMode === "both") {
    return `${entry.folderSize || "—"} · ${(entry.childCount ?? 0).toLocaleString()} items`;
  }
  return entry.folderSize || "—";
}

function iconForEntry(entry) {
  if (entry.isDir) return { id: "i-folder", className: "is-folder" };
  const name = entry.name.toLowerCase();
  if (name.endsWith(".md")) return { id: "i-file-text", className: "is-text" };
  if (name.endsWith(".json") || name.endsWith(".sh")) return { id: "i-code-file", className: "is-code" };
  if (name.startsWith(".")) return { id: "i-code-file", className: "is-env" };
  return { id: "i-file", className: "is-text" };
}

export function iconHtml(entry) {
  const icon = iconForEntry(entry);
  return `<span class="osx-row-icon ${icon.className}"><svg class="icon"><use href="#${icon.id}"/></svg></span>`;
}

function visibleColumns() {
  return COLUMN_DEFS.filter((col) => state.columns.has(col.id));
}

export function columnTemplate() {
  return visibleColumns().map((col) => col.width).join(" ");
}

export function statusFilters(side) {
  return state.filters[side];
}

export function filterOptions(side) {
  return FILTER_OPTIONS[side].map((value) => {
    const entry = DATA[side].find((item) => item.status === value) || { status: value };
    return { value, ...statusMeta(entry, side) };
  });
}

export function baseEntries(side) {
  return state.hidden ? DATA[side] : DATA[side].filter((entry) => !entry.name.startsWith("."));
}

function compareEntries(a, b, sort) {
  const factor = sort.dir === "desc" ? -1 : 1;
  const id = sort.id;
  let result = 0;
  if (id === "name") result = a.name.localeCompare(b.name, undefined, { numeric: true });
  else if (id === "type") {
    const typeA = a.isDir ? "Folder" : a.type || "File";
    const typeB = b.isDir ? "Folder" : b.type || "File";
    result = typeA.localeCompare(typeB) || a.name.localeCompare(b.name);
  } else if (id === "status") {
    result = statusMeta(a, sort.side).label.localeCompare(statusMeta(b, sort.side).label) || a.name.localeCompare(b.name);
  } else if (id === "size") {
    result = (a.sizeValue || 0) - (b.sizeValue || 0);
  } else if (id === "modified") {
    result = String(a.modified || "").localeCompare(String(b.modified || ""));
  }
  return result * factor;
}

export function currentEntries(side) {
  let rows = baseEntries(side);
  const query = (state.search[side] || "").trim().toLowerCase();
  if (query) {
    rows = rows.filter(
      (entry) =>
        entry.name.toLowerCase().includes(query) ||
        entryPath(entry).toLowerCase().includes(query),
    );
  }
  const filters = statusFilters(side);
  if (filters.size) rows = rows.filter((entry) => filters.has(entry.status));
  const sort = { ...state.sort[side], side };
  return [...rows].sort((a, b) => compareEntries(a, b, sort));
}

export function isSelected(side, entry) {
  return state.selected?.side === side && state.selected?.name === entry.name;
}

export function filterLabel(side) {
  const filters = statusFilters(side);
  if (!filters.size) return "Filter";
  if (filters.size === 1) {
    const value = [...filters][0];
    const entry = DATA[side].find((item) => item.status === value) || { status: value };
    return statusMeta(entry, side).label;
  }
  return `Filter · ${filters.size}`;
}

export function selectedEntry() {
  if (!state.selected) return null;
  return DATA[state.selected.side].find((entry) => entry.name === state.selected.name) || null;
}

export function counterpartTarget(entry, side) {
  if (!entry) return null;
  if (side === "remote") {
    if (entry.status === "missing") return null;
    if (entry.status === "moved" || entry.status === "possible") return entry.foundAt || null;
    return entry.path;
  }
  if (entry.status === "local_only" || entry.status === "unmatched") return null;
  if (entry.status === "moved_match" || entry.status === "moved") return entry.foundAt || null;
  if (entry.status === "type_mismatch") return entry.path;
  return entry.foundAt || entry.path;
}
