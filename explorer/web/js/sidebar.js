/* Sidebar coordination: only one of the right-hand panels is open at a time. */

import { sourcePanelSide } from './store.js';

export let sidebarMode = null;
let sidebarHideTimer = null;
const SIDEBAR_MS = 340; // fallback; the live value comes from --motion-layout

export function sidebarHideDelay() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--motion-layout');
  const ms = parseFloat(raw);
  return (Number.isFinite(ms) ? ms : SIDEBAR_MS) + 40;
}

export function setSidebarMode(mode) {
  sidebarMode = mode || null;
  const layout = document.getElementById('panes');
  const panels = {
    columns: document.getElementById('columns-panel'),
    detail: document.getElementById('detail-panel'),
    source: document.getElementById('source-panel'),
    analytics: document.getElementById('analytics-panel'),
  };
  clearTimeout(sidebarHideTimer);

  for (const [key, panel] of Object.entries(panels)) {
    if (!panel || key === sidebarMode) continue;
    panel.classList.remove('is-open');
    if (panel.hidden) continue;
    // Keep the closing panel around until it has animated away.
    sidebarHideTimer = setTimeout(() => {
      if (sidebarMode !== key) panel.hidden = true;
    }, sidebarHideDelay());
  }

  const panel = panels[sidebarMode];
  if (panel) {
    panel.hidden = false;
    void panel.offsetWidth; // flush the closed state so the open transition runs
    panel.classList.add('is-open');
  }

  if (layout) layout.classList.toggle('sidebar-open', Boolean(sidebarMode));

  document.querySelectorAll('[data-role="source-info"]').forEach(btn => {
    const open = sidebarMode === 'source' && btn.dataset.side === sourcePanelSide;
    btn.setAttribute('aria-expanded', String(open));
  });

  const analyticsBtn = document.getElementById('analytics-toggle');
  if (analyticsBtn) {
    analyticsBtn.setAttribute('aria-expanded', String(sidebarMode === 'analytics'));
  }
}
