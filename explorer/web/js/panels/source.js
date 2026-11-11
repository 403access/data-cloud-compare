/* The source-details sidebar for the local index or the remote snapshot. */

import { BASE } from '../config.js';
import { DATE, fmtBytes, fmtNum } from '../format.js';
import {
  currentProvider,
  setSourcePanelSide,
  sourceMetaCache,
  sourcePanelSide,
  state,
} from '../store.js';
import { setSidebarMode, sidebarMode } from '../sidebar.js';
import { baseOf } from '../util.js';
import { detailFact } from './detail.js';

export function fmtSourceDate(src) {
  if (!src || src.missing || !src.mtime) return 'unknown date';
  return DATE.format(new Date(src.mtime * 1000));
}

function sourceMeta() {
  return sourceMetaCache[state.provider] || null;
}

export function sourceFind(meta, label) {
  return ((meta && meta.sources) || []).find(src => src.label === label) || null;
}

function sourceHero(title, subtitle, kind) {
  const hero = document.createElement('div');
  hero.className = 'detail-hero';
  const icon = document.createElement('span');
  icon.className = 'detail-icon source-hero-icon ' + kind;
  icon.innerHTML = kind === 'local'
    ? `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
         <rect x="2.2" y="4" width="15.6" height="4.6" rx="1.4" fill="currentColor" opacity=".9"/>
         <rect x="2.2" y="9.2" width="15.6" height="6.8" rx="1.6" fill="currentColor" opacity=".55"/>
         <circle cx="5" cy="6.3" r=".85" fill="#fff" opacity=".85"/>
       </svg>`
    : `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
         <path d="M10 2.2a5.7 5.7 0 0 1 5.6 4.7 3.9 3.9 0 0 1-.8 7.7H5.4a4.1 4.1 0 0 1-.7-8.1A5.7 5.7 0 0 1 10 2.2Z" fill="currentColor" opacity=".9"/>
         <path d="M10 12.4V8.2M7.9 10l2.1-2.1 2.1 2.1" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
       </svg>`;
  const text = document.createElement('div');
  text.className = 'detail-hero-text';
  const heading = document.createElement('h3');
  heading.textContent = title;
  text.append(heading);
  if (subtitle) {
    const path = document.createElement('p');
    path.className = 'detail-path';
    path.textContent = subtitle;
    text.append(path);
  }
  hero.append(icon, text);
  return hero;
}

function sourceBadges(kind) {
  const badges = document.createElement('div');
  badges.className = 'detail-badges';
  const type = document.createElement('span');
  type.className = 'detail-type';
  type.textContent = kind === 'local' ? 'SQLite index' : 'Remote listing';
  const snapshot = document.createElement('span');
  snapshot.className = 'source-pill';
  snapshot.textContent = 'Snapshot';
  const readonly = document.createElement('span');
  readonly.className = 'source-pill';
  readonly.textContent = 'Read-only';
  badges.append(type, snapshot, readonly);
  return badges;
}

function sourceCompare(provider, localSource, archiveSource) {
  const wrap = document.createElement('div');
  wrap.className = 'source-compare';
  const left = document.createElement('span');
  left.className = 'source-compare-side';
  left.append(document.createTextNode('local index '));
  const leftDate = document.createElement('b');
  leftDate.textContent = `(${fmtSourceDate(localSource)})`;
  left.append(leftDate);
  const arrow = document.createElement('span');
  arrow.className = 'source-compare-arrow';
  arrow.textContent = '⇄';
  const right = document.createElement('span');
  right.className = 'source-compare-side';
  right.append(document.createTextNode(
    `${provider.label.toLowerCase()} snapshot `));
  const rightDate = document.createElement('b');
  rightDate.textContent = `(${fmtSourceDate(archiveSource)})`;
  right.append(rightDate);
  wrap.append(left, arrow, right);
  return wrap;
}

export function renderSourcePanel(side) {
  const body = document.getElementById('source-body');
  const titleEl = document.getElementById('source-title');
  const subtitleEl = document.getElementById('source-subtitle');
  if (!body || !titleEl || !subtitleEl) return;

  const isLocal = side === 'local';
  const meta = sourceMeta();
  const provider = (meta && meta.provider) || currentProvider();
  const localSource = sourceFind(meta, 'local_db');
  const archiveSource = sourceFind(meta, 'archive');
  const summary = (meta && meta.summary) || {};
  const archive = summary.archive || {};

  titleEl.textContent = isLocal ? 'Local index' : `${provider.label} snapshot`;
  subtitleEl.textContent = isLocal
    ? 'Reference side for every comparison.'
    : 'Remote side of the comparison.';
  body.replaceChildren();

  if (!meta) {
    const loading = document.createElement('p');
    loading.className = 'detail-note';
    loading.textContent = 'Loading source details…';
    body.append(loading);
    return;
  }

  body.append(sourceHero(
    isLocal ? 'Local index' : `${provider.label} snapshot`,
    isLocal
      ? (localSource && localSource.path) || 'file_indexer.db'
      : provider.archive || '',
    isLocal ? 'local' : 'remote'));

  body.append(sourceBadges(isLocal ? 'local' : 'remote'));

  const facts = document.createElement('div');
  facts.className = 'detail-facts';

  if (isLocal) {
    facts.append(detailFact('Source', localSource && localSource.path
      ? baseOf(localSource.path) : 'file_indexer.db', { mono: true }));
    facts.append(detailFact('Root', meta.base || BASE, { mono: true }));
    facts.append(detailFact('Index date', fmtSourceDate(localSource)));
    facts.append(detailFact('Entries', fmtNum(summary.db_entries)));
    if (localSource && !localSource.missing) {
      facts.append(detailFact('Database size', fmtBytes(localSource.size)));
    }
  } else {
    facts.append(detailFact('Provider', provider.label));
    facts.append(detailFact('Snapshot version',
      provider.snapshot_version || '—', { mono: true }));
    facts.append(detailFact('Snapshot date', fmtSourceDate(archiveSource)));
    facts.append(detailFact('Archive file', provider.archive || '—', { mono: true }));
    facts.append(detailFact('Root', provider.root_label || '—', { mono: true }));
    facts.append(detailFact('Files', fmtNum(archive.files)));
    facts.append(detailFact('Folders', fmtNum(archive.dirs)));
    facts.append(detailFact('Size', fmtBytes(archive.bytes)));
    if (provider.rclone_remote) {
      facts.append(detailFact('Remote', provider.rclone_remote, { mono: true }));
    }
    if (summary.present_pct != null) {
      facts.append(detailFact('Coverage', `${summary.present_pct.toFixed(1)}%`));
    }
  }
  body.append(facts);

  body.append(sourceCompare(provider, localSource, archiveSource));

  const note = document.createElement('p');
  note.className = 'detail-note';
  note.textContent = isLocal
    ? 'file_indexer.db snapshot · not a live mount'
    : (provider.subtitle || 'snapshot · virtual read-only view');
  body.append(note);
}

export function openSourcePanel(side) {
  setSourcePanelSide(side);
  renderSourcePanel(sourcePanelSide);
  setSidebarMode('source');
  const close = document.getElementById('source-close');
  if (close) close.focus({ preventScroll: true });
}

export function closeSourcePanel() {
  if (sidebarMode !== 'source') return;
  setSidebarMode(null);
}
