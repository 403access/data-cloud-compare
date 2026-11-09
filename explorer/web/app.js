/* Two-pane Tank ⇄ cloud explorer (vanilla JS, no build step) */

'use strict';

const ROW_H = 30;
const SEARCH_MIN = 2;
const BASE = '/mnt/tank';

/* ------------------------------------------------------------------ icons */

const svg = (body, klass = '') =>
  `<svg class="${klass}" viewBox="0 0 16 16" fill="none" aria-hidden="true">${body}</svg>`;

const ICONS = {
  folder: svg(
    `<path d="M1.5 3.3a1 1 0 0 1 1-1h3.8l1.3 1.7h6.4a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V3.3Z" fill="currentColor"/>` +
    `<path d="M1.5 5.9h13" stroke="#fff" stroke-opacity=".22" stroke-width=".9"/>`,
    'row-icon-folder'),
  file: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
    `<path d="M9 1.9v2.9h2.9" stroke="currentColor" stroke-width="1.05" stroke-linejoin="round"/>`),
  image: svg(
    `<rect x="2.1" y="3" width="11.8" height="10" rx="1.5" stroke="currentColor" stroke-width="1.15"/>` +
    `<circle cx="5.8" cy="6.4" r="1.15" fill="currentColor"/>` +
    `<path d="m3.3 12.1 3.2-3.3 1.9 1.7 2.2-2.5 2.1 2.6" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>`,
    'ic-image'),
  video: svg(
    `<rect x="2.1" y="3" width="11.8" height="10" rx="1.5" stroke="currentColor" stroke-width="1.15"/>` +
    `<path d="M6.6 5.8 10.4 8l-3.8 2.2V5.8Z" fill="currentColor"/>`,
    'ic-video'),
  audio: svg(
    `<path d="M6.2 11.9V4.8l5.2-1.4v6.7" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
    `<ellipse cx="4.9" cy="12.1" rx="1.7" ry="1.35" fill="currentColor"/>` +
    `<ellipse cx="10.1" cy="10.7" rx="1.7" ry="1.35" fill="currentColor"/>`,
    'ic-audio'),
  archive: svg(
    `<rect x="2.2" y="3.1" width="11.6" height="9.8" rx="1.2" stroke="currentColor" stroke-width="1.15"/>` +
    `<path d="M2.5 5.8h11M6.1 5.8v3.4h3.8V5.8" stroke="currentColor" stroke-width="1.05"/>`,
    'ic-archive'),
  code: svg(
    `<path d="m5.7 4.6-3.3 3.4 3.3 3.4M10.3 4.6l3.3 3.4-3.3 3.4M9.1 3.1 7 12.9" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>`,
    'ic-code'),
  pdf: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
    `<path d="M9 1.9v2.9h2.9" stroke="currentColor" stroke-width="1.05" stroke-linejoin="round"/>` +
    `<text x="8" y="11.9" text-anchor="middle" font-size="4.4" font-weight="700" fill="currentColor">PDF</text>`,
    'ic-pdf'),
  text: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
    `<path d="M9 1.9v2.9h2.9M5.8 7.1h4.4M5.8 9.1h4.4M5.8 11.1h3.1" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/>`,
    'ic-text'),
  sheet: svg(
    `<rect x="2.8" y="2.6" width="10.4" height="10.8" rx="1.1" stroke="currentColor" stroke-width="1.15"/>` +
    `<path d="M3 6.1h10M3 9.4h10M6.4 3v10.3M9.7 3v10.3" stroke="currentColor" stroke-width=".95" opacity=".8"/>`,
    'ic-sheet'),
  doc: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
    `<path d="M9 1.9v2.9h2.9M5.8 7.2h4.4M5.8 9.2h4.4M5.8 11.2h2.7" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/>`,
    'ic-text'),
};

const EXT_KIND = (() => {
  const map = {};
  const add = (kind, exts) => exts.forEach(x => { map[x] = kind; });
  add('image', ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'tif',
    'tiff', 'bmp', 'svg', 'raw', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'orf']);
  add('video', ['mp4', 'mov', 'mkv', 'avi', 'wmv', 'flv', 'webm', 'm4v',
    'mpg', 'mpeg', 'ts', 'm2ts', 'vob']);
  add('audio', ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'aiff',
    'aif', 'alac', 'wma', 'dsf']);
  add('archive', ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz',
    'iso', 'dmg', 'pkg', 'cab', 'zst', 'lz4']);
  add('code', ['js', 'mjs', 'cjs', 'ts', 'jsx', 'tsx', 'json', 'html', 'htm',
    'css', 'scss', 'sass', 'less', 'py', 'rs', 'go', 'java', 'c', 'cc', 'cpp',
    'h', 'hpp', 'rb', 'php', 'sh', 'zsh', 'bash', 'yml', 'yaml', 'toml',
    'xml', 'sql', 'kt', 'swift', 'm', 'mm', 'pl', 'lua', 'vue', 'svelte']);
  add('pdf', ['pdf']);
  add('sheet', ['xls', 'xlsx', 'numbers', 'ods', 'csv', 'tsv']);
  add('doc', ['doc', 'docx', 'pages', 'odt', 'rtf', 'ppt', 'pptx', 'key',
    'epub']);
  add('text', ['txt', 'md', 'markdown', 'log', 'nfo', 'ini', 'cfg', 'conf']);
  return map;
})();

function iconFor(entry) {
  if (entry.is_dir) {
    return `<span class="row-icon">${ICONS.folder}</span>`;
  }
  const name = entry.name || '';
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  const kind = EXT_KIND[ext];
  const icon = kind && ICONS[kind] ? ICONS[kind] : ICONS.file;
  return `<span class="row-icon file-icon">${icon}</span>`;
}

/* --------------------------------------------------------------- formatting */

const NUM = new Intl.NumberFormat();
const DATE = new Intl.DateTimeFormat(undefined, {
  year: 'numeric', month: 'short', day: 'numeric',
});

function fmtNum(n) {
  return n == null ? '—' : NUM.format(n);
}

function fmtBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[i]}`;
}

