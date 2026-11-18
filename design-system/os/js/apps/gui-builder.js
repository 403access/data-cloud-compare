/* Aether OS — App Studio
   A GUI builder seeded with one project per desktop app (the builder itself is
   deliberately absent). Projects are editable, new apps can be created, and
   every component can bind to the live system-variable catalog. */

import { readJSON, writeJSON } from "../core/state.js";
import { esc } from "../core/utils.js";
import { toast } from "../core/toast.js";
import { openWindow, windowById } from "../shell/windows.js";
import { systemVariables } from "./builder-variables.js";
import {
  BUILTIN_PROJECTS, COMPONENT_PALETTE, NODE_DEFAULTS, PROJECT_ACCENTS, PROJECT_ICONS,
} from "./builder-projects.js";

/* ------------------------------------------------------------- constants */

const STORAGE_KEY = "explorer-os-builder-v1";
const STORAGE_VERSION = 1;
const HISTORY_LIMIT = 40;

const NODE_LABELS = {
  appbar: "App bar",
  panel: "Panel",
  list: "List",
  text: "Text",
  button: "Button",
  toggle: "Switch",
  field: "Search field",
  tabs: "Tabs",
  meter: "Meter",
  chart: "Chart",
  gauge: "Gauge",
  art: "Artwork",
  grid: "Month grid",
  details: "Details",
  console: "Console",
  icon: "Icon tile",
  divider: "Divider",
};

const TONES = [
  ["accent", "Current"],
  ["green", "Mint"],
  ["blue", "Sky"],
  ["amber", "Amber"],
  ["red", "Coral"],
  ["violet", "Violet"],
  ["pink", "Pink"],
  ["gray", "Harbour"],
  ["neutral", "Neutral"],
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value * 10) / 10;
const copy = (value) => JSON.parse(JSON.stringify(value));

const iconLabel = (id) =>
  String(id).replace(/^i-/, "").replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

/* ---------------------------------------------------------------- refs */

const win = windowById("builder");
const rootEl = win?.querySelector("[data-builder]");
const projectHost = win?.querySelector("[data-builder-projects]");
const projectSearch = win?.querySelector("[data-project-search]");
const canvas = win?.querySelector("[data-builder-canvas]");
const frame = win?.querySelector("[data-builder-frame]");
const paletteHost = win?.querySelector("[data-builder-palette]");
const inspectorHost = win?.querySelector("[data-builder-inspector]");
const variableHost = win?.querySelector("[data-builder-variable-list]");
const variableSearch = win?.querySelector("[data-variable-search]");
const variableHint = win?.querySelector("[data-variable-hint]");
const inspectPanel = win?.querySelector("[data-builder-inspect]");
const varsPanel = win?.querySelector("[data-builder-vars]");
const newForm = win?.querySelector("[data-builder-newform]");
const previewButton = win?.querySelector("[data-builder-preview]");
const resetButton = win?.querySelector("[data-builder-reset]");
const undoButton = win?.querySelector("[data-builder-undo]");
const redoButton = win?.querySelector("[data-builder-redo]");

/* --------------------------------------------------------------- state */

let projects = [];
let activeId = null;
let selectedId = null;
let activePanel = "variables";
let preview = false;
let projectQuery = "";
let variableQuery = "";
let variables = [];
let variableMap = new Map();
let undoStack = [];
let redoStack = [];
let saveTimer = 0;
let resetTimer = 0;
let resetArmed = false;
let lastSaved = null;
let initialized = false;

/* ------------------------------------------------------------- storage */

function uniqueNodeId(prefix = "node") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function uniqueProjectId(name) {
  const base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";
  let id = `project-${base}`;
  let suffix = 2;
  while (projects.some((project) => project.id === id)) id = `project-${base}-${suffix++}`;
  return id;
}

function normalizeNode(raw, index) {
  const type = raw?.type || "panel";
  const base = NODE_DEFAULTS[type] || NODE_DEFAULTS.panel;
  const merged = { tone: "accent", variant: "body", ...copy(base), ...copy(raw || {}) };
  merged.id = String(merged.id || uniqueNodeId(`n${index + 1}`));
  merged.type = type;
  merged.label = merged.label == null ? base.label || "" : String(merged.label);
  merged.x = clamp(Number(merged.x) || 0, 0, 99);
  merged.y = clamp(Number(merged.y) || 0, 0, 99);
  merged.w = clamp(Number(merged.w) || base.w || 24, 3, 100 - merged.x);
  merged.h = clamp(Number(merged.h) || base.h || 5, 2, 100 - merged.y);
  merged.variant = ["title", "body", "caption"].includes(merged.variant) ? merged.variant : "body";
  merged.tone = TONES.some(([id]) => id === merged.tone) ? merged.tone : "accent";
  merged.bind = typeof merged.bind === "string" ? merged.bind : "";
  merged.icon = PROJECT_ICONS.includes(merged.icon) ? merged.icon : base.icon || "i-grid";
  if (["list", "tabs"].includes(type)) {
    merged.items = Array.isArray(merged.items) && merged.items.length
      ? merged.items.map(String)
      : copy(base.items || ["Item"]);
  }
  if (type === "console") {
    merged.lines = Array.isArray(merged.lines) && merged.lines.length
      ? merged.lines.map(String)
      : copy(base.lines || ["Line"]);
  }
  if (type === "details") {
    merged.pairs = Array.isArray(merged.pairs) && merged.pairs.length
      ? merged.pairs.map((pair) => [String(pair?.[0] ?? "Label"), String(pair?.[1] ?? "Value")])
      : copy(base.pairs || [["Label", "Value"]]);
  }
  if (type === "tabs") merged.active = clamp(Number(merged.active) || 0, 0, merged.items.length - 1);
  if (["meter", "gauge"].includes(type)) merged.value = clamp(Number(merged.value) || base.value || 50, 0, 100);
  if (type === "toggle") merged.on = merged.on !== false;
  return merged;
}

function normalizeProject(raw, seed = null) {
  const source = seed ? { ...copy(seed), ...copy(raw || {}), builtin: true } : copy(raw || {});
  const seen = new Set();
  const nodes = (Array.isArray(source.nodes) ? source.nodes : []).map((node, index) => {
    const normalized = normalizeNode(node, index);
    while (seen.has(normalized.id)) normalized.id = uniqueNodeId("node");
    seen.add(normalized.id);
    return normalized;
  });
  return {
    id: String(source.id || uniqueProjectId(source.name || "app")),
    name: String(source.name || "Untitled App"),
    app: String(source.app || source.name || "App"),
    description: String(source.description || "A custom app project."),
    icon: PROJECT_ICONS.includes(source.icon) ? source.icon : "i-grid",
    accent: PROJECT_ACCENTS.some((entry) => entry.value === source.accent) ? source.accent : "#38d6ff",
    builtin: Boolean(seed),
    nodes,
  };
}

