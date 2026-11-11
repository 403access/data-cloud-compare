/* The ⌘K command bar: fuzzy commands plus a cross-pane file search. */

import { BASE, SEARCH_MIN } from './config.js';
import { COLUMN_DEFS } from './columns.js';
import { entryType, fmtBytes } from './format.js';
import { iconFor, svg } from './icons.js';
import { getJSON } from './net.js';
import { counterpartTarget, statusLabel } from './status.js';
import {
  currentProvider,
  panes,
  providerCatalog,
  state,
} from './store.js';
import { toast } from './toast.js';
import { baseOf, parentOf } from './util.js';
import {
  closeColumnsPanel,
  openColumnsPanel,
  resetColumns,
  setColumnVisibility,
} from './panels/columns-panel.js';
import {
  closeAnalyticsPanel,
  openAnalyticsPanel,
} from './panels/analytics-panel.js';
import { openDetailPanel } from './panels/detail.js';
import { revealCounterpart } from './panels/reveal.js';
import {
  refreshPane,
  setActive,
  setHidden,
  setLegendOpen,
} from './selection.js';
import { sidebarMode } from './sidebar.js';
import {
  applyThemeMode,
  applyWaterSettings,
  setThemePanelOpen,
  themePanelOpen,
  waterSettings,
} from './theme.js';
import { switchProvider } from './providers.js';

const COMMAND_ICONS = {
  local: svg(
    `<rect x="2.2" y="4" width="11.6" height="3.4" rx="1" stroke="currentColor" stroke-width="1.2"/>` +
    `<rect x="2.2" y="8.4" width="11.6" height="4.4" rx="1.2" stroke="currentColor" stroke-width="1.2"/>` +
    `<circle cx="4.2" cy="5.7" r=".6" fill="currentColor"/>`),
  remote: svg(
    `<path d="M8 2.5a4.2 4.2 0 0 1 4.1 3.5 3 3 0 0 1-.6 5.9H4.5a3.1 3.1 0 0 1-.6-6.1A4.2 4.2 0 0 1 8 2.5Z" stroke="currentColor" stroke-width="1.25"/>`),
  search: svg(
    `<circle cx="7.1" cy="7.1" r="4.2" stroke="currentColor" stroke-width="1.35"/>` +
    `<path d="m10.3 10.3 3 3" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>`),
  home: svg(
    `<path d="M2.6 7.4 8 2.7l5.4 4.7v6H9.8V9.6H6.2v3.8H2.6v-6Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>`),
  back: svg(
    `<path d="m9.6 3.6-4.2 4.4 4.2 4.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`),
  forward: svg(
    `<path d="m6.4 3.6 4.2 4.4-4.2 4.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`),
  up: svg(
    `<path d="M8 13V3.6M3.9 7.7 8 3.6l4.1 4.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`),
  mirror: svg(
    `<path d="M2.4 5.8h8.3M8.7 3.3l2.5 2.5-2.5 2.5M13.6 10.2H5.3m2 2.5-2.5-2.5 2.5-2.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>`),
  reveal: svg(
    `<path d="M1.8 8s2.3-4.1 6.2-4.1S14.2 8 14.2 8s-2.3 4.1-6.2 4.1S1.8 8 1.8 8Z" stroke="currentColor" stroke-width="1.25"/>` +
    `<circle cx="8" cy="8" r="1.8" stroke="currentColor" stroke-width="1.2"/>`),
  hidden: svg(
    `<path d="M1.8 8s2.3-4.1 6.2-4.1S14.2 8 14.2 8s-2.3 4.1-6.2 4.1S1.8 8 1.8 8Z" stroke="currentColor" stroke-width="1.25"/>` +
    `<circle cx="8" cy="8" r="1.8" fill="currentColor" opacity=".7"/>`),
  columns: svg(
    `<rect x="2" y="2.7" width="12" height="10.6" rx="1.4" stroke="currentColor" stroke-width="1.25"/>` +
    `<path d="M5.8 2.9v10.2M9.6 2.9v10.2" stroke="currentColor" stroke-width="1.05"/>`),
  legend: svg(
    `<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3"/>` +
    `<path d="M8 7.3v3.4M8 5.1v.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`),
  sort: svg(
    `<path d="M3.7 3.1v9.4M2 10.8l1.7 1.7 1.7-1.7M8.2 4.1h5.3M9.3 7.1h4.2M10.6 10.1h2.9" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>`),
  filter: svg(
    `<path d="M2.4 3.2h11.2L9.3 8.3v4.2L6.8 14V8.3L2.4 3.2Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>`),
  theme: svg(
    `<circle cx="8" cy="8" r="2.7" stroke="currentColor" stroke-width="1.25"/>` +
    `<path d="M8 1.7v1.5M8 12.8v1.5M1.7 8h1.5M12.8 8h1.5M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`),
  water: svg(
    `<path d="M8 2.1S3.9 6.4 3.9 9.3a4.1 4.1 0 0 0 8.2 0C12.1 6.4 8 2.1 8 2.1Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M6.2 9.5a1.9 1.9 0 0 0 1.8 1.7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity=".65"/>`),
  provider: svg(
    `<path d="M8 2.5a4.2 4.2 0 0 1 4.1 3.5 3 3 0 0 1-.6 5.9H4.5a3.1 3.1 0 0 1-.6-6.1A4.2 4.2 0 0 1 8 2.5Z" stroke="currentColor" stroke-width="1.25"/>` +
    `<path d="M8 6.1v4.2M6.2 8.4 8 10.2l1.8-1.8" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>`),
  details: svg(
    `<rect x="2.3" y="2.7" width="11.4" height="10.6" rx="1.4" stroke="currentColor" stroke-width="1.25"/>` +
    `<path d="M8 5.3v3.2M8 10.6v.1" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>`),
  analytics: svg(
    `<path d="M2.8 13.4V8.2M6.4 13.4V4.1M10 13.4v-3.6M13.6 13.4V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>` +
    `<path d="M2 13.9h12.2" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>`),
  reset: svg(
    `<path d="M13.2 8a5.2 5.2 0 1 1-1.5-3.7M13.1 2.6v3.1H10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`),
  settings: svg(
    `<circle cx="8" cy="8" r="1.9" stroke="currentColor" stroke-width="1.2"/>` +
    `<path d="M8 1.9v1.4M8 12.7v1.4M1.9 8h1.4M12.7 8h1.4M3.7 3.7l1 1M11.3 11.3l1 1M12.3 3.7l-1 1M4.7 11.3l-1 1" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"/>`),
  check: svg(
    `<path d="m3.2 8.2 3.1 3.1 6.5-6.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`),
};