function fmtDate(ts) {
  if (!ts) return '—';
  try { return DATE.format(new Date(ts * 1000)); } catch { return '—'; }
}

function plural(n, one, many) {
  return `${fmtNum(n)} ${n === 1 ? one : (many || one + 's')}`;
}

/* ------------------------------------------------------------------ status */

const STATUS_LABEL_REMOTE = {
  exact: 'Same',
  moved: 'Moved',
  possible: 'Maybe',
  partial: 'Partial',
  missing: 'Missing',
};

const FALLBACK_PROVIDER = {
  key: 'jottacloud',
  label: 'Jottacloud',
  root_label: 'Archive',
  subtitle: 'archive.json snapshot · virtual read-only view',
  accent: '#5e5ce6',
  available: true,
  reason: '',
};

function localStatusLabel(status) {
  const label = currentProvider().label || 'remote';
  switch (status) {
    case 'exact': return `In ${label}`;
    case 'moved_match': return 'Moved match';
    case 'local_only': return 'Local only';
    case 'type_mismatch': return 'Type differs';
    case 'unmatched': return `Not in ${label}`;
    default: return STATUS_LABEL_REMOTE[status] || status || '—';
  }
}

const CHIP_ORDER = [
  'missing', 'partial', 'possible', 'moved', 'type_mismatch',
  'moved_match', 'local_only', 'unmatched', 'exact',
];

function statusLabel(entry, side) {
  if (side === 'remote') {
    return STATUS_LABEL_REMOTE[entry.status] || entry.status || '—';
  }
  return localStatusLabel(entry.status);
}

function statusTitle(entry) {
  const bits = [];
  if (entry.note) bits.push(`Report: ${entry.note}`);
  if (entry.agg && entry.agg.total) {
    const a = entry.agg;
    const parts = [
      `${fmtNum(a.exact)} same`,
      `${fmtNum(a.moved)} moved`,
      `${fmtNum(a.possible)} maybe`,
    ];
    if (a.partial) parts.push(`${fmtNum(a.partial)} partial`);
    parts.push(`${fmtNum(a.missing)} missing`);
    bits.push(`${currentProvider().label}: ${fmtNum(a.total)} items: ${parts.join(', ')}`);
  } else if (entry.is_dir && entry.child_count != null) {
    bits.push(`${fmtNum(entry.child_count)} direct items`);
  }
  if (entry.found_at) bits.push(`Found at: ${entry.found_at}`);
  return bits.join(' · ');
}

function counterpartTarget(entry, side) {
  if (!entry) return null;
  if (side === 'remote') {
    if (entry.status === 'missing') return null;
    if (entry.status === 'moved' || entry.status === 'possible') {
      return entry.found_at || null;
    }
    return entry.path; // exact / partial: same path on the local side
  }
  if (entry.status === 'local_only' || entry.status === 'unmatched') return null;
  if (entry.status === 'moved_match' || entry.status === 'moved') {
    return entry.found_at || null;
  }
  if (entry.status === 'type_mismatch') return entry.path;
  return entry.found_at || entry.path;
}

/* ------------------------------------------------------------------- state */

const state = {
  active: 'local',
  hidden: false,
  provider: 'jottacloud',
};

const providerCatalog = {
  list: [],
  byKey: {},
};

function currentProvider() {
  return providerCatalog.byKey[state.provider] || FALLBACK_PROVIDER;
}

const panes = {};

let toastTimer = null;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

