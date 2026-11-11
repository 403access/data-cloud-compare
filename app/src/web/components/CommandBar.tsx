/** The ⌘K command bar: fuzzy commands plus a cross-pane file search. */

import { Fragment, useEffect, useRef, useState } from "react";
import { BASE, SEARCH_MIN } from "../lib/config";
import { COLUMN_DEFS } from "../lib/columns";
import { getJSON } from "../lib/api";
import { baseOf, entryType, fmtBytes, parentOf } from "../lib/format";
import { commandIcon, iconFor } from "../lib/icons";
import { counterpartTarget, statusLabel } from "../lib/status";
import type {
  Entry,
  ProviderInfo,
  Side,
  ThemeMode,
} from "../lib/types";
import type { PaneApi } from "../hooks/usePane";

interface CommandItem {
  kind: "command" | "file";
  key: string;
  group: string;
  groupIndex: number;
  seq?: number;
  title: string;
  subtitle: string;
  keywords?: string;
  icon?: string;
  iconHtml?: string;
  check?: boolean;
  aside?: string;
  entry?: Entry;
  side?: Side;
  run?: () => void | Promise<void>;
}

interface Props {
  open: boolean;
  panes: { local: PaneApi; remote: PaneApi };
  active: Side;
  provider: ProviderInfo;
  providers: ProviderInfo[];
  hidden: boolean;
  legendOpen: boolean;
  sidebarMode: string | null;
  themeMode: ThemeMode;
  themePanelOpen: boolean;
  waterEffects: boolean;
  columns: Set<string>;
  shortcut: string;
  onClose: () => void;
  onSetActive: (side: Side) => void;
  onSetHidden: (value: boolean) => void;
  onSetLegend: (open: boolean) => void;
  onOpenColumns: () => void;
  onCloseColumns: () => void;
  onOpenAnalytics: () => void;
  onCloseAnalytics: () => void;
  onOpenDetail: (side: Side, entry: Entry) => void;
  onReveal: (entry: Entry, side: Side) => void;
  onToggleColumn: (id: string, visible: boolean) => void;
  onResetColumns: () => void;
  onThemeMode: (mode: ThemeMode) => void;
  onThemePanel: (open: boolean) => void;
  onToggleWaterEffects: () => void;
  onProviderSwitch: (key: string) => void;
  onToast: (message: string) => void;
}