function loadProjects() {
  const saved = readJSON(STORAGE_KEY);
  const savedProjects = Array.isArray(saved?.projects) ? saved.projects : [];
  const savedById = new Map(savedProjects.map((project) => [project.id, project]));
  const list = BUILTIN_PROJECTS.map((seed) => normalizeProject(savedById.get(seed.id) || seed, seed));
  const builtinIds = new Set(BUILTIN_PROJECTS.map((project) => project.id));
  savedProjects.forEach((project) => {
    if (builtinIds.has(project.id)) return;
    list.push(normalizeProject(project));
  });
  activeId =
    saved?.activeId && list.some((project) => project.id === saved.activeId)
      ? saved.activeId
      : list[0]?.id || null;
  return list;
}

function persist() {
  writeJSON(STORAGE_KEY, {
    version: STORAGE_VERSION,
    projects,
    activeId,
  });
  lastSaved = new Date();
  updateSaveLabel();
  updateStatus();
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(persist, 260);
}

/* ------------------------------------------------------------- selectors */

function activeProject() {
  return projects.find((project) => project.id === activeId) || null;
}

function selectedNode() {
  const project = activeProject();
  if (!project || !selectedId) return null;
  return project.nodes.find((node) => node.id === selectedId) || null;
}

function groupedVariables(list = variables) {
  const groups = new Map();
  list.forEach((variable) => {
    if (!groups.has(variable.group)) groups.set(variable.group, []);
    groups.get(variable.group).push(variable);
  });
  return groups;
}

function refreshVariables() {
  const project = activeProject();
  variables = systemVariables({
    projects: projects.length,
    custom: projects.filter((entry) => !entry.builtin).length,
    selected: project?.name || "",
    nodes: project?.nodes.length || 0,
  });
  variableMap = new Map(variables.map((variable) => [variable.id, variable]));
}

/* --------------------------------------------------------------- render */

function displayFor(node) {
  const variable = node.bind ? variableMap.get(node.bind) : null;
  return variable ? variable.display : node.label;
}

function iconSvg(id) {
  return `<svg class="icon" aria-hidden="true"><use href="#${esc(id || "i-grid")}"/></svg>`;
}

function liveSpan(node, text, className = "") {
  return `<span class="${className} osb-live" data-node-live="${esc(node.id)}">${esc(text)}</span>`;
}

function nodeInner(node) {
  const variable = node.bind ? variableMap.get(node.bind) : null;
  const items = Array.isArray(node.items) ? node.items : [];
  const lines = Array.isArray(node.lines) ? node.lines : [];
  const pairs = Array.isArray(node.pairs) ? node.pairs : [];

  switch (node.type) {
    case "appbar":
      return `<span class="osb-appbar__icon">${iconSvg(node.icon)}</span><b class="osb-appbar__title">${liveSpan(node, displayFor(node))}</b><span class="osb-appbar__chip">${node.bind ? "Variable" : "App"}</span>`;
    case "panel":
      return `<span class="osb-panel__label">${esc(node.label)}</span><span class="osb-panel__ghost" aria-hidden="true"></span>`;
    case "list":
      return `<span class="osb-list__head"><span>${esc(node.label)}</span>${node.bind ? `<b>${liveSpan(node, variable?.display || "—")}</b>` : `<span>${items.length}</span>`}</span>
        <span class="osb-list__rows">${items.slice(0, 5).map((item) => `<span class="osb-list__row"><i></i><span>${esc(item)}</span></span>`).join("")}</span>`;
    case "text":
      return `<span class="osb-text osb-text--${esc(node.variant)}">${liveSpan(node, displayFor(node))}</span>`;
    case "button":
      return `<span class="osb-button">${liveSpan(node, displayFor(node))}</span>`;
    case "toggle": {
      const on = variable?.kind === "boolean" ? Boolean(variable.value) : node.on !== false;
      return `<span class="osb-toggle__label">${esc(node.label)}</span><span class="osb-toggle__state" data-node-live="${esc(node.id)}">${esc(on ? "On" : "Off")}</span><span class="osb-toggle__track${on ? " is-on" : ""}" data-node-toggle="${esc(node.id)}" aria-hidden="true"><i></i></span>`;
    }
    case "field":
      return `<span class="osb-field__icon">${iconSvg("i-search")}</span><span class="osb-field__text">${esc(node.label)}</span>`;
    case "tabs": {
      const active = clamp(Number(node.active) || 0, 0, Math.max(0, items.length - 1));
      return `<span class="osb-tabs__row">${items.map((item, index) => `<span class="osb-tabs__item${index === active ? " is-active" : ""}">${esc(item)}</span>`).join("")}</span>`;
    }
    case "meter": {
      const value = clamp(Number(variable?.value ?? node.value ?? 50) || 0, 0, 100);
      return `<span class="osb-meter__head"><span>${esc(node.label)}</span><b>${liveSpan(node, variable?.display || `${Math.round(value)}%`)}</b></span><span class="osb-meter__track"><i data-node-meter="${esc(node.id)}" style="width:${value}%"></i></span>`;
    }
    case "chart": {
      const line = "M0 30 L10 24 L20 27 L30 19 L40 22 L50 15 L60 18 L70 12 L80 16 L90 8 L100 11 L110 6 L120 9";
      const area = `${line} L120 40 L0 40 Z`;
      return `<span class="osb-chart__head"><span>${esc(node.label)}</span><b>${liveSpan(node, variable?.display || "Live")}</b></span>
        <svg class="osb-chart__graph" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">
          <g class="osb-chart__grid"><line x1="0" y1="10" x2="120" y2="10"></line><line x1="0" y1="20" x2="120" y2="20"></line><line x1="0" y1="30" x2="120" y2="30"></line></g>
          <path class="osb-chart__area" d="${area}"></path>
          <path class="osb-chart__line" d="${line}"></path>
        </svg>`;
    }
    case "gauge": {
      const value = clamp(Number(variable?.value ?? node.value ?? 50) || 0, 0, 100);
      return `<span class="osb-gauge__ring" data-node-meter="${esc(node.id)}" style="--value:${value}%"><span class="osb-gauge__inner"><b>${liveSpan(node, variable?.display || `${Math.round(value)}%`)}</b><small>${esc(node.label)}</small></span></span>`;
    }
    case "art":
      return `<span class="osb-art__orb"></span><span class="osb-art__ring"></span><span class="osb-art__ring osb-art__ring--2"></span>`;
    case "grid": {
      const cells = Array.from({ length: 35 }, (_, index) => {
        const classes = ["osb-grid__cell"];
        if (index === 16) classes.push("is-today");
        if ([3, 9, 18, 24, 30].includes(index)) classes.push("has-event");
        return `<i class="${classes.join(" ")}"></i>`;
      }).join("");
      return `<span class="osb-grid__head"><span>${esc(node.label)}</span>${node.bind ? `<b>${liveSpan(node, variable?.display || "—")}</b>` : ""}</span><span class="osb-grid__cells">${cells}</span>`;
    }
    case "details":
      return `<span class="osb-details__head"><span>${esc(node.label)}</span>${node.bind ? `<b>${liveSpan(node, variable?.display || "—")}</b>` : ""}</span>
        <span class="osb-details__rows">${pairs.slice(0, 4).map(([key, value]) => `<span class="osb-details__row"><span>${esc(key)}</span><b>${esc(value)}</b></span>`).join("")}</span>`;
    case "console":
      return `<span class="osb-console__lines">${lines.map((line, index) => `<span class="osb-console__line${index === 0 ? " is-prompt" : ""}">${esc(line)}</span>`).join("")}</span><span class="osb-console__cursor" aria-hidden="true">▌</span>`;
    case "icon":
      return `<span class="osb-icon__tile">${iconSvg(node.icon)}</span>${node.label ? `<span class="osb-icon__label">${esc(node.label)}</span>` : ""}`;
    case "divider":
      return `<span class="osb-divider__line"></span>`;
    default:
      return `<span class="osb-text osb-text--body">${esc(node.label)}</span>`;
  }
}

