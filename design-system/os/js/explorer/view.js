/* Aether OS — explorer view
   Renders the two panes, the status bar, the side panels, and the small
   selection actions the rendered controls need to call back into. */

import { DATA, SUMMARY } from "../core/data.js";
import {
  COLUMN_DEFS, DEFAULT_COLUMNS, PROVIDERS, SIZE_KEY, STATUS_COLORS, saveColumns, state,
} from "../core/state.js";
import { toast } from "../core/toast.js";
import { date, esc } from "../core/utils.js";
import {
  baseEntries, columnTemplate, counterpartTarget, currentEntries,
  entryParent, entryPath, filterLabel, filterOptions, iconHtml,
  isSelected, providerLabel, providerRoot, selectedEntry, sizeDisplay,
  statusFilters, statusMeta,
} from "./model.js";
import { openWindow, windowById } from "../shell/windows.js";

function rowHtml(entry, side) {
  const status = statusMeta(entry, side);
  const selected = isSelected(side, entry);
  const cell = (id, content, className, extra = "") =>
    `<div class="osx-cell ${className}"${state.columns.has(id) ? "" : " hidden"}${extra}>${content}</div>`;
  return `<div class="osx-row${selected ? " is-selected" : ""}" role="option" aria-selected="${selected}" data-entry="${esc(entry.name)}" data-side="${side}" title="${esc(entryPath(entry))}">
    ${cell("name", `${iconHtml(entry)}<span class="osx-name" title="${esc(entryPath(entry))}">${esc(entry.name)}</span>`, "osx-cell-name")}
    ${cell("type", esc(entry.isDir ? "Folder" : entry.type || "File"), "osx-cell-type")}
    ${cell("status", `<span class="osx-status-chip ${status.className}" title="${esc(entry.note || status.label)}"><span class="dot"></span><span>${esc(status.label)}</span></span>`, "osx-cell-status")}
    ${cell("size", esc(sizeDisplay(entry)), "osx-cell-size")}
    ${cell("modified", entry.modified ? esc(date(entry.modified)) : "—", "osx-cell-mod")}
  </div>`;
}

function renderColumns(side) {
  const pane = document.querySelector(`[data-pane="${side}"]`);
  const head = document.querySelector(`[data-column-head="${side}"]`);
  if (!pane || !head) return;
  pane.style.setProperty("--osx-cols", columnTemplate());
  head.querySelectorAll("button[data-sort]").forEach((button) => {
    const id = button.dataset.sort;
    button.hidden = !state.columns.has(id);
    const sort = state.sort[side];
    button.classList.toggle("is-sorted", sort.id === id);
    button.classList.toggle("is-desc", sort.id === id && sort.dir === "desc");
  });
}

export function renderFilterPop(side) {
  const pop = document.querySelector(`[data-filter-pop="${side}"]`);
  if (!pop) return;
  const active = statusFilters(side);
  pop.innerHTML = `<div class="osx-filter-head"><span>Show only</span><button type="button" data-filter-clear="${side}">Clear all</button></div>${filterOptions(side)
    .map(
      (option) => `<label class="osx-filter-option"><input type="checkbox" value="${option.value}" ${active.has(option.value) ? "checked" : ""}><span class="dot" style="background:${STATUS_COLORS[option.value] || "var(--ds-gray)"}"></span><span>${esc(option.label)}</span></label>`,
    )
    .join("")}`;
  pop.querySelectorAll("input[type=checkbox]").forEach((box) => {
    box.addEventListener("change", () => {
      const filters = statusFilters(side);
      if (box.checked) filters.add(box.value);
      else filters.delete(box.value);
      renderPane(side);
      renderStatusbar();
    });
  });
  pop.querySelector(`[data-filter-clear="${side}"]`)?.addEventListener("click", () => {
    statusFilters(side).clear();
    renderPane(side);
    renderStatusbar();
    renderFilterPop(side);
    pop.hidden = false;
  });
}