function parentOf(path) {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

function baseOf(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

/* -------------------------------------------------------------------- pane */

class Pane {
  constructor(side, root) {
    this.side = side;
    this.root = root;
    this.path = '';
    this.history = [''];
    this.hIndex = 0;
    this.entries = [];
    this.results = [];
    this.selected = null;
    this.sort = 'name';
    this.dir = 'asc';
    this.query = '';
    this.scope = 'all';
    this.searchMode = false;
    this.truncated = false;
    this.exists = true;
    this.stats = { files: 0, dirs: 0, items: 0, bytes: 0 };
    this.loading = false;
    this.reqSeq = 0;
    this.searchTimer = null;
    this.renderQueued = false;

    this.list = root.querySelector('[data-role="list"]');
    this.spacer = root.querySelector('[data-role="spacer"]');
    this.body = root.querySelector('[data-role="body"]');
    this.emptyEl = root.querySelector('[data-role="empty"]');
    this.loadingEl = root.querySelector('[data-role="loading"]');
    this.crumbsEl = root.querySelector('[data-role="crumbs"]');
    this.searchInput = root.querySelector('[data-role="search"]');
    this.scopeSelect = root.querySelector('[data-role="scope"]');
    this.clearBtn = root.querySelector('[data-role="clear"]');
    this.badgeEl = root.querySelector('[data-role="badge"]');
    this.summaryEl = root.querySelector('[data-role="summary"]');
    this.chipsEl = root.querySelector('[data-role="chips"]');
    this.columnButtons = [...root.querySelectorAll('[data-sort]')];
    this.backBtn = root.querySelector('[data-act="back"]');
    this.forwardBtn = root.querySelector('[data-act="forward"]');
    this.upBtn = root.querySelector('[data-act="up"]');
    this.mirrorBtn = root.querySelector('[data-act="mirror"]');

    this.bind();
    this.updateSortIndicators();

    this.list.addEventListener('scroll', () => this.scheduleRender());
    window.addEventListener('resize', () => this.scheduleRender());
  }

  get other() {
    return this.side === 'local' ? panes.remote : panes.local;
  }

  get rootLabel() {
    return this.side === 'local'
      ? BASE
      : (currentProvider().root_label || 'Archive');
  }

  currentEntries() {
    return this.searchMode ? this.results : this.entries;
  }

  selectedEntry() {
    if (!this.selected) return null;
    return this.currentEntries().find(e => e.path === this.selected) || null;
  }

  bind() {
    this.root.addEventListener('pointerdown', () => setActive(this.side));

    this.root.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'back') this.back();
        else if (act === 'forward') this.forward();
        else if (act === 'up') this.up();
        else if (act === 'mirror') this.mirror();
      });
    });

    this.columnButtons.forEach(btn => {
      btn.addEventListener('click', () => this.setSort(btn.dataset.sort));
    });

    this.body.addEventListener('click', ev => {
      const row = ev.target.closest('.row');
      if (!row) return;
      setActive(this.side);
      this.select(row.dataset.path);
      this.list.focus({ preventScroll: true });
    });

    this.body.addEventListener('dblclick', ev => {
      const row = ev.target.closest('.row');
      if (!row) return;
      const entry = this.currentEntries().find(e => e.path === row.dataset.path);
      if (entry) this.activate(entry);
    });

    this.list.addEventListener('keydown', ev => this.onKey(ev));
    this.list.addEventListener('focus', () => setActive(this.side));

    this.searchInput.addEventListener('input', () => this.onSearchInput());
    this.searchInput.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        this.clearSearch();
      } else if (ev.key === 'ArrowDown' || ev.key === 'Enter') {
        const entries = this.currentEntries();
        if (this.searchMode && entries.length) {
          ev.preventDefault();
          this.select(entries[0].path);
          this.list.focus();
        }
      }
    });
    this.scopeSelect.addEventListener('change', () => {
      this.scope = this.scopeSelect.value;
      if (this.searchMode && this.query) this.runSearch(this.query);
    });
    this.clearBtn.addEventListener('click', () => this.clearSearch());
  }

  /* ---------------------------------------------------------- navigation */

  async navigate(path, opts = {}) {
    const { push = true, select = null } = opts;
    path = path || '';
    this.exitSearch(false);
    this.path = path;
    if (push) {
      if (this.history[this.hIndex] !== path) {
        this.history = this.history.slice(0, this.hIndex + 1);
        this.history.push(path);
        this.hIndex = this.history.length - 1;
      }
    }
    this.selected = select;
    return this.fetchList();
  }

  async fetchList() {
    const seq = ++this.reqSeq;
    this.setLoading(true);
    const url = `/api/list?side=${this.side}` +
      `&provider=${encodeURIComponent(state.provider)}` +
      `&path=${encodeURIComponent(this.path)}` +
      `&sort=${this.sort}&dir=${this.dir}` +
      `&hidden=${state.hidden ? 1 : 0}`;
    try {
      const data = await getJSON(url);
      if (seq !== this.reqSeq) return null;
      this.applyList(data);
      return data;
    } catch (err) {
      if (seq === this.reqSeq) {
        this.entries = [];
        this.exists = false;
        this.renderAll(true);
        this.showEmpty(`Could not load this folder: ${err.message}`);
        toast(err.message);
      }
      return null;
    } finally {
      if (seq === this.reqSeq) this.setLoading(false);
    }
  }

  applyList(data) {
    this.entries = data.entries || [];
    this.stats = data.stats || { files: 0, dirs: 0, items: 0, bytes: 0 };
    this.exists = data.exists !== false;
    if (this.selected && !this.currentEntries().some(e => e.path === this.selected)) {
      this.selected = null;
    }
    this.renderCrumbs(data.crumbs || []);
    this.updateNavButtons();
    this.updateBadge();
    this.updateFooter();
    this.renderAll(true);
    this.root.classList.toggle('missing-path', !this.exists);
    updateSelectionBar();
  }

  back() {
    if (this.hIndex <= 0) return;
    this.hIndex -= 1;
    this.navigate(this.history[this.hIndex], { push: false });
  }

  forward() {
    if (this.hIndex >= this.history.length - 1) return;
    this.hIndex += 1;
    this.navigate(this.history[this.hIndex], { push: false });
  }

  up() {
    if (!this.path) return;
    this.navigate(parentOf(this.path));
  }

  async mirror() {
    const data = await this.other.navigate(this.path, { push: true });
    if (data && !data.exists) {
      toast(`“${this.path || '/'}” was not found on the ` +
        `${this.other.side === 'local' ? 'local' : currentProvider().label} side.`);
    }
  }

  updateNavButtons() {
    this.backBtn.disabled = this.hIndex <= 0;
    this.forwardBtn.disabled = this.hIndex >= this.history.length - 1;
    this.upBtn.disabled = !this.path;
  }

  /* -------------------------------------------------------------- search */

  onSearchInput() {
    const q = this.searchInput.value.trim();
    this.clearBtn.hidden = q.length === 0;
    this.root.querySelector('.searchbar').classList.toggle('searching', q.length > 0);
    clearTimeout(this.searchTimer);
    if (!q) {
      if (this.searchMode) this.clearSearch();
      return;
    }
    if (q.length < SEARCH_MIN) {
      if (this.searchMode) {
        this.exitSearch(false);
        this.fetchList();
      }
      return;
    }
    this.searchTimer = setTimeout(() => this.runSearch(q), 260);
  }

  async runSearch(q) {
    const seq = ++this.reqSeq;
    this.searchMode = true;
    this.query = q;
    this.selected = null;
    this.setLoading(true);
    const url = `/api/search?side=${this.side}` +
      `&provider=${encodeURIComponent(state.provider)}` +
      `&q=${encodeURIComponent(q)}` +
      `&scope=${this.scope}&path=${encodeURIComponent(this.path)}` +
      `&hidden=${state.hidden ? 1 : 0}`;
    try {
      const data = await getJSON(url);
      if (seq !== this.reqSeq) return;
      this.results = data.entries || [];
      this.truncated = !!data.truncated;
      this.sortResults();
      this.updateBadge();
      this.updateFooter();
      this.renderAll(true);
      updateSelectionBar();
    } catch (err) {
      if (seq === this.reqSeq) toast(`Search failed: ${err.message}`);
    } finally {
      if (seq === this.reqSeq) this.setLoading(false);
    }
  }

  clearSearch() {
    if (!this.searchMode && !this.searchInput.value) return;
    this.exitSearch(false);
    this.searchInput.value = '';
    this.clearBtn.hidden = true;
    this.root.querySelector('.searchbar').classList.remove('searching');
    this.fetchList();
  }

  exitSearch(reload) {
    const wasSearching = this.searchMode;
    this.searchMode = false;
    this.query = '';
    this.results = [];
    this.truncated = false;
    clearTimeout(this.searchTimer);
    if (wasSearching) {
      this.searchInput.value = '';
      this.clearBtn.hidden = true;
      this.root.querySelector('.searchbar').classList.remove('searching');
    }
    if (reload && wasSearching) this.fetchList();
  }

  sortResults() {
    const statusOrder = {
      missing: 0, partial: 1, possible: 2, moved: 3, moved_match: 3,
      type_mismatch: 4, exact: 5, local_only: 6, unmatched: 7,
    };
    let key;
    if (this.sort === 'size') key = e => e.size || 0;
    else if (this.sort === 'modified') key = e => e.modified || 0;
    else if (this.sort === 'status') key = e => statusOrder[e.status] ?? 99;
    else key = e => (e.name || '').toLocaleLowerCase();
    const dir = this.dir === 'desc' ? -1 : 1;
    this.results.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      const ak = key(a);
      const bk = key(b);
      if (ak < bk) return -1 * dir;
      if (ak > bk) return 1 * dir;
      return 0;
    });
  }

  setSort(sort) {
    if (this.sort === sort) {
      this.dir = this.dir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sort = sort;
      this.dir = 'asc';
    }
    this.updateSortIndicators();
    if (this.searchMode) {
      this.sortResults();
      this.renderAll(true);
    } else {
      this.fetchList();
    }
  }

  updateSortIndicators() {
    this.columnButtons.forEach(btn => {
      const active = btn.dataset.sort === this.sort;
      btn.classList.toggle('sorted', active);
      btn.classList.toggle('desc', active && this.dir === 'desc');
    });
  }

  /* -------------------------------------------------------------- render */

  setLoading(on) {
    this.loading = on;
    this.loadingEl.hidden = !on;
  }

  renderAll(resetScroll) {
    const entries = this.currentEntries();
    if (resetScroll) this.list.scrollTop = 0;
    this.spacer.style.height = `${entries.length * ROW_H}px`;
    this.emptyEl.hidden = true;
    if (!entries.length) {
      this.body.replaceChildren();
      this.showEmpty();
      return;
    }
    this.renderWindow();
  }

  scheduleRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.renderWindow();
    });
  }

  renderWindow() {
    const entries = this.currentEntries();
    if (!entries.length) {
      this.body.replaceChildren();
      return;
    }
    const scrollTop = this.list.scrollTop;
    const height = this.list.clientHeight || 400;
    let start = Math.max(0, Math.floor(scrollTop / ROW_H) - 4);
    let end = Math.min(entries.length,
      Math.ceil((scrollTop + height) / ROW_H) + 6);

    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i += 1) {
      frag.appendChild(this.buildRow(entries[i]));
    }
    this.body.replaceChildren(frag);
    this.body.style.transform = `translateY(${start * ROW_H}px)`;
  }

  buildRow(entry) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.path = entry.path;
    if (this.selected === entry.path) row.classList.add('selected');
    const statusClass = `st-${entry.status || 'unmatched'}`;

    const nameCell = document.createElement('div');
    nameCell.className = 'row-cell cell-name';
    const iconWrap = document.createElement('span');
    iconWrap.innerHTML = iconFor(entry); // static icon markup only
    const label = document.createElement('span');
    label.className = 'name-label';
    label.textContent = entry.name || baseOf(entry.path);
    label.title = entry.path;
    nameCell.append(iconWrap.firstElementChild, label);
    if (this.searchMode) {
      const sub = document.createElement('span');
      sub.className = 'subpath';
      sub.textContent = entry.parent || '/';
      sub.title = entry.parent || '/';
      nameCell.append(sub);
    }

    const statusCell = document.createElement('div');
    statusCell.className = 'row-cell cell-status';
    const chip = document.createElement('span');
    chip.className = `status-chip ${statusClass}`;
    const dot = document.createElement('span');
    dot.className = 'dot';
    const chipLabel = document.createElement('span');
    chipLabel.textContent = statusLabel(entry, this.side);
    chip.append(dot, chipLabel);
    const title = statusTitle(entry);
    if (title) chip.title = title;
    statusCell.append(chip);

    const sizeCell = document.createElement('div');
    sizeCell.className = 'row-cell cell-size';
    if (entry.is_dir) {
      if (entry.child_count != null) {
        sizeCell.textContent = fmtNum(entry.child_count);
        sizeCell.title = `${fmtNum(entry.child_count)} direct items`;
      } else {
        sizeCell.textContent = '—';
      }
    } else {
      sizeCell.textContent = fmtBytes(entry.size);
      sizeCell.title = entry.size != null ? `${fmtNum(entry.size)} bytes` : '';
    }

    const modCell = document.createElement('div');
    modCell.className = 'row-cell cell-mod';
    modCell.textContent = entry.modified ? fmtDate(entry.modified) : '—';

    row.append(nameCell, statusCell, sizeCell, modCell);
    return row;
  }

  showEmpty(message) {
    const entries = this.currentEntries();
    let text = message;
    if (!text) {
      if (!this.exists) {
        text = `“${this.path || '/'}” does not exist in ` +
          (this.side === 'local'
            ? 'the local index.'
            : `the ${currentProvider().label} snapshot.`);
      } else if (this.searchMode) {
        text = this.truncated
          ? `Showing the first results for “${this.query}”. Type more to narrow it down.`
          : `No matches for “${this.query}”.`;
      } else {
        text = 'This folder is empty.';
      }
    }
    this.emptyEl.textContent = text;
    this.emptyEl.hidden = false;
    this.spacer.style.height = '0px';
    this.body.replaceChildren();
    if (entries.length) this.emptyEl.hidden = true;
  }

  renderCrumbs(crumbs) {
    this.crumbsEl.replaceChildren();
    if (!crumbs.length) return;
    crumbs.forEach((c, index) => {
      if (index > 0) {
        const sep = document.createElement('span');
        sep.className = 'crumb-sep';
        sep.textContent = '›';
        this.crumbsEl.append(sep);
      }
      const btn = document.createElement('button');
      btn.className = 'crumb';
      btn.textContent = index === 0 ? this.rootLabel : c.name;
      btn.title = c.path || this.rootLabel;
      btn.addEventListener('click', () => this.navigate(c.path));
      this.crumbsEl.append(btn);
    });
    requestAnimationFrame(() => {
      this.crumbsEl.scrollLeft = this.crumbsEl.scrollWidth;
    });
  }

  updateBadge() {
    const entries = this.currentEntries();
    if (this.searchMode) {
      this.badgeEl.innerHTML =
        `<b>${fmtNum(entries.length)}${this.truncated ? '+' : ''}</b> results`;
      return;
    }
    this.badgeEl.innerHTML = `<b>${fmtNum(entries.length)}</b> items`;
  }

  updateFooter() {
    const entries = this.currentEntries();
    if (this.searchMode) {
      this.summaryEl.textContent =
        `${fmtNum(entries.length)}${this.truncated ? '+' : ''} results` +
        (this.truncated ? ' · refine to narrow down' : '');
    } else {
      const s = this.stats || {};
      this.summaryEl.textContent =
        `${fmtNum(s.items)} items · ${plural(s.dirs, 'folder')} · ` +
        `${plural(s.files, 'file')} · ${fmtBytes(s.bytes)}`;
    }

    const counts = {};
    entries.forEach(e => { counts[e.status] = (counts[e.status] || 0) + 1; });
    this.chipsEl.replaceChildren();
    CHIP_ORDER.forEach(status => {
      if (!counts[status]) return;
      if (status === 'exact') return; // the uninteresting default
      const chip = document.createElement('span');
      chip.className = `mini-chip st-${status}`;
      chip.innerHTML = '<span class="dot"></span>';
      const text = document.createElement('span');
      text.textContent = `${statusLabel({ status }, this.side)} ${fmtNum(counts[status])}`;
      chip.append(text);
      this.chipsEl.append(chip);
    });
  }

  /* ----------------------------------------------------------- selection */

  select(path) {
    this.selected = path || null;
    this.body.querySelectorAll('.row.selected').forEach(r => r.classList.remove('selected'));
    if (this.selected) {
      const row = [...this.body.querySelectorAll('.row')]
        .find(r => r.dataset.path === this.selected);
      if (row) row.classList.add('selected');
      this.scrollIntoView(this.selected);
    }
    updateSelectionBar();
  }

  scrollIntoView(path) {
    const entries = this.currentEntries();
    const index = entries.findIndex(e => e.path === path);
    if (index < 0) return;
    const top = this.list.scrollTop;
    const height = this.list.clientHeight || 400;
    if (index * ROW_H < top) {
      this.list.scrollTop = index * ROW_H;
    } else if ((index + 1) * ROW_H > top + height) {
      this.list.scrollTop = (index + 1) * ROW_H - height + 2;
    }
    this.scheduleRender();
  }

  activate(entry) {
    if (!entry) return;
    if (this.searchMode) {
      if (entry.is_dir) {
        this.navigate(entry.path);
      } else {
        this.navigate(entry.parent, { select: entry.path });
      }
      return;
    }
    if (entry.is_dir) {
      this.navigate(entry.path);
    } else {
      revealCounterpart(entry, this.side);
    }
  }

  onKey(ev) {
    const entries = this.currentEntries();
    if (!entries.length) return;
    const index = entries.findIndex(e => e.path === this.selected);
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      const next = Math.min(entries.length - 1, index < 0 ? 0 : index + 1);
      this.select(entries[next].path);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      const next = Math.max(0, index < 0 ? 0 : index - 1);
      this.select(entries[next].path);
    } else if (ev.key === 'Home') {
      ev.preventDefault();
      this.select(entries[0].path);
    } else if (ev.key === 'End') {
      ev.preventDefault();
      this.select(entries[entries.length - 1].path);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (index >= 0) this.activate(entries[index]);
    } else if (ev.key === 'Backspace') {
      ev.preventDefault();
      this.up();
    } else if (ev.key === 'Escape') {
      if (this.searchMode || this.searchInput.value) this.clearSearch();
      else this.select(null);
    }
  }
}

