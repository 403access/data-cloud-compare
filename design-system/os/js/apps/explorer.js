/* Aether OS — Explorer
   A single-pane file browser over the local fixture index. The compare app
   owns the two-pane view; this window is one plain explorer UI instance. */

import { DATA } from "../core/data.js";
import { toast } from "../core/toast.js";
import { date, esc } from "../core/utils.js";
import { selectEntry } from "../compare/view.js";
import { openWindow, windowById } from "../shell/windows.js";

const ROOT = "/mnt/tank";

const win = windowById("explorer");
const fileEl = win?.querySelector("[data-file-explorer]");
const rowsEl = win?.querySelector("[data-file-rows]");
const crumbsEl = win?.querySelector("[data-file-crumbs]");
const placesEl = win?.querySelector("[data-file-places]");
const headEl = win?.querySelector("[data-file-head]");
const summaryEl = win?.querySelector("[data-file-summary]");
const selectedEl = win?.querySelector("[data-file-selected]");
const statusEl = win?.querySelector("[data-file-status]");
const titleEl = win?.querySelector("[data-file-title]");
const searchEl = win?.querySelector("[data-file-search]");
const hiddenEl = win?.querySelector("[data-file-hidden]");
const compareEl = win?.querySelector("[data-file-compare]");
const sidebarToggleEl = win?.querySelector("[data-file-sidebar-toggle]");
const navButtons = win ? Array.from(win.querySelectorAll("[data-file-nav]")) : [];

const view = {
  path: ROOT,
  selected: null,
  hidden: false,
  query: "",
  sort: { id: "name", dir: "asc" },
  history: [ROOT],
  historyIndex: 0,
};

const byPath = new Map();

/* --------------------------------------------------------------- tree */

function makeDir(name, path) {
  return {
    name,
    path,
    isDir: true,
    children: new Map(),
    entry: null,
  };
}

function ensureDir(parent, name) {
  let node = parent.children.get(name);
  if (!node) {
    node = makeDir(name, `${parent.path}/${name}`);
    parent.children.set(name, node);
  }
  return node;
}

function buildTree() {
  const root = makeDir("tank", ROOT);
  for (const entry of DATA.local) {
    if (!entry.path || !entry.path.startsWith(`${ROOT}/`)) continue;
    const parts = entry.path.slice(ROOT.length + 1).split("/").filter(Boolean);
    if (!parts.length) continue;
    let parent = root;
    for (let index = 0; index < parts.length - 1; index += 1) {
      parent = ensureDir(parent, parts[index]);
    }
    const name = parts[parts.length - 1];
    const existing = parent.children.get(name);
    if (existing?.isDir && entry.isDir) {
      existing.entry = entry;
      continue;
    }
    parent.children.set(name, {
      name,
      path: entry.path,
      isDir: Boolean(entry.isDir),
      children: entry.isDir ? new Map() : null,
      entry,
    });
  }
  byPath.clear();
  const walk = (node) => {
    byPath.set(node.path, node);
    if (node.children) node.children.forEach(walk);
  };
  walk(root);
  return root;
}

const tree = buildTree();

function parentPath(path) {
  const cut = path.lastIndexOf("/");
  if (cut <= ROOT.lastIndexOf("/")) return ROOT;
  return path.slice(0, cut);
}

function childrenOf(node) {
  if (!node?.children) return [];
  return Array.from(node.children.values());
}

function matchesHidden(node) {
  return view.hidden || !node.name.startsWith(".");
}

function subtree(node, matches) {
  const found = [];
  const walk = (current) => {
    for (const child of childrenOf(current)) {
      if (!matchesHidden(child)) continue;
      if (matches(child)) found.push(child);
      if (child.children) walk(child);
    }
  };
  walk(node);
  return found;
}

/* -------------------------------------------------------------- meta */

function latestModified(node) {
  const values = [node.entry?.modified];
  if (node.children) {
    node.children.forEach((child) => values.push(latestModified(child)));
  }
  return values.filter(Boolean).sort().pop() || "";
}