function renderNode(node) {
  const selected = !preview && node.id === selectedId;
  const bound = Boolean(node.bind);
  return `<div class="osb-node osb-node--${esc(node.type)} osb-tone--${esc(node.tone)}${selected ? " is-selected" : ""}${bound ? " is-bound" : ""}" data-node-id="${esc(node.id)}" style="--x:${node.x};--y:${node.y};--w:${node.w};--h:${node.h}" role="group" aria-label="${esc(NODE_LABELS[node.type] || node.type)} ${esc(node.label)}">
    ${nodeInner(node)}
    ${bound ? `<span class="osb-bind-dot" title="Bound to ${esc(node.bind)}"></span>` : ""}
    <span class="osb-handle" data-builder-resize aria-hidden="true"></span>
  </div>`;
}

function renderCanvas() {
  if (!canvas) return;
  const project = activeProject();
  if (project) {
    if (selectedId && !project.nodes.some((node) => node.id === selectedId)) selectedId = null;
    frame?.style.setProperty("--project-accent", project.accent);
    canvas.innerHTML = project.nodes.length
      ? project.nodes.map(renderNode).join("")
      : `<div class="osb-empty"><b>Blank canvas</b><span>Add a component from the palette, or choose a variable to bind.</span></div>`;
  } else {
    canvas.innerHTML = `<div class="osb-empty"><b>No project</b><span>Create an app to start building.</span></div>`;
  }
  rootEl?.classList.toggle("is-preview", preview);
  const title = win?.querySelector("[data-builder-title]");
  const subtitle = win?.querySelector("[data-builder-subtitle]");
  if (title) title.textContent = project?.name || "App Studio";
  if (subtitle) {
    const bound = project ? project.nodes.filter((node) => node.bind).length : 0;
    subtitle.textContent = project
      ? `${project.app} · ${project.nodes.length} component${project.nodes.length === 1 ? "" : "s"} · ${bound} bound to variables`
      : "Select or create a project.";
  }
  refreshCanvasLive();
}

function projectRow(project) {
  const active = project.id === activeId;
  return `<button class="osb-project${active ? " is-active" : ""}" type="button" data-project-id="${esc(project.id)}" aria-pressed="${active}">
    <span class="osb-project__tile" style="--tile:${esc(project.accent)}">${iconSvg(project.icon)}</span>
    <span class="osb-project__text"><b>${esc(project.name)}</b><small>${project.builtin ? esc(project.app) : "Custom app"} · ${project.nodes.length} component${project.nodes.length === 1 ? "" : "s"}</small></span>
    ${active ? '<span class="osb-project__live" aria-hidden="true"></span>' : ""}
  </button>`;
}

function renderProjects() {
  if (!projectHost) return;
  const query = projectQuery.trim().toLowerCase();
  const matches = (project) =>
    !query ||
    `${project.name} ${project.app} ${project.description}`.toLowerCase().includes(query);
  const builtins = projects.filter((project) => project.builtin && matches(project));
  const customs = projects.filter((project) => !project.builtin && matches(project));
  const section = (title, list) =>
    list.length
      ? `<div class="osb-projects__section"><span>${esc(title)}</span><b>${list.length}</b></div>${list.map(projectRow).join("")}`
      : "";
  const empty = !builtins.length && !customs.length
    ? `<p class="osb-projects__empty">No projects match “${esc(projectQuery)}”.</p>`
    : "";
  projectHost.innerHTML = `${section("System apps", builtins)}${section("Your apps", customs)}${empty}${
    customs.length ? "" : '<p class="osb-projects__empty">Custom apps you create appear here.</p>'
  }`;
}

function renderPalette() {
  if (!paletteHost) return;
  const groups = new Map();
  COMPONENT_PALETTE.forEach((part) => {
    if (!groups.has(part.group)) groups.set(part.group, []);
    groups.get(part.group).push(part);
  });
  paletteHost.innerHTML = `<span class="osb-palette__title">Components</span><div class="osb-palette__groups">${[...groups]
    .map(
      ([group, parts]) => `<div class="osb-palette__group"><span>${esc(group)}</span><div class="osb-palette__items">${parts
        .map(
          (part) => `<button class="osb-part" type="button" data-add-type="${esc(part.type)}" data-add-variant="${esc(part.variant || "")}" title="Add ${esc(part.label)}">${iconSvg(part.icon)}<span>${esc(part.label)}</span></button>`,
        )
        .join("")}</div></div>`,
    )
    .join("")}</div>`;
}

