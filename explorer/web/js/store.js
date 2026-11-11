/* The few pieces of state shared across the explorer modules. */

import { readSizeMode, readVisibleColumns } from './columns.js';

export const FALLBACK_PROVIDER = {
  key: 'jottacloud',
  label: 'Jottacloud',
  root_label: 'Archive',
  subtitle: 'archive.json snapshot · virtual read-only view',
  accent: '#5e5ce6',
  available: true,
  reason: '',
};

export const state = {
  active: 'local',
  hidden: false,
  provider: 'jottacloud',
  columns: readVisibleColumns(),
  sizeMode: readSizeMode(),
};

export const providerCatalog = {
  list: [],
  byKey: {},
};

export const panes = {};

/* Shared caches / transient UI state used by more than one module. */
export const sourceMetaCache = {};
export let sourcePanelSide = 'local';

export function setSourcePanelSide(side) {
  sourcePanelSide = side === 'remote' ? 'remote' : 'local';
}

export function currentProvider() {
  return providerCatalog.byKey[state.provider] || FALLBACK_PROVIDER;
}
