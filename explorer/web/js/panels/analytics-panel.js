/* The analytics sidebar: snapshot totals, index coverage and breakdowns. */

import { fmtBytes, fmtNum } from '../format.js';
import { currentProvider, sourceMetaCache, state } from '../store.js';
import { setSidebarMode, sidebarMode } from '../sidebar.js';
import { baseOf } from '../util.js';
import { detailFact } from './detail.js';
import { fmtSourceDate, sourceFind } from './source.js';

function sourceMeta() {
  return sourceMetaCache[state.provider] || null;
}

function analyticsHero(title, subtitle) {
  const hero = document.createElement('div');
  hero.className = 'detail-hero';
  const icon = document.createElement('span');
  icon.className = 'detail-icon analytics-hero-icon';
  icon.innerHTML = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.2 17V9.4M8 17V4.2M12.8 17v-5.1M17.6 17V6.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M2.2 17h15.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`;
  const text = document.createElement('div');
  text.className = 'detail-hero-text';
  const heading = document.createElement('h3');
  heading.textContent = title;
  text.append(heading);
  if (subtitle) {
    const sub = document.createElement('p');
    sub.className = 'detail-path';
    sub.textContent = subtitle;
    text.append(sub);
  }
  hero.append(icon, text);
  return hero;
}

function analyticsStat(label, value, tone) {
  const tile = document.createElement('div');
  tile.className = 'analytics-stat' + (tone ? ` ${tone}` : '');
  const name = document.createElement('span');
  name.className = 'analytics-stat-label';
  name.textContent = label;
  const val = document.createElement('strong');
  val.className = 'analytics-stat-value';
  val.textContent = value;
  tile.append(name, val);
  return tile;
}

function analyticsSection(title) {
  const heading = document.createElement('h4');
  heading.className = 'analytics-section-title';
  heading.textContent = title;
  return heading;
}

function analyticsCoverageRow(pct) {
  const row = document.createElement('div');
  row.className = 'analytics-coverage';
  const track = document.createElement('span');
  track.className = 'analytics-track';
  const fill = document.createElement('span');
  fill.className = 'analytics-fill ' + (pct > 90 ? 'good' : (pct > 60 ? 'ok' : 'low'));
  fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  track.append(fill);
  const label = document.createElement('span');
  label.className = 'analytics-pct';
  label.textContent = `${pct.toFixed(1)}%`;
  row.append(track, label);
  return row;
}

function analyticsBreakdownRow(label, bucket, tone) {
  const row = document.createElement('div');
  row.className = 'analytics-row';
  const name = document.createElement('span');
  name.className = 'analytics-row-label';
  const dot = document.createElement('span');
  dot.className = `dot ${tone || ''}`;
  name.append(dot, document.createTextNode(label));
  const count = document.createElement('span');
  count.className = 'analytics-row-count';
  count.textContent = `${fmtNum(bucket.files)} files`;
  const size = document.createElement('span');
  size.className = 'analytics-row-size';
  size.textContent = fmtBytes(bucket.bytes);
  row.append(name, count, size);
  return row;
}

export function renderAnalyticsPanel() {
  const body = document.getElementById('analytics-body');
  if (!body) return;
  const meta = sourceMeta();
  const provider = (meta && meta.provider) || currentProvider();

  const subtitleEl = document.getElementById('analytics-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent = `${provider.label} snapshot totals and index coverage.`;
  }

  body.replaceChildren();
  if (!meta) {
    const loading = document.createElement('p');
    loading.className = 'detail-note';
    loading.textContent = 'Loading analytics…';
    body.append(loading);
    return;
  }

  const summary = meta.summary || {};
  const archive = summary.archive || {};
  const buckets = summary.buckets || {};
  const localSource = sourceFind(meta, 'local_db');
  const archiveSource = sourceFind(meta, 'archive');
  const pct = summary.present_pct;

  body.append(analyticsHero(`${provider.label} analytics`, provider.archive || ''));

  const stats = document.createElement('div');
  stats.className = 'analytics-stats';
  stats.append(
    analyticsStat('Files', fmtNum(archive.files)),
    analyticsStat('Folders', fmtNum(archive.dirs)),
    analyticsStat('Total size', fmtBytes(archive.bytes)),
    analyticsStat('Coverage', pct != null ? `${pct.toFixed(1)}%` : '—',
      pct == null ? '' : (pct > 90 ? 'good' : (pct > 60 ? 'ok' : 'low'))));
  body.append(stats);

  if (pct != null) body.append(analyticsCoverageRow(pct));

  body.append(analyticsSection('Snapshot'));
  const snapshot = document.createElement('div');
  snapshot.className = 'detail-facts';
  snapshot.append(detailFact('Version', provider.snapshot_version || '—', { mono: true }));
  snapshot.append(detailFact('Date', fmtSourceDate(archiveSource)));
  snapshot.append(detailFact('Root', provider.root_label || '—', { mono: true }));
  snapshot.append(detailFact('Archive file', provider.archive || '—', { mono: true }));
  body.append(snapshot);

  body.append(analyticsSection('Local index'));
  const local = document.createElement('div');
  local.className = 'detail-facts';
  local.append(detailFact('Entries', fmtNum(summary.db_entries)));
  local.append(detailFact('Index date', fmtSourceDate(localSource)));
  local.append(detailFact('Source', localSource && localSource.path
    ? baseOf(localSource.path) : 'file_indexer.db', { mono: true }));
  if (localSource && !localSource.missing) {
    local.append(detailFact('Database size', fmtBytes(localSource.size)));
  }
  if (summary.local_only_count != null) {
    local.append(detailFact('Local-only entries', fmtNum(summary.local_only_count)));
  }
  body.append(local);

  const bucketRows = [
    ['Same path', buckets.exact, 'good'],
    ['Moved', buckets.moved, 'ok'],
    ['Maybe', buckets.possible, 'warn'],
    ['Missing', buckets.missing, 'low'],
  ].filter(([, bucket]) => bucket && bucket.files != null);
  if (bucketRows.length) {
    body.append(analyticsSection('Status breakdown'));
    const breakdown = document.createElement('div');
    breakdown.className = 'analytics-breakdown';
    bucketRows.forEach(([label, bucket, tone]) => {
      breakdown.append(analyticsBreakdownRow(label, bucket, tone));
    });
    body.append(breakdown);
  }

  const note = document.createElement('p');
  note.className = 'detail-note';
  note.textContent = 'Computed from the snapshot and file_indexer.db · not a live mount';
  body.append(note);
}

export function openAnalyticsPanel() {
  renderAnalyticsPanel();
  setSidebarMode('analytics');
  const close = document.getElementById('analytics-close');
  if (close) close.focus({ preventScroll: true });
}

export function closeAnalyticsPanel() {
  if (sidebarMode !== 'analytics') return;
  setSidebarMode(null);
}