function iconOptions(selected) {
  return PROJECT_ICONS.map(
    (id) => `<option value="${esc(id)}"${id === selected ? " selected" : ""}>${esc(iconLabel(id))}</option>`,
  ).join("");
}

function accentOptions(selected) {
  return PROJECT_ACCENTS.map(
    (entry) => `<option value="${esc(entry.value)}"${entry.value === selected ? " selected" : ""}>${esc(entry.label)}</option>`,
  ).join("");
}

function toneOptions(selected) {
  return TONES.map(
    ([id, label]) => `<option value="${esc(id)}"${id === selected ? " selected" : ""}>${esc(label)}</option>`,
  ).join("");
}

function variantOptions(selected) {
  return ["title", "body", "caption"]
    .map((id) => `<option value="${id}"${id === selected ? " selected" : ""}>${id[0].toUpperCase()}${id.slice(1)}</option>`)
    .join("");
}

function bindOptions(selected) {
  let html = `<option value="">Not bound</option>`;
  groupedVariables().forEach((list, group) => {
    html += `<optgroup label="${esc(group)}">${list
      .map(
        (variable) =>
          `<option value="${esc(variable.id)}"${variable.id === selected ? " selected" : ""}>${esc(variable.label)} · ${esc(variable.id)}</option>`,
      )
      .join("")}</optgroup>`;
  });
  if (selected && !variableMap.has(selected)) {
    html += `<option value="${esc(selected)}" selected>Missing · ${esc(selected)}</option>`;
  }
  return html;
}

function renderInspector() {
  if (!inspectorHost) return;
  const project = activeProject();
  if (!project) {
    inspectorHost.innerHTML = `<p class="osb-empty-note">No project selected.</p>`;
    return;
  }
  const node = selectedNode();
  if (!node) {
    const bound = project.nodes.filter((entry) => entry.bind).length;
    inspectorHost.innerHTML = `<div class="osb-inspector">
      <header class="osb-inspect__head">
        <div><span>Project</span><b>${esc(project.name)}</b><small>${project.builtin ? "Built-in app project" : "Custom app project"}</small></div>
        <span class="osb-inspect__badge">${project.builtin ? "System" : "Custom"}</span>
      </header>
      <label class="osb-field"><span>App name</span><input data-project-field="name" value="${esc(project.name)}"></label>
      <label class="osb-field"><span>Description</span><textarea rows="3" data-project-field="description">${esc(project.description)}</textarea></label>
      <div class="osb-grid2">
        <label class="osb-field"><span>Icon</span><select data-project-field="icon">${iconOptions(project.icon)}</select></label>
        <label class="osb-field"><span>Accent</span><select data-project-field="accent">${accentOptions(project.accent)}</select></label>
      </div>
      <div class="osb-inspect__stats">
        <span><b>${project.nodes.length}</b> components</span>
        <span><b>${bound}</b> bound</span>
        <span><b>${new Set(project.nodes.map((entry) => entry.type)).size}</b> types</span>
      </div>
      <div class="osb-inspect__actions">
        <button class="osb-action" type="button" data-project-duplicate>Duplicate project</button>
        ${project.builtin ? "" : '<button class="osb-action is-danger" type="button" data-project-delete>Delete app</button>'}
      </div>
      <p class="osb-hint">Select a component on the canvas to edit it. Choose a variable in the Variables tab to bind it to the selected component.</p>
    </div>`;
    return;
  }

  const variable = node.bind ? variableMap.get(node.bind) : null;
  const arrayField =
    ["list", "tabs"].includes(node.type)
      ? `<label class="osb-field"><span>Items <small>one per line</small></span><textarea rows="4" data-node-items="items">${esc((node.items || []).join("\n"))}</textarea></label>`
      : node.type === "console"
        ? `<label class="osb-field"><span>Lines <small>one per line</small></span><textarea rows="4" data-node-lines="lines">${esc((node.lines || []).join("\n"))}</textarea></label>`
        : node.type === "details"
          ? `<label class="osb-field"><span>Rows <small>label | value</small></span><textarea rows="4" data-node-pairs="pairs">${esc((node.pairs || []).map(([key, value]) => `${key} | ${value}`).join("\n"))}</textarea></label>`
          : "";

  inspectorHost.innerHTML = `<div class="osb-inspector">
    <header class="osb-inspect__head">
      <div><span>Component</span><b>${esc(NODE_LABELS[node.type] || node.type)}</b><small>${esc(node.id)}</small></div>
      <span class="osb-inspect__badge">${esc(node.type)}</span>
    </header>
    <label class="osb-field"><span>Label</span><input data-node-field="label" value="${esc(node.label)}"></label>
    <label class="osb-field"><span>Bind to system variable</span><select data-node-field="bind">${bindOptions(node.bind)}</select></label>
    ${
      node.bind
        ? `<p class="osb-bind-live"><span>Live value</span><b data-bind-live>${esc(variable?.display || "—")}</b><code>{{${esc(node.bind)}}}</code></p>`
        : '<p class="osb-hint">A bound component follows the system while the builder is open.</p>'
    }
    <div class="osb-grid4">
      <label class="osb-field"><span>X</span><input type="number" step="0.5" data-node-field="x" value="${node.x}"></label>
      <label class="osb-field"><span>Y</span><input type="number" step="0.5" data-node-field="y" value="${node.y}"></label>
      <label class="osb-field"><span>W</span><input type="number" step="0.5" min="3" data-node-field="w" value="${node.w}"></label>
      <label class="osb-field"><span>H</span><input type="number" step="0.5" min="2" data-node-field="h" value="${node.h}"></label>
    </div>
    <div class="osb-grid2">
      <label class="osb-field"><span>Tone</span><select data-node-field="tone">${toneOptions(node.tone)}</select></label>
      ${
        node.type === "text"
          ? `<label class="osb-field"><span>Style</span><select data-node-field="variant">${variantOptions(node.variant)}</select></label>`
          : node.type === "appbar" || node.type === "icon"
            ? `<label class="osb-field"><span>Icon</span><select data-node-field="icon">${iconOptions(node.icon)}</select></label>`
            : ["meter", "gauge"].includes(node.type) && !node.bind
              ? `<label class="osb-field"><span>Value</span><input type="number" min="0" max="100" data-node-field="value" value="${node.value}"></label>`
              : `<label class="osb-field"><span>Position</span><input value="${node.x}%, ${node.y}%" readonly></label>`
      }
    </div>
    ${arrayField}
    <div class="osb-inspect__actions">
      <button class="osb-action" type="button" data-node-duplicate>Duplicate</button>
      <button class="osb-action is-danger" type="button" data-node-delete>Delete component</button>
    </div>
  </div>`;
}

