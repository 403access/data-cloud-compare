/* Active pane tracking, the bottom selection bar and shared pane commands. */

import { fmtBytes, fmtDate, fmtNum, sizeDisplay } from './format.js';
import { counterpartTarget, statusLabel, statusTitle } from './status.js';
import { currentProvider, panes, state } from './store.js';
import { closeDetailPanel, refreshDetailPanel } from './panels/detail.js';
import { revealCounterpart } from './panels/reveal.js';

export function setActive(side) {
  if (state.active === side && panes[side] && panes[side].root.classList.contains('active')) {
    return;
  }
  state.active = side;
  Object.entries(panes).forEach(([key, pane]) => {
    pane.root.classList.toggle('active', key === side);
  });
  updateSelectionBar();
}

export function updateSelectionBar() {
  const pane = panes[state.active];
  const info = document.getElementById('selection-info');
  const revealBtn = document.getElementById('reveal-btn');
  if (!pane) return;

  const entry = pane.selectedEntry();
  refreshDetailPanel();
  info.replaceChildren();
  info.classList.remove('selection-enter');
  void info.offsetWidth;
  info.classList.add('selection-enter');
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
    const size = sizeDisplay(entry);
    if (size.text && size.text !== '—') bits.push(size.text);
    if (state.sizeMode === 'bytes' && entry.child_count != null) {
      bits.push(`${fmtNum(entry.child_count)} items`);
    }
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

export function refreshPane(pane) {
  if (!pane) return;
  if (pane.searchMode && pane.query) pane.runSearch(pane.query);
  else pane.fetchList();
}

export function refreshPaneData() {
  Object.values(panes).forEach(refreshPane);
}

export function setHidden(value) {
  state.hidden = Boolean(value);
  const toggle = document.getElementById('hidden-toggle');
  if (toggle) toggle.checked = state.hidden;
  refreshPaneData();
}

export function setLegendOpen(open) {
  const legend = document.getElementById('legend');
  const button = document.getElementById('legend-toggle');
  if (!legend) return;
  legend.hidden = !open;
  if (button) button.setAttribute('aria-expanded', String(open));
}
