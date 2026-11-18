/* Aether OS — command catalog
   Builds the command bar inventory from the explorer, system apps, appearance,
   columns, sort, and filters, then merges fuzzy file matches. */

import {
  COLUMN_DEFS, DEFAULT_COLUMNS, PROVIDERS, STATUS_COLORS, THEME_LABELS,
  THEME_MODES, saveColumns, saveProvider, state,
} from "../core/state.js";
import { toast } from "../core/toast.js";
import {
  baseEntries, counterpartTarget, entryParent, filterOptions, iconHtml,
  providerLabel, providerRoot, selectedEntry, statusFilters, statusMeta,
} from "../explorer/model.js";
import {
  mirrorPanes, openSelected, renderAll, revealSelected,
  setActiveSide, setSidePanel, toggleLegend, toggleSidePanel,} from "../explorer/view.js";
import {
  closeWindow, isOpen, openWindow, windowById,
} from "./windows.js";
import { setThemeMode, setWaterSetting } from "../features/appearance.js";
import { batteryState, batteryTime } from "../apps/battery.js";
import {
  calendarAppSelected, calendarDayFormat, openCalendarApp,
} from "../apps/calendar.js";
import { connectedDeviceCount, devicesState, openDevices } from "../apps/devices.js";
import { networkState } from "../apps/network.js";
import { openTaskManager, taskTotals } from "../apps/task-manager.js";
import { STORAGE_FREE_GB } from "../apps/task-processes.js";

function fuzzyScore(text, query) {
  const hay = String(text || "").toLowerCase();
  const needle = String(query || "").toLowerCase();
  if (!needle) return 0;
  if (!hay) return -1;
  const direct = hay.indexOf(needle);
  if (direct >= 0) return 100 - Math.min(direct, 50) - Math.min(hay.length, 200) * 0.08;
  let pos = 0;
  let previous = -2;
  let streak = 0;
  let score = 0;
  for (const ch of needle) {
    const found = hay.indexOf(ch, pos);
    if (found < 0) return -1;
    streak = found === previous + 1 ? streak + 1 : 0;
    score += 4 + streak * 3 - Math.min(found - pos, 8);
    previous = found;
    pos = found + 1;
  }
  return score - Math.min(hay.length, 200) * 0.05;
}

function scoreCommand(item, query) {
  const title = fuzzyScore(item.title, query);
  const extra = Math.max(
    fuzzyScore(item.subtitle || "", query),
    fuzzyScore(item.keywords || "", query),
    fuzzyScore(item.group, query),
  );
  if (title < 0 && extra < 0) return -1;
  return (title < 0 ? 0 : title * 2) + (extra < 0 ? 0 : extra);
}

export function commandIcon(name) {
  const ids = {
    local: "i-local",
    remote: "i-cloud",
    home: "i-folder",
    back: "i-chevron-left",
    forward: "i-chevron-right",
    up: "i-chevron-up",
    mirror: "i-sync",
    search: "i-search",
    hidden: "i-file",
    legend: "i-info",
    keyboard: "i-keyboard",
    columns: "i-columns",
    analytics: "i-chart",
    details: "i-info",
    reset: "i-sync",
    sort: "i-sort",
    filter: "i-filter",
    theme: "i-sun",
    water: "i-drop",
    provider: "i-cloud",
    check: "i-check",
    settings: "i-gear",
    network: "i-globe",
    devices: "i-bluetooth",
    battery: "i-battery",
    calendar: "i-calendar",
    taskmanager: "i-activity",
  };
  return ids[name] || "i-command";
}

function addCommand(items, groups, group, title, opts = {}) {
  if (!groups.has(group)) groups.set(group, groups.size);
  items.push({
    kind: "command",
    key: `cmd:${opts.key || `${group}:${title}`}`,
    group,
    groupIndex: groups.get(group),
    seq: items.length,
    title,
    subtitle: opts.subtitle || "",
    keywords: opts.keywords || "",
    icon: opts.icon || "settings",
    check: Boolean(opts.check),
    aside: opts.aside || "",
    run: opts.run || (() => {}),
  });
}

