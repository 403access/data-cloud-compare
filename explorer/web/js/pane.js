/* One virtualised file-list pane (local index or remote snapshot). */

import { BASE, ROW_H, SEARCH_MIN } from './config.js';
import { COLUMN_DEFS } from './columns.js';
import {
  entryType,
  fmtBytes,
  fmtDate,
  fmtNum,
  plural,
  sizeDisplay,
  sizeSortValue,
} from './format.js';
import { iconFor } from './icons.js';
import { getJSON } from './net.js';
import {
  CHIP_ORDER,
  STATUS_FILTER_ORDER,
  counterpartTarget,
  statusLabel,
  statusTitle,
} from './status.js';
import { currentProvider, panes, state } from './store.js';
import { toast } from './toast.js';
import { baseOf, parentOf } from './util.js';
import {
  columnTemplate,
  openColumnsPanel,
} from './panels/columns-panel.js';
import { openSourcePanel } from './panels/source.js';
import {
  closeDetailPanel,
  openDetailPanel,
  refreshDetailPanel,
} from './panels/detail.js';
import { revealCounterpart } from './panels/reveal.js';
import { setActive, updateSelectionBar } from './selection.js';

export class Pane {
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
    this.statusFilters = new Set();
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
    this.filterBtn = root.querySelector('[data-role="filter-toggle"]');
    this.filterLabel = root.querySelector('[data-role="filter-label"]');
    this.filterMenu = root.querySelector('[data-role="filter-menu"]');
    this.clearBtn = root.querySelector('[data-role="clear"]');
    this.summaryEl = root.querySelector('[data-role="summary"]');
    this.chipsEl = root.querySelector('[data-role="chips"]');
    this.columnHead = root.querySelector('[data-role="columns"]');
    this.columnButtons = [...root.querySelectorAll('[data-sort]')];
    this.backBtn = root.querySelector('[data-act="back"]');
    this.forwardBtn = root.querySelector('[data-act="forward"]');
    this.upBtn = root.querySelector('[data-act="up"]');
    this.mirrorBtn = root.querySelector('[data-act="mirror"]');
    this.sourceInfoBtn = root.querySelector('[data-role="source-info"]');

    this.bind();
    this.applyColumns(false);
    this.updateSortIndicators();
    this.buildStatusFilter();

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

  baseEntries() {
    return this.searchMode ? this.results : this.entries;
  }

