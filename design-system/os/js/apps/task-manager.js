/* Aether OS — Task Manager
   Process trees, filtering, selection details, resource history charts, and the
   six-second sampler. The menu bar meters are driven by syncResourceUi. */

import { toast } from "../core/toast.js";
import { esc } from "../core/utils.js";
import {
  MEMORY_TOTAL_GB, PROCESS_SEED, STORAGE_FREE_GB, STORAGE_TOTAL_GB,
  TASK_CATEGORIES,
} from "./task-processes.js";
import { openWindow } from "../shell/windows.js";

let taskProcesses = PROCESS_SEED.map((task) => ({ ...task }));
let selectedTask = null;
let taskFilter = "all";
let taskSidebarMode = null;
let expandedTaskGroups = new Set(["compare", "jottacloud-sync"]);

const TASK_SAMPLE_MS = 6000;
const TASK_HISTORY_LIMIT = 601;
const TASK_RANGES = {
  60: "1 minute",
  300: "5 minutes",
  900: "15 minutes",
  3600: "1 hour",
};
let taskRange = 300;
let resourceHistory = [];

const TASK_CHART_WIDTH = 120;
const TASK_CHART_TOP = 2;
const TASK_CHART_BOTTOM = 38;

export function taskProcessCount() {
  return taskProcesses.length;
}

export function topProcess() {
  return [...taskProcesses].sort((a, b) => b.cpu - a.cpu)[0] || null;
}

export function taskTotals() {
  const cpu = taskProcesses.reduce((sum, task) => sum + task.cpu, 0);
  const memory = taskProcesses.reduce((sum, task) => sum + task.memory, 0);
  return {
    cpu: Math.min(100, cpu),
    memory: Math.min(100, (memory / MEMORY_TOTAL_GB) * 100),
    memoryGb: memory,
    storage: (STORAGE_FREE_GB / STORAGE_TOTAL_GB) * 100,
    storageFree: STORAGE_FREE_GB,
  };
}

