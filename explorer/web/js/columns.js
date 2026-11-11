/* Column configuration plus the persisted column/size preferences. */

import {
  COLUMN_STORAGE_KEY,
  SIZE_MODE_STORAGE_KEY,
  SIZE_MODES,
} from './config.js';

export const COLUMN_DEFS = [
  { id: 'name', label: 'Name', hint: 'File or folder name', width: 'minmax(0, 1fr)', required: true },
  { id: 'type', label: 'Type', hint: 'Folder or file extension', width: 'var(--col-type)' },
  { id: 'status', label: 'Status', hint: 'Comparison result', width: 'var(--col-status)' },
  { id: 'size', label: 'Size', hint: 'Nested bytes or direct item count', width: 'var(--col-size)' },
  { id: 'modified', label: 'Modified', hint: 'Last modified date', width: 'var(--col-mod)' },
];

export const DEFAULT_COLUMNS = COLUMN_DEFS.map(col => col.id);

export function readVisibleColumns() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(COLUMN_STORAGE_KEY) || 'null');
  } catch { /* ignore */ }
  if (!Array.isArray(saved)) return new Set(DEFAULT_COLUMNS);
  const valid = new Set(DEFAULT_COLUMNS);
  const chosen = new Set(saved.filter(id => valid.has(id)));
  chosen.add('name');
  return chosen;
}

export function saveVisibleColumns(columns) {
  try {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify([...columns]));
  } catch { /* ignore */ }
}

export function readSizeMode() {
  let saved = null;
  try { saved = localStorage.getItem(SIZE_MODE_STORAGE_KEY); } catch { /* ignore */ }
  return SIZE_MODES.includes(saved) ? saved : 'bytes';
}

export function saveSizeMode(mode) {
  try { localStorage.setItem(SIZE_MODE_STORAGE_KEY, mode); } catch { /* ignore */ }
}
