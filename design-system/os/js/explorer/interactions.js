/* Aether OS — explorer interactions
   DOM event wiring for the panes, search, filters, sorting, providers, the
   legend, and the side panel. All listeners are registered once at import. */

import { saveProvider, state } from "../core/state.js";
import { toast } from "../core/toast.js";
import {
  providerLabel, providerRoot, statusFilters,
} from "./model.js";
import {
  openSelected, renderAll, renderFilterPop, renderPane, renderStatusbar,
  revealSelected, selectEntry, setActiveSide, setSidePanel, toggleLegend,
} from "./view.js";

/* rows and pane interaction */

document.querySelectorAll("[data-rows]").forEach((rows) => {
  const side = rows.dataset.rows;
  rows.addEventListener("click", (event) => {
    const row = event.target.closest(".osx-row");
    if (!row) return;
    setActiveSide(side);
    selectEntry(side, row.dataset.entry);
  });
  rows.addEventListener("dblclick", (event) => {
    const row = event.target.closest(".osx-row");
    if (!row) return;
    selectEntry(side, row.dataset.entry);
    openSelected();
  });
  rows.addEventListener("contextmenu", (event) => {
    const row = event.target.closest(".osx-row");
    if (!row) return;
    event.preventDefault();
    selectEntry(side, row.dataset.entry);
    setSidePanel("detail", side, row.dataset.entry);
  });
  rows.addEventListener("keydown", (event) => {
    const visible = Array.from(rows.querySelectorAll(".osx-row"));
    if (!visible.length) return;
    const index = visible.findIndex((row) => row.classList.contains("is-selected"));
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = visible[Math.min(visible.length - 1, index < 0 ? 0 : index + 1)];
      selectEntry(side, next.dataset.entry);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = visible[Math.max(0, index < 0 ? 0 : index - 1)];
      selectEntry(side, next.dataset.entry);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectEntry(side, visible[0].dataset.entry);
    } else if (event.key === "End") {
      event.preventDefault();
      selectEntry(side, visible[visible.length - 1].dataset.entry);
    } else if (event.key === "Enter") {
      event.preventDefault();
      openSelected();
    } else if (event.key === "Backspace") {
      event.preventDefault();
      toast("Already at the snapshot root", "warn");
    }
  });
  rows.addEventListener("focus", () => setActiveSide(side));
});

document.querySelectorAll("[data-pane]").forEach((pane) => {
  pane.addEventListener("pointerdown", () => setActiveSide(pane.dataset.pane));
});

document.querySelectorAll("[data-search]").forEach((input) => {
  input.addEventListener("input", () => {
    const side = input.dataset.search;
    state.search[side] = input.value;
    renderPane(side);
    renderStatusbar();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      input.value = "";
      state.search[input.dataset.search] = "";
      renderPane(input.dataset.search);
      renderStatusbar();
    }
  });
});

document.querySelectorAll("[data-scope]").forEach((select) => {
  select.addEventListener("change", () => {
    state.scope[select.dataset.scope] = select.value;
  });
});

document.querySelectorAll("[data-filter-toggle]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const side = button.dataset.filterToggle;
    const pop = document.querySelector(`[data-filter-pop="${side}"]`);
    const opening = pop?.hidden;
    document.querySelectorAll("[data-filter-pop]").forEach((other) => (other.hidden = true));
    document.querySelectorAll("[data-filter-toggle]").forEach((other) => other.setAttribute("aria-expanded", "false"));
    if (opening && pop) {
      renderFilterPop(side);
      pop.hidden = false;
      button.setAttribute("aria-expanded", "true");
    }
  });
});

document.querySelectorAll("[data-column-head]").forEach((head) => {
  head.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-sort]");
    if (!button) return;
    const side = head.dataset.columnHead;
    const id = button.dataset.sort;
    const current = state.sort[side];
    if (current.id === id) current.dir = current.dir === "asc" ? "desc" : "asc";
    else {
      current.id = id;
      current.dir = "asc";
    }
    renderPane(side);
    renderStatusbar();
  });
});

document.querySelectorAll("[data-nav]").forEach((button) => {
  button.addEventListener("click", () => {
    toast("Already at the snapshot root", "warn");
  });
});

document.querySelectorAll("[data-provider]").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.provider === button.dataset.provider) return;
    state.provider = button.dataset.provider;
    saveProvider();
    renderAll();
    toast(`Remote provider · ${providerLabel()}`);
  });
});

document.querySelectorAll("[data-crumb]").forEach((button) => {
  button.addEventListener("click", () => {
    toast(button.dataset.crumb === "local" ? "Local root · /mnt/tank" : `${providerLabel()} root · ${providerRoot()}`);
  });
});

document.querySelector("[data-hidden-toggle]")?.addEventListener("change", (event) => {
  state.hidden = event.target.checked;
  renderAll();
});

document.querySelectorAll("[data-source-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    const side = button.dataset.sourcePanel;
    setSidePanel("source", side);
  });
});

document.querySelector("[data-side-close]")?.addEventListener("click", () => setSidePanel(null));

document.querySelector("[data-selection]")?.addEventListener("click", (event) => {
  if (event.target.closest("[data-found-at]")) revealSelected();
});
document.addEventListener("click", (event) => {
  const mini = event.target.closest("[data-mini-filter]");
  if (!mini) return;
  const side = mini.dataset.miniFilter;
  const status = mini.dataset.status;
  const filters = statusFilters(side);
  if (filters.has(status)) filters.delete(status);
  else filters.add(status);
  renderPane(side);
  renderStatusbar();
});

document.querySelectorAll("[data-legend-toggle]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleLegend();
  });
});

/* Dismiss the filter popover and legend when clicking outside their controls. */
document.addEventListener("click", (event) => {
  if (!event.target.closest(".osx-filter-wrap")) {
    document.querySelectorAll("[data-filter-pop]").forEach((pop) => (pop.hidden = true));
    document.querySelectorAll("[data-filter-toggle]").forEach((button) =>
      button.setAttribute("aria-expanded", "false"),
    );
  }
  if (!event.target.closest(".osx-legend") && !event.target.closest("[data-legend-toggle]")) {
    const legend = document.querySelector("[data-legend]");
    if (legend) {
      legend.hidden = true;
      state.legendOpen = false;
      document.querySelector("[data-legend-toggle]")?.setAttribute("aria-expanded", "false");
    }
  }
});