  currentEntries() {
    const base = this.baseEntries();
    if (!this.statusFilters.size) return base;
    return base.filter(e => this.statusFilters.has(e.status));
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

    if (this.sourceInfoBtn) {
      this.sourceInfoBtn.addEventListener('click', ev => {
        ev.stopPropagation();
        openSourcePanel(this.side);
      });
    }

    this.columnButtons.forEach(btn => {
      btn.addEventListener('click', () => this.setSort(btn.dataset.sort));
    });

    this.columnHead.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      openColumnsPanel();
    });
    this.list.addEventListener('contextmenu', ev => {
      const row = ev.target.closest('.row');
      if (!row) {
        ev.preventDefault();
        openColumnsPanel();
        return;
      }
      ev.preventDefault();
      setActive(this.side);
      this.select(row.dataset.path);
      const entry = this.currentEntries().find(e => e.path === row.dataset.path);
      if (entry) openDetailPanel(this, entry);
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
    this.filterBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      const opening = this.filterMenu.hidden;
      this.setFilterMenuOpen(opening);
      if (opening && ev.detail === 0) {
        const first = this.filterMenu.querySelector('input');
        if (first) first.focus();
      }
    });
    this.filterBtn.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && !this.filterMenu.hidden) {
        ev.preventDefault();
        this.setFilterMenuOpen(false);
      }
    });
    this.filterMenu.addEventListener('click', ev => ev.stopPropagation());
    this.filterMenu.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        this.setFilterMenuOpen(false);
        this.filterBtn.focus();
      }
    });
    document.addEventListener('click', () => this.setFilterMenuOpen(false));
    this.clearBtn.addEventListener('click', () => this.clearSearch());
  }

  /* ------------------------------------------------------------ filtering */

  statusFilterOptions() {
    const order = STATUS_FILTER_ORDER[this.side] || STATUS_FILTER_ORDER.remote;
    return order.map(status => ({
      value: status,
      label: statusLabel({ status }, this.side),
    }));
  }

  activeStatusFilters() {
    const order = STATUS_FILTER_ORDER[this.side] || STATUS_FILTER_ORDER.remote;
    return order.filter(status => this.statusFilters.has(status));
  }

  statusFilterLabel() {
    return this.activeStatusFilters()
      .map(status => statusLabel({ status }, this.side))
      .join(', ');
  }

  updateFilterButton() {
    const active = this.activeStatusFilters();
    this.filterLabel.textContent = active.length === 0
      ? 'Filter'
      : active.length === 1 ? active[0] : `Filter · ${active.length}`;
    this.filterBtn.classList.toggle('active', active.length > 0);
    this.filterBtn.title = active.length
      ? `Filtering by: ${active.join(', ')}`
      : 'Filter by status';
  }

  setFilterMenuOpen(open) {
    this.filterMenu.hidden = !open;
    this.filterBtn.setAttribute('aria-expanded', String(open));
    this.filterBtn.classList.toggle('open', open);
    if (open) {
      Object.values(panes).forEach(pane => {
        if (pane && pane !== this) pane.setFilterMenuOpen(false);
      });
    }
  }

  buildStatusFilter() {
    const options = this.statusFilterOptions();
    const valid = new Set(options.map(option => option.value));
    this.statusFilters.forEach(status => {
      if (!valid.has(status)) this.statusFilters.delete(status);
    });

    const head = document.createElement('div');
    head.className = 'filter-menu-head';
    const caption = document.createElement('span');
    caption.textContent = 'Show only';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'filter-clear';
    clear.textContent = 'Clear all';
    clear.addEventListener('click', () => this.clearStatusFilters());
    head.append(caption, clear);

    const rows = options.map(option => {
      const row = document.createElement('label');
      row.className = 'filter-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = option.value;
      input.checked = this.statusFilters.has(option.value);
      input.addEventListener('change', () => {
        if (input.checked) this.statusFilters.add(option.value);
        else this.statusFilters.delete(option.value);
        this.onStatusFilterChange();
      });
      const dot = document.createElement('span');
      dot.className = `filter-dot st-${option.value}`;
      const text = document.createElement('span');
      text.textContent = option.label;
      row.append(input, dot, text);
      return row;
    });

    this.filterMenu.replaceChildren(head, ...rows);
    this.updateFilterButton();
  }

  syncStatusFilterInputs() {
    this.filterMenu.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.checked = this.statusFilters.has(input.value);
    });
  }

  onStatusFilterChange() {
    if (this.selected && !this.currentEntries().some(e => e.path === this.selected)) {
      this.selected = null;
    }
    this.updateFilterButton();
    this.renderAll(true);
    this.updateFooter();
    updateSelectionBar();
  }

  toggleStatusFilter(status) {
    if (this.statusFilters.has(status)) this.statusFilters.delete(status);
    else this.statusFilters.add(status);
    this.syncStatusFilterInputs();
    this.onStatusFilterChange();
  }

  clearStatusFilters() {
    if (!this.statusFilters.size) return;
    this.statusFilters.clear();
    this.syncStatusFilterInputs();
    this.onStatusFilterChange();
  }

  /* ---------------------------------------------------------- navigation */

  async navigate(path, opts = {}) {
    const { push = true, select = null } = opts;
    path = path || '';
    this.exitSearch(false);
    closeDetailPanel();
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
      `&sizemode=${state.sizeMode}` +
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
    if (this.sort === 'size') key = e => sizeSortValue(e);
    else if (this.sort === 'modified') key = e => e.modified || 0;
    else if (this.sort === 'status') key = e => statusOrder[e.status] ?? 99;
    else if (this.sort === 'type') key = e => entryType(e).toLocaleLowerCase();
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

  applyColumns(rerender = true) {
    this.columnButtons.forEach(btn => {
      btn.hidden = !state.columns.has(btn.dataset.sort);
    });
    this.root.style.setProperty('--col-template', columnTemplate());
    this.updateSortIndicators();
    if (rerender) this.renderAll(false);
  }

  refreshSizeDisplay() {
    if (this.searchMode) this.sortResults();
    if (this.sort === 'size' && !this.searchMode) this.fetchList();
    else this.renderAll(false);
    refreshDetailPanel();
    updateSelectionBar();
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

    const typeCell = document.createElement('div');
    typeCell.className = 'row-cell cell-type';
    typeCell.textContent = entryType(entry);
    if (!entry.is_dir && entry.size != null) {
      typeCell.title = `${entryType(entry)} file · ${fmtNum(entry.size)} bytes`;
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
    const size = sizeDisplay(entry);
    sizeCell.textContent = size.text;
    if (size.title) sizeCell.title = size.title;

    const modCell = document.createElement('div');
    modCell.className = 'row-cell cell-mod';
    modCell.textContent = entry.modified ? fmtDate(entry.modified) : '—';

    const cells = {
      name: nameCell,
      type: typeCell,
      status: statusCell,
      size: sizeCell,
      modified: modCell,
    };
    COLUMN_DEFS.forEach(col => {
      if (state.columns.has(col.id)) row.append(cells[col.id]);
    });
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
      } else if (this.statusFilters.size && this.baseEntries().length) {
        text = 'No items match the selected status filters.';
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

  updateFooter() {
    const entries = this.currentEntries();
    const base = this.baseEntries();
    if (this.searchMode) {
      this.summaryEl.textContent = this.statusFilters.size
        ? `${fmtNum(entries.length)} of ${fmtNum(base.length)} results · ` +
          `${this.statusFilterLabel()}`
        : `${fmtNum(entries.length)}${this.truncated ? '+' : ''} results` +
          (this.truncated ? ' · refine to narrow down' : '');
    } else if (this.statusFilters.size) {
      this.summaryEl.textContent =
        `Showing ${fmtNum(entries.length)} of ${fmtNum(base.length)} items · ` +
        `${this.statusFilterLabel()}`;
    } else {
      const s = this.stats || {};
      this.summaryEl.textContent =
        `${fmtNum(s.items)} items · ${plural(s.dirs, 'folder')} · ` +
        `${plural(s.files, 'file')} · ${fmtBytes(s.bytes)}`;
    }

    const counts = {};
    base.forEach(e => { counts[e.status] = (counts[e.status] || 0) + 1; });
    this.chipsEl.replaceChildren();
    CHIP_ORDER.forEach(status => {
      if (!counts[status]) return;
      if (status === 'exact') return; // the uninteresting default
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `mini-chip st-${status}` +
        (this.statusFilters.has(status) ? ' active' : '');
      chip.title = this.statusFilters.has(status)
        ? 'Remove this status from the filter'
        : `Add ${statusLabel({ status }, this.side)} to the filter`;
      chip.innerHTML = '<span class="dot"></span>';
      const text = document.createElement('span');
      text.textContent = `${statusLabel({ status }, this.side)} ${fmtNum(counts[status])}`;
      chip.append(text);
      chip.addEventListener('click', () => this.toggleStatusFilter(status));
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