function renderPaneFoot(side) {
  const summary = document.querySelector(`[data-pane-summary="${side}"]`);
  const chips = document.querySelector(`[data-pane-chips="${side}"]`);
  if (!summary || !chips) return;
  const base = baseEntries(side);
  const visible = currentEntries(side);
  const filters = statusFilters(side);
  const filtering = Boolean(state.search[side].trim()) || filters.size > 0;
  if (filtering) {
    summary.textContent = `${visible.length} of ${base.length} items · ${filters.size ? filterLabel(side) : "search"}`;
  } else {
    const meta = SUMMARY[side];
    summary.textContent = `${meta.items} items · ${meta.dirs} folders · ${meta.files} files · ${meta.size}`;
  }
  const counts = new Map();
  for (const entry of base) counts.set(entry.status, (counts.get(entry.status) || 0) + 1);
  const order = ["missing", "partial", "possible", "moved", "type_mismatch", "moved_match", "local_only", "unmatched", "exact"];
  chips.innerHTML = order
    .filter((status) => status !== "exact" && counts.get(status))
    .map((status) => {
      const meta = statusMeta(base.find((entry) => entry.status === status) || { status }, side);
      return `<button type="button" class="osx-mini-chip ${meta.className}${filters.has(status) ? " is-active" : ""}" data-mini-filter="${side}" data-status="${status}" title="Toggle ${esc(meta.label)} in the filter"><span class="dot"></span><span>${esc(meta.label)} ${counts.get(status)}</span></button>`;
    })
    .join("");
}

export function renderPane(side) {
  const rowsEl = document.querySelector(`[data-rows="${side}"]`);
  if (!rowsEl) return;
  const rows = currentEntries(side);
  rowsEl.innerHTML = rows.length
    ? rows.map((entry) => rowHtml(entry, side)).join("")
    : `<div class="osx-empty">${
        state.search[side].trim()
          ? `No items match “${esc(state.search[side].trim())}”.`
          : statusFilters(side).size
            ? "No items match the selected status filters."
            : "This folder is empty."
      }</div>`;
  renderColumns(side);
  renderPaneFoot(side);

  const filterButton = document.querySelector(`[data-filter-toggle="${side}"]`);
  if (filterButton) {
    filterButton.classList.toggle("is-active", statusFilters(side).size > 0);
    const label = filterButton.querySelector("span");
    if (label) label.textContent = filterLabel(side);
  }
}

export function renderStatusbar() {
  const selection = document.querySelector("[data-selection]");
  const reveal = document.querySelector('.osx-statusbar [data-cmd="reveal-selected"]');
  if (!selection || !reveal) return;
  const entry = selectedEntry();
  if (!entry) {
    selection.innerHTML = '<span class="muted">Select an item to see details.</span>';
    reveal.disabled = true;
    reveal.textContent = "Reveal counterpart";
    return;
  }
  const side = state.selected.side;
  const status = statusMeta(entry, side);
  const meta = entry.isDir ? `Folder · ${sizeDisplay(entry)}` : `File · ${entry.size || "—"}`;
  const modified = entry.modified ? ` · ${date(entry.modified)}` : "";
  selection.innerHTML = `<span class="osx-sel-name" title="${esc(entryPath(entry))}">${esc(entry.name)}</span>
    <span class="osx-sel-meta">${esc(meta)}${esc(modified)}</span>
    <span class="osx-status-chip ${status.className}" title="${esc(entry.note || status.label)}"><span class="dot"></span><span>${esc(status.label)}</span></span>
    ${entry.foundAt ? `<button type="button" class="osx-sel-found" data-found-at="${esc(entry.foundAt)}" title="${esc(entry.foundAt)}">Found at: ${esc(entry.foundAt)}</button>` : ""}`;
  const target = counterpartTarget(entry, side);
  reveal.disabled = !target;
  reveal.textContent = side === "remote" ? "Show in local index" : `Show in ${providerLabel()}`;
}