function renderVariableChrome() {
  document.querySelectorAll("[data-builder-variable-count]").forEach((node) => {
    node.textContent = String(variables.length);
  });
  if (variableHint) {
    const node = selectedNode();
    variableHint.textContent = node
      ? `Selected: ${NODE_LABELS[node.type] || node.type} · ${node.label || "Untitled"}. Choose a variable to bind it.`
      : "Select a component to bind a variable. With nothing selected, choosing a variable copies its template.";
  }
  syncVariableSelection();
}

function renderVariableList() {
  if (!variableHost) return;
  const query = variableQuery.trim().toLowerCase();
  const filtered = variables.filter((variable) =>
    !query ||
    `${variable.group} ${variable.label} ${variable.id} ${variable.display}`.toLowerCase().includes(query),
  );
  if (!filtered.length) {
    variableHost.innerHTML = `<p class="osb-vars__empty">No variables match “${esc(variableQuery)}”.</p>`;
    return;
  }
  const groups = groupedVariables(filtered);
  variableHost.innerHTML = [...groups]
    .map(
      ([group, list]) => `<section class="osb-var-group"><header><span>${esc(group)}</span><b>${list.length}</b></header>${list
        .map((variable) => {
          const swatch = variable.swatch
            ? `<i class="osb-var__swatch" data-var-swatch="${esc(variable.id)}" style="background:${esc(variable.value)}"></i>`
            : "";
          return `<button class="osb-var" type="button" data-bind-variable="${esc(variable.id)}" title="Bind ${esc(variable.id)} to the selected component">
            <span class="osb-var__main"><b>${esc(variable.label)}</b><code>${esc(variable.id)}</code></span>
            <span class="osb-var__value${variable.kind === "boolean" ? (variable.value ? " is-on" : " is-off") : ""}">${swatch}<b data-var-value="${esc(variable.id)}">${esc(variable.display)}</b></span>
          </button>`;
        })
        .join("")}</section>`,
    )
    .join("");
  syncVariableSelection();
}

function syncVariableSelection() {
  if (!variableHost) return;
  const node = selectedNode();
  variableHost.querySelectorAll("[data-bind-variable]").forEach((row) => {
    row.classList.toggle("is-bound", Boolean(node?.bind) && row.dataset.bindVariable === node.bind);
  });
}

function refreshCanvasLive() {
  const project = activeProject();
  if (!project || !canvas) return;
  project.nodes.forEach((node) => {
    if (!node.bind) return;
    const element = canvas.querySelector(`[data-node-id="${CSS.escape(node.id)}"]`);
    if (element) refreshNodeValues(node, element);
  });
  const node = selectedNode();
  const live = inspectorHost?.querySelector("[data-bind-live]");
  if (node?.bind && live) live.textContent = variableMap.get(node.bind)?.display || "—";
}

function refreshNodeValues(node, element) {
  const variable = node.bind ? variableMap.get(node.bind) : null;
  const display = variable ? variable.display : "—";
  element.querySelectorAll("[data-node-live]").forEach((nodeEl) => {
    nodeEl.textContent = display;
  });
  const meter = element.querySelector("[data-node-meter]");
  if (meter) {
    const value = clamp(Number(variable?.value ?? node.value ?? 50) || 0, 0, 100);
    if (node.type === "gauge") meter.style.setProperty("--value", `${value}%`);
    else meter.style.width = `${value}%`;
  }
  const toggle = element.querySelector("[data-node-toggle]");
  if (toggle) {
    const on = variable?.kind === "boolean" ? Boolean(variable.value) : node.on !== false;
    toggle.classList.toggle("is-on", on);
    toggle.setAttribute("aria-pressed", String(on));
  }
}

function updateVariableRows() {
  if (!variableHost) return;
  variableHost.querySelectorAll("[data-var-value]").forEach((node) => {
    const variable = variableMap.get(node.dataset.varValue);
    if (!variable) return;
    node.textContent = variable.display;
    const valueWrap = node.parentElement;
    valueWrap?.classList.toggle("is-on", variable.kind === "boolean" && Boolean(variable.value));
    valueWrap?.classList.toggle("is-off", variable.kind === "boolean" && !variable.value);
  });
  variableHost.querySelectorAll("[data-var-swatch]").forEach((node) => {
    const variable = variableMap.get(node.dataset.varSwatch);
    if (variable) node.style.background = variable.value;
  });
}

function updateCounts() {
  document.querySelectorAll("[data-builder-project-count]").forEach((node) => {
    node.textContent = String(projects.length);
  });
  document.querySelectorAll("[data-builder-variable-count]").forEach((node) => {
    node.textContent = String(variables.length);
  });
}

function updateSaveLabel() {
  const label = lastSaved
    ? `Saved ${new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(lastSaved)}`
    : "Saved locally";
  document.querySelectorAll("[data-builder-save]").forEach((node) => {
    node.textContent = label;
  });
}

function syncResetButton() {
  if (!resetButton) return;
  resetButton.textContent = resetArmed ? "Click again to reset" : "Reset projects";
  resetButton.classList.toggle("is-armed", resetArmed);
}

function updateStatus() {
  const project = activeProject();
  const bound = project ? project.nodes.filter((node) => node.bind).length : 0;
  document.querySelectorAll("[data-builder-status]").forEach((node) => {
    node.textContent = project
      ? `${project.name} · ${project.nodes.length} component${project.nodes.length === 1 ? "" : "s"} · ${bound} bound`
      : "No project selected";
  });
  updateSaveLabel();
  syncResetButton();
}

function syncHistory() {
  if (undoButton) undoButton.disabled = !undoStack.length;
  if (redoButton) redoButton.disabled = !redoStack.length;
}

function syncPreviewButton() {
  rootEl?.classList.toggle("is-preview", preview);
  if (!previewButton) return;
  previewButton.setAttribute("aria-pressed", String(preview));
  previewButton.classList.toggle("is-active", preview);
  const label = previewButton.querySelector("span");
  if (label) label.textContent = preview ? "Exit preview" : "Preview";
}