function fuzzyScore(text: string, query: string): number {
  const hay = String(text || "").toLowerCase();
  const needle = String(query || "").toLowerCase();
  if (!needle) return 0;
  if (!hay) return -1;
  const direct = hay.indexOf(needle);
  if (direct >= 0) {
    return 100 - Math.min(direct, 50) - Math.min(hay.length, 200) * 0.08;
  }
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

function scoreCommand(cmd: CommandItem, query: string): number {
  const title = fuzzyScore(cmd.title, query);
  const extra = Math.max(
    fuzzyScore(cmd.subtitle, query),
    fuzzyScore(cmd.keywords || "", query),
    fuzzyScore(cmd.group, query),
  );
  if (title < 0 && extra < 0) return -1;
  return (title < 0 ? 0 : title * 2) + (extra < 0 ? 0 : extra);
}

function focusPane(side: Side): void {
  document.querySelector<HTMLElement>(`#pane-${side} .vlist`)?.focus();
}

function rankCommandFiles(entries: Entry[], query: string): Entry[] {
  return entries
    .map((entry) => {
      const name = entry.name || baseOf(entry.path);
      const nameScore = fuzzyScore(name, query);
      const pathScore = Math.max(
        fuzzyScore(entry.parent || "", query),
        fuzzyScore(entry.path || "", query),
      );
      return {
        entry,
        score: nameScore >= 0 ? nameScore * 2 + Math.max(pathScore, 0) : pathScore,
      };
    })
    .filter((match) => match.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.entry.is_dir ? 1 : 0) - (a.entry.is_dir ? 1 : 0) ||
        (a.entry.name || "").localeCompare(b.entry.name || ""),
    )
    .slice(0, 24)
    .map((match) => match.entry);
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

export function CommandBar(props: Props) {
  const {
    open,
    panes,
    active,
    provider,
    providers,
    hidden,
    legendOpen,
    sidebarMode,
    themeMode,
    themePanelOpen,
    waterEffects,
    columns,
  } = props;

  const [mounted, setMounted] = useState(open);
  const [isOpen, setIsOpen] = useState(open);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [files, setFiles] = useState<{ local: Entry[]; remote: Entry[] }>({
    local: [],
    remote: [],
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);
  const lastFocus = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(true);
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    if (open) {
      lastFocus.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      setIsOpen(true);
      setQuery("");
      setIndex(0);
      setLoading(false);
      setFileError("");
      setFiles({ local: [], remote: [] });
      requestSeq.current += 1;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    } else {
      setIsOpen(false);
      const timer = setTimeout(() => {
        setMounted(false);
        if (!restoreFocus.current) return;
        const focused = document.activeElement as HTMLElement | null;
        const insideOverlay = focused?.closest("#command-overlay");
        if (!focused || focused === document.body || insideOverlay) {
          lastFocus.current?.focus?.({ preventScroll: true });
        }
      }, 160);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!isOpen) return;
    const el = document.getElementById(`command-option-${index}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [index, isOpen]);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const activePane = panes[active];
  const selected = activePane.selectedEntry();
  const providerLabel = provider.label || "remote";

  function commandCatalog(): CommandItem[] {
    const list: CommandItem[] = [];
    const groups = new Map<string, number>();
    let seq = 0;
    const add = (
      group: string,
      title: string,
      opts: Partial<CommandItem> & { run?: () => void | Promise<void> } = {},
    ) => {
      if (!groups.has(group)) groups.set(group, groups.size);
      list.push({
        kind: "command",
        key: `cmd:${opts.key || `${group}:${title}`}`,
        group,
        groupIndex: groups.get(group)!,
        seq: (seq += 1),
        title,
        subtitle: opts.subtitle || "",
        keywords: opts.keywords || "",
        icon: opts.icon || "settings",
        check: Boolean(opts.check),
        aside: opts.aside || "",
        run: opts.run || (() => {}),
      });
    };

    add("Navigation", "Focus local pane", {
      key: "focus-local",
      icon: "local",
      subtitle: "Move keyboard focus to the local index",
      keywords: "left side",
      run: () => {
        props.onSetActive("local");
        focusPane("local");
      },
    });
    add("Navigation", `Focus ${providerLabel} pane`, {
      key: "focus-remote",
      icon: "remote",
      subtitle: "Move keyboard focus to the remote snapshot",
      keywords: "right side cloud",
      run: () => {
        props.onSetActive("remote");
        focusPane("remote");
      },
    });
    add("Navigation", "Go to local root", {
      icon: "home",
      subtitle: BASE,
      keywords: "start home top",
      run: () => {
        props.onSetActive("local");
        void panes.local.navigate("");
      },
    });
    add("Navigation", `Go to ${providerLabel} root`, {
      icon: "home",
      subtitle: provider.root_label || "Archive",
      keywords: "start home top cloud",
      run: () => {
        props.onSetActive("remote");
        void panes.remote.navigate("");
      },
    });
    add("Navigation", "Go back", {
      icon: "back",
      subtitle: `${activePane.side === "local" ? "Local index" : providerLabel} · ${activePane.path || "/"}`,
      keywords: "history previous",
      run: () => activePane.back(),
    });
    add("Navigation", "Go forward", {
      icon: "forward",
      subtitle: `${activePane.side === "local" ? "Local index" : providerLabel} · ${activePane.path || "/"}`,
      keywords: "history next",
      run: () => activePane.forward(),
    });
    add("Navigation", "Go up one folder", {
      icon: "up",
      subtitle: activePane.path ? parentOf(activePane.path) || "/" : "Already at the root",
      keywords: "parent directory",
      run: () => activePane.up(),
    });
    add("Navigation", "Show this path in the other pane", {
      icon: "mirror",
      subtitle: `Mirror ${activePane.path || "/"}`,
      keywords: "same path compare",
      run: () => void activePane.mirror(),
    });
    if (selected) {
      add("Navigation", selected.is_dir ? "Open selected folder" : "Open selected item", {
        key: "open-selected",
        icon: selected.is_dir ? "local" : "remote",
        subtitle: selected.path,
        keywords: "enter selected",
        run: () => activePane.activate(selected),
      });
      if (counterpartTarget(selected, activePane.side)) {
        add("Navigation", "Reveal selected counterpart", {
          key: "reveal-selected",
          icon: "reveal",
          subtitle: counterpartTarget(selected, activePane.side) || "",
          keywords: "find other side match",
          run: () => props.onReveal(selected, activePane.side),
        });
      }
    }

    add("Search", "Search the active pane", {
      icon: "search",
      subtitle: "Focus the search field in the active pane",
      keywords: "find filter",
      run: () => {
        const input = document.querySelector<HTMLInputElement>(
          `#pane-${active} [data-role="search"]`,
        );
        input?.focus();
        input?.select();
      },
    });
    add("Search", "Search the local index", {
      icon: "search",
      subtitle: "Look for files and folders under /mnt/tank",
      keywords: "find local",
      run: () => {
        props.onSetActive("local");
        const input = document.querySelector<HTMLInputElement>(
          '#pane-local [data-role="search"]',
        );
        input?.focus();
        input?.select();
      },
    });
    add("Search", `Search ${providerLabel}`, {
      icon: "search",
      subtitle: "Look for files and folders in the remote snapshot",
      keywords: "find remote cloud",
      run: () => {
        props.onSetActive("remote");
        const input = document.querySelector<HTMLInputElement>(
          '#pane-remote [data-role="search"]',
        );
        input?.focus();
        input?.select();
      },
    });

    add("View", hidden ? "Hide dotfiles" : "Show dotfiles", {
      key: "toggle-hidden",
      icon: "hidden",
      subtitle: "Include files and folders whose names start with a dot",
      keywords: "hidden files visibility",
      check: hidden,
      run: () => props.onSetHidden(!hidden),
    });
    add("View", "Refresh the current folder", {
      icon: "reset",
      subtitle: `Reload ${activePane.side === "local" ? "the local index" : providerLabel} · ${activePane.path || "/"}`,
      keywords: "reload update",
      run: () => {
        if (activePane.searchMode && activePane.query) void activePane.runSearch(activePane.query);
        else void activePane.fetchList();
      },
    });
    add("View", legendOpen ? "Hide the legend" : "Show the legend", {
      key: "toggle-legend",
      icon: "legend",
      subtitle: "Explain the comparison status colours",
      keywords: "help key colours colors",
      check: legendOpen,
      run: () => props.onSetLegend(!legendOpen),
    });
    add("View", sidebarMode === "columns" ? "Close the columns sidebar" : "Open the columns sidebar", {
      key: "toggle-columns-panel",
      icon: "columns",
      subtitle: "Choose which table columns both panes show",
      keywords: "table layout settings",
      run: () => (sidebarMode === "columns" ? props.onCloseColumns() : props.onOpenColumns()),
    });
    add("View", sidebarMode === "analytics" ? "Close the analytics view" : "Open the analytics view", {
      key: "toggle-analytics-panel",
      icon: "analytics",
      subtitle: "Snapshot totals, local index entries, and coverage",
      keywords: "stats statistics metrics summary report numbers",
      run: () => (sidebarMode === "analytics" ? props.onCloseAnalytics() : props.onOpenAnalytics()),
    });
    if (selected) {
      add("View", "Show details for the selected item", {
        icon: "details",
        subtitle: selected.path,
        keywords: "inspector info selected",
        run: () => props.onOpenDetail(activePane.side, selected),
      });
    }

    COLUMN_DEFS.filter((col) => !col.required).forEach((col) => {
      const shown = columns.has(col.id);
      add("Columns", `Toggle the ${col.label} column`, {
        key: `column:${col.id}`,
        icon: "columns",
        subtitle: shown ? "Currently visible" : "Currently hidden",
        keywords: `columns table ${col.id}`,
        check: shown,
        run: () => props.onToggleColumn(col.id, !columns.has(col.id)),
      });
    });
    add("Columns", "Reset the columns", {
      icon: "reset",
      subtitle: "Show all columns again",
      keywords: "table layout default",
      run: () => props.onResetColumns(),
    });

    COLUMN_DEFS.forEach((col) => {
      add("Sort", `Sort by ${col.label}`, {
        key: `sort:${col.id}`,
        icon: "sort",
        subtitle:
          activePane.sort === col.id
            ? `Active · ${activePane.dir === "asc" ? "ascending" : "descending"} — choose again to reverse`
            : "Sort the active pane",
        keywords: `order ${col.id} column`,
        check: activePane.sort === col.id,
        aside:
          activePane.sort === col.id
            ? activePane.dir === "asc"
              ? "Asc"
              : "Desc"
            : "",
        run: () => activePane.setSort(col.id as any),
      });
    });

    activePane.statusFilterOptions().forEach((option) => {
      const on = activePane.statusFilters.has(option.value);
      add("Filters", `Filter: ${option.label}`, {
        key: `filter:${option.value}`,
        icon: "filter",
        subtitle: on ? "Currently filtered" : "Only show this status in the active pane",
        keywords: `status show only ${option.value}`,
        check: on,
        run: () => activePane.toggleStatusFilter(option.value),
      });
    });
    if (activePane.statusFilters.size) {
      add("Filters", "Clear status filters", {
        icon: "reset",
        subtitle: "Show every status in the active pane",
        keywords: "remove filter status all",
        run: () => activePane.clearStatusFilters(),
      });
    }

    const themeModes: Array<[ThemeMode, string, string]> = [
      ["system", "System", "Follow the operating system"],
      ["light", "Light", "Bright surfaces"],
      ["dark", "Dark", "Low-light surfaces"],
      ["water", "Water", "Animated water effects"],
    ];
    themeModes.forEach(([mode, label, hint]) => {
      add("Appearance", `Use the ${label} theme`, {
        key: `theme:${mode}`,
        icon: mode === "water" ? "water" : "theme",
        subtitle: hint,
        keywords: `appearance color colour ${mode}`,
        check: themeMode === mode,
        run: () => props.onThemeMode(mode),
      });
    });
    add("Appearance", themePanelOpen ? "Close water settings" : "Open water settings", {
      key: "toggle-water-panel",
      icon: "water",
      subtitle: "Tune the ripple, caustic, and current effects",
      keywords: "water settings theme",
      run: () => props.onThemePanel(!themePanelOpen),
    });
    add("Appearance", "Toggle water effects", {
      key: "toggle-water-effects",
      icon: "water",
      subtitle: "Ripples, drips, and shimmer when the Water theme is active",
      keywords: "water effects animation theme",
      check: waterEffects,
      run: () => props.onToggleWaterEffects(),
    });

    providers.forEach((info) => {
      if (!info.available) return;
      add("Provider", `Switch to ${info.label}`, {
        key: `provider:${info.key}`,
        icon: "provider",
        subtitle:
          provider.key === info.key
            ? `${info.root_label || "Archive"} · currently active`
            : `Right pane · ${info.root_label || "Archive"}`,
        keywords: `remote cloud ${info.key}`,
        check: provider.key === info.key,
        run: () => props.onProviderSwitch(info.key),
      });
    });

    return list;
  }

  function commandFileItems(entries: Entry[], side: Side): CommandItem[] {
    if (!entries.length) return [];
    const group = side === "local" ? "Local index" : provider.label || "Remote";
    const groupIndex = side === "local" ? 1000 : 1001;
    return entries.map((entry) => ({
      kind: "file",
      key: `file:${side}:${entry.path}`,
      group,
      groupIndex,
      title: entry.name || baseOf(entry.path),
      subtitle: `${statusLabel(entry, side, provider)} · ${
        entry.parent != null ? entry.parent || "/" : "/"
      }`,
      iconHtml: iconFor(entry),
      aside: entry.is_dir
        ? "Folder"
        : entry.size != null
          ? fmtBytes(entry.size)
          : entryType(entry),
      entry,
      side,
    }));
  }

  function buildCommandItems(currentQuery: string): {
    items: CommandItem[];
    raw: string;
    commandsOnly: boolean;
  } {
    const commandsOnly = currentQuery.startsWith(">");
    const raw = commandsOnly ? currentQuery.slice(1).trim() : currentQuery.trim();
    const commands = commandCatalog();
    let matches = commands;
    if (raw) {
      matches = commands
        .map((cmd) => ({ cmd, score: scoreCommand(cmd, raw) }))
        .filter((match) => match.score >= 0)
        .sort(
          (a, b) =>
            a.cmd.groupIndex - b.cmd.groupIndex ||
            b.score - a.score ||
            (a.cmd.seq || 0) - (b.cmd.seq || 0),
        )
        .map((match) => match.cmd);
    }
    const items = matches.slice();
    if (!commandsOnly && raw.length >= SEARCH_MIN) {
      items.push(...commandFileItems(files.local, "local"));
      items.push(...commandFileItems(files.remote, "remote"));
    }
    return { items, raw, commandsOnly };
  }

  const { items, raw, commandsOnly } = buildCommandItems(query);
  const showFileStatus = !commandsOnly && raw.length >= SEARCH_MIN;

  function close(restore = true): void {
    restoreFocus.current = restore;
    if (restore) lastFocus.current?.focus?.({ preventScroll: true });
    props.onClose();
  }

  function queryChanged(value: string): void {
    setQuery(value);
    setIndex(0);
    setLoading(false);
    setFileError("");
    setFiles({ local: [], remote: [] });
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const seq = ++requestSeq.current;
    const nextCommandsOnly = value.startsWith(">");
    const nextRaw = nextCommandsOnly ? value.slice(1).trim() : value.trim();
    if (nextCommandsOnly || nextRaw.length < SEARCH_MIN) return;
    setLoading(true);
    searchTimer.current = setTimeout(() => void searchFiles(nextRaw, seq), 180);
  }

  async function searchFiles(search: string, seq: number): Promise<void> {
    const url = (side: Side) =>
      `/api/search?side=${side}` +
      `&provider=${encodeURIComponent(provider.key)}` +
      `&q=${encodeURIComponent(search)}` +
      `&scope=all&path=` +
      `&hidden=${hidden ? 1 : 0}`;
    try {
      const [local, remote] = await Promise.allSettled([
        getJSON(url("local")),
        getJSON(url("remote")),
      ]);
      if (seq !== requestSeq.current) return;
      setFiles({
        local:
          local.status === "fulfilled"
            ? rankCommandFiles(local.value.entries || [], search)
            : [],
        remote:
          remote.status === "fulfilled"
            ? rankCommandFiles(remote.value.entries || [], search)
            : [],
      });
      setFileError(
        local.status === "rejected" && remote.status === "rejected"
          ? `File search failed: ${
              local.reason?.message || remote.reason?.message || "unknown error"
            }`
          : "",
      );
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }

  async function openCommandFile(item: CommandItem): Promise<void> {
    if (!item.side || !item.entry) return;
    close(false);
    const pane = panes[item.side];
    props.onSetActive(item.side);
    const entry = item.entry;
    if (entry.is_dir) await pane.navigate(entry.path);
    else {
      const parent = entry.parent != null ? entry.parent : parentOf(entry.path);
      await pane.navigate(parent, { select: entry.path });
    }
    focusPane(item.side);
  }

  function runItem(item: CommandItem | undefined): void {
    if (!item) return;
    if (item.kind === "file") {
      void openCommandFile(item);
      return;
    }
    close();
    try {
      const result = item.run?.();
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch((error) =>
          props.onToast((error as Error).message || String(error)),
        );
      }
    } catch (error) {
      props.onToast((error as Error).message || String(error));
    }
  }

  function moveSelection(delta: number): void {
    if (!items.length) return;
    setIndex((prev) => (prev + delta + items.length) % items.length);
  }

  if (!mounted) return null;

  let emptyTitle = "No matches";
  let emptyHint = "Try a different word or command.";
  if (query.startsWith(">")) {
    emptyTitle = "No command matches";
    emptyHint = "Remove the > to search files and folders too.";
  } else if (query.trim() && raw.length < SEARCH_MIN) {
    emptyTitle = `Type ${SEARCH_MIN - raw.length} more character${SEARCH_MIN - raw.length === 1 ? "" : "s"}`;
    emptyHint = "File and folder search starts after two characters.";
  } else if (loading) {
    emptyTitle = "Searching files and folders…";
    emptyHint = "Commands that match your text are shown above.";
  } else if (fileError && showFileStatus) {
    emptyTitle = "Could not search files";
    emptyHint = fileError;
  } else if (raw) {
    emptyTitle = `No matches for “${raw}”`;
  } else {
    emptyTitle = "No commands available";
    emptyHint = "Try again once the explorer has finished loading.";
  }

  let lastGroup: string | null = null;

  return (
    <div
      className={`command-overlay${isOpen ? " is-open" : ""}`}
      id="command-overlay"
      hidden={!mounted}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
          return;
        }
        if (event.key !== "Tab") return;
        const focusables = [inputRef.current, document.getElementById("command-close")].filter(
          (el): el is HTMLElement => Boolean(el) && !(el as HTMLButtonElement).disabled,
        );
        if (!focusables.length) return;
        event.preventDefault();
        const current = focusables.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey
          ? current <= 0
            ? focusables.length - 1
            : current - 1
          : (current + 1) % focusables.length;
        focusables[next].focus();
      }}
    >
      <div className="command-bar" role="dialog" aria-modal="true" aria-labelledby="command-heading">
        <h2 className="sr-only" id="command-heading">Command bar</h2>
        <div className="command-input-row">
          <svg className="command-input-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="8.8" cy="8.8" r="5.4" stroke="currentColor" strokeWidth="1.7" />
            <path d="m12.9 12.9 3.4 3.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input
            id="command-input"
            ref={inputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="command-results"
            placeholder="Search files and folders, or run a command…"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search files and folders or run a command"
            aria-activedescendant={items[index] ? `command-option-${index}` : undefined}
            value={query}
            onChange={(event) => queryChanged(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                moveSelection(1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                moveSelection(-1);
              } else if (event.key === "Home" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                setIndex(0);
              } else if (event.key === "End" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                setIndex(Math.max(0, items.length - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                runItem(items[index]);
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close();
              }
            }}
          />
          <span className="spinner command-spinner" id="command-loading" hidden={!loading} aria-hidden="true" />
          <button
            type="button"
            className="command-esc"
            id="command-close"
            title="Close command bar"
            aria-label="Close command bar"
            onClick={() => close()}
          >
            Esc
          </button>
        </div>
        <div
          className="command-results"
          id="command-results"
          role="listbox"
          aria-label="Commands and files"
          onMouseMove={(event) => {
            const row = (event.target as HTMLElement).closest(".command-item") as HTMLElement | null;
            if (!row) return;
            const next = Number(row.dataset.index);
            if (next !== index) setIndex(next);
          }}
          onClick={(event) => {
            const row = (event.target as HTMLElement).closest(".command-item") as HTMLElement | null;
            if (!row) return;
            const next = Number(row.dataset.index);
            setIndex(next);
            runItem(items[next]);
          }}
        >
          {items.map((item, itemIndex) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <Fragment key={item.key}>
                {showGroup ? (
                  <div className="command-group" role="presentation">
                    {item.group}
                  </div>
                ) : null}
                <div
                  className={`command-item${itemIndex === index ? " active" : ""}`}
                  id={`command-option-${itemIndex}`}
                  data-index={itemIndex}
                  role="option"
                  aria-selected={itemIndex === index}
                  title={item.kind === "file" ? item.entry?.path : item.subtitle || item.title}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <span
                    className="command-item-icon"
                    dangerouslySetInnerHTML={{
                      __html:
                        item.kind === "file"
                          ? item.iconHtml || ""
                          : commandIcon(item.icon || ""),
                    }}
                  />
                  <span className="command-item-main">
                    <span className="command-item-title">
                      {item.kind === "file" ? item.title : <Highlight text={item.title} query={raw} />}
                    </span>
                    {item.subtitle ? (
                      <span className="command-item-sub">
                        {item.kind === "file" ? (
                          <span className={`filter-dot st-${item.entry?.status || "unmatched"}`} />
                        ) : null}
                        {item.subtitle}
                      </span>
                    ) : null}
                  </span>
                  {item.aside ? <span className="command-item-aside">{item.aside}</span> : null}
                  {item.check ? (
                    <span
                      className="command-item-check"
                      title="Active"
                      dangerouslySetInnerHTML={{ __html: commandIcon("check") }}
                    />
                  ) : null}
                </div>
              </Fragment>
            );
          })}

          {showFileStatus && loading && items.length ? (
            <div className="command-note" role="presentation">
              <span className="spinner" />
              Searching files and folders…
            </div>
          ) : showFileStatus &&
            fileError &&
            items.length &&
            !files.local.length &&
            !files.remote.length ? (
            <div className="command-note" role="presentation">
              {fileError}
            </div>
          ) : null}
        </div>

        <div className="command-empty" id="command-empty" hidden={items.length > 0}>
          <p id="command-empty-title">{emptyTitle}</p>
          <span id="command-empty-hint">{emptyHint}</span>
        </div>

        <footer className="command-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> to move · <kbd>↵</kbd> to open
          </span>
          <span>
            <kbd>esc</kbd> to close · <kbd data-command-shortcut>{props.shortcut}</kbd> to toggle
          </span>
        </footer>
      </div>
    </div>
  );
}