const taskMemoryLabel = (gb) => (gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(gb * 1024)} MB`);

function seedResourceHistory() {
  const totals = taskTotals();
  const now = Date.now();
  let cpu = totals.cpu;
  let memory = totals.memory;
  resourceHistory = new Array(TASK_HISTORY_LIMIT);
  for (let i = TASK_HISTORY_LIMIT - 1; i >= 0; i -= 1) {
    resourceHistory[i] = { t: now - i * TASK_SAMPLE_MS, cpu, memory };
    cpu = Math.max(6, Math.min(64, cpu + (Math.random() - 0.5) * 2.8));
    memory = Math.max(32, Math.min(82, memory + (Math.random() - 0.5) * 1.4));
  }
}

function recordResourceHistory() {
  const totals = taskTotals();
  const now = Date.now();
  const last = resourceHistory[resourceHistory.length - 1];
  if (last && now - last.t < TASK_SAMPLE_MS / 2) {
    last.cpu = totals.cpu;
    last.memory = totals.memory;
    return;
  }
  resourceHistory.push({ t: now, cpu: totals.cpu, memory: totals.memory });
  const cutoff = now - TASK_HISTORY_LIMIT * TASK_SAMPLE_MS;
  while (resourceHistory.length > 1 && resourceHistory[0].t < cutoff) resourceHistory.shift();
}

function taskChartCoords(points, key, start, range) {
  const values = points.map((point) => Math.max(0, Math.min(100, point[key])));
  let min = Math.min(...values);
  let max = Math.max(...values);
  const span = Math.max(max - min, 8);
  const centre = (min + max) / 2;
  min = Math.max(0, centre - span / 2 - 2);
  max = Math.min(100, centre + span / 2 + 2);
  const valueRange = Math.max(1, max - min);
  return points.map((point) => {
    const x = Math.max(0, Math.min(TASK_CHART_WIDTH, ((point.t - start) / range) * TASK_CHART_WIDTH));
    const value = Math.max(0, Math.min(100, point[key]));
    const y = TASK_CHART_BOTTOM - ((value - min) / valueRange) * (TASK_CHART_BOTTOM - TASK_CHART_TOP);
    return [x, y];
  });
}

function taskChartLine(coords) {
  return coords
    .map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
}

function taskChartArea(coords) {
  const first = coords[0];
  const last = coords[coords.length - 1];
  const floor = TASK_CHART_BOTTOM.toFixed(2);
  return `M${first[0].toFixed(2)} ${floor} ${coords
    .map(([x, y]) => `L${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ")} L${last[0].toFixed(2)} ${floor} Z`;
}

function renderTaskCharts() {
  const now = Date.now();
  const rangeMs = taskRange * 1000;
  const start = now - rangeMs;
  let points = resourceHistory.filter((point) => point.t >= start);
  if (points.length < 2) points = resourceHistory.slice(-2);
  if (!points.length) return;

  ["cpu", "memory"].forEach((key) => {
    const coords = taskChartCoords(points, key, start, rangeMs);
    document.querySelector(`[data-tm-line="${key}"]`)?.setAttribute("d", taskChartLine(coords));
    document.querySelector(`[data-tm-area="${key}"]`)?.setAttribute("d", taskChartArea(coords));
  });

  const totals = taskTotals();
  document.querySelectorAll("[data-tm-chart-cpu]").forEach((node) => {
    node.textContent = `${Math.round(totals.cpu)}%`;
  });
  document.querySelectorAll("[data-tm-chart-memory]").forEach((node) => {
    node.textContent = `${Math.round(totals.memory)}%`;
  });
  document.querySelectorAll("[data-tm-window]").forEach((node) => {
    node.textContent = `Last ${TASK_RANGES[taskRange]} · sampled every 6s`;
  });
}

seedResourceHistory();

function taskById(id) {
  return taskProcesses.find((task) => task.id === id) || null;
}

function taskChildren(id) {
  return taskProcesses.filter((task) => task.parent === id);
}

function taskDescendantIds(id) {
  const ids = new Set();
  const walk = (parentId) => {
    taskProcesses.forEach((task) => {
      if (task.parent !== parentId) return;
      ids.add(task.id);
      walk(task.id);
    });
  };
  walk(id);
  return ids;
}

function taskVisibleIds() {
  if (taskFilter === "all") return new Set(taskProcesses.map((task) => task.id));
  const visible = new Set();
  taskProcesses.forEach((task) => {
    if (task.category !== taskFilter) return;
    let current = task;
    while (current) {
      visible.add(current.id);
      current = current.parent ? taskById(current.parent) : null;
    }
  });
  return visible;
}

function expandTaskAncestors() {
  taskProcesses.forEach((task) => {
    if (taskFilter !== "all" && task.category !== taskFilter) return;
    let parentId = task.parent;
    while (parentId) {
      expandedTaskGroups.add(parentId);
      parentId = taskById(parentId)?.parent ?? null;
    }
  });
}

function toggleTaskGroup(id) {
  if (expandedTaskGroups.has(id)) {
    expandedTaskGroups.delete(id);
    if (selectedTask && taskDescendantIds(id).has(selectedTask)) selectedTask = id;
  } else {
    expandedTaskGroups.add(id);
  }
  renderTaskRows();
}

function taskRowHtml(task, depth, childCount, expanded, context) {
  const selected = selectedTask === task.id;
  const category = TASK_CATEGORIES[task.category];
  const caret = childCount
    ? `<button class="os-tm-caret${expanded ? " is-open" : ""}" type="button" data-task-toggle="${esc(task.id)}" tabindex="-1" aria-label="${expanded ? "Collapse" : "Expand"} ${esc(task.name)}"><svg class="icon"><use href="#i-chevron-right"/></svg></button>`
    : '<span class="os-tm-caret is-empty" aria-hidden="true"></span>';
  return `<div class="os-tm-row${selected ? " is-selected" : ""}${context ? " is-context" : ""}${depth ? " is-child" : ""}" data-task-row="${esc(task.id)}" role="treeitem" aria-level="${depth + 1}" aria-selected="${selected}"${childCount ? ` aria-expanded="${expanded}"` : ""} tabindex="0" style="--depth:${depth}">
    <span class="os-tm-name">${caret}<svg class="icon os-tm-icon"><use href="#${task.icon}"/></svg><span class="os-tm-title">${esc(task.name)}</span>${childCount ? `<span class="os-tm-child-count">${childCount}</span>` : ""}</span>
    <span class="os-tm-cpu">${task.cpu.toFixed(1)}%</span>
    <span class="os-tm-mem">${taskMemoryLabel(task.memory)}</span>
    <span class="os-tm-category is-${task.category}"><span class="dot"></span>${category.label}</span>
  </div>`;
}

function taskBranchHtml(task, depth, visibleIds, out) {
  if (!visibleIds.has(task.id)) return;
  const children = taskChildren(task.id).filter((child) => visibleIds.has(child.id));
  const expanded = children.length > 0 && expandedTaskGroups.has(task.id);
  const context = taskFilter !== "all" && task.category !== taskFilter;
  out.push(taskRowHtml(task, depth, children.length, expanded, context));
  if (!expanded) return;
  children.forEach((child) => taskBranchHtml(child, depth + 1, visibleIds, out));
}

function renderTaskRows() {
  const host = document.querySelector("[data-task-rows]");
  if (!host) return;
  const visibleIds = taskVisibleIds();
  const roots = taskProcesses.filter((task) => !task.parent || !taskById(task.parent));
  const rows = [];
  roots.forEach((task) => taskBranchHtml(task, 0, visibleIds, rows));
  host.innerHTML = rows.length ? rows.join("") : '<p class="os-tm-empty">No processes match this filter.</p>';
  renderTaskSelection();
}

function updateTaskRows() {
  taskProcesses.forEach((task) => {
    const row = document.querySelector(`[data-task-row="${CSS.escape(task.id)}"]`);
    if (!row) return;
    row.querySelector(".os-tm-cpu").textContent = `${task.cpu.toFixed(1)}%`;
    row.querySelector(".os-tm-mem").textContent = taskMemoryLabel(task.memory);
  });
}

function taskDetailHtml(task) {
  const category = TASK_CATEGORIES[task.category];
  const parent = task.parent ? taskById(task.parent) : null;
  const children = taskChildren(task.id);
  const descendants = taskDescendantIds(task.id).size;
  const expanded = expandedTaskGroups.has(task.id);
  return `<div class="os-tm-detail-hero">
      <span class="os-tm-detail-icon"><svg class="icon"><use href="#${task.icon}"/></svg></span>
      <div class="os-tm-detail-title"><b>${esc(task.name)}</b><span class="os-tm-category is-${task.category}"><span class="dot"></span>${category.label}</span></div>
    </div>
    <div class="os-tm-detail-facts">
      <div class="os-tm-detail-fact"><span>Process ID</span><b>${task.pid}</b></div>
      <div class="os-tm-detail-fact"><span>Parent</span><b>${esc(parent ? parent.name : "launchd")}</b></div>
      <div class="os-tm-detail-fact"><span>Category</span><b>${category.label}</b></div>
      <div class="os-tm-detail-fact"><span>Status</span><b>${esc(task.status)}</b></div>
      <div class="os-tm-detail-fact"><span>CPU</span><b data-task-detail-value="cpu">${task.cpu.toFixed(1)}%</b></div>
      <div class="os-tm-detail-fact"><span>Memory</span><b data-task-detail-value="memory">${taskMemoryLabel(task.memory)}</b></div>
      <div class="os-tm-detail-fact"><span>Threads</span><b>${task.threads}</b></div>
      <div class="os-tm-detail-fact"><span>Uptime</span><b>${esc(task.uptime)}</b></div>
    </div>
    <p class="os-tm-detail-note">${esc(task.note)}${children.length ? ` ${children.length} child ${children.length === 1 ? "process" : "processes"}${descendants > children.length ? ` · ${descendants} in the group` : ""}.` : ""}</p>
    <div class="os-tm-detail-actions">
      ${children.length ? `<button class="os-tm-detail-action" type="button" data-task-detail-fold="${esc(task.id)}">${expanded ? "Hide children" : `Show ${children.length} child ${children.length === 1 ? "process" : "processes"}`}</button>` : ""}
      <button class="os-tm-detail-action is-danger" type="button" data-task-detail-end>End task${descendants ? ` and ${descendants} child ${descendants === 1 ? "process" : "processes"}` : ""}</button>
    </div>`;
}

function renderTaskDetail() {
  const panel = document.querySelector("[data-task-detail]");
  const body = document.querySelector("[data-task-detail-body]");
  if (!panel || !body) return;
  const task = taskSidebarMode === "detail" && selectedTask ? taskById(selectedTask) : null;
  if (!task) {
    panel.hidden = true;
    syncTaskSidebar();
    return;
  }
  panel.hidden = false;
  const display = document.querySelector("[data-task-display]");
  if (display) display.hidden = true;
  document.querySelector("[data-task-display-toggle]")?.setAttribute("aria-expanded", "false");
  if (panel.dataset.taskDetailFor === task.id) {
    const cpu = body.querySelector('[data-task-detail-value="cpu"]');
    const memory = body.querySelector('[data-task-detail-value="memory"]');
    if (cpu) cpu.textContent = `${task.cpu.toFixed(1)}%`;
    if (memory) memory.textContent = taskMemoryLabel(task.memory);
    syncTaskSidebar();
    return;
  }
  body.innerHTML = taskDetailHtml(task);
  panel.dataset.taskDetailFor = task.id;
  syncTaskSidebar();
}

function renderTaskSelection() {
  const selected = selectedTask ? taskById(selectedTask) : null;
  document.querySelectorAll("[data-task-row]").forEach((row) => {
    const active = row.dataset.taskRow === selectedTask;
    row.classList.toggle("is-selected", active);
    row.setAttribute("aria-selected", String(active));
  });
  const endButton = document.querySelector("[data-task-end]");
  if (endButton) endButton.disabled = !selected;
  const label = document.querySelector("[data-task-selection]");
  if (label) {
    label.textContent = selected
      ? `${selected.name} · ${TASK_CATEGORIES[selected.category].label} · ${taskMemoryLabel(selected.memory)}`
      : "Select a process to see details.";
  }
  renderTaskDetail();
}

function renderTaskFilters() {
  const host = document.querySelector("[data-task-filters]");
  if (!host) return;
  const counts = new Map(Object.keys(TASK_CATEGORIES).map((key) => [key, 0]));
  taskProcesses.forEach((task) => counts.set(task.category, (counts.get(task.category) || 0) + 1));
  const chip = (key, label, count) => `<button class="os-tm-filter${taskFilter === key ? " is-active" : ""}" type="button" data-task-filter="${key}" aria-pressed="${taskFilter === key}">${key === "all" ? "" : `<span class="os-tm-filter-dot is-${key}" aria-hidden="true"></span>`}<span>${label}</span><b>${count}</b></button>`;
  host.innerHTML = chip("all", "All", taskProcesses.length) + Object.entries(TASK_CATEGORIES)
    .map(([key, category]) => chip(key, category.label, counts.get(key) || 0))
    .join("");
}

function setTaskFilter(filter) {
  if (filter !== "all" && !TASK_CATEGORIES[filter]) return;
  taskFilter = filter;
  if (filter !== "all") expandTaskAncestors();
  if (selectedTask && !taskVisibleIds().has(selectedTask)) {
    selectedTask = null;
    if (taskSidebarMode === "detail") taskSidebarMode = null;
  }
  renderTaskFilters();
  renderTaskRows();
}

function selectTask(id) {
  if (!taskById(id)) return;
  selectedTask = id;
  taskSidebarMode = "detail";
  renderTaskSelection();
  const panel = document.querySelector("[data-task-detail]");
  if (panel) panel.scrollTop = 0;
}

function endSelectedTask() {
  const target = selectedTask ? taskById(selectedTask) : null;
  if (!target) return;
  const removeIds = new Set([target.id, ...taskDescendantIds(target.id)]);
  const count = removeIds.size;
  taskProcesses = taskProcesses.filter((task) => !removeIds.has(task.id));
  removeIds.forEach((id) => expandedTaskGroups.delete(id));
  selectedTask = null;
  taskSidebarMode = null;
  renderTaskFilters();
  renderTaskRows();
  syncResourceUi();
  recordResourceHistory();
  renderTaskCharts();
  toast(count > 1 ? `Ended ${target.name} and ${count - 1} child processes` : `Ended ${target.name}`);
}

function syncResourceUi() {
  const totals = taskTotals();
  const cpu = Math.round(totals.cpu);
  const ram = Math.round(totals.memory);
  const free = Math.round(totals.storageFree);

  document.querySelectorAll('[data-resource-fill="cpu"]').forEach((node) => (node.style.width = `${totals.cpu}%`));
  document.querySelectorAll('[data-resource-fill="memory"]').forEach((node) => (node.style.width = `${totals.memory}%`));
  document.querySelectorAll('[data-resource-fill="storage"]').forEach((node) => (node.style.width = `${totals.storage}%`));
  document.querySelectorAll('[data-resource-value="cpu"]').forEach((node) => (node.textContent = `${cpu}%`));
  document.querySelectorAll('[data-resource-value="memory"]').forEach((node) => (node.textContent = `${ram}%`));
  document.querySelectorAll('[data-resource-value="storage"]').forEach((node) => (node.textContent = `${free} GB`));

  document.querySelectorAll("[data-resource-group]").forEach((node) => {
    const label = `Open Task Manager. CPU ${cpu}%, memory ${ram}%, storage ${free} GB left.`;
    node.setAttribute("title", `Task Manager · CPU ${cpu}% · Memory ${ram}% · ${free} GB left`);
    node.setAttribute("aria-label", label);
  });

  document.querySelectorAll("[data-tm-cpu]").forEach((node) => (node.textContent = `${cpu}%`));
  document.querySelectorAll("[data-tm-memory]").forEach((node) => (node.textContent = `${ram}%`));
  document.querySelectorAll("[data-tm-storage]").forEach((node) => (node.textContent = `${free} GB`));
  document.querySelectorAll("[data-tm-cpu-detail]").forEach((node) => {
    node.textContent = `${taskProcesses.length} processes · 8 cores`;
  });
  document.querySelectorAll("[data-tm-memory-detail]").forEach((node) => {
    node.textContent = `${totals.memoryGb.toFixed(1)} GB of ${MEMORY_TOTAL_GB} GB`;
  });
  document.querySelectorAll("[data-tm-storage-detail]").forEach((node) => {
    node.textContent = `left of ${STORAGE_TOTAL_GB / 1024} TB`;
  });
}

function sampleResources() {
  taskProcesses.forEach((task) => {
    task.cpu = Math.max(0.1, Math.min(9, task.cpu + (Math.random() - 0.5) * 0.8));
    task.memory = Math.max(0.05, task.memory + (Math.random() - 0.5) * 0.08);
  });
  updateTaskRows();
  renderTaskSelection();
  syncResourceUi();
  recordResourceHistory();
  renderTaskCharts();
}

export function openTaskManager() {
  openWindow("taskmanager");
  renderTaskFilters();
  renderTaskRows();
  syncResourceUi();
  renderTaskCharts();
}

document.addEventListener("click", (event) => {
  const filter = event.target.closest("[data-task-filter]");
  if (filter) {
    setTaskFilter(filter.dataset.taskFilter);
    return;
  }
  const toggle = event.target.closest("[data-task-toggle]");
  if (toggle) {
    toggleTaskGroup(toggle.dataset.taskToggle);
    return;
  }
  const fold = event.target.closest("[data-task-detail-fold]");
  if (fold) {
    toggleTaskGroup(fold.dataset.taskDetailFold);
    return;
  }
  const detailClose = event.target.closest("[data-task-detail-close]");
  if (detailClose) {
    selectedTask = null;
    taskSidebarMode = null;
    renderTaskSelection();
    return;
  }
  if (event.target.closest("[data-task-detail-end]")) {
    endSelectedTask();
    return;
  }
  const row = event.target.closest("[data-task-row]");
  if (!row) return;
  selectTask(row.dataset.taskRow);
});

document.addEventListener("keydown", (event) => {
  const row = event.target.closest("[data-task-row]");
  if (!row) return;
  const id = row.dataset.taskRow;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    selectTask(id);
    return;
  }
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  const group = taskChildren(id);
  if (!group.length) return;
  event.preventDefault();
  if (event.key === "ArrowRight" && !expandedTaskGroups.has(id)) toggleTaskGroup(id);
  if (event.key === "ArrowLeft" && expandedTaskGroups.has(id)) toggleTaskGroup(id);
});

