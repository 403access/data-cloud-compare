/* Explorer entry point: construct the panes, load data and wire global UI. */

import { Pane } from './pane.js';
import { FALLBACK_PROVIDER, panes, providerCatalog, state } from './store.js';
import { toast } from './toast.js';
import {
  buildColumnsPanel,
  closeColumnsPanel,
  resetColumns,
} from './panels/columns-panel.js';
import { closeAnalyticsPanel, openAnalyticsPanel } from './panels/analytics-panel.js';
import { closeDetailPanel } from './panels/detail.js';
import { closeSourcePanel } from './panels/source.js';
import { revealCounterpart } from './panels/reveal.js';
import {
  loadProviders,
  switchProvider,
  updateProviderChrome,
} from './providers.js';
import { loadMeta } from './meta.js';
import { buildLegend } from './legend.js';
import {
  setActive,
  setHidden,
  setLegendOpen,
} from './selection.js';
import { setSidebarMode, sidebarMode } from './sidebar.js';
import {
  commandState,
  closeCommandBar,
  openCommandBar,
  setupCommandBar,
} from './commands.js';
import {
  setThemePanelOpen,
  setupTheme,
  themePanelOpen,
} from './theme.js';

async function init() {
  panes.local = new Pane('local', document.getElementById('pane-local'));
  panes.remote = new Pane('remote', document.getElementById('pane-remote'));

  buildColumnsPanel();
  document.getElementById('columns-close').addEventListener('click', closeColumnsPanel);
  document.getElementById('columns-reset').addEventListener('click', resetColumns);
  document.getElementById('detail-close').addEventListener('click', closeDetailPanel);
  document.getElementById('source-close').addEventListener('click', closeSourcePanel);
  document.getElementById('analytics-close').addEventListener('click', closeAnalyticsPanel);
  document.getElementById('analytics-toggle').addEventListener('click', () => {
    if (sidebarMode === 'analytics') closeAnalyticsPanel();
    else openAnalyticsPanel();
  });
  setupTheme();
  setupCommandBar();

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
    setHidden(hiddenToggle.checked);
  });

  const legendBtn = document.getElementById('legend-toggle');
  const legend = document.getElementById('legend');
  legendBtn.addEventListener('click', ev => {
    ev.stopPropagation();
    setLegendOpen(legend.hidden);
  });
  document.addEventListener('click', ev => {
    if (!legend.hidden && !legend.contains(ev.target) && ev.target !== legendBtn) {
      setLegendOpen(false);
    }
  });
  document.addEventListener('keydown', ev => {
    const mod = ev.metaKey || ev.ctrlKey;
    if (mod && !ev.altKey && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      if (commandState.open) closeCommandBar();
      else openCommandBar();
      return;
    }
    if (commandState.open) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        closeCommandBar();
      }
      return;
    }
    if (ev.key === 'Escape') {
      if (themePanelOpen) {
        ev.preventDefault();
        setThemePanelOpen(false);
        return;
      }
      if (sidebarMode) {
        ev.preventDefault();
        setSidebarMode(null);
        return;
      }
    }
    if (mod && ev.key.toLowerCase() === 'f') {
      ev.preventDefault();
      panes[state.active].searchInput.focus();
      panes[state.active].searchInput.select();
    }
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