function commandIcon(name) {
  return COMMAND_ICONS[name] || COMMAND_ICONS.settings;
}

export const commandState = {
  open: false,
  query: '',
  index: 0,
  items: [],
  loading: false,
  fileError: '',
  requestSeq: 0,
  searchTimer: null,
  hideTimer: null,
  files: { local: [], remote: [] },
  lastFocus: null,
};

function fuzzyScore(text, query) {
  const hay = String(text || '').toLowerCase();
  const needle = String(query || '').toLowerCase();
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

function scoreCommand(cmd, query) {
  const title = fuzzyScore(cmd.title, query);
  const extra = Math.max(
    fuzzyScore(cmd.subtitle, query),
    fuzzyScore(cmd.keywords, query),
    fuzzyScore(cmd.group, query),
  );
  if (title < 0 && extra < 0) return -1;
  return (title < 0 ? 0 : title * 2) + (extra < 0 ? 0 : extra);
}

function commandCatalog() {
  const active = panes[state.active];
  const provider = currentProvider();
  const providerLabel = provider.label || 'remote';
  const selected = active ? active.selectedEntry() : null;
  const list = [];
  const groups = new Map();
  let seq = 0;

  const add = (group, title, opts = {}) => {
    if (!groups.has(group)) groups.set(group, groups.size);
    list.push({
      kind: 'command',
      key: `cmd:${opts.id || `${group}:${title}`}`,
      group,
      groupIndex: groups.get(group),
      seq: seq += 1,
      title,
      subtitle: opts.subtitle || '',
      keywords: opts.keywords || '',
      icon: opts.icon || 'settings',
      check: Boolean(opts.check),
      aside: opts.aside || '',
      run: opts.run || (() => {}),
    });
  };

  // Navigation
  add('Navigation', 'Focus local pane', {
    id: 'focus-local',
    icon: 'local',
    subtitle: 'Move keyboard focus to the local index',
    keywords: 'left side',
    run: () => { setActive('local'); panes.local.list.focus(); },
  });
  add('Navigation', `Focus ${providerLabel} pane`, {
    id: 'focus-remote',
    icon: 'remote',
    subtitle: 'Move keyboard focus to the remote snapshot',
    keywords: 'right side cloud',
    run: () => { setActive('remote'); panes.remote.list.focus(); },
  });
  add('Navigation', 'Go to local root', {
    icon: 'home',
    subtitle: BASE,
    keywords: 'start home top',
    run: () => { setActive('local'); panes.local.navigate(''); },
  });
  add('Navigation', `Go to ${providerLabel} root`, {
    icon: 'home',
    subtitle: provider.root_label || 'Archive',
    keywords: 'start home top cloud',
    run: () => { setActive('remote'); panes.remote.navigate(''); },
  });
  add('Navigation', 'Go back', {
    icon: 'back',
    subtitle: `${active.side === 'local' ? 'Local index' : providerLabel} · ${active.path || '/'}`,
    keywords: 'history previous',
    run: () => active.back(),
  });
  add('Navigation', 'Go forward', {
    icon: 'forward',
    subtitle: `${active.side === 'local' ? 'Local index' : providerLabel} · ${active.path || '/'}`,
    keywords: 'history next',
    run: () => active.forward(),
  });
  add('Navigation', 'Go up one folder', {
    icon: 'up',
    subtitle: active.path ? parentOf(active.path) || '/' : 'Already at the root',
    keywords: 'parent directory',
    run: () => active.up(),
  });
  add('Navigation', 'Show this path in the other pane', {
    icon: 'mirror',
    subtitle: `Mirror ${active.path || '/'}`,
    keywords: 'same path compare',
    run: () => active.mirror(),
  });
  if (selected) {
    add('Navigation', selected.is_dir ? 'Open selected folder' : 'Open selected item', {
      id: 'open-selected',
      icon: selected.is_dir ? 'local' : 'remote',
      subtitle: selected.path,
      keywords: 'enter selected',
      run: () => active.activate(selected),
    });
    if (counterpartTarget(selected, active.side)) {
      add('Navigation', 'Reveal selected counterpart', {
        id: 'reveal-selected',
        icon: 'reveal',
        subtitle: counterpartTarget(selected, active.side),
        keywords: 'find other side match',
        run: () => revealCounterpart(selected, active.side),
      });
    }
  }

  // Search
  add('Search', 'Search the active pane', {
    icon: 'search',
    subtitle: 'Focus the search field in the active pane',
    keywords: 'find filter',
    run: () => {
      const pane = panes[state.active];
      pane.searchInput.focus();
      pane.searchInput.select();
    },
  });
  add('Search', 'Search the local index', {
    icon: 'search',
    subtitle: 'Look for files and folders under /mnt/tank',
    keywords: 'find local',
    run: () => {
      setActive('local');
      panes.local.searchInput.focus();
      panes.local.searchInput.select();
    },
  });
  add('Search', `Search ${providerLabel}`, {
    icon: 'search',
    subtitle: 'Look for files and folders in the remote snapshot',
    keywords: 'find remote cloud',
    run: () => {
      setActive('remote');
      panes.remote.searchInput.focus();
      panes.remote.searchInput.select();
    },
  });

  // View
  add('View', state.hidden ? 'Hide dotfiles' : 'Show dotfiles', {
    id: 'toggle-hidden',
    icon: 'hidden',
    subtitle: 'Include files and folders whose names start with a dot',
    keywords: 'hidden files visibility',
    check: state.hidden,
    run: () => setHidden(!state.hidden),
  });
  add('View', 'Refresh the current folder', {
    icon: 'reset',
    subtitle: `Reload ${active.side === 'local' ? 'the local index' : providerLabel} · ${active.path || '/'}`,
    keywords: 'reload update',
    run: () => refreshPane(active),
  });
  add('View', document.getElementById('legend')?.hidden ? 'Show the legend' : 'Hide the legend', {
    id: 'toggle-legend',
    icon: 'legend',
    subtitle: 'Explain the comparison status colours',
    keywords: 'help key colours colors',
    check: !(document.getElementById('legend')?.hidden),
    run: () => setLegendOpen(Boolean(document.getElementById('legend')?.hidden)),
  });
  add('View', sidebarMode === 'columns' ? 'Close the columns sidebar' : 'Open the columns sidebar', {
    id: 'toggle-columns-panel',
    icon: 'columns',
    subtitle: 'Choose which table columns both panes show',
    keywords: 'table layout settings',
    run: () => (sidebarMode === 'columns' ? closeColumnsPanel() : openColumnsPanel()),
  });
  add('View', sidebarMode === 'analytics' ? 'Close the analytics view' : 'Open the analytics view', {
    id: 'toggle-analytics-panel',
    icon: 'analytics',
    subtitle: 'Snapshot totals, local index entries, and coverage',
    keywords: 'stats statistics metrics summary report numbers',
    run: () => (sidebarMode === 'analytics' ? closeAnalyticsPanel() : openAnalyticsPanel()),
  });
  if (selected) {
    add('View', 'Show details for the selected item', {
      icon: 'details',
      subtitle: selected.path,
      keywords: 'inspector info selected',
      run: () => openDetailPanel(active, selected),
    });
  }

  // Columns
  COLUMN_DEFS.filter(col => !col.required).forEach(col => {
    const shown = state.columns.has(col.id);
    add('Columns', `Toggle the ${col.label} column`, {
      id: `column:${col.id}`,
      icon: 'columns',
      subtitle: shown ? 'Currently visible' : 'Currently hidden',
      keywords: `columns table ${col.id}`,
      check: shown,
      run: () => setColumnVisibility(col.id, !state.columns.has(col.id)),
    });
  });
  add('Columns', 'Reset the columns', {
    icon: 'reset',
    subtitle: 'Show all columns again',
    keywords: 'table layout default',
    run: () => resetColumns(),
  });

  // Sort
  COLUMN_DEFS.forEach(col => {
    add('Sort', `Sort by ${col.label}`, {
      id: `sort:${col.id}`,
      icon: 'sort',
      subtitle: active.sort === col.id
        ? `Active · ${active.dir === 'asc' ? 'ascending' : 'descending'} — choose again to reverse`
        : 'Sort the active pane',
      keywords: `order ${col.id} column`,
      check: active.sort === col.id,
      aside: active.sort === col.id ? (active.dir === 'asc' ? 'Asc' : 'Desc') : '',
      run: () => active.setSort(col.id),
    });
  });

  // Status filters
  active.statusFilterOptions().forEach(option => {
    const on = active.statusFilters.has(option.value);
    add('Filters', `Filter: ${option.label}`, {
      id: `filter:${option.value}`,
      icon: 'filter',
      subtitle: on ? 'Currently filtered' : 'Only show this status in the active pane',
      keywords: `status show only ${option.value}`,
      check: on,
      run: () => active.toggleStatusFilter(option.value),
    });
  });
  if (active.statusFilters.size) {
    add('Filters', 'Clear status filters', {
      icon: 'reset',
      subtitle: 'Show every status in the active pane',
      keywords: 'remove filter status all',
      run: () => active.clearStatusFilters(),
    });
  }

  // Appearance
  const themeMode = document.documentElement.dataset.theme || 'system';
  [
    ['system', 'System', 'Follow the operating system'],
    ['light', 'Light', 'Bright surfaces'],
    ['dark', 'Dark', 'Low-light surfaces'],
    ['water', 'Water', 'Animated water effects'],
  ].forEach(([mode, label, hint]) => {
    add('Appearance', `Use the ${label} theme`, {
      id: `theme:${mode}`,
      icon: mode === 'water' ? 'water' : 'theme',
      subtitle: hint,
      keywords: `appearance color colour ${mode}`,
      check: themeMode === mode,
      run: () => applyThemeMode(mode),
    });
  });
  add('Appearance', themePanelOpen ? 'Close water settings' : 'Open water settings', {
    id: 'toggle-water-panel',
    icon: 'water',
    subtitle: 'Tune the ripple, caustic, and current effects',
    keywords: 'water settings theme',
    run: () => setThemePanelOpen(!themePanelOpen),
  });
  add('Appearance', 'Toggle water effects', {
    id: 'toggle-water-effects',
    icon: 'water',
    subtitle: 'Ripples, drips, and shimmer when the Water theme is active',
    keywords: 'water effects animation theme',
    check: waterSettings.effects,
    run: () => {
      waterSettings.effects = !waterSettings.effects;
      applyWaterSettings({ persist: true });
    },
  });

  // Providers
  providerCatalog.list.forEach(info => {
    if (!info.available) return;
    add('Provider', `Switch to ${info.label}`, {
      id: `provider:${info.key}`,
      icon: 'provider',
      subtitle: state.provider === info.key
        ? `${info.root_label || 'Archive'} · currently active`
        : `Right pane · ${info.root_label || 'Archive'}`,
      keywords: `remote cloud ${info.key}`,
      check: state.provider === info.key,
      run: () => switchProvider(info.key),
    });
  });

  return list;
}

function commandFileItems(entries, side) {
  if (!entries.length) return [];
  const provider = currentProvider();
  const group = side === 'local' ? 'Local index' : (provider.label || 'Remote');
  const groupIndex = side === 'local' ? 1000 : 1001;
  return entries.map(entry => ({
    kind: 'file',
    key: `file:${side}:${entry.path}`,
    group,
    groupIndex,
    title: entry.name || baseOf(entry.path),
    subtitle: `${statusLabel(entry, side)} · ${entry.parent != null ? entry.parent || '/' : '/'}`,
    iconHtml: iconFor(entry),
    aside: entry.is_dir
      ? 'Folder'
      : (entry.size != null ? fmtBytes(entry.size) : entryType(entry)),
    entry,
    side,
  }));
}

function buildCommandItems(query) {
  const commandsOnly = query.startsWith('>');
  const raw = commandsOnly ? query.slice(1).trim() : query.trim();
  const commands = commandCatalog();
  let matches = commands;

  if (raw) {
    matches = commands
      .map(cmd => ({ cmd, score: scoreCommand(cmd, raw) }))
      .filter(match => match.score >= 0)
      .sort((a, b) =>
        a.cmd.groupIndex - b.cmd.groupIndex ||
        b.score - a.score ||
        a.cmd.seq - b.cmd.seq)
      .map(match => match.cmd);
  }

  const items = matches.slice();
  if (!commandsOnly && raw.length >= SEARCH_MIN) {
    items.push(...commandFileItems(commandState.files.local, 'local'));
    items.push(...commandFileItems(commandState.files.remote, 'remote'));
  }
  return { items, raw, commandsOnly };
}

function appendCommandHighlight(el, text, query) {
  if (!query) {
    el.textContent = text;
    return;
  }
  const hay = text.toLowerCase();
  const needle = query.toLowerCase();
  const index = hay.indexOf(needle);
  if (index < 0) {
    el.textContent = text;
    return;
  }
  if (index > 0) el.append(text.slice(0, index));
  const mark = document.createElement('mark');
  mark.textContent = text.slice(index, index + needle.length);
  el.append(mark);
  if (index + needle.length < text.length) {
    el.append(text.slice(index + needle.length));
  }
}

function buildCommandItem(item, index, query) {
  const row = document.createElement('div');
  row.className = 'command-item';
  row.id = `command-option-${index}`;
  row.dataset.index = String(index);
  row.setAttribute('role', 'option');
  row.setAttribute('aria-selected', 'false');
  row.title = item.kind === 'file' ? item.entry.path : (item.subtitle || item.title);

  const icon = document.createElement('span');
  icon.className = 'command-item-icon';
  if (item.kind === 'file') icon.innerHTML = item.iconHtml; // static icon markup only
  else icon.innerHTML = commandIcon(item.icon); // static icon markup only

  const main = document.createElement('span');
  main.className = 'command-item-main';
  const title = document.createElement('span');
  title.className = 'command-item-title';
  if (item.kind === 'file') title.textContent = item.title;
  else appendCommandHighlight(title, item.title, query);
  main.append(title);

  if (item.subtitle) {
    const sub = document.createElement('span');
    sub.className = 'command-item-sub';
    if (item.kind === 'file') {
      const dot = document.createElement('span');
      dot.className = `filter-dot st-${item.entry.status || 'unmatched'}`;
      sub.append(dot);
    }
    sub.append(document.createTextNode(item.subtitle));
    main.append(sub);
  }

  row.append(icon, main);

  if (item.aside) {
    const aside = document.createElement('span');
    aside.className = 'command-item-aside';
    aside.textContent = item.aside;
    row.append(aside);
  }
  if (item.check) {
    const check = document.createElement('span');
    check.className = 'command-item-check';
    check.innerHTML = commandIcon('check'); // static icon markup only
    check.title = 'Active';
    row.append(check);
  }

  row.addEventListener('mousedown', ev => ev.preventDefault());
  return row;
}

function syncCommandSelection(scroll = true) {
  const input = document.getElementById('command-input');
  const results = document.getElementById('command-results');
  if (!input || !results) return;
  const options = results.querySelectorAll('.command-item');
  let active = null;
  options.forEach(option => {
    const isActive = Number(option.dataset.index) === commandState.index;
    option.classList.toggle('active', isActive);
    option.setAttribute('aria-selected', String(isActive));
    if (isActive) active = option;
  });
  if (active) {
    input.setAttribute('aria-activedescendant', active.id);
    if (scroll) active.scrollIntoView({ block: 'nearest' });
  } else {
    input.removeAttribute('aria-activedescendant');
  }
}

function renderCommandPalette() {
  const results = document.getElementById('command-results');
  const empty = document.getElementById('command-empty');
  const emptyTitle = document.getElementById('command-empty-title');
  const emptyHint = document.getElementById('command-empty-hint');
  const loadingEl = document.getElementById('command-loading');
  if (!results || !empty || !emptyTitle || !emptyHint) return;

  const { items, raw, commandsOnly } = buildCommandItems(commandState.query);
  const previous = commandState.items[commandState.index];
  const previousKey = previous ? previous.key : null;
  commandState.items = items;

  if (previousKey) {
    const found = items.findIndex(item => item.key === previousKey);
    commandState.index = found >= 0 ? found : Math.min(commandState.index, items.length - 1);
  } else {
    commandState.index = Math.min(commandState.index, items.length - 1);
  }
  if (commandState.index < 0) commandState.index = 0;

  const frag = document.createDocumentFragment();
  let lastGroup = null;
  items.forEach((item, index) => {
    if (item.group !== lastGroup) {
      lastGroup = item.group;
      const head = document.createElement('div');
      head.className = 'command-group';
      head.setAttribute('role', 'presentation');
      head.textContent = item.group;
      frag.append(head);
    }
    frag.append(buildCommandItem(item, index, raw));
  });

  const showFileStatus = !commandsOnly && raw.length >= SEARCH_MIN;
  if (showFileStatus && commandState.loading && items.length) {
    const note = document.createElement('div');
    note.className = 'command-note';
    note.setAttribute('role', 'presentation');
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    note.append(spinner, document.createTextNode('Searching files and folders…'));
    frag.append(note);
  } else if (showFileStatus && commandState.fileError && items.length &&
      !commandState.files.local.length && !commandState.files.remote.length) {
    const note = document.createElement('div');
    note.className = 'command-note';
    note.setAttribute('role', 'presentation');
    note.textContent = commandState.fileError;
    frag.append(note);
  }

  results.replaceChildren(frag);
  if (loadingEl) loadingEl.hidden = !commandState.loading;

  empty.hidden = items.length > 0;
  if (!items.length) {
    let title = 'No matches';
    let hint = 'Try a different word or command.';
    if (commandState.query.startsWith('>')) {
      title = 'No command matches';
      hint = 'Remove the > to search files and folders too.';
    } else if (commandState.query.trim() && raw.length < SEARCH_MIN) {
      title = `Type ${SEARCH_MIN - raw.length} more character${SEARCH_MIN - raw.length === 1 ? '' : 's'}`;
      hint = 'File and folder search starts after two characters.';
    } else if (commandState.loading) {
      title = 'Searching files and folders…';
      hint = 'Commands that match your text are shown above.';
    } else if (commandState.fileError && showFileStatus) {
      title = 'Could not search files';
      hint = commandState.fileError;
    } else if (raw) {
      title = `No matches for “${raw}”`;
    } else {
      title = 'No commands available';
      hint = 'Try again once the explorer has finished loading.';
    }
    emptyTitle.textContent = title;
    emptyHint.textContent = hint;
  }

  syncCommandSelection(false);
}

function commandSearchUrl(side, query) {
  return `/api/search?side=${side}` +
    `&provider=${encodeURIComponent(state.provider)}` +
    `&q=${encodeURIComponent(query)}` +
    `&scope=all&path=` +
    `&hidden=${state.hidden ? 1 : 0}`;
}

function rankCommandFiles(entries, query) {
  return entries
    .map(entry => {
      const name = entry.name || baseOf(entry.path);
      const nameScore = fuzzyScore(name, query);
      const pathScore = Math.max(
        fuzzyScore(entry.parent || '', query),
        fuzzyScore(entry.path || '', query),
      );
      return {
        entry,
        score: nameScore >= 0 ? nameScore * 2 + Math.max(pathScore, 0) : pathScore,
      };
    })
    .filter(match => match.score >= 0)
    .sort((a, b) =>
      b.score - a.score ||
      (b.entry.is_dir ? 1 : 0) - (a.entry.is_dir ? 1 : 0) ||
      (a.entry.name || '').localeCompare(b.entry.name || ''))
    .slice(0, 24)
    .map(match => match.entry);
}

async function searchCommandFiles(query) {
  const seq = ++commandState.requestSeq;
  try {
    const [local, remote] = await Promise.allSettled([
      getJSON(commandSearchUrl('local', query)),
      getJSON(commandSearchUrl('remote', query)),
    ]);
    if (seq !== commandState.requestSeq || !commandState.open) return;
    commandState.files.local = local.status === 'fulfilled'
      ? rankCommandFiles(local.value.entries || [], query)
      : [];
    commandState.files.remote = remote.status === 'fulfilled'
      ? rankCommandFiles(remote.value.entries || [], query)
      : [];
    commandState.fileError = local.status === 'rejected' && remote.status === 'rejected'
      ? `File search failed: ${local.reason?.message || remote.reason?.message || 'unknown error'}`
      : '';
  } finally {
    if (seq === commandState.requestSeq && commandState.open) {
      commandState.loading = false;
      const loadingEl = document.getElementById('command-loading');
      if (loadingEl) loadingEl.hidden = true;
      renderCommandPalette();
    }
  }
}

function scheduleCommandSearch() {
  clearTimeout(commandState.searchTimer);
  const query = commandState.query;
  const commandsOnly = query.startsWith('>');
  const raw = commandsOnly ? query.slice(1).trim() : query.trim();

  commandState.requestSeq += 1;
  commandState.files = { local: [], remote: [] };
  commandState.fileError = '';

  if (commandsOnly || raw.length < SEARCH_MIN) {
    commandState.loading = false;
    renderCommandPalette();
    return;
  }

  commandState.loading = true;
  const searchSeq = commandState.requestSeq;
  renderCommandPalette();
  commandState.searchTimer = setTimeout(() => {
    if (searchSeq !== commandState.requestSeq || !commandState.open) return;
    searchCommandFiles(raw);
  }, 180);
}

function commandQueryChanged() {
  const input = document.getElementById('command-input');
  if (!input) return;
  commandState.query = input.value;
  commandState.index = 0;
  commandState.items = [];
  scheduleCommandSearch();
}

async function openCommandFile(item) {
  closeCommandBar({ restoreFocus: false });
  const pane = panes[item.side];
  if (!pane) return;
  setActive(item.side);
  const entry = item.entry;
  if (entry.is_dir) {
    await pane.navigate(entry.path);
  } else {
    const parent = entry.parent != null ? entry.parent : parentOf(entry.path);
    await pane.navigate(parent, { select: entry.path });
  }
  pane.list.focus({ preventScroll: true });
}

function runCommandItem(item) {
  if (!item) return;
  if (item.kind === 'file') {
    openCommandFile(item);
    return;
  }
  closeCommandBar();
  try {
    const result = item.run();
    if (result && typeof result.catch === 'function') {
      result.catch(err => toast(err.message || String(err)));
    }
  } catch (err) {
    toast(err.message || String(err));
  }
}

function moveCommandSelection(delta) {
  if (!commandState.items.length) return;
  const count = commandState.items.length;
  commandState.index = (commandState.index + delta + count) % count;
  syncCommandSelection();
}

export function openCommandBar() {
  const overlay = document.getElementById('command-overlay');
  const input = document.getElementById('command-input');
  const trigger = document.getElementById('command-open');
  if (!overlay || !input) return;
  clearTimeout(commandState.hideTimer);
  if (commandState.open) {
    input.focus();
    input.select();
    return;
  }
  commandState.lastFocus = document.activeElement;
  commandState.open = true;
  commandState.query = '';
  commandState.index = 0;
  commandState.items = [];
  commandState.files = { local: [], remote: [] };
  commandState.loading = false;
  commandState.fileError = '';
  clearTimeout(commandState.searchTimer);
  commandState.requestSeq += 1;
  input.value = '';
  overlay.hidden = false;
  overlay.classList.add('is-open');
  if (trigger) trigger.setAttribute('aria-expanded', 'true');
  renderCommandPalette();
  requestAnimationFrame(() => input.focus());
}

export function closeCommandBar({ restoreFocus = true } = {}) {
  if (!commandState.open) return;
  commandState.open = false;
  clearTimeout(commandState.searchTimer);
  commandState.requestSeq += 1;
  commandState.loading = false;
  const overlay = document.getElementById('command-overlay');
  const trigger = document.getElementById('command-open');
  if (overlay) {
    overlay.classList.remove('is-open');
    clearTimeout(commandState.hideTimer);
    commandState.hideTimer = setTimeout(() => {
      if (!commandState.open && overlay) overlay.hidden = true;
    }, 160);
  }
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus && commandState.lastFocus &&
      typeof commandState.lastFocus.focus === 'function') {
    commandState.lastFocus.focus({ preventScroll: true });
  }
}

