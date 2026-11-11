/* The per-item details sidebar. */

import { iconFor } from '../icons.js';
import { entryType, fmtBytes, fmtDate, fmtNum } from '../format.js';
import { counterpartTarget, statusLabel, statusTitle } from '../status.js';
import { currentProvider, panes, state } from '../store.js';
import { baseOf } from '../util.js';
import { setSidebarMode, sidebarMode } from '../sidebar.js';
import { revealCounterpart } from './reveal.js';

export function detailFact(label, value, opts = {}) {
  const row = document.createElement('div');
  row.className = 'detail-fact' + (opts.mono ? ' mono' : '');
  const name = document.createElement('span');
  name.className = 'detail-fact-label';
  name.textContent = label;
  const text = document.createElement('span');
  text.className = 'detail-fact-value';
  if (value instanceof Node) text.append(value);
  else {
    text.textContent = value;
    text.title = opts.title || value;
  }
  row.append(name, text);
  return row;
}

export function renderDetailPanel(pane, entry) {
  const body = document.getElementById('detail-body');
  if (!body || !entry) return;
  const name = entry.name || baseOf(entry.path);
  body.replaceChildren();

  const hero = document.createElement('div');
  hero.className = 'detail-hero';
  const icon = document.createElement('span');
  icon.className = 'detail-icon';
  icon.innerHTML = iconFor(entry); // static icon markup only
  const titles = document.createElement('div');
  titles.className = 'detail-hero-text';
  const heading = document.createElement('h3');
  heading.textContent = name;
  heading.title = name;
  titles.append(heading);
  if (entry.path && entry.path !== name) {
    const path = document.createElement('p');
    path.className = 'detail-path';
    path.textContent = entry.path;
    path.title = entry.path;
    titles.append(path);
  }
  hero.append(icon, titles);
  body.append(hero);

  const badges = document.createElement('div');
  badges.className = 'detail-badges';
  const type = document.createElement('span');
  type.className = 'detail-type';
  type.textContent = entry.is_dir ? 'Folder' : entryType(entry);
  const chip = document.createElement('span');
  chip.className = `status-chip st-${entry.status || 'unmatched'}`;
  const dot = document.createElement('span');
  dot.className = 'dot';
  const chipLabel = document.createElement('span');
  chipLabel.textContent = statusLabel(entry, pane.side);
  chip.append(dot, chipLabel);
  const chipTitle = statusTitle(entry);
  if (chipTitle) chip.title = chipTitle;
  badges.append(type, chip);
  body.append(badges);

  const facts = document.createElement('div');
  facts.className = 'detail-facts';
  if (entry.is_dir) {
    facts.append(detailFact('Folder size', entry.folder_size != null
      ? fmtBytes(entry.folder_size) : '—'));
    facts.append(detailFact('Items', entry.child_count != null
      ? `${fmtNum(entry.child_count)} direct` : '—'));
  } else {
    facts.append(detailFact('Size', fmtBytes(entry.size)));
  }
  if (entry.modified) facts.append(detailFact('Modified', fmtDate(entry.modified)));
  if (entry.parent) facts.append(detailFact('Folder', entry.parent, { mono: true }));
  if (entry.found_at) facts.append(detailFact('Found at', entry.found_at, { mono: true }));
  facts.append(detailFact('Source', pane.side === 'local'
    ? 'Local index'
    : currentProvider().label));
  body.append(facts);

  const notes = [];
  if (entry.note) notes.push(entry.note);
  if (entry.agg && entry.agg.total) {
    const a = entry.agg;
    const parts = [
      `${fmtNum(a.exact)} same`,
      `${fmtNum(a.moved)} moved`,
      `${fmtNum(a.possible)} maybe`,
    ];
    if (a.partial) parts.push(`${fmtNum(a.partial)} partial`);
    parts.push(`${fmtNum(a.missing)} missing`);
    notes.push(`${fmtNum(a.total)} items: ${parts.join(', ')}`);
  }
  if (notes.length) {
    const note = document.createElement('p');
    note.className = 'detail-note';
    note.textContent = notes.join('\n');
    body.append(note);
  }

  const actions = document.createElement('div');
  actions.className = 'detail-actions';
  if (entry.is_dir) {
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'btn primary';
    open.textContent = 'Open folder';
    open.addEventListener('click', () => {
      closeDetailPanel();
      pane.activate(entry);
    });
    actions.append(open);
  }
  const target = counterpartTarget(entry, pane.side);
  const reveal = document.createElement('button');
  reveal.type = 'button';
  reveal.className = 'btn';
  reveal.textContent = pane.side === 'remote'
    ? 'Show in local index'
    : `Show in ${currentProvider().label}`;
  reveal.disabled = !target;
  reveal.addEventListener('click', () => revealCounterpart(entry, pane.side));
  actions.append(reveal);
  body.append(actions);
}

export function openDetailPanel(pane, entry) {
  if (!entry) return;
  renderDetailPanel(pane, entry);
  setSidebarMode('detail');
}

export function closeDetailPanel() {
  if (sidebarMode !== 'detail') return;
  setSidebarMode(null);
}

export function refreshDetailPanel() {
  if (sidebarMode !== 'detail') return;
  const pane = panes[state.active];
  const entry = pane && pane.selectedEntry();
  if (entry) renderDetailPanel(pane, entry);
  else closeDetailPanel();
}