function nodeMeta(node) {
  const entry = node.entry;
  if (node.isDir) {
    const count = node.children?.size || 0;
    return {
      type: "Folder",
      size: entry?.folderSize || `${count.toLocaleString()} item${count === 1 ? "" : "s"}`,
      sizeValue: entry?.sizeValue || 0,
      modified: latestModified(node),
    };
  }
  return {
    type: entry?.type || "File",
    size: entry?.size || "—",
    sizeValue: entry?.sizeValue || 0,
    modified: entry?.modified || "",
  };
}

function iconFor(node) {
  if (node.isDir) return { id: "i-folder", className: "is-folder os-file-folder" };
  const name = node.name.toLowerCase();
  if (name.endsWith(".md")) return { id: "i-file-text", className: "is-text" };
  if (name.endsWith(".json") || name.endsWith(".sh")) return { id: "i-code-file", className: "is-code" };
  if (name.startsWith(".")) return { id: "i-code-file", className: "is-env" };
  return { id: "i-file", className: "is-text" };
}

/* ------------------------------------------------------------- render */

function currentRows() {
  const node = byPath.get(view.path) || tree;
  const query = view.query.trim().toLowerCase();
  let rows = query
    ? subtree(node, (child) => child.name.toLowerCase().includes(query))
    : childrenOf(node).filter(matchesHidden);

  const factor = view.sort.dir === "desc" ? -1 : 1;
  rows = [...rows].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    const left = nodeMeta(a);
    const right = nodeMeta(b);
    let result = 0;
    if (view.sort.id === "size") result = left.sizeValue - right.sizeValue;
    else if (view.sort.id === "modified") result = left.modified.localeCompare(right.modified);
    else if (view.sort.id === "type") result = left.type.localeCompare(right.type);
    else result = a.name.localeCompare(b.name, undefined, { numeric: true });
    return result * factor || a.name.localeCompare(b.name);
  });
  return rows;
}

function rowHtml(node) {
  const meta = nodeMeta(node);
  const icon = iconFor(node);
  const selected = node.path === view.selected;
  return `<div class="os-file-row${selected ? " is-selected" : ""}" role="option" aria-selected="${selected}" data-file-entry="${esc(node.path)}" title="${esc(node.path)}">
    <div class="osx-cell osx-cell-name"><span class="osx-row-icon ${icon.className}"><svg class="icon"><use href="#${icon.id}"/></svg></span><span class="osx-name">${esc(node.name)}</span></div>
    <div class="osx-cell osx-cell-type">${esc(meta.type)}</div>
    <div class="osx-cell osx-cell-size">${esc(meta.size)}</div>
    <div class="osx-cell osx-cell-mod">${meta.modified ? esc(date(meta.modified)) : "—"}</div>
  </div>`;
}

function renderRows() {
  if (!rowsEl) return;
  const rows = currentRows();
  rowsEl.innerHTML = rows.length
    ? rows.map(rowHtml).join("")
    : `<div class="os-file-empty">${
        view.query.trim() ? `No items match “${esc(view.query.trim())}”.` : "This folder is empty."
      }</div>`;
}

function renderCrumbs() {
  if (!crumbsEl) return;
  const parts = view.path.slice(ROOT.length).split("/").filter(Boolean);
  const crumbs = [{ name: ROOT, path: ROOT }];
  let path = ROOT;
  for (const part of parts) {
    path = `${path}/${part}`;
    crumbs.push({ name: part, path });
  }
  crumbsEl.innerHTML = crumbs
    .map((crumb) => `<button type="button" data-file-crumb="${esc(crumb.path)}">${esc(crumb.name)}</button>`)
    .join("");
}