function syncPanels() {
  win?.querySelectorAll("[data-builder-tab]").forEach((button) => {
    const active = button.dataset.builderTab === activePanel;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (inspectPanel) inspectPanel.hidden = activePanel !== "inspect";
  if (varsPanel) varsPanel.hidden = activePanel !== "variables";
}

function renderAll() {
  refreshVariables();
  syncPanels();
  renderProjects();
  renderCanvas();
  renderInspector();
  renderVariableList();
  renderVariableChrome();
  updateCounts();
  updateStatus();
  syncHistory();
  syncPreviewButton();
}

/* ------------------------------------------------------------ selection */

function syncSelection() {
  if (!canvas) return;
  canvas.querySelectorAll("[data-node-id]").forEach((element) => {
    element.classList.toggle("is-selected", !preview && element.dataset.nodeId === selectedId);
  });
}

function selectNode(id, { inspector = false } = {}) {
  selectedId = id || null;
  syncSelection();
  renderInspector();
  renderVariableChrome();
  if (inspector && id) setPanel("inspect");
}

function selectProject(id) {
  if (!projects.some((project) => project.id === id)) return;
  activeId = id;
  selectedId = null;
  undoStack = [];
  redoStack = [];
  renderAll();
  persist();
}

function setPanel(panel) {
  activePanel = panel === "inspect" ? "inspect" : "variables";
  syncPanels();
  if (activePanel === "inspect") renderInspector();
  else {
    renderVariableChrome();
    if (variables.length) renderVariableList();
  }
}

/* --------------------------------------------------------------- history */

function record() {
  const project = activeProject();
  if (!project) return;
  undoStack.push(copy(project));
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
  syncHistory();
}

function undo() {
  if (!undoStack.length) return;
  const project = activeProject();
  if (project) redoStack.push(copy(project));
  const previous = undoStack.pop();
  const index = projects.findIndex((entry) => entry.id === previous.id);
  if (index >= 0) projects[index] = previous;
  if (!projects[index]?.nodes.some((node) => node.id === selectedId)) selectedId = null;
  renderAll();
  persist();
}

function redo() {
  if (!redoStack.length) return;
  const project = activeProject();
  if (project) undoStack.push(copy(project));
  const next = redoStack.pop();
  const index = projects.findIndex((entry) => entry.id === next.id);
  if (index >= 0) projects[index] = next;
  if (!projects[index]?.nodes.some((node) => node.id === selectedId)) selectedId = null;
  renderAll();
  persist();
}

/* -------------------------------------------------------------- editing */

function addNode(part) {
  const project = activeProject();
  if (!project) {
    toast("Select a project first", "warn");
    return;
  }
  record();
  const base = NODE_DEFAULTS[part.type] || NODE_DEFAULTS.panel;
  const count = project.nodes.length;
  const maxW = part.type === "appbar" ? 100 : base.w;
  const x = part.type === "appbar" ? 0 : clamp(8 + ((count * 6) % 48), 0, 100 - maxW);
  const y = part.type === "appbar" ? 0 : clamp(12 + ((count * 8) % 48), 0, 100 - base.h);
  const node = normalizeNode(
    {
      ...copy(base),
      id: uniqueNodeId("node"),
      type: part.type,
      label: part.label,
      variant: part.variant || base.variant,
      x,
      y,
      w: maxW,
      h: base.h,
    },
    count,
  );
  if (part.type === "appbar") {
    node.x = 0;
    node.y = 0;
    node.w = 100;
    node.h = 9;
  }
  project.nodes.push(node);
  selectedId = node.id;
  activePanel = "inspect";
  renderAll();
  persist();
  toast(`Added ${part.label} to ${project.name}`);
}

function deleteNode() {
  const project = activeProject();
  const node = selectedNode();
  if (!project || !node) return;
  record();
  project.nodes = project.nodes.filter((entry) => entry.id !== node.id);
  selectedId = null;
  renderAll();
  persist();
  toast(`${NODE_LABELS[node.type] || node.type} deleted`);
}

function duplicateNode() {
  const project = activeProject();
  const node = selectedNode();
  if (!project || !node) return;
  record();
  const twin = copy(node);
  twin.id = uniqueNodeId("node");
  twin.x = clamp(round(node.x + 2), 0, 100 - node.w);
  twin.y = clamp(round(node.y + 2), 0, 100 - node.h);
  project.nodes.push(twin);
  selectedId = twin.id;
  renderAll();
  persist();
  toast("Component duplicated");
}

function duplicateProject() {
  const project = activeProject();
  if (!project) return;
  const twin = normalizeProject({
    ...copy(project),
    id: uniqueProjectId(`${project.name} copy`),
    name: `${project.name} copy`,
    app: project.app,
    builtin: false,
    nodes: project.nodes.map((node) => ({ ...copy(node), id: uniqueNodeId("node") })),
  });
  projects.push(twin);
  activeId = twin.id;
  selectedId = null;
  undoStack = [];
  redoStack = [];
  renderAll();
  persist();
  toast(`Duplicated ${project.name}`);
  setPanel("inspect");
}

function deleteProject() {
  const project = activeProject();
  if (!project || project.builtin) return;
  projects = projects.filter((entry) => entry.id !== project.id);
  activeId = projects.find((entry) => entry.builtin)?.id || projects[0]?.id || null;
  selectedId = null;
  undoStack = [];
  redoStack = [];
  renderAll();
  persist();
  toast(`${project.name} deleted`);
  setPanel("inspect");
}

function createProject({ name, description, icon, accent, template }) {
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    toast("Name the app first", "warn");
    return false;
  }
  const source = template ? projects.find((project) => project.id === template) : null;
  const projectId = uniqueProjectId(cleanName);
  const nodes = source
    ? source.nodes.map((node, index) => ({
        ...copy(node),
        id: `${projectId}-node-${index + 1}`,
      }))
    : [];
  if (nodes.length && nodes[0].type === "appbar") nodes[0].label = cleanName;
  const project = normalizeProject({
    id: projectId,
    name: cleanName,
    app: cleanName,
    description: String(description || "").trim() || "A custom app project.",
    icon: PROJECT_ICONS.includes(icon) ? icon : "i-grid",
    accent: PROJECT_ACCENTS.some((entry) => entry.value === accent) ? accent : "#38d6ff",
    builtin: false,
    nodes,
  });
  projects.push(project);
  activeId = project.id;
  selectedId = null;
  undoStack = [];
  redoStack = [];
  renderAll();
  persist();
  setPanel("inspect");
  toast(`Created ${cleanName}`);
  return true;
}

function resetProjects() {
  projects = BUILTIN_PROJECTS.map((seed) => normalizeProject(seed, seed));
  activeId = projects[0]?.id || null;
  selectedId = null;
  preview = false;
  undoStack = [];
  redoStack = [];
  resetArmed = false;
  window.clearTimeout(resetTimer);
  renderAll();
  persist();
  toast("App Studio projects reset to the system set");
}

/* ---------------------------------------------------------------- drag */

function applyBox(element, node) {
  element.style.setProperty("--x", node.x);
  element.style.setProperty("--y", node.y);
  element.style.setProperty("--w", node.w);
  element.style.setProperty("--h", node.h);
}

function updateInspectorGeometry(node) {
  ["x", "y", "w", "h"].forEach((key) => {
    const input = inspectorHost?.querySelector(`[data-node-field="${key}"]`);
    if (input && document.activeElement !== input) input.value = node[key];
  });
}

function startDrag(event, node, element) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const startX = event.clientX;
  const startY = event.clientY;
  const origin = { x: node.x, y: node.y };
  let moved = false;

  function move(moveEvent) {
    const dx = ((moveEvent.clientX - startX) / rect.width) * 100;
    const dy = ((moveEvent.clientY - startY) / rect.height) * 100;
    if (!moved && Math.abs(dx) + Math.abs(dy) < 0.6) return;
    if (!moved) {
      record();
      moved = true;
    }
    node.x = round(clamp(origin.x + dx, 0, 100 - node.w));
    node.y = round(clamp(origin.y + dy, 0, 100 - node.h));
    applyBox(element, node);
    updateInspectorGeometry(node);
  }

  function end() {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", end);
    if (moved) {
      persist();
      updateInspectorGeometry(node);
    }
  }

  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  event.preventDefault();
}