document.querySelector("[data-task-end]")?.addEventListener("click", endSelectedTask);

document.querySelector("[data-task-sample]")?.addEventListener("click", () => {
  sampleResources();
  toast("Resource sample refreshed");
});

document.querySelectorAll("[data-tm-range]").forEach((button) => {
  button.addEventListener("click", () => {
    taskRange = Number(button.dataset.tmRange);
    document.querySelectorAll("[data-tm-range]").forEach((option) => {
      const active = option === button;
      option.classList.toggle("is-active", active);
      option.setAttribute("aria-selected", String(active));
    });
    renderTaskCharts();
  });
});
const taskDisplayPanel = document.querySelector("[data-task-display]");
const taskDisplayToggle = document.querySelector("[data-task-display-toggle]");
const taskDetailPanel = document.querySelector("[data-task-detail]");
const taskManagerPanel = document.querySelector(".os-taskmanager");

function syncTaskSidebar() {
  const open = Boolean(
    (taskDisplayPanel && !taskDisplayPanel.hidden) ||
    (taskDetailPanel && !taskDetailPanel.hidden)
  );
  taskManagerPanel?.classList.toggle("is-sidebar-open", open);
}

function setTaskDisplayOpen(open) {
  if (!taskDisplayPanel) return;
  taskDisplayPanel.hidden = !open;
  if (open) {
    taskSidebarMode = "display";
    if (taskDetailPanel) taskDetailPanel.hidden = true;
  } else if (taskSidebarMode === "display") {
    taskSidebarMode = null;
  }
  taskDisplayToggle?.setAttribute("aria-expanded", String(open));
  syncTaskSidebar();
}

taskDisplayToggle?.addEventListener("click", () => {
  setTaskDisplayOpen(taskDisplayPanel?.hidden);
});

document.querySelector("[data-task-display-close]")?.addEventListener("click", () => {
  setTaskDisplayOpen(false);
  taskDisplayToggle?.focus({ preventScroll: true });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (taskDisplayPanel && !taskDisplayPanel.hidden) {
    setTaskDisplayOpen(false);
  } else if (taskDetailPanel && !taskDetailPanel.hidden) {
    selectedTask = null;
    taskSidebarMode = null;
    renderTaskSelection();
  }
});

export function initTaskManager() {
  renderTaskFilters();
  renderTaskRows();
  syncResourceUi();
  renderTaskCharts();
  window.setInterval(() => {
    if (document.hidden) return;
    sampleResources();
  }, 6000);
}