/* ------------------------------------------------------------- selection bar */

function setActive(side) {
  if (state.active === side && panes[side] && panes[side].root.classList.contains('active')) {
    return;
  }
  state.active = side;
  Object.entries(panes).forEach(([key, pane]) => {
    pane.root.classList.toggle('active', key === side);
  });
  updateSelectionBar();
}

function updateSelectionBar() {
  const pane = panes[state.active];
  const info = document.getElementById('selection-info');
  const revealBtn = document.getElementById('reveal-btn');
  if (!pane) return;

  const entry = pane.selectedEntry();
  info.replaceChildren();
  if (!entry) {
    const span = document.createElement('span');
    span.className = 'muted';
    span.textContent = 'Select an item to see details.';
    info.append(span);
    revealBtn.disabled = true;
    revealBtn.textContent = 'Reveal counterpart';
    return;
  }

  const name = document.createElement('span');
  name.className = 'sel-name';
  name.textContent = entry.name || entry.path;
  name.title = entry.path;
  info.append(name);

  const meta = document.createElement('span');
  meta.className = 'sel-meta';
  const bits = [];
  if (entry.is_dir) {
    bits.push('Folder');
    if (entry.child_count != null) bits.push(`${fmtNum(entry.child_count)} items`);
  } else {
    bits.push('File');
    bits.push(fmtBytes(entry.size));
  }
  if (entry.modified) bits.push(fmtDate(entry.modified));
  meta.textContent = bits.join(' · ');
  info.append(meta);

  const chip = document.createElement('span');
  chip.className = `status-chip st-${entry.status || 'unmatched'}`;
  const dot = document.createElement('span');
  dot.className = 'dot';
  const label = document.createElement('span');
  label.textContent = statusLabel(entry, pane.side);
  chip.append(dot, label);
  const title = statusTitle(entry);
  if (title) chip.title = title;
  info.append(chip);

  if (entry.found_at) {
    const found = document.createElement('button');
    found.className = 'sel-found';
    found.textContent = `Found at: ${entry.found_at}`;
    found.title = entry.found_at;
    found.addEventListener('click', () => {
      revealCounterpart(entry, pane.side);
    });
    info.append(found);
  }

  const target = counterpartTarget(entry, pane.side);
  revealBtn.disabled = !target;
  revealBtn.textContent = pane.side === 'remote'
    ? 'Show in local index'
    : `Show in ${currentProvider().label}`;
}