function commandCatalog() {
  const items = [];
  const groups = new Map();
  const provider = providerLabel();
  const active = state.activeSide;
  const entry = selectedEntry();
  const target = entry ? counterpartTarget(entry, state.selected?.side) : null;

  addCommand(items, groups, "Navigation", "Focus local pane", {
    key: "focus-local",
    icon: "local",
    subtitle: "Move keyboard focus to the local index",
    keywords: "left side",
    run: () => {
      openWindow("explorer");
      setActiveSide("local");
      document.querySelector('[data-rows="local"]')?.focus();
    },
  });
  addCommand(items, groups, "Navigation", `Focus ${provider} pane`, {
    key: "focus-remote",
    icon: "remote",
    subtitle: "Move keyboard focus to the remote snapshot",
    keywords: "right side cloud",
    run: () => {
      openWindow("explorer");
      setActiveSide("remote");
      document.querySelector('[data-rows="remote"]')?.focus();
    },
  });
  addCommand(items, groups, "Navigation", "Go to local root", {
    icon: "home",
    subtitle: "/mnt/tank",
    keywords: "start home top",
    run: () => toast("Local root · /mnt/tank"),
  });
  addCommand(items, groups, "Navigation", `Go to ${provider} root`, {
    icon: "home",
    subtitle: providerRoot(),
    keywords: "start home top cloud",
    run: () => toast(`${provider} root · ${providerRoot()}`),
  });
  addCommand(items, groups, "Navigation", "Go back", {
    icon: "back",
    subtitle: `${active === "local" ? "Local index" : provider} · ${active === "local" ? "/mnt/tank" : providerRoot()}`,
    keywords: "history previous",
    run: () => toast("No history in this snapshot view", "warn"),
  });
  addCommand(items, groups, "Navigation", "Go forward", {
    icon: "forward",
    subtitle: `${active === "local" ? "Local index" : provider} · ${active === "local" ? "/mnt/tank" : providerRoot()}`,
    keywords: "history next",
    run: () => toast("No history in this snapshot view", "warn"),
  });
  addCommand(items, groups, "Navigation", "Go up one folder", {
    icon: "up",
    subtitle: "Already at the root",
    keywords: "parent directory",
    run: () => toast("Already at the snapshot root", "warn"),
  });
  addCommand(items, groups, "Navigation", "Show this path in the other pane", {
    icon: "mirror",
    subtitle: `Mirror ${active === "local" ? "/mnt/tank" : providerRoot()}`,
    keywords: "same path compare",
    run: mirrorPanes,
  });
  if (entry) {
    addCommand(items, groups, "Navigation", entry.isDir ? "Open selected folder" : "Open selected item", {
      key: "open-selected",
      icon: entry.isDir ? "local" : "remote",
      subtitle: entry.path,
      keywords: "enter selected",
      run: openSelected,
    });
    if (target) {
      addCommand(items, groups, "Navigation", "Reveal selected counterpart", {
        key: "reveal-selected",
        icon: "mirror",
        subtitle: target,
        keywords: "find other side match",
        run: revealSelected,
      });
    }
  }

  addCommand(items, groups, "Search", "Search the active pane", {
    icon: "search",
    subtitle: "Focus the search field in the active pane",
    keywords: "find filter",
    run: () => {
      openWindow("explorer");
      const input = document.querySelector(`[data-search="${active}"]`);
      input?.focus();
      input?.select();
    },
  });
  addCommand(items, groups, "Search", "Search the local index", {
    icon: "search",
    subtitle: "Look for files and folders under /mnt/tank",
    keywords: "find local",
    run: () => {
      openWindow("explorer");
      setActiveSide("local");
      const input = document.querySelector('[data-search="local"]');
      input?.focus();
      input?.select();
    },
  });
  addCommand(items, groups, "Search", `Search ${provider}`, {
    icon: "search",
    subtitle: "Look for files and folders in the remote snapshot",
    keywords: "find remote cloud",
    run: () => {
      openWindow("explorer");
      setActiveSide("remote");
      const input = document.querySelector('[data-search="remote"]');
      input?.focus();
      input?.select();
    },
  });

  addCommand(items, groups, "View", state.hidden ? "Hide dotfiles" : "Show dotfiles", {
    key: "toggle-hidden",
    icon: "hidden",
    subtitle: "Include files and folders whose names start with a dot",
    keywords: "hidden files visibility",
    check: state.hidden,
    run: () => {
      openWindow("explorer");
      state.hidden = !state.hidden;
      const input = document.querySelector("[data-hidden-toggle]");
      if (input) input.checked = state.hidden;
      renderAll();
    },
  });
  addCommand(items, groups, "View", "Refresh the current folder", {
    icon: "reset",
    subtitle: `Reload ${active === "local" ? "the local index" : provider}`,
    keywords: "reload update",
    run: () => toast(`Reloaded ${active === "local" ? "local index" : provider} snapshot`),
  });
  addCommand(items, groups, "View", state.legendOpen ? "Hide the legend" : "Show the legend", {
    key: "toggle-legend",
    icon: "legend",
    subtitle: "Explain the comparison status colours",
    keywords: "help key colours colors",
    check: state.legendOpen,
    run: () => {
      openWindow("explorer");
      toggleLegend();
    },
  });
  addCommand(items, groups, "View", "Open keyboard shortcuts", {
    key: "toggle-shortcuts-window",
    icon: "keyboard",
    subtitle: "Review the current key map",
    keywords: "shortcut cheat sheet keys bindings keyboard",
    run: () => openWindow("shortcuts"),
  });
  addCommand(items, groups, "View", state.sidePanel === "columns" ? "Close the columns sidebar" : "Open the columns sidebar", {
    key: "toggle-columns-panel",
    icon: "columns",
    subtitle: "Choose which table columns both panes show",
    keywords: "table layout settings",
    run: () => toggleSidePanel("columns"),
  });
  addCommand(items, groups, "View", state.sidePanel === "analytics" ? "Close the analytics view" : "Open the analytics view", {
    key: "toggle-analytics-panel",
    icon: "analytics",
    subtitle: "Snapshot totals, local index entries, and coverage",
    keywords: "stats statistics metrics summary report numbers",
    run: () => toggleSidePanel("analytics"),
  });
  if (entry) {
    addCommand(items, groups, "View", "Show details for the selected item", {
      icon: "details",
      subtitle: entry.path,
      keywords: "inspector info selected",
      run: () => setSidePanel("detail", state.selected.side, entry.name),
    });
  }

  COLUMN_DEFS.filter((col) => !col.required).forEach((col) => {
    const shown = state.columns.has(col.id);
    addCommand(items, groups, "Columns", `Toggle the ${col.label} column`, {
      key: `column:${col.id}`,
      icon: "columns",
      subtitle: shown ? "Currently visible" : "Currently hidden",
      keywords: `columns table ${col.id}`,
      check: shown,
      run: () => {
        if (state.columns.has(col.id)) state.columns.delete(col.id);
        else state.columns.add(col.id);
        state.columns.add("name");
        saveColumns();
        renderAll();
      },
    });
  });
  addCommand(items, groups, "Columns", "Reset the columns", {
    icon: "reset",
    subtitle: "Show all columns again",
    keywords: "table layout default",
    run: () => {
      state.columns = new Set(DEFAULT_COLUMNS);
      state.sizeMode = "bytes";
      saveColumns();
      renderAll();
    },
  });

  COLUMN_DEFS.forEach((col) => {
    const sort = state.sort[active];
    addCommand(items, groups, "Sort", `Sort by ${col.label}`, {
      key: `sort:${col.id}`,
      icon: "sort",
      subtitle:
        sort.id === col.id
          ? `Active · ${sort.dir === "asc" ? "ascending" : "descending"} — choose again to reverse`
          : "Sort the active pane",
      keywords: `order ${col.id} column`,
      check: sort.id === col.id,
      aside: sort.id === col.id ? (sort.dir === "asc" ? "Asc" : "Desc") : "",
      run: () => {
        if (sort.id === col.id) sort.dir = sort.dir === "asc" ? "desc" : "asc";
        else {
          sort.id = col.id;
          sort.dir = "asc";
        }
        renderAll();
      },
    });
  });

  filterOptions(active).forEach((option) => {
    const on = statusFilters(active).has(option.value);
    addCommand(items, groups, "Filters", `Filter: ${option.label}`, {
      key: `filter:${option.value}`,
      icon: "filter",
      subtitle: on ? "Currently filtered" : "Only show this status in the active pane",
      keywords: `status show only ${option.value}`,
      check: on,
      run: () => {
        const filters = statusFilters(active);
        if (filters.has(option.value)) filters.delete(option.value);
        else filters.add(option.value);
        renderAll();
      },
    });
  });
  if (statusFilters(active).size) {
    addCommand(items, groups, "Filters", "Clear status filters", {
      icon: "reset",
      subtitle: "Show every status in the active pane",
      keywords: "remove filter status all",
      run: () => {
        statusFilters(active).clear();
        renderAll();
      },
    });
  }

  THEME_MODES.forEach((mode) => {
    const hints = {
      system: "Follow the operating system",
      light: "Bright surfaces",
      dark: "Low-light surfaces",
      water: "Animated water effects",
    };
    addCommand(items, groups, "Appearance", `Use the ${THEME_LABELS[mode]} theme`, {
      key: `theme:${mode}`,
      icon: mode === "water" ? "water" : "theme",
      subtitle: hints[mode],
      keywords: `appearance color colour ${mode}`,
      check: state.themeMode === mode,
      run: () => setThemeMode(mode),
    });
  });
  const settingsWindow = windowById("settings");
  const settingsOpen = isOpen(settingsWindow);
  addCommand(items, groups, "Appearance", settingsOpen ? "Close water settings" : "Open water settings", {
    key: "toggle-water-panel",
    icon: "water",
    subtitle: "Tune the ripple, caustic, and current effects",
    keywords: "water settings theme",
    check: settingsOpen,
    run: () => {
      if (isOpen(settingsWindow)) closeWindow(settingsWindow);
      else openWindow("settings");
    },
  });
  addCommand(items, groups, "Appearance", "Toggle water effects", {
    key: "toggle-water-effects",
    icon: "water",
    subtitle: "Ripples, drips, and shimmer when the Water theme is active",
    keywords: "water effects animation theme",
    check: state.water.effects,
    run: () => setWaterSetting("effects", !state.water.effects),
  });

  addCommand(items, groups, "System", "Open Network", {
    key: "open-network",
    icon: "network",
    subtitle: networkState.wifi ? `Wi-Fi · ${networkState.connected}` : "Wi-Fi is off",
    keywords: "wifi wi-fi internet vpn network",
    run: () => openWindow("network"),
  });
  addCommand(items, groups, "System", "Open Devices", {
    key: "open-devices",
    icon: "devices",
    subtitle: devicesState.bluetooth
      ? `${connectedDeviceCount()} accessories · Bluetooth on`
      : "Bluetooth is off",
    keywords: "bluetooth wireless mouse keyboard accessories connect",
    run: () => openDevices(),
  });
  addCommand(items, groups, "System", "Open Battery", {
    key: "open-battery",
    icon: "battery",
    subtitle: `${batteryState.level}% · ${batteryTime()}`,
    keywords: "power energy charge battery",
    run: () => openWindow("battery"),
  });
  addCommand(items, groups, "System", "Open Calendar", {
    key: "open-calendar",
    icon: "calendar",
    subtitle: calendarDayFormat.format(calendarAppSelected),
    keywords: "date time month agenda events schedule",
    run: () => openCalendarApp(),
  });
  addCommand(items, groups, "System", "Open Task Manager", {
    key: "open-taskmanager",
    icon: "taskmanager",
    subtitle: `CPU ${Math.round(taskTotals().cpu)}% · Memory ${Math.round(taskTotals().memory)}% · ${STORAGE_FREE_GB} GB left`,
    keywords: "activity monitor processes cpu memory ram storage resources performance",
    run: () => openTaskManager(),
  });

  Object.values(PROVIDERS).forEach((info) => {
    addCommand(items, groups, "Provider", `Switch to ${info.label}`, {
      key: `provider:${info.key}`,
      icon: "provider",
      subtitle:
        state.provider === info.key
          ? `${info.root} · currently active`
          : `Right pane · ${info.root}`,
      keywords: `remote cloud ${info.key}`,
      check: state.provider === info.key,
      run: () => {
        if (state.provider === info.key) return;
        state.provider = info.key;
        saveProvider();
        renderAll();
        toast(`Remote provider · ${info.label}`);
      },
    });
  });

  return items;
}