export function setupCommandBar() {
  const overlay = document.getElementById('command-overlay');
  const input = document.getElementById('command-input');
  const results = document.getElementById('command-results');
  const trigger = document.getElementById('command-open');
  const close = document.getElementById('command-close');
  if (!overlay || !input || !results) return;

  const shortcut = /Mac|iPhone|iPad|iPod/.test(navigator.platform || '')
    ? '⌘K'
    : 'Ctrl K';
  document.querySelectorAll('[data-command-shortcut]').forEach(el => {
    el.textContent = shortcut;
  });
  if (trigger) {
    trigger.title = `Search files and folders or run a command (${shortcut})`;
    trigger.addEventListener('click', openCommandBar);
  }
  if (close) close.addEventListener('click', () => closeCommandBar());

  input.addEventListener('input', commandQueryChanged);
  input.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      moveCommandSelection(1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      moveCommandSelection(-1);
    } else if (ev.key === 'Home' && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      commandState.index = 0;
      syncCommandSelection();
    } else if (ev.key === 'End' && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      commandState.index = Math.max(0, commandState.items.length - 1);
      syncCommandSelection();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      runCommandItem(commandState.items[commandState.index]);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      closeCommandBar();
    }
  });

  results.addEventListener('mousemove', ev => {
    const row = ev.target.closest('.command-item');
    if (!row) return;
    const index = Number(row.dataset.index);
    if (index === commandState.index) return;
    commandState.index = index;
    syncCommandSelection(false);
  });
  results.addEventListener('click', ev => {
    const row = ev.target.closest('.command-item');
    if (!row) return;
    const index = Number(row.dataset.index);
    commandState.index = index;
    runCommandItem(commandState.items[index]);
  });

  overlay.addEventListener('mousedown', ev => {
    if (ev.target === overlay) closeCommandBar();
  });
  overlay.addEventListener('keydown', ev => {
    if (ev.key !== 'Tab') return;
    const focusables = [input, close].filter(el => el && !el.disabled && !el.hidden);
    if (!focusables.length) return;
    ev.preventDefault();
    const index = focusables.indexOf(document.activeElement);
    const next = ev.shiftKey
      ? (index <= 0 ? focusables.length - 1 : index - 1)
      : (index + 1) % focusables.length;
    focusables[next].focus();
  });
}