function startResize(event, node, element) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const startX = event.clientX;
  const startY = event.clientY;
  const origin = { w: node.w, h: node.h };
  let moved = false;

  function move(moveEvent) {
    const dx = ((moveEvent.clientX - startX) / rect.width) * 100;
    const dy = ((moveEvent.clientY - startY) / rect.height) * 100;
    if (!moved && Math.abs(dx) + Math.abs(dy) < 0.4) return;
    if (!moved) {
      record();
      moved = true;
    }
    node.w = round(clamp(origin.w + dx, 3, 100 - node.x));
    node.h = round(clamp(origin.h + dy, 2, 100 - node.y));
    applyBox(element, node);
    updateInspectorGeometry(node);
  }

  function end() {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", end);
    if (moved) {
      persist();
      updateInspectorGeometry(node);
    }
  }

  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  event.preventDefault();
}

/* --------------------------------------------------------------- inputs */

function applyNodeField(target, field) {
  const node = selectedNode();
  if (!node) return;
  if (["x", "y", "w", "h"].includes(field)) {
    const raw = Number(target.value);
    if (!Number.isFinite(raw)) return;
    if (field === "x") node.x = clamp(raw, 0, 100 - node.w);
    if (field === "y") node.y = clamp(raw, 0, 100 - node.h);
    if (field === "w") node.w = clamp(raw, 3, 100 - node.x);
    if (field === "h") node.h = clamp(raw, 2, 100 - node.y);
  } else if (field === "value") {
    node.value = clamp(Number(target.value) || 0, 0, 100);
  } else {
    node[field] = target.value;
  }
  renderCanvas();
  if (field === "bind") {
    renderVariableChrome();
    renderVariableList();
  }
  scheduleSave();
}

function applyProjectField(target, field) {
  const project = activeProject();
  if (!project) return;
  project[field] = target.value;
  renderProjects();
  renderCanvas();
  scheduleSave();
}

function moveNodeBy(dx, dy) {
  const node = selectedNode();
  if (!node) return;
  record();
  node.x = clamp(round(node.x + dx), 0, 100 - node.w);
  node.y = clamp(round(node.y + dy), 0, 100 - node.h);
  const element = canvas?.querySelector(`[data-node-id="${CSS.escape(node.id)}"]`);
  if (element) applyBox(element, node);
  updateInspectorGeometry(node);
  scheduleSave();
}

/* --------------------------------------------------------------- events */