function rankFiles(entries, query) {
  return entries
    .map((entry) => {
      const nameScore = fuzzyScore(entry.name, query);
      const pathScore = Math.max(fuzzyScore(entryParent(entry), query), fuzzyScore(entry.path, query));
      return { entry, score: nameScore >= 0 ? nameScore * 2 + Math.max(pathScore, 0) : pathScore };
    })
    .filter((match) => match.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.entry.isDir ? 1 : 0) - (a.entry.isDir ? 1 : 0) ||
        a.entry.name.localeCompare(b.entry.name),
    )
    .slice(0, 24)
    .map((match) => match.entry);
}

function fileItems(side, raw) {
  const group = side === "local" ? "Local index" : providerLabel();
  const groupIndex = side === "local" ? 1000 : 1001;
  return rankFiles(baseEntries(side), raw).map((entry) => {
    const status = statusMeta(entry, side);
    return {
      kind: "file",
      key: `file:${side}:${entry.path}`,
      group,
      groupIndex,
      seq: 0,
      title: entry.name,
      subtitle: `${status.label} · ${entryParent(entry)}`,
      icon: side === "local" ? "local" : "remote",
      iconHtml: iconHtml(entry),
      aside: entry.isDir ? "Folder" : entry.size || "—",
      statusColor: STATUS_COLORS[entry.status] || "var(--ds-gray)",
      entry,
      side,
    };
  });
}

export function buildCommandItems() {
  const query = state.command.query;
  const commandsOnly = query.startsWith(">");
  const raw = commandsOnly ? query.slice(1).trim() : query.trim();
  const commands = commandCatalog();
  let matches = commands;
  if (raw) {
    matches = commands
      .map((item) => ({ item, score: scoreCommand(item, raw) }))
      .filter((match) => match.score >= 0)
      .sort(
        (a, b) =>
          a.item.groupIndex - b.item.groupIndex ||
          b.score - a.score ||
          a.item.seq - b.item.seq,
      )
      .map((match) => match.item);
  }
  const items = matches.slice();
  if (!commandsOnly && raw.length >= 2) {
    items.push(...fileItems("local", raw));
    items.push(...fileItems("remote", raw));
  }
  return { items, raw, commandsOnly };
}