function renderPlaces() {
  if (!placesEl) return;
  const root = byPath.get(ROOT) || tree;
  placesEl.innerHTML = childrenOf(root)
    .filter((node) => node.isDir && node.path !== `${ROOT}/Projects` && matchesHidden(node))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map(
      (node) => `<button class="os-side-item${node.path === view.path ? " is-active" : ""}" type="button" data-file-place="${esc(node.path)}"><svg class="icon"><use href="#i-folder"/></svg><span>${esc(node.name)}</span></button>`,
    )
    .join("");

  win?.querySelectorAll("[data-file-place]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filePlace === view.path);
  });
}

function renderHead() {
  if (!headEl) return;
  headEl.querySelectorAll("[data-file-sort]").forEach((button) => {
    button.classList.toggle("is-sorted", button.dataset.fileSort === view.sort.id);
    button.classList.toggle("is-desc", button.dataset.fileSort === view.sort.id && view.sort.dir === "desc");
  });
}

function renderSummary() {
  if (!summaryEl) return;
  const node = byPath.get(view.path) || tree;
  const rows = currentRows();
  const dirs = rows.filter((row) => row.isDir).length;
  const files = rows.length - dirs;
  if (view.query.trim()) {
    summaryEl.textContent = `${rows.length} match${rows.length === 1 ? "" : "es"} for “${view.query.trim()}”`;
  } else {
    summaryEl.textContent = `${rows.length} item${rows.length === 1 ? "" : "s"} · ${dirs} folder${dirs === 1 ? "" : "s"} · ${files} file${files === 1 ? "" : "s"}`;
  }
  if (titleEl) titleEl.textContent = node.path;
  if (selectedEl) {
    const selected = view.selected ? byPath.get(view.selected) : null;
    selectedEl.textContent = selected ? selected.name : "";
  }
}

function renderStatus() {
  if (!statusEl) return;
  const node = view.selected ? byPath.get(view.selected) : null;
  if (!node) {
    statusEl.innerHTML = '<span class="muted">Select an item to see details.</span>';
    if (compareEl) compareEl.disabled = true;
    if (selectedEl) selectedEl.textContent = "";
    return;
  }
  const meta = nodeMeta(node);
  const item = node.isDir
    ? `Folder · ${meta.size}`
    : `File · ${meta.size}`;
  statusEl.innerHTML = `<span class="osx-sel-name" title="${esc(node.path)}">${esc(node.name)}</span>
    <span class="osx-sel-meta">${esc(item)}${meta.modified ? ` · ${esc(date(meta.modified))}` : ""}</span>`;
  if (compareEl) compareEl.disabled = false;
  if (selectedEl) selectedEl.textContent = node.path;
}

function renderAll() {
  renderCrumbs();
  renderPlaces();
  renderHead();
  renderRows();
  renderSummary();
  renderStatus();
  renderNavButtons();
}

function renderNavButtons() {
  navButtons.forEach((button) => {
    if (button.dataset.fileNav === "back") button.disabled = view.historyIndex <= 0;
    else if (button.dataset.fileNav === "forward") button.disabled = view.historyIndex >= view.history.length - 1;
    else button.disabled = view.path === ROOT;
  });
}

/* --------------------------------------------------------- navigation */

function navigate(path, { push = true } = {}) {
  const node = byPath.get(path);
  if (!node?.isDir) return;
  if (push) {
    view.history = view.history.slice(0, view.historyIndex + 1);
    view.history.push(path);
    view.historyIndex = view.history.length - 1;
  }
  view.path = path;
  view.selected = null;
  view.query = "";
  if (searchEl) searchEl.value = "";
  renderAll();
}

function select(path) {
  const node = byPath.get(path);
  if (!node) return;
  view.selected = path;
  rowsEl?.querySelectorAll(".os-file-row").forEach((row) => {
    const active = row.dataset.fileEntry === path;
    row.classList.toggle("is-selected", active);
    row.setAttribute("aria-selected", String(active));
  });
  renderSummary();
  renderStatus();
}

