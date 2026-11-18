/* Aether OS — resizable app sidebars
   A sidebar declares how its width is controlled:
     data-resize-sidebar          marks the element as resizable
     data-resize-key              stable key for the saved width
     data-resize-var              custom property that carries the width
     data-resize-host="parent"    set the property on the layout parent (grid)
     data-resize-host="self"      set the property on the sidebar itself (flex)
     data-resize-edge="start|end" which side of the layout the sidebar sits on
     data-resize-min/max          width bounds
     data-resize-min-main         room the main content keeps while dragging

   Widths are saved locally, restored on load, and reset with a double-click
   or Home while the handle is focused. */

import { readJSON, writeJSON } from "../core/state.js";

const STORAGE_KEY = "explorer-os-sidebar-widths-v1";
const STEP = 16;
const LARGE_STEP = 48;
const STACKED_RATIO = 0.72;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

let savedWidths = (() => {
  const stored = readJSON(STORAGE_KEY);
  return stored && typeof stored === "object" ? stored : {};
})();

function persistWidths() {
  writeJSON(STORAGE_KEY, savedWidths);
}

function readConfig(panel) {
  const parent = panel.parentElement;
  if (!parent) return null;
  return {
    panel,
    parent,
    key: panel.dataset.resizeKey || panel.id || panel.dataset.resizeVar,
    varName: panel.dataset.resizeVar,
    host: panel.dataset.resizeHost === "self" ? panel : parent,
    edge: panel.dataset.resizeEdge === "start" ? "start" : "end",
    min: Number(panel.dataset.resizeMin) || 180,
    max: Number(panel.dataset.resizeMax) || 520,
    minMain: Number(panel.dataset.resizeMinMain) || 300,
    label: panel.dataset.resizeLabel || panel.getAttribute("aria-label") || "Sidebar",
  };
}

function createResizer(config) {
  const { panel, parent, key, varName, host, edge, min, max, minMain, label } = config;

  const handle = document.createElement("div");
  handle.className = "os-side-resize";
  handle.dataset.resizeHandle = key;
  handle.tabIndex = 0;
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", "vertical");
  handle.setAttribute("aria-label", `Resize ${label}`);
  handle.title = "Drag to resize · double-click to reset";
  parent.appendChild(handle);

  function effectiveMax() {
    const parentWidth = parent.getBoundingClientRect().width;
    if (!parentWidth) return max;
    const siblings = Array.from(parent.children).filter(
      (child) => child !== panel && child !== handle && child.hasAttribute("data-resize-sidebar"),
    );
    const occupied = siblings.reduce((total, child) => {
      const rect = child.getBoundingClientRect();
      return total + (rect.width || 0);
    }, 0);
    return Math.max(min, Math.min(max, parentWidth - occupied - minMain));
  }

  function applyWidth(width) {
    if (Number.isFinite(width)) host.style.setProperty(varName, `${Math.round(width)}px`);
    else host.style.removeProperty(varName);
  }

  function syncGeometry() {
    const parentRect = parent.getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    const stacked = rect.width >= parentRect.width * STACKED_RATIO;
    const hidden = panel.hidden || rect.width < 2 || rect.height < 2 || stacked;
    handle.hidden = hidden;
    if (hidden) return;

    const boundary = edge === "end" ? rect.left : rect.right;
    handle.style.top = `${rect.top - parentRect.top}px`;
    handle.style.height = `${rect.height}px`;
    handle.style.left = `${boundary - parentRect.left}px`;

    const current = Math.round(rect.width);
    handle.setAttribute("aria-valuemin", String(min));
    handle.setAttribute("aria-valuemax", String(effectiveMax()));
    handle.setAttribute("aria-valuenow", String(current));
    handle.setAttribute("aria-valuetext", `${current} pixels`);
  }

  function commitWidth(width) {
    const next = Math.round(clamp(width, min, effectiveMax()));
    applyWidth(next);
    savedWidths[key] = next;
    persistWidths();
    syncGeometry();
    return next;
  }

  function resetWidth() {
    delete savedWidths[key];
    persistWidths();
    applyWidth(null);
    syncGeometry();
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const startRect = panel.getBoundingClientRect();
    if (!startRect.width) return;
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = startRect.width;
    let width = startWidth;

    handle.setPointerCapture?.(event.pointerId);
    handle.classList.add("is-dragging");
    document.body.classList.add("is-resizing-sidebar");

    const onMove = (moveEvent) => {
      const delta = edge === "end" ? startX - moveEvent.clientX : moveEvent.clientX - startX;
      width = clamp(startWidth + delta, min, effectiveMax());
      applyWidth(width);
      syncGeometry();
    };

    const onEnd = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onEnd);
      handle.removeEventListener("pointercancel", onEnd);
      try {
        handle.releasePointerCapture?.(event.pointerId);
      } catch {
        /* pointer may already be released */
      }
      handle.classList.remove("is-dragging");
      document.body.classList.remove("is-resizing-sidebar");
      savedWidths[key] = Math.round(width);
      persistWidths();
      syncGeometry();
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onEnd);
    handle.addEventListener("pointercancel", onEnd);
  }

  function onKeyDown(event) {
    if (event.key === "Home") {
      event.preventDefault();
      resetWidth();
      return;
    }
    const step = event.shiftKey ? LARGE_STEP : STEP;
    let delta = 0;
    if (event.key === "ArrowLeft") delta = edge === "end" ? step : -step;
    else if (event.key === "ArrowRight") delta = edge === "end" ? -step : step;
    else return;
    event.preventDefault();
    const current = panel.getBoundingClientRect().width;
    commitWidth(current + delta);
  }

  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("keydown", onKeyDown);
  handle.addEventListener("dblclick", resetWidth);

  const width = savedWidths[key];
  if (Number.isFinite(width)) applyWidth(clamp(width, min, max));

  const observer = new ResizeObserver(syncGeometry);
  observer.observe(parent);
  observer.observe(panel);

  const mutations = new MutationObserver(syncGeometry);
  mutations.observe(panel, { attributes: true, attributeFilter: ["hidden", "class"] });

  window.addEventListener("resize", syncGeometry);
  syncGeometry();
}

export function initSidebarResize() {
  document.querySelectorAll("[data-resize-sidebar]").forEach((panel) => {
    const config = readConfig(panel);
    if (config?.varName) createResizer(config);
  });
}