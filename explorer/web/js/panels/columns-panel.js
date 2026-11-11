/* The columns sidebar: visible columns and how folder sizes are shown. */

import {
  COLUMN_DEFS,
  DEFAULT_COLUMNS,
  saveSizeMode,
  saveVisibleColumns,
} from '../columns.js';
import { SIZE_MODE_LABELS, SIZE_MODES } from '../config.js';
import { panes, state } from '../store.js';
import { setSidebarMode, sidebarMode } from '../sidebar.js';

export function columnTemplate() {
  return COLUMN_DEFS
    .filter(col => state.columns.has(col.id))
    .map(col => col.width)
    .join(' ');
}

export function setColumnVisibility(id, visible) {
  const def = COLUMN_DEFS.find(col => col.id === id);
  if (!def || def.required) return;
  if (visible) state.columns.add(id);
  else state.columns.delete(id);
  saveVisibleColumns(state.columns);
  syncColumnsPanel();
  Object.values(panes).forEach(pane => pane.applyColumns());
}

export function resetColumns() {
  state.columns = new Set(DEFAULT_COLUMNS);
  saveVisibleColumns(state.columns);
  syncColumnsPanel();
  Object.values(panes).forEach(pane => pane.applyColumns());
}

export function setSizeMode(mode) {
  if (!SIZE_MODES.includes(mode) || state.sizeMode === mode) return;
  state.sizeMode = mode;
  saveSizeMode(mode);
  syncColumnsPanel();
  Object.values(panes).forEach(pane => pane.refreshSizeDisplay());
}

export function buildColumnsPanel() {
  const options = document.getElementById('columns-options');
  if (!options) return;
  const rows = COLUMN_DEFS.map(col => {
    const row = document.createElement('label');
    row.className = 'columns-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.column = col.id;
    input.checked = state.columns.has(col.id);
    input.disabled = Boolean(col.required);
    input.addEventListener('change', () => {
      setColumnVisibility(col.id, input.checked);
    });
    const text = document.createElement('span');
    text.className = 'columns-option-text';
    const title = document.createElement('span');
    title.className = 'columns-option-title';
    title.textContent = col.label;
    const hint = document.createElement('span');
    hint.className = 'columns-option-hint';
    hint.textContent = col.required ? 'Always shown' : col.hint;
    text.append(title, hint);
    row.append(input, text);
    return row;
  });

  const sizeRow = document.createElement('label');
  sizeRow.className = 'columns-setting';
  const sizeText = document.createElement('span');
  sizeText.className = 'columns-option-text';
  const sizeTitle = document.createElement('span');
  sizeTitle.className = 'columns-option-title';
  sizeTitle.textContent = 'Folder size';
  const sizeHint = document.createElement('span');
  sizeHint.className = 'columns-option-hint';
  sizeHint.textContent = 'Choose how the Size column shows folders.';
  sizeText.append(sizeTitle, sizeHint);
  const select = document.createElement('select');
  select.id = 'columns-size-mode';
  select.className = 'columns-select';
  select.setAttribute('aria-label', 'Folder size display');
  SIZE_MODES.forEach(mode => {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = SIZE_MODE_LABELS[mode];
    select.append(option);
  });
  select.value = state.sizeMode;
  select.addEventListener('change', () => setSizeMode(select.value));
  sizeRow.append(sizeText, select);

  options.replaceChildren(...rows, sizeRow);
}

export function syncColumnsPanel() {
  document.querySelectorAll('#columns-options input[data-column]').forEach(input => {
    input.checked = state.columns.has(input.dataset.column);
  });
  const select = document.getElementById('columns-size-mode');
  if (select) select.value = state.sizeMode;
}

export function openColumnsPanel() {
  const panel = document.getElementById('columns-panel');
  if (!panel) return;
  syncColumnsPanel();
  setSidebarMode('columns');
  const close = document.getElementById('columns-close');
  if (close) close.focus({ preventScroll: true });
}

export function closeColumnsPanel() {
  if (sidebarMode !== 'columns') return;
  setSidebarMode(null);
}
