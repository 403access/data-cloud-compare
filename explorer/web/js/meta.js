/* Loads the per-provider summary once and refreshes open source/analytics panels. */

import { getJSON } from './net.js';
import { sidebarMode } from './sidebar.js';
import { sourceMetaCache, sourcePanelSide, state } from './store.js';
import { renderAnalyticsPanel } from './panels/analytics-panel.js';
import { renderSourcePanel } from './panels/source.js';

export function loadMeta(providerKey = state.provider) {
  getJSON(`/api/meta?provider=${encodeURIComponent(providerKey)}`).then(data => {
    if (providerKey !== state.provider) return;
    sourceMetaCache[providerKey] = data;
    if (sidebarMode === 'source') renderSourcePanel(sourcePanelSide);
    if (sidebarMode === 'analytics') renderAnalyticsPanel();
  }).catch(() => {
    if (sidebarMode === 'source') renderSourcePanel(sourcePanelSide);
    if (sidebarMode === 'analytics') renderAnalyticsPanel();
  });
}