function openNode(node) {
  if (!node) return;
  if (node.isDir) {
    navigate(node.path);
    return;
  }
  toast(`Read-only file · ${node.name}`);
}

function openCompare() {
  const node = view.selected ? byPath.get(view.selected) : null;
  openWindow("compare");
  if (!node?.entry) {
    toast("Only indexed files have a comparison", "warn");
    return;
  }
  selectEntry("local", node.entry.name, { scroll: true });
  toast(`Data Cloud Compare · ${node.name}`);
}

/* ------------------------------------------------------------- events */

function bindEvents() {
  rowsEl?.addEventListener("click", (event) => {
    const row = event.target.closest(".os-file-row");
    if (row) select(row.dataset.fileEntry);
  });

  rowsEl?.addEventListener("dblclick", (event) => {
    const row = event.target.closest(".os-file-row");
    if (!row) return;
    select(row.dataset.fileEntry);
    openNode(byPath.get(row.dataset.fileEntry));
  });

  rowsEl?.addEventListener("keydown", (event) => {
    const rows = Array.from(rowsEl.querySelectorAll(".os-file-row"));
    if (!rows.length) return;
    const index = rows.findIndex((row) => row.classList.contains("is-selected"));
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = rows[Math.min(rows.length - 1, index < 0 ? 0 : index + 1)];
      select(next.dataset.fileEntry);
      next.scrollIntoView({ block: "nearest" });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = rows[Math.max(0, index < 0 ? 0 : index - 1)];
      select(next.dataset.fileEntry);
      next.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Home") {
      event.preventDefault();
      select(rows[0].dataset.fileEntry);
    } else if (event.key === "End") {
      event.preventDefault();
      select(rows[rows.length - 1].dataset.fileEntry);
    } else if (event.key === "Enter") {
      event.preventDefault();
      openNode(view.selected ? byPath.get(view.selected) : null);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      navigate(parentPath(view.path));
    }
  });

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.fileNav;
      if (action === "back" && view.historyIndex > 0) {
        view.historyIndex -= 1;
        navigate(view.history[view.historyIndex], { push: false });
      } else if (action === "forward" && view.historyIndex < view.history.length - 1) {
        view.historyIndex += 1;
        navigate(view.history[view.historyIndex], { push: false });
      } else if (action === "up") {
        navigate(parentPath(view.path));
      }
    });
  });

  crumbsEl?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-file-crumb]");
    if (button) navigate(button.dataset.fileCrumb);
  });

  placesEl?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-file-place]");
    if (button) navigate(button.dataset.filePlace);
  });

  win?.querySelectorAll("[data-file-place]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.filePlace));
  });

  headEl?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-file-sort]");
    if (!button) return;
    const id = button.dataset.fileSort;
    if (view.sort.id === id) view.sort.dir = view.sort.dir === "asc" ? "desc" : "asc";
    else {
      view.sort.id = id;
      view.sort.dir = "asc";
    }
    renderHead();
    renderRows();
    renderSummary();
  });

  searchEl?.addEventListener("input", () => {
    view.query = searchEl.value;
    renderRows();
    renderSummary();
  });

  hiddenEl?.addEventListener("change", () => {
    view.hidden = hiddenEl.checked;
    renderAll();
  });

  compareEl?.addEventListener("click", openCompare);

  sidebarToggleEl?.addEventListener("click", () => {
    const collapsed = Boolean(fileEl?.classList.toggle("is-sidebar-collapsed"));
    const label = collapsed ? "Show sidebar" : "Hide sidebar";
    sidebarToggleEl.setAttribute("aria-pressed", String(!collapsed));
    sidebarToggleEl.setAttribute("aria-label", label);
    sidebarToggleEl.title = label;
  });

  win?.addEventListener("pointerdown", () => {
    renderNavButtons();
  });
}

export function openExplorer(path = ROOT) {
  openWindow("explorer");
  if (path !== view.path && byPath.has(path)) navigate(path);
}

if (win) {
  bindEvents();
  renderAll();
}