async function revealCounterpart(entry, side) {
  const target = counterpartTarget(entry, side);
  if (!target) {
    toast(side === 'remote'
      ? 'This item has no match on the local side.'
      : `This item has no counterpart in ${currentProvider().label}.`);
    return;
  }
  const dest = side === 'remote' ? panes.local : panes.remote;
  const parent = parentOf(target);
  const name = baseOf(target);
  const data = await dest.navigate(parent, { push: true, select: target });
  if (data && !data.exists) {
    toast(`Counterpart folder not found: ${parent || '/'}`);
    return;
  }
  setActive(dest.side);
  dest.list.focus();
  if (name) dest.select(target);
}

/* --------------------------------------------------------------------- meta */

function loadMeta(providerKey = state.provider) {
  getJSON(`/api/meta?provider=${encodeURIComponent(providerKey)}`).then(data => {
    if (providerKey !== state.provider) return;
    const provider = data.provider || currentProvider();
    const s = data.summary || {};
    const archive = s.archive || {};
    const buckets = s.buckets || {};
    const strip = document.getElementById('meta-strip');
    strip.replaceChildren();

    const addChip = (html, title, optional) => {
      const chip = document.createElement('span');
      chip.className = 'meta-chip' + (optional ? ' optional' : '');
      chip.innerHTML = '<span class="dot"></span>';
      const body = document.createElement('span');
      body.innerHTML = html; // only server-side numeric summary, no filenames
      chip.append(body);
      if (title) chip.title = title;
      strip.append(chip);
    };

    addChip(
      `${provider.label} <b>${fmtNum(archive.files)}</b> files · ` +
      `<b>${fmtNum(archive.dirs)}</b> folders · ${fmtBytes(archive.bytes)}`,
      `${provider.label} snapshot (${provider.archive})`, false);
    const localEntries = s.db_entries;
    addChip(
      `Local index <b>${fmtNum(localEntries)}</b> entries`,
      'file_indexer.db (/mnt/tank index snapshot)', true);
    const pct = s.present_pct;
    if (pct != null) {
      addChip(`Coverage <b>${pct.toFixed(1)}%</b>`,
        `${provider.label} files found in the local index ` +
        '(same path, moved, or possible)', true);
    }
    if (buckets.missing && buckets.missing.files != null) {
      addChip(`Missing <b>${fmtNum(buckets.missing.files)}</b> files`,
        `${provider.label} files not found in the local index`, true);
    }

    const archiveSource = (data.sources || []).find(x => x.label === 'archive');
    const localSource = (data.sources || []).find(x => x.label === 'local_db');
    const fmtSourceDate = src => {
      if (!src || src.missing || !src.mtime) return 'unknown date';
      return DATE.format(new Date(src.mtime * 1000));
    };
    const sub = document.getElementById('brand-sub');
    sub.textContent =
      `local index (${fmtSourceDate(localSource)}) ⇄ ` +
      `${provider.label.toLowerCase()} snapshot ` +
      `(${fmtSourceDate(archiveSource)})`;
  }).catch(() => {
    const sub = document.getElementById('brand-sub');
    if (sub) sub.textContent = 'Could not load summary metadata';
  });
}