function renderProviderUi() {
  const provider = PROVIDERS[state.provider];
  document.querySelectorAll("[data-provider-label]").forEach((node) => (node.textContent = provider.label));
  document.querySelectorAll("[data-provider-name]").forEach((node) => (node.textContent = provider.label));
  document.querySelectorAll("[data-provider-root]").forEach((node) => (node.textContent = provider.root));
  document.querySelectorAll(".osx-provider-choice").forEach((button) => {
    const active = button.dataset.provider === state.provider;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  const remoteSearch = document.querySelector('[data-search="remote"]');
  if (remoteSearch) {
    remoteSearch.placeholder = `Search ${provider.label}…`;
    remoteSearch.setAttribute("aria-label", `Search ${provider.label}`);
  }
  const crumb = document.querySelector('[data-crumb="remote"]');
  if (crumb) crumb.textContent = provider.root;
  const remotePane = document.querySelector('[data-pane="remote"] .osx-pane-icon--remote');
  if (remotePane) remotePane.style.color = provider.key === "google_drive" ? "#4285f4" : "#a78bfa";
}

export function renderAll() {
  renderProviderUi();
  renderPane("local");
  renderPane("remote");
  renderStatusbar();
  if (state.sidePanel) renderSidePanel();
}

export function setActiveSide(side) {
  state.activeSide = side;
  document.querySelectorAll(".osx-pane").forEach((pane) => {
    pane.classList.toggle("is-active", pane.dataset.pane === side);
  });
  updateFilterButtonLabels();
}

function updateFilterButtonLabels() {
  for (const side of ["local", "remote"]) {
    const button = document.querySelector(`[data-filter-toggle="${side}"]`);
    if (!button) continue;
    button.classList.toggle("is-active", statusFilters(side).size > 0);
    const label = button.querySelector("span");
    if (label) label.textContent = filterLabel(side);
  }
}

export function selectEntry(side, name, { scroll = false } = {}) {
  const entry = DATA[side].find((item) => item.name === name);
  if (!entry) return;
  state.selected = { side, name };
  setActiveSide(side);
  document.querySelectorAll(".osx-row").forEach((row) => {
    const active = row.dataset.side === side && row.dataset.entry === name;
    row.classList.toggle("is-selected", active);
    row.setAttribute("aria-selected", String(active));
  });
  renderStatusbar();
  if (state.sidePanel === "detail") renderSidePanel();
  if (scroll) {
    const row = Array.from(document.querySelectorAll(`[data-rows="${side}"] .osx-row`)).find(
      (item) => item.dataset.entry === name,
    );
    row?.scrollIntoView({ block: "nearest" });
  }
}

export function revealSelected() {
  openWindow("explorer");
  const entry = selectedEntry();
  if (!entry || !state.selected) {
    toast("Select a file or folder first", "warn");
    return;
  }
  const side = state.selected.side;
  const target = counterpartTarget(entry, side);
  if (!target) {
    toast(`No counterpart for ${entry.name}`, "warn");
    return;
  }
  const other = side === "local" ? "remote" : "local";
  const match = DATA[other].find((item) => item.path === target || item.name === entry.name);
  if (match) {
    const base = baseEntries(other);
    if (!base.some((item) => item.name === match.name)) {
      state.hidden = true;
      const input = document.querySelector("[data-hidden-toggle]");
      if (input) input.checked = true;
    }
    clearPaneFilters(other);
    renderAll();
    selectEntry(other, match.name, { scroll: true });
    const row = Array.from(document.querySelectorAll(`[data-rows="${other}"] .osx-row`)).find(
      (item) => item.dataset.entry === match.name,
    );
    if (row) {
      row.classList.remove("is-flash");
      void row.offsetWidth;
      row.classList.add("is-flash");
      window.setTimeout(() => row.classList.remove("is-flash"), 1200);
    }
    toast(`Counterpart · ${target}`);
  } else {
    toast(`Counterpart · ${target}`);
  }
}

export function openSelected() {
  openWindow("explorer");
  const entry = selectedEntry();
  if (!entry) {
    toast("Select a file or folder first", "warn");
    return;
  }
  if (entry.isDir) {
    toast(`Opened folder · ${entry.name}`);
  } else {
    setSidePanel("detail", state.selected.side, entry.name);
  }
}

export function mirrorPanes() {
  openWindow("explorer");
  document.querySelectorAll(".osx-pane").forEach((pane) => {
    pane.classList.remove("is-flash");
    void pane.offsetWidth;
    pane.classList.add("is-flash");
    window.setTimeout(() => pane.classList.remove("is-flash"), 1000);
  });
  toast(`Both panes pinned to ${state.activeSide === "local" ? "/mnt/tank" : providerRoot()}`);
}

/* ------------------------------------------------------------- side panel */

export function setSidePanel(mode, side = state.activeSide, entryName = state.selected?.name) {
  const panel = document.querySelector("[data-side-panel]");
  const win = windowById("explorer");
  if (!panel || !win) return;
  if (mode) openWindow("explorer");
  if (!mode) {
    state.sidePanel = null;
    panel.hidden = true;
    win.classList.remove("has-side");
    return;
  }
  state.sidePanel = mode;
  state.sidePanelSide = side;
  panel.hidden = false;
  win.classList.add("has-side");
  renderSidePanel();
}

export function toggleSidePanel(mode, side = state.activeSide, entryName = state.selected?.name) {
  if (state.sidePanel === mode) setSidePanel(null);
  else setSidePanel(mode, side, entryName);
}

function sidePanelData() {
  return {
    columns: {
      title: "Columns",
      subtitle: "Choose what both panes show and how folder sizes read.",
    },
    detail: {
      title: "Details",
      subtitle: "Right-click a file or folder to inspect it.",
    },
    analytics: {
      title: "Analytics",
      subtitle: `${providerLabel()} snapshot totals and index coverage.`,
    },
    source: {
      title: state.sidePanelSide === "local" ? "Local index" : `${providerLabel()} snapshot`,
      subtitle: state.sidePanelSide === "local" ? "Reference side for every comparison." : "Remote side of the comparison.",
    },
  };
}

function renderSidePanel() {
  const panel = document.querySelector("[data-side-panel]");
  if (!panel || !state.sidePanel) return;
  const meta = sidePanelData()[state.sidePanel];
  panel.querySelector("[data-side-title]").textContent = meta.title;
  panel.querySelector("[data-side-subtitle]").textContent = meta.subtitle;
  const body = panel.querySelector("[data-side-body]");
  if (!body) return;

  if (state.sidePanel === "columns") {
    body.innerHTML = `<div class="osx-columns-options">${COLUMN_DEFS.map(
      (col) => `<label class="osx-columns-option"><input type="checkbox" data-column-toggle="${col.id}" ${state.columns.has(col.id) ? "checked" : ""} ${col.required ? "disabled" : ""}><span class="osx-columns-text"><span class="osx-columns-title">${col.label}</span><span class="osx-columns-hint">${col.required ? "Always shown" : col.hint}</span></span></label>`,
    ).join("")}
      <label class="osx-columns-setting"><span class="osx-columns-text"><span class="osx-columns-title">Folder size</span><span class="osx-columns-hint">Choose how the Size column shows folders.</span></span><select class="osx-select" data-size-mode aria-label="Folder size display"><option value="bytes" ${state.sizeMode === "bytes" ? "selected" : ""}>Size in bytes</option><option value="files" ${state.sizeMode === "files" ? "selected" : ""}>Item count</option><option value="both" ${state.sizeMode === "both" ? "selected" : ""}>Bytes + item count</option></select></label>
    </div>
    <div class="osx-side-foot"><button type="button" class="osx-btn osx-btn--ghost" data-columns-reset>Reset columns</button><p>Right-click a table header any time to reopen this sidebar.</p></div>`;
    body.querySelectorAll("[data-column-toggle]").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) state.columns.add(input.dataset.columnToggle);
        else state.columns.delete(input.dataset.columnToggle);
        state.columns.add("name");
        saveColumns();
        renderAll();
      });
    });
    body.querySelector("[data-size-mode]")?.addEventListener("change", (event) => {
      state.sizeMode = event.target.value;
      try {
        localStorage.setItem(SIZE_KEY, state.sizeMode);
      } catch {
        /* ignore */
      }
      renderAll();
    });
    body.querySelector("[data-columns-reset]")?.addEventListener("click", () => {
      state.columns = new Set(DEFAULT_COLUMNS);
      state.sizeMode = "bytes";
      saveColumns();
      try {
        localStorage.setItem(SIZE_KEY, state.sizeMode);
      } catch {
        /* ignore */
      }
      renderAll();
    });
    return;
  }

  if (state.sidePanel === "detail") {
    const key = state.selected?.name;
    const side = state.selected?.side || state.sidePanelSide;
    const entry = key ? DATA[side].find((item) => item.name === key) : null;
    if (!entry) {
      body.innerHTML = '<p class="osx-detail-note">Right-click a file or folder to inspect it.</p>';
      return;
    }
    const status = statusMeta(entry, side);
    const facts = [
      entry.isDir
        ? ["Folder size", entry.folderSize || "—"]
        : ["Size", entry.size || "—"],
      entry.isDir ? ["Items", entry.childCount != null ? `${entry.childCount.toLocaleString()} direct` : "—"] : null,
      entry.modified ? ["Modified", date(entry.modified)] : null,
      entry.path ? ["Folder", entryParent(entry)] : null,
      entry.foundAt ? ["Found at", entry.foundAt] : null,
      ["Source", side === "local" ? "Local index" : providerLabel()],
    ].filter(Boolean);
    body.innerHTML = `<div class="osx-detail-body">
      <div class="osx-detail-hero"><span class="osx-detail-icon">${iconHtml(entry)}</span><div style="min-width:0"><h3>${esc(entry.name)}</h3><p class="osx-detail-path">${esc(entryPath(entry))}</p></div></div>
      <div class="osx-detail-badges"><span class="osx-detail-type">${entry.isDir ? "Folder" : esc(entry.type || "File")}</span><span class="osx-status-chip ${status.className}"><span class="dot"></span><span>${esc(status.label)}</span></span></div>
      <div class="osx-detail-facts">${facts.map(([label, value]) => `<div class="osx-detail-fact${label === "Found at" || label === "Folder" ? " is-mono" : ""}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join("")}</div>
      ${entry.note ? `<p class="osx-detail-note">${esc(entry.note)}</p>` : ""}
      <div class="osx-detail-actions">${entry.isDir ? `<button type="button" class="osx-btn osx-btn--primary" data-detail-open>Open folder</button>` : ""}<button type="button" class="osx-btn" data-detail-reveal ${counterpartTarget(entry, side) ? "" : "disabled"}>${side === "remote" ? "Show in local index" : `Show in ${providerLabel()}`}</button></div>
    </div>`;
    body.querySelector("[data-detail-open]")?.addEventListener("click", openSelected);
    body.querySelector("[data-detail-reveal]")?.addEventListener("click", revealSelected);
    return;
  }

  if (state.sidePanel === "analytics") {
    const remote = SUMMARY.remote;
    const coverage = 87.7;
    const counts = new Map();
    for (const entry of DATA.remote) counts.set(entry.status, (counts.get(entry.status) || 0) + 1);
    body.innerHTML = `<div class="osx-detail-body">
      <div class="osx-detail-hero"><span class="osx-detail-icon"><svg class="icon"><use href="#i-chart"/></svg></span><div><h3>${providerLabel()} analytics</h3><p class="osx-detail-path">explorer-water-settings · snapshot</p></div></div>
      <div class="osx-analytics-stats">
        <div class="osx-analytics-stat"><span>Files</span><b>${remote.files.toLocaleString()}</b></div>
        <div class="osx-analytics-stat"><span>Folders</span><b>${remote.dirs.toLocaleString()}</b></div>
        <div class="osx-analytics-stat"><span>Total size</span><b>${remote.size}</b></div>
        <div class="osx-analytics-stat good"><span>Coverage</span><b>${coverage.toFixed(1)}%</b></div>
      </div>
      <div class="osx-analytics-coverage"><span class="osx-analytics-track"><span class="osx-analytics-fill" style="width:${coverage}%"></span></span><span class="osx-analytics-pct">${coverage.toFixed(1)}%</span></div>
      <h4 class="osx-side-section-title">Snapshot</h4>
      <div class="osx-detail-facts">
        <div class="osx-detail-fact"><span>Version</span><b>2026-11-17</b></div>
        <div class="osx-detail-fact"><span>Date</span><b>17 Nov 2026</b></div>
        <div class="osx-detail-fact"><span>Root</span><b>${esc(providerRoot())}</b></div>
        <div class="osx-detail-fact is-mono"><span>Archive file</span><b>archive.json</b></div>
      </div>
      <h4 class="osx-side-section-title">Status breakdown</h4>
      <div>${[["Same path", "exact", "good"], ["Moved", "moved", "ok"], ["Maybe", "possible", "warn"], ["Missing", "missing", "low"]].map(([label, status, tone]) => `<div class="osx-analytics-row"><span><span class="dot ${tone}"></span>${label}</span><b>${(counts.get(status) || 0).toLocaleString()} files</b><b>—</b></div>`).join("")}</div>
      <p class="osx-side-note">Computed from the snapshot and file_indexer.db · not a live mount</p>
    </div>`;
    return;
  }

  if (state.sidePanel === "source") {
    const local = state.sidePanelSide === "local";
    const facts = local
      ? [
          ["Source", "file_indexer.db"],
          ["Root", "/mnt/tank"],
          ["Index date", "26 Aug 2026"],
          ["Entries", "2,431,882"],
          ["Database size", "614 MB"],
        ]
      : [
          ["Provider", providerLabel()],
          ["Snapshot version", "2026-11-17"],
          ["Snapshot date", "17 Nov 2026"],
          ["Archive file", "archive.json"],
          ["Root", providerRoot()],
          ["Coverage", "87.7%"],
        ];
    body.innerHTML = `<div class="osx-detail-body">
      <div class="osx-detail-hero"><span class="osx-detail-icon">${local ? '<svg class="icon"><use href="#i-local"/></svg>' : '<svg class="icon"><use href="#i-cloud"/></svg>'}</span><div><h3>${local ? "Local index" : `${providerLabel()} snapshot`}</h3><p class="osx-detail-path">${local ? "file_indexer.db" : "archive.json"}</p></div></div>
      <div class="osx-detail-badges"><span class="osx-detail-type">${local ? "SQLite index" : "Remote listing"}</span><span class="osx-status-chip st-exact"><span class="dot"></span><span>Snapshot</span></span><span class="osx-status-chip st-unmatched"><span class="dot"></span><span>Read-only</span></span></div>
      <div class="osx-detail-facts">${facts.map(([label, value]) => `<div class="osx-detail-fact${label === "Source" || label === "Root" || label === "Archive file" ? " is-mono" : ""}"><span>${label}</span><b>${esc(value)}</b></div>`).join("")}</div>
      <div class="osx-source-compare">local index <b>(26 Aug 2026)</b> <i>⇄</i> ${providerLabel().toLowerCase()} snapshot <b>(17 Nov 2026)</b></div>
      <p class="osx-detail-note">${local ? "file_indexer.db snapshot · not a live mount" : "Snapshot · virtual read-only view"}</p>
    </div>`;
  }
}

export function clearPaneFilters(side) {
  state.search[side] = "";
  statusFilters(side).clear();
  const input = document.querySelector(`[data-search="${side}"]`);
  if (input) input.value = "";
}

export function toggleLegend() {
  const legend = document.querySelector("[data-legend]");
  const button = document.querySelector("[data-legend-toggle]");
  if (!legend) return;
  state.legendOpen = legend.hidden;
  legend.hidden = !state.legendOpen;
  button?.setAttribute("aria-expanded", String(state.legendOpen));
}