function bindEvents() {
  win?.addEventListener("pointerdown", () => {
    if (document.activeElement !== win) win.focus({ preventScroll: true });
  }, true);

  projectHost?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-project-id]");
    if (button) selectProject(button.dataset.projectId);
  });

  projectSearch?.addEventListener("input", () => {
    projectQuery = projectSearch.value;
    renderProjects();
  });

  win?.querySelector("[data-builder-new]")?.addEventListener("click", () => {
    if (!newForm) return;
    if (newForm.hidden) openNewForm();
    else closeNewForm();
  });

  newForm?.querySelector("[data-new-cancel]")?.addEventListener("click", () => closeNewForm());

  newForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = newForm.querySelector("[data-new-name]")?.value || "";
    const description = newForm.querySelector("[data-new-description]")?.value || "";
    const icon = newForm.querySelector("[data-new-icon]")?.value || "i-grid";
    const accent = newForm.querySelector("[data-new-accent]")?.value || "#38d6ff";
    const template = newForm.querySelector("[data-new-template]")?.value || "";
    if (createProject({ name, description, icon, accent, template })) closeNewForm();
  });

  win?.querySelectorAll("[data-builder-tab]").forEach((button) => {
    button.addEventListener("click", () => setPanel(button.dataset.builderTab));
  });

  previewButton?.addEventListener("click", () => {
    preview = !preview;
    if (preview) selectedId = null;
    syncPreviewButton();
    syncSelection();
    renderCanvas();
    renderInspector();
    renderVariableChrome();
  });

  undoButton?.addEventListener("click", undo);
  redoButton?.addEventListener("click", redo);

  resetButton?.addEventListener("click", () => {
    if (!resetArmed) {
      resetArmed = true;
      syncResetButton();
      resetTimer = window.setTimeout(() => {
        resetArmed = false;
        syncResetButton();
      }, 3200);
      return;
    }
    window.clearTimeout(resetTimer);
    resetProjects();
  });

  paletteHost?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-type]");
    if (!button) return;
    const part = COMPONENT_PALETTE.find(
      (entry) => entry.type === button.dataset.addType && (entry.variant || "") === (button.dataset.addVariant || ""),
    );
    if (part) addNode(part);
  });

  canvas?.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const nodeElement = event.target.closest("[data-node-id]");
    if (!nodeElement) {
      if (selectedId) selectNode(null);
      return;
    }
    const project = activeProject();
    const node = project?.nodes.find((entry) => entry.id === nodeElement.dataset.nodeId);
    if (!node) return;
    if (preview) return;
    selectNode(node.id);
    if (event.target.closest("[data-builder-resize]")) startResize(event, node, nodeElement);
    else startDrag(event, node, nodeElement);
  });

  canvas?.addEventListener("dblclick", (event) => {
    const nodeElement = event.target.closest("[data-node-id]");
    if (!nodeElement || preview) return;
    selectNode(nodeElement.dataset.nodeId, { inspector: true });
  });

  inspectorHost?.addEventListener("focusin", () => {
    if (activeProject() && !preview) record();
  });

  inspectorHost?.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;
    if (target.dataset.nodeField) {
      applyNodeField(target, target.dataset.nodeField);
      return;
    }
    if (target.dataset.nodeItems) {
      const node = selectedNode();
      if (!node) return;
      node.items = target.value.split("\n").map((line) => line.trim()).filter(Boolean);
      if (node.type === "tabs") node.active = clamp(Number(node.active) || 0, 0, Math.max(0, node.items.length - 1));
      renderCanvas();
      scheduleSave();
      return;
    }
    if (target.dataset.nodeLines) {
      const node = selectedNode();
      if (!node) return;
      node.lines = target.value.split("\n").map((line) => line.trimEnd()).filter(Boolean);
      renderCanvas();
      scheduleSave();
      return;
    }
    if (target.dataset.nodePairs) {
      const node = selectedNode();
      if (!node) return;
      node.pairs = target.value
        .split("\n")
        .map((line) => line.split("|").map((part) => part.trim()))
        .filter((pair) => pair[0])
        .map((pair) => [pair[0] || "Label", pair[1] || "Value"]);
      renderCanvas();
      scheduleSave();
      return;
    }
    if (target.dataset.projectField) applyProjectField(target, target.dataset.projectField);
  });

  inspectorHost?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.dataset.nodeField) {
      applyNodeField(target, target.dataset.nodeField);
      renderInspector();
      return;
    }
    if (target.dataset.projectField) {
      applyProjectField(target, target.dataset.projectField);
      renderInspector();
    }
  });

  inspectorHost?.addEventListener("click", (event) => {
    if (event.target.closest("[data-node-delete]")) {
      deleteNode();
      return;
    }
    if (event.target.closest("[data-node-duplicate]")) {
      duplicateNode();
      return;
    }
    if (event.target.closest("[data-project-duplicate]")) {
      duplicateProject();
      return;
    }
    const deleteButton = event.target.closest("[data-project-delete]");
    if (deleteButton) {
      if (deleteButton.dataset.armed === "true") {
        deleteProject();
        return;
      }
      deleteButton.dataset.armed = "true";
      deleteButton.textContent = "Click again to delete";
      deleteButton.classList.add("is-armed");
      window.setTimeout(() => {
        if (!deleteButton.isConnected) return;
        deleteButton.dataset.armed = "false";
        deleteButton.textContent = "Delete app";
        deleteButton.classList.remove("is-armed");
      }, 3200);
    }
  });

  variableSearch?.addEventListener("input", () => {
    variableQuery = variableSearch.value;
    renderVariableList();
  });

  variableHost?.addEventListener("click", async (event) => {
    const row = event.target.closest("[data-bind-variable]");
    if (!row) return;
    const variable = variableMap.get(row.dataset.bindVariable);
    if (!variable) return;
    const node = selectedNode();
    if (node) {
      record();
      node.bind = variable.id;
      renderCanvas();
      renderInspector();
      renderVariableChrome();
      syncVariableSelection();
      scheduleSave();
      toast(`Bound ${NODE_LABELS[node.type] || node.type} to ${variable.label}`);
      return;
    }
    const template = `{{${variable.id}}}`;
    try {
      await navigator.clipboard?.writeText(template);
      toast(`Copied ${template}`);
    } catch {
      toast(`Variable ${variable.id}`);
    }
  });

  win?.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.key.toLowerCase() === "z") {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (modifier && event.key.toLowerCase() === "d") {
      event.preventDefault();
      event.stopPropagation();
      duplicateNode();
      return;
    }
    if (event.key === "Escape") {
      if (preview) {
        preview = false;
        syncPreviewButton();
        renderCanvas();
        renderInspector();
      } else if (selectedId) {
        selectNode(null);
      }
      return;
    }
    if (!selectedNode()) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      deleteNode();
      return;
    }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      const step = event.shiftKey ? 5 : 1;
      if (event.key === "ArrowLeft") moveNodeBy(-step, 0);
      if (event.key === "ArrowRight") moveNodeBy(step, 0);
      if (event.key === "ArrowUp") moveNodeBy(0, -step);
      if (event.key === "ArrowDown") moveNodeBy(0, step);
    }
  });
}

function openNewForm() {
  if (!newForm) return;
  newForm.reset();
  const iconSelect = newForm.querySelector("[data-new-icon]");
  const accentSelect = newForm.querySelector("[data-new-accent]");
  const templateSelect = newForm.querySelector("[data-new-template]");
  if (iconSelect) iconSelect.innerHTML = iconOptions("i-grid");
  if (accentSelect) accentSelect.innerHTML = accentOptions("#38d6ff");
  if (templateSelect) {
    templateSelect.innerHTML = `<option value="">Blank canvas</option>${projects
      .map((project) => `<option value="${esc(project.id)}">${esc(project.name)} · ${project.builtin ? "system" : "custom"}</option>`)
      .join("")}`;
  }
  newForm.hidden = false;
  newForm.querySelector("[data-new-name]")?.focus();
}

function closeNewForm() {
  if (newForm) newForm.hidden = true;
}

function tick() {
  if (!win || win.hidden || win.classList.contains("is-minimized") || document.hidden) return;
  refreshVariables();
  updateVariableRows();
  refreshCanvasLive();
  updateCounts();
}

/* ---------------------------------------------------------------- entry */

export function initBuilder() {
  if (initialized || !win) return;
  initialized = true;
  projects = loadProjects();
  bindEvents();
  renderPalette();
  renderAll();
  window.setInterval(tick, 1000);
}

export function openBuilder() {
  if (!win) return;
  initBuilder();
  openWindow("builder");
  refreshVariables();
  renderAll();
}