/* ------------------------------------------------------------------- legend */

function legendEntries() {
  const label = currentProvider().label;
  return [
    ['lt', `${label} side`],
    ['st-exact', 'Same', 'This path exists in the local index at the same path.'],
    ['st-moved', 'Moved', 'Found in the local index under a different path (same name and size).'],
    ['st-possible', 'Maybe', 'A file with the same name exists locally, but the size differs.'],
    ['st-partial', 'Partial', 'Folder has a mix of present and missing children.'],
    ['st-missing', 'Missing', 'No matching path, name or size was found in the local index.'],
    ['lt', 'Local side'],
    ['st-exact', `In ${label}`, `This local item exists at the same path in ${label}.`],
    ['st-moved_match', 'Moved match', `This local item is the match for a moved ${label} item.`],
    ['st-local_only', 'Local only', `Present in the index but not found anywhere in ${label}.`],
    ['st-unmatched', `Not in ${label}`, `No same-path counterpart in ${label}; it may still have matched another item.`],
    ['st-type_mismatch', 'Type differs', 'A file/folder with the same name exists on the other side.'],
  ];
}

function buildLegend() {
  const legend = document.getElementById('legend');
  const rows = legendEntries().map(([cls, title, desc]) => {
    if (cls === 'lt') {
      const h = document.createElement('h4');
      h.textContent = title;
      return h;
    }
    const row = document.createElement('div');
    row.className = 'legend-row';
    const chip = document.createElement('span');
    chip.className = `status-chip ${cls}`;
    chip.innerHTML = '<span class="dot"></span>';
    const text = document.createElement('span');
    const b = document.createElement('b');
    b.textContent = title;
    text.append(b);
    if (desc) text.append(document.createTextNode(` — ${desc}`));
    row.append(chip, text);
    return row;
  });
  legend.replaceChildren(...rows);
}

