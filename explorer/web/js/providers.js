/* Provider catalogue, header chrome and switching the remote side. */

import { getJSON } from './net.js';
import { toast } from './toast.js';
import {
  currentProvider,
  panes,
  providerCatalog,
  sourcePanelSide,
  state,
} from './store.js';
import { sidebarMode } from './sidebar.js';
import { buildLegend } from './legend.js';
import { loadMeta } from './meta.js';
import { updateSelectionBar } from './selection.js';
import { renderAnalyticsPanel } from './panels/analytics-panel.js';
import { renderSourcePanel } from './panels/source.js';

export async function loadProviders() {
  const data = await getJSON('/api/providers');
  providerCatalog.list = data.providers || [];
  providerCatalog.byKey = {};
  providerCatalog.list.forEach(p => { providerCatalog.byKey[p.key] = p; });
}

export function updateProviderChrome() {
  const provider = currentProvider();
  document.title = `Tank ⇄ ${provider.label}`;
  document.getElementById('brand-provider').textContent = provider.label;
  document.getElementById('remote-provider-name').textContent = provider.label;
  document.getElementById('remote-root-name').textContent = provider.root_label;

  const remoteInfo = document.querySelector(
    '[data-role="source-info"][data-side="remote"]');
  if (remoteInfo) {
    const about = `About the ${provider.label} snapshot`;
    remoteInfo.title = about;
    remoteInfo.setAttribute('aria-label', about);
  }

  if (sidebarMode === 'source' && sourcePanelSide === 'remote') {
    renderSourcePanel('remote');
  }
  if (sidebarMode === 'analytics') {
    renderAnalyticsPanel();
  }

  if (panes.remote) {
    panes.remote.searchInput.placeholder = `Search ${provider.label}…`;
    panes.remote.searchInput.setAttribute('aria-label',
      `Search ${provider.label}`);
    panes.remote.root.style.setProperty('--remote-brand',
      provider.accent || '#5e5ce6');
  }

  // "In Jottacloud" / "Not in Jottacloud" (and the Google Drive equivalents)
  // depend on the current provider, so rebuild the status filters.
  Object.values(panes).forEach(pane => pane.buildStatusFilter());

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

export async function switchProvider(key) {
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