/* ---------------------------------------------------------------- providers */

async function loadProviders() {
  const data = await getJSON('/api/providers');
  providerCatalog.list = data.providers || [];
  providerCatalog.byKey = {};
  providerCatalog.list.forEach(p => { providerCatalog.byKey[p.key] = p; });
}

function updateProviderChrome() {
  const provider = currentProvider();
  document.title = `Tank ⇄ ${provider.label}`;
  document.getElementById('brand-provider').textContent = provider.label;
  document.getElementById('remote-provider-name').textContent = provider.label;
  document.getElementById('remote-root-name').textContent = provider.root_label;
  document.getElementById('remote-provider-desc').textContent = provider.subtitle;

  if (panes.remote) {
    panes.remote.searchInput.placeholder = `Search ${provider.label}…`;
    panes.remote.searchInput.setAttribute('aria-label',
      `Search ${provider.label}`);
    panes.remote.root.style.setProperty('--remote-brand',
      provider.accent || '#5e5ce6');
  }

  document.querySelectorAll('#provider-switch [data-provider]').forEach(btn => {
    const info = providerCatalog.byKey[btn.dataset.provider];
    const active = btn.dataset.provider === state.provider;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
    btn.classList.toggle('unavailable', Boolean(info && !info.available));
    btn.title = info && !info.available
      ? info.reason
      : `Switch the right pane to ${info ? info.label : btn.dataset.provider}`;
  });
}

async function switchProvider(key) {
  if (key === state.provider) return;
  const info = providerCatalog.byKey[key];
  if (!info) return;
  if (!info.available) {
    toast(info.reason || `${info.label} is not available.`);
    return;
  }

  state.provider = key;
  try { localStorage.setItem('explorer-provider', key); } catch { /* ignore */ }
  updateProviderChrome();

  // Show the same folder in the new provider when it exists there, otherwise
  // start again at that provider's root.
  const remote = panes.remote;
  const wanted = remote.path;
  remote.history = [wanted];
  remote.hIndex = 0;
  remote.selected = null;
  const data = await remote.navigate(wanted, { push: false });
  if (data && !data.exists) {
    remote.history = [''];
    remote.hIndex = 0;
    await remote.navigate('', { push: false });
  }

  // Local badges ("In Jottacloud" / "In Google Drive", …) change too.
  if (panes.local.searchMode && panes.local.query) {
    await panes.local.runSearch(panes.local.query);
  } else {
    await panes.local.fetchList();
  }

  loadMeta(key);
  buildLegend();
  updateSelectionBar();
}

/* ------------------------------------------------------------------- wiring */

async function init() {
  panes.local = new Pane('local', document.getElementById('pane-local'));
  panes.remote = new Pane('remote', document.getElementById('pane-remote'));

  try {
    await loadProviders();
  } catch (err) {
    providerCatalog.list = [FALLBACK_PROVIDER];
    providerCatalog.byKey = { jottacloud: FALLBACK_PROVIDER };
    toast(`Could not load provider list: ${err.message}`);
  }

  let wanted = 'jottacloud';
  try { wanted = localStorage.getItem('explorer-provider') || wanted; } catch { /* ignore */ }
  if (!providerCatalog.byKey[wanted]) wanted = 'jottacloud';
  if (providerCatalog.byKey[wanted] && !providerCatalog.byKey[wanted].available) {
    const first = providerCatalog.list.find(p => p.available);
    if (first) wanted = first.key;
  }
  state.provider = wanted;
  updateProviderChrome();

  setActive('local');
  loadMeta();
  buildLegend();
  panes.local.navigate('', { push: false });
  panes.remote.navigate('', { push: false });

  document.getElementById('provider-switch').addEventListener('click', ev => {
    const btn = ev.target.closest('[data-provider]');
    if (btn) switchProvider(btn.dataset.provider);
  });

  const hiddenToggle = document.getElementById('hidden-toggle');
  hiddenToggle.addEventListener('change', () => {
    state.hidden = hiddenToggle.checked;
    Object.values(panes).forEach(pane => {
      if (pane.searchMode && pane.query) pane.runSearch(pane.query);
      else pane.fetchList();
    });
  });

  const legendBtn = document.getElementById('legend-toggle');
  const legend = document.getElementById('legend');
  legendBtn.addEventListener('click', ev => {
    ev.stopPropagation();
    const open = !legend.hidden;
    legend.hidden = open;
    legendBtn.setAttribute('aria-expanded', String(!open));
  });
  document.addEventListener('click', ev => {
    if (!legend.hidden && !legend.contains(ev.target) && ev.target !== legendBtn) {
      legend.hidden = true;
      legendBtn.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', ev => {
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'f') {
      ev.preventDefault();
      panes[state.active].searchInput.focus();
      panes[state.active].searchInput.select();
    }
  });

  const themeBtn = document.getElementById('theme-toggle');
  themeBtn.addEventListener('click', () => {
    const root = document.documentElement;
    const current = root.dataset.theme ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('explorer-theme', next); } catch { /* ignore */ }
  });

  const revealBtn = document.getElementById('reveal-btn');
  revealBtn.addEventListener('click', () => {
    const pane = panes[state.active];
    const entry = pane.selectedEntry();
    if (entry) revealCounterpart(entry, pane.side);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
