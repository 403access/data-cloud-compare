/* Two-pane Tank ⇄ cloud explorer (vanilla JS, no build step) */

'use strict';

const ROW_H = 30;
const SEARCH_MIN = 2;
const BASE = '/mnt/tank';

/* ------------------------------------------------------------------ icons */

const svg = (body, klass = '') =>
  `<svg class="${klass}" viewBox="0 0 16 16" fill="none" aria-hidden="true">${body}</svg>`;

const ICONS = {
  folder: svg(
    `<path d="M1.5 3.3a1 1 0 0 1 1-1h3.8l1.3 1.7h6.4a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V3.3Z" fill="currentColor"/>` +
    `<path d="M1.5 5.9h13" stroke="#fff" stroke-opacity=".22" stroke-width=".9"/>`,
    'row-icon-folder'),
  file: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
    `<path d="M9 1.9v2.9h2.9" stroke="currentColor" stroke-width="1.05" stroke-linejoin="round"/>`),
  image: svg(
    `<rect x="2.1" y="3" width="11.8" height="10" rx="1.5" stroke="currentColor" stroke-width="1.15"/>` +
    `<circle cx="5.8" cy="6.4" r="1.15" fill="currentColor"/>` +
    `<path d="m3.3 12.1 3.2-3.3 1.9 1.7 2.2-2.5 2.1 2.6" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>`,
    'ic-image'),
  video: svg(
    `<rect x="2.1" y="3" width="11.8" height="10" rx="1.5" stroke="currentColor" stroke-width="1.15"/>` +
    `<path d="M6.6 5.8 10.4 8l-3.8 2.2V5.8Z" fill="currentColor"/>`,
    'ic-video'),
  audio: svg(
    `<path d="M6.2 11.9V4.8l5.2-1.4v6.7" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
    `<ellipse cx="4.9" cy="12.1" rx="1.7" ry="1.35" fill="currentColor"/>` +
    `<ellipse cx="10.1" cy="10.7" rx="1.7" ry="1.35" fill="currentColor"/>`,
    'ic-audio'),
  archive: svg(
    `<rect x="2.2" y="3.1" width="11.6" height="9.8" rx="1.2" stroke="currentColor" stroke-width="1.15"/>` +
    `<path d="M2.5 5.8h11M6.1 5.8v3.4h3.8V5.8" stroke="currentColor" stroke-width="1.05"/>`,
    'ic-archive'),
  code: svg(
    `<path d="m5.7 4.6-3.3 3.4 3.3 3.4M10.3 4.6l3.3 3.4-3.3 3.4M9.1 3.1 7 12.9" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>`,
    'ic-code'),
  pdf: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
    `<path d="M9 1.9v2.9h2.9" stroke="currentColor" stroke-width="1.05" stroke-linejoin="round"/>` +
    `<text x="8" y="11.9" text-anchor="middle" font-size="4.4" font-weight="700" fill="currentColor">PDF</text>`,
    'ic-pdf'),
  text: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
    `<path d="M9 1.9v2.9h2.9M5.8 7.1h4.4M5.8 9.1h4.4M5.8 11.1h3.1" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/>`,
    'ic-text'),
  sheet: svg(
    `<rect x="2.8" y="2.6" width="10.4" height="10.8" rx="1.1" stroke="currentColor" stroke-width="1.15"/>` +
    `<path d="M3 6.1h10M3 9.4h10M6.4 3v10.3M9.7 3v10.3" stroke="currentColor" stroke-width=".95" opacity=".8"/>`,
    'ic-sheet'),
  doc: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
    `<path d="M9 1.9v2.9h2.9M5.8 7.2h4.4M5.8 9.2h4.4M5.8 11.2h2.7" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/>`,
    'ic-text'),
};

const EXT_KIND = (() => {
  const map = {};
  const add = (kind, exts) => exts.forEach(x => { map[x] = kind; });
  add('image', ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'tif',
    'tiff', 'bmp', 'svg', 'raw', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'orf']);
  add('video', ['mp4', 'mov', 'mkv', 'avi', 'wmv', 'flv', 'webm', 'm4v',
    'mpg', 'mpeg', 'ts', 'm2ts', 'vob']);
  add('audio', ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'aiff',
    'aif', 'alac', 'wma', 'dsf']);
  add('archive', ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz',
    'iso', 'dmg', 'pkg', 'cab', 'zst', 'lz4']);
  add('code', ['js', 'mjs', 'cjs', 'ts', 'jsx', 'tsx', 'json', 'html', 'htm',
    'css', 'scss', 'sass', 'less', 'py', 'rs', 'go', 'java', 'c', 'cc', 'cpp',
    'h', 'hpp', 'rb', 'php', 'sh', 'zsh', 'bash', 'yml', 'yaml', 'toml',
    'xml', 'sql', 'kt', 'swift', 'm', 'mm', 'pl', 'lua', 'vue', 'svelte']);
  add('pdf', ['pdf']);
  add('sheet', ['xls', 'xlsx', 'numbers', 'ods', 'csv', 'tsv']);
  add('doc', ['doc', 'docx', 'pages', 'odt', 'rtf', 'ppt', 'pptx', 'key',
    'epub']);
  add('text', ['txt', 'md', 'markdown', 'log', 'nfo', 'ini', 'cfg', 'conf']);
  return map;
})();

function iconFor(entry) {
  if (entry.is_dir) {
    return `<span class="row-icon">${ICONS.folder}</span>`;
  }
  const name = entry.name || '';
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  const kind = EXT_KIND[ext];
  const icon = kind && ICONS[kind] ? ICONS[kind] : ICONS.file;
  return `<span class="row-icon file-icon">${icon}</span>`;
}

/* --------------------------------------------------------------- formatting */

const NUM = new Intl.NumberFormat();
const DATE = new Intl.DateTimeFormat(undefined, {
  year: 'numeric', month: 'short', day: 'numeric',
});

function fmtNum(n) {
  return n == null ? '—' : NUM.format(n);
}

function fmtBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[i]}`;
}

function fmtDate(ts) {
  if (!ts) return '—';
  try { return DATE.format(new Date(ts * 1000)); } catch { return '—'; }
}

function entryType(entry) {
  if (entry.type) return entry.type;
  if (entry.is_dir) return 'Folder';
  const name = entry.name || baseOf(entry.path);
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1
    ? name.slice(dot + 1).toUpperCase()
    : 'File';
}

function plural(n, one, many) {
  return `${fmtNum(n)} ${n === 1 ? one : (many || one + 's')}`;
}

/* ------------------------------------------------------------------ status */

const STATUS_LABEL_REMOTE = {
  exact: 'Same',
  moved: 'Moved',
  possible: 'Maybe',
  partial: 'Partial',
  missing: 'Missing',
};

const FALLBACK_PROVIDER = {
  key: 'jottacloud',
  label: 'Jottacloud',
  root_label: 'Archive',
  subtitle: 'archive.json snapshot · virtual read-only view',
  accent: '#5e5ce6',
  available: true,
  reason: '',
};

function localStatusLabel(status) {
  const label = currentProvider().label || 'remote';
  switch (status) {
    case 'exact': return `In ${label}`;
    case 'moved_match': return 'Moved match';
    case 'local_only': return 'Local only';
    case 'type_mismatch': return 'Type differs';
    case 'unmatched': return `Not in ${label}`;
    default: return STATUS_LABEL_REMOTE[status] || status || '—';
  }
}

const CHIP_ORDER = [
  'missing', 'partial', 'possible', 'moved', 'type_mismatch',
  'moved_match', 'local_only', 'unmatched', 'exact',
];

const STATUS_FILTER_ORDER = {
  remote: ['exact', 'moved', 'possible', 'partial', 'missing'],
  local: ['exact', 'moved', 'moved_match', 'possible', 'partial', 'missing',
    'type_mismatch', 'local_only', 'unmatched'],
};

function statusLabel(entry, side) {
  if (side === 'remote') {
    return STATUS_LABEL_REMOTE[entry.status] || entry.status || '—';
  }
  return localStatusLabel(entry.status);
}

function statusTitle(entry) {
  const bits = [];
  if (entry.note) bits.push(`Report: ${entry.note}`);
  if (entry.agg && entry.agg.total) {
    const a = entry.agg;
    const parts = [
      `${fmtNum(a.exact)} same`,
      `${fmtNum(a.moved)} moved`,
      `${fmtNum(a.possible)} maybe`,
    ];
    if (a.partial) parts.push(`${fmtNum(a.partial)} partial`);
    parts.push(`${fmtNum(a.missing)} missing`);
    bits.push(`${currentProvider().label}: ${fmtNum(a.total)} items: ${parts.join(', ')}`);
  } else if (entry.is_dir && entry.child_count != null) {
    bits.push(`${fmtNum(entry.child_count)} direct items`);
  }
  if (entry.found_at) bits.push(`Found at: ${entry.found_at}`);
  return bits.join(' · ');
}

function counterpartTarget(entry, side) {
  if (!entry) return null;
  if (side === 'remote') {
    if (entry.status === 'missing') return null;
    if (entry.status === 'moved' || entry.status === 'possible') {
      return entry.found_at || null;
    }
    return entry.path; // exact / partial: same path on the local side
  }
  if (entry.status === 'local_only' || entry.status === 'unmatched') return null;
  if (entry.status === 'moved_match' || entry.status === 'moved') {
    return entry.found_at || null;
  }
  if (entry.status === 'type_mismatch') return entry.path;
  return entry.found_at || entry.path;
}

/* ------------------------------------------------------------------- state */

const COLUMN_DEFS = [
  { id: 'name', label: 'Name', hint: 'File or folder name', width: 'minmax(0, 1fr)', required: true },
  { id: 'type', label: 'Type', hint: 'Folder or file extension', width: 'var(--col-type)' },
  { id: 'status', label: 'Status', hint: 'Comparison result', width: 'var(--col-status)' },
  { id: 'size', label: 'Size', hint: 'Bytes or direct item count', width: 'var(--col-size)' },
  { id: 'modified', label: 'Modified', hint: 'Last modified date', width: 'var(--col-mod)' },
];

const COLUMN_STORAGE_KEY = 'explorer-columns';
const DEFAULT_COLUMNS = COLUMN_DEFS.map(col => col.id);

function readVisibleColumns() {
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

function saveVisibleColumns() {
  try {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify([...state.columns]));
  } catch { /* ignore */ }
}

const state = {
  active: 'local',
  hidden: false,
  provider: 'jottacloud',
  columns: readVisibleColumns(),
};

const providerCatalog = {
  list: [],
  byKey: {},
};

/* ------------------------------------------------------------- water theme */

const THEME_STORAGE_KEY = 'explorer-theme';
const WATER_SETTINGS_KEY = 'explorer-water-settings';

const WATER_DEFAULTS = Object.freeze({
  effects: true,
  drips: true,
  clickRipples: true,
  caustics: true,
  rowMotion: true,
  glass: true,
  tone: 'ocean',
  speed: 'flowing',
  intensity: 'subtle',
});

const WATER_TONES = {
  lagoon: '85, 240, 224',
  ocean: '56, 214, 255',
  deep: '72, 183, 255',
};

const WATER_SPEEDS = { calm: 0.65, flowing: 1, rapid: 1.6 };

const WATER_INTENSITY = {
  subtle: { minDist: 32, throttle: 100, alpha: 0.16, grow: 9, clickAlpha: 0.26 },
  balanced: { minDist: 22, throttle: 74, alpha: 0.22, grow: 13, clickAlpha: 0.32 },
  lively: { minDist: 14, throttle: 50, alpha: 0.28, grow: 17, clickAlpha: 0.38 },
};

function readWaterSettings() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(WATER_SETTINGS_KEY) || 'null');
  } catch { /* ignore */ }
  if (!saved || typeof saved !== 'object') return { ...WATER_DEFAULTS };
  const pick = (value, allowed, fallback) =>
    allowed.includes(value) ? value : fallback;
  return {
    effects: saved.effects !== false,
    drips: saved.drips !== false,
    clickRipples: saved.clickRipples !== false,
    caustics: saved.caustics !== false,
    rowMotion: saved.rowMotion !== false,
    glass: saved.glass !== false,
    tone: pick(saved.tone, Object.keys(WATER_TONES), WATER_DEFAULTS.tone),
    speed: pick(saved.speed, Object.keys(WATER_SPEEDS), WATER_DEFAULTS.speed),
    intensity: pick(saved.intensity, Object.keys(WATER_INTENSITY), WATER_DEFAULTS.intensity),
  };
}

let waterSettings = readWaterSettings();
let waterFX = null;

function saveWaterSettings() {
  try {
    localStorage.setItem(WATER_SETTINGS_KEY, JSON.stringify(waterSettings));
  } catch { /* ignore */ }
}

function waterSpeedFactor() {
  return WATER_SPEEDS[waterSettings.speed] || 1;
}

/* Cursor ripples and drifting caustics, drawn on a single fixed canvas. It is
 * deliberately capped and throttled so it stays a calm detail, not a toy. */
class WaterFX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    this.active = false;
    this.running = false;
    this.particles = [];
    this.pointer = null;
    this.lastSpawn = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.w = 0;
    this.h = 0;
    this.frame = this.frame.bind(this);
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize, { passive: true });
    window.addEventListener('pointermove', ev => this.onPointerMove(ev), { passive: true });
    window.addEventListener('pointerdown', ev => this.onPointerDown(ev), { passive: true });
  }

  prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  configure(settings, active) {
    this.settings = settings;
    const shouldRun = Boolean(active) && Boolean(this.ctx) && !this.prefersReducedMotion();
    this.active = shouldRun;
    if (shouldRun) this.start();
    else this.stop();
  }

  resize() {
    if (!this.ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.max(1, Math.round(this.w * dpr));
    this.canvas.height = Math.max(1, Math.round(this.h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  start() {
    if (this.running) return;
    this.resize();
    this.lastFrame = performance.now();
    this.running = true;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.particles = [];
    this.pointer = null;
    if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
  }

  onPointerMove(ev) {
    this.pointer = { x: ev.clientX, y: ev.clientY, at: performance.now() };
    if (!this.active || !this.settings.effects || !this.settings.drips) return;
    const cfg = WATER_INTENSITY[this.settings.intensity] || WATER_INTENSITY.subtle;
    const now = performance.now();
    if (now - this.lastSpawn < cfg.throttle) return;
    const dx = ev.clientX - this.lastX;
    const dy = ev.clientY - this.lastY;
    if (Math.hypot(dx, dy) < cfg.minDist) return;
    this.lastSpawn = now;
    this.lastX = ev.clientX;
    this.lastY = ev.clientY;
    this.spawn(ev.clientX, ev.clientY, 'drip');
  }

  onPointerDown(ev) {
    if (!this.active || !this.settings.effects || !this.settings.clickRipples) return;
    this.spawn(ev.clientX, ev.clientY, 'click');
  }

  spawn(x, y, kind) {
    const cfg = WATER_INTENSITY[this.settings.intensity] || WATER_INTENSITY.subtle;
    const click = kind === 'click';
    if (this.particles.length > 90) this.particles.shift();
    this.particles.push({
      x,
      y,
      age: 0,
      life: click ? 1500 : 950,
      start: click ? 2 : 1,
      grow: click ? 38 : cfg.grow,
      alpha: click ? cfg.clickAlpha : cfg.alpha,
      width: click ? 1.7 : 1.05,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  drawCaustics(now) {
    if (!this.settings.caustics) return;
    const rgb = WATER_TONES[this.settings.tone] || WATER_TONES.ocean;
    const t = now * 0.001 * waterSpeedFactor();
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i += 1) {
      const cx = this.w * (0.5 + 0.44 * Math.sin(t * 0.11 * (i + 1) + i * 1.7));
      const cy = this.h * (0.5 + 0.42 * Math.cos(t * 0.14 * (i + 1) + i * 0.83));
      const radius = Math.max(this.w, this.h) * (0.2 + 0.055 * i);
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, `rgba(${rgb}, 0.038)`);
      gradient.addColorStop(0.55, `rgba(${rgb}, 0.014)`);
      gradient.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPointer(now) {
    if (!this.settings.drips || !this.pointer) return;
    const age = now - this.pointer.at;
    if (age > 2200) return;
    const fade = Math.max(0, 1 - age / 2200);
    const rgb = WATER_TONES[this.settings.tone] || WATER_TONES.ocean;
    const ctx = this.ctx;
    const gradient = ctx.createRadialGradient(
      this.pointer.x, this.pointer.y, 0,
      this.pointer.x, this.pointer.y, 74,
    );
    gradient.addColorStop(0, `rgba(${rgb}, ${0.055 * fade})`);
    gradient.addColorStop(0.45, `rgba(${rgb}, ${0.022 * fade})`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.pointer.x, this.pointer.y, 74, 0, Math.PI * 2);
    ctx.fill();
  }

  frame(now) {
    if (!this.running) return;
    const dt = Math.min(48, now - this.lastFrame);
    this.lastFrame = now;
    const ctx = this.ctx;
    const rgb = WATER_TONES[this.settings.tone] || WATER_TONES.ocean;
    const speed = waterSpeedFactor();

    ctx.clearRect(0, 0, this.w, this.h);
    this.drawCaustics(now);
    this.drawPointer(now);

    const alive = [];
    for (const p of this.particles) {
      p.age += dt * speed;
      const progress = p.age / p.life;
      if (progress >= 1) continue;
      const eased = 1 - Math.pow(1 - progress, 3);
      const radius = p.start + p.grow * eased;
      const alpha = p.alpha * Math.pow(1 - progress, 1.6);
      const squash = 1 + 0.055 * Math.sin(progress * Math.PI * 2 + p.wobble);

      ctx.beginPath();
      ctx.ellipse(p.x, p.y, radius, radius * squash, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
      ctx.lineWidth = Math.max(0.55, p.width * (1 - progress * 0.55));
      ctx.stroke();

      if (progress < 0.42) {
        const core = 1 - progress / 0.42;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 1.5 + radius * 0.06, 1.5 + radius * 0.09, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${alpha * 0.42 * core})`;
        ctx.fill();
      }
      alive.push(p);
    }
    this.particles = alive;
    this.raf = requestAnimationFrame(this.frame);
  }
}

function applyWaterSettings({ persist = false } = {}) {
  const root = document.documentElement;
  const water = root.dataset.theme === 'water';
  root.dataset.waterTone = waterSettings.tone;
  root.dataset.waterSpeed = waterSettings.speed;
  root.dataset.waterIntensity = waterSettings.intensity;
  root.dataset.waterGlass = waterSettings.glass ? 'on' : 'off';
  root.dataset.waterEffects = waterSettings.effects ? 'on' : 'off';
  root.dataset.waterCaustics = waterSettings.caustics ? 'on' : 'off';
  root.dataset.waterRowMotion = waterSettings.rowMotion ? 'on' : 'off';
  if (persist) saveWaterSettings();

  if (waterFX) {
    waterFX.configure(waterSettings, water && waterSettings.effects);
  }
  syncWaterControls();
  updateWaterStatus(water);
}

function syncWaterControls() {
  const setToggle = (id, value) => {
    const input = document.getElementById(id);
    if (input) input.checked = value;
  };
  const setSelect = (id, value) => {
    const input = document.getElementById(id);
    if (input) input.value = value;
  };
  setToggle('water-effects', waterSettings.effects);
  setToggle('water-drips', waterSettings.drips);
  setToggle('water-click', waterSettings.clickRipples);
  setToggle('water-caustics', waterSettings.caustics);
  setToggle('water-row-motion', waterSettings.rowMotion);
  setToggle('water-glass', waterSettings.glass);
  setSelect('water-tone', waterSettings.tone);
  setSelect('water-speed', waterSettings.speed);
  setSelect('water-intensity', waterSettings.intensity);
}

function updateWaterStatus(isWaterTheme) {
  const panel = document.getElementById('theme-panel');
  const status = document.getElementById('theme-status-text');
  const activate = document.getElementById('theme-activate');
  if (!panel || !status) return;
  const paused = !isWaterTheme || !waterSettings.effects;
  panel.classList.toggle('is-paused', paused);
  if (!isWaterTheme) {
    status.textContent = 'Water effects are paused while another theme is active.';
  } else if (!waterSettings.effects) {
    status.textContent = 'Water effects are off. The theme stays calm and still.';
  } else if (!waterSettings.drips) {
    status.textContent = 'Water effects are active. Cursor drips are off.';
  } else {
    status.textContent = 'Water effects are active. Drips follow your cursor.';
  }
  if (activate) activate.hidden = isWaterTheme;
}

function applyThemeMode(mode, { persist = true, openPanel = false } = {}) {
  const root = document.documentElement;
  if (mode === 'system') delete root.dataset.theme;
  else root.dataset.theme = mode;
  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, mode); } catch { /* ignore */ }
  }
  const select = document.getElementById('theme-select');
  if (select) select.value = mode;
  applyWaterSettings();
  if (openPanel && mode === 'water') setThemePanelOpen(true);
}

let themePanelOpen = false;
let themeHideTimer = null;

function setThemePanelOpen(open) {
  const panel = document.getElementById('theme-panel');
  const layout = document.getElementById('panes');
  const toggle = document.getElementById('theme-settings-toggle');
  if (!panel || !layout) return;
  themePanelOpen = Boolean(open);
  clearTimeout(themeHideTimer);
  if (themePanelOpen) {
    panel.hidden = false;
    void panel.offsetWidth;
    panel.classList.add('is-open');
    layout.classList.add('left-open');
  } else {
    panel.classList.remove('is-open');
    layout.classList.remove('left-open');
    themeHideTimer = setTimeout(() => {
      if (!themePanelOpen) panel.hidden = true;
    }, sidebarHideDelay());
  }
  if (toggle) {
    toggle.classList.toggle('active', themePanelOpen);
    toggle.setAttribute('aria-expanded', String(themePanelOpen));
  }
}

function setupTheme() {
  const canvas = document.getElementById('water-fx');
  waterFX = new WaterFX(canvas);

  const select = document.getElementById('theme-select');
  const initial = document.documentElement.dataset.theme || 'system';
  if (select) {
    select.value = initial;
    select.addEventListener('change', () => {
      applyThemeMode(select.value, { openPanel: select.value === 'water' });
    });
  }

  const settingsToggle = document.getElementById('theme-settings-toggle');
  if (settingsToggle) {
    settingsToggle.addEventListener('click', () => {
      setThemePanelOpen(!themePanelOpen);
    });
  }
  const close = document.getElementById('theme-panel-close');
  if (close) close.addEventListener('click', () => setThemePanelOpen(false));

  const activate = document.getElementById('theme-activate');
  if (activate) {
    activate.addEventListener('click', () => {
      applyThemeMode('water', { openPanel: true });
    });
  }

  const bindToggle = (id, key) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('change', () => {
      waterSettings[key] = input.checked;
      applyWaterSettings({ persist: true });
    });
  };
  bindToggle('water-effects', 'effects');
  bindToggle('water-drips', 'drips');
  bindToggle('water-click', 'clickRipples');
  bindToggle('water-caustics', 'caustics');
  bindToggle('water-row-motion', 'rowMotion');
  bindToggle('water-glass', 'glass');

  const bindSelect = (id, key) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('change', () => {
      waterSettings[key] = input.value;
      applyWaterSettings({ persist: true });
    });
  };
  bindSelect('water-tone', 'tone');
  bindSelect('water-speed', 'speed');
  bindSelect('water-intensity', 'intensity');

  const reset = document.getElementById('theme-reset');
  if (reset) {
    reset.addEventListener('click', () => {
      waterSettings = { ...WATER_DEFAULTS };
      applyWaterSettings({ persist: true });
      toast('Water settings reset.');
    });
  }

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMotionChange = () => applyWaterSettings();
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);

  applyThemeMode(initial, { persist: false });
}

function currentProvider() {
  return providerCatalog.byKey[state.provider] || FALLBACK_PROVIDER;
}

const panes = {};

function columnTemplate() {
  return COLUMN_DEFS
    .filter(col => state.columns.has(col.id))
    .map(col => col.width)
    .join(' ');
}

function setColumnVisibility(id, visible) {
  const def = COLUMN_DEFS.find(col => col.id === id);
  if (!def || def.required) return;
  if (visible) state.columns.add(id);
  else state.columns.delete(id);
  saveVisibleColumns();
  syncColumnsPanel();
  Object.values(panes).forEach(pane => pane.applyColumns());
}

function resetColumns() {
  state.columns = new Set(DEFAULT_COLUMNS);
  saveVisibleColumns();
  syncColumnsPanel();
  Object.values(panes).forEach(pane => pane.applyColumns());
}

function buildColumnsPanel() {
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
  options.replaceChildren(...rows);
}

function syncColumnsPanel() {
  document.querySelectorAll('#columns-options input[data-column]').forEach(input => {
    input.checked = state.columns.has(input.dataset.column);
  });
}

let sidebarMode = null;
let sidebarHideTimer = null;
let sourcePanelSide = 'local';
const sourceMetaCache = {};
const SIDEBAR_MS = 340; // fallback; the live value comes from --motion-layout

function sidebarHideDelay() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--motion-layout');
  const ms = parseFloat(raw);
  return (Number.isFinite(ms) ? ms : SIDEBAR_MS) + 40;
}

function setSidebarMode(mode) {
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

function openColumnsPanel() {
  const panel = document.getElementById('columns-panel');
  if (!panel) return;
  syncColumnsPanel();
  setSidebarMode('columns');
  const close = document.getElementById('columns-close');
  if (close) close.focus({ preventScroll: true });
}

function closeColumnsPanel() {
  if (sidebarMode !== 'columns') return;
  setSidebarMode(null);
}

function closeDetailPanel() {
  if (sidebarMode !== 'detail') return;
  setSidebarMode(null);
}

/* ------------------------------------------------------------ source panel */

function fmtSourceDate(src) {
  if (!src || src.missing || !src.mtime) return 'unknown date';
  return DATE.format(new Date(src.mtime * 1000));
}

function sourceMeta() {
  return sourceMetaCache[state.provider] || null;
}

function sourceFind(meta, label) {
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

function renderSourcePanel(side) {
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

function openSourcePanel(side) {
  sourcePanelSide = side === 'remote' ? 'remote' : 'local';
  renderSourcePanel(sourcePanelSide);
  setSidebarMode('source');
  const close = document.getElementById('source-close');
  if (close) close.focus({ preventScroll: true });
}

function closeSourcePanel() {
  if (sidebarMode !== 'source') return;
  setSidebarMode(null);
}

/* --------------------------------------------------------------- analytics */

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

function renderAnalyticsPanel() {
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

function openAnalyticsPanel() {
  renderAnalyticsPanel();
  setSidebarMode('analytics');
  const close = document.getElementById('analytics-close');
  if (close) close.focus({ preventScroll: true });
}

function closeAnalyticsPanel() {
  if (sidebarMode !== 'analytics') return;
  setSidebarMode(null);
}

function detailFact(label, value, opts = {}) {
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

function renderDetailPanel(pane, entry) {
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
  facts.append(detailFact(entry.is_dir ? 'Items' : 'Size', entry.is_dir
    ? (entry.child_count != null ? `${fmtNum(entry.child_count)} direct` : '—')
    : fmtBytes(entry.size)));
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

function openDetailPanel(pane, entry) {
  if (!entry) return;
  renderDetailPanel(pane, entry);
  setSidebarMode('detail');
}

function refreshDetailPanel() {
  if (sidebarMode !== 'detail') return;
  const pane = panes[state.active];
  const entry = pane && pane.selectedEntry();
  if (entry) renderDetailPanel(pane, entry);
  else closeDetailPanel();
}

let toastTimer = null;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

function parentOf(path) {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

function baseOf(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

/* -------------------------------------------------------------------- pane */

class Pane {
  constructor(side, root) {
    this.side = side;
    this.root = root;
    this.path = '';
    this.history = [''];
    this.hIndex = 0;
    this.entries = [];
    this.results = [];
    this.selected = null;
    this.sort = 'name';
    this.dir = 'asc';
    this.query = '';
    this.scope = 'all';
    this.statusFilters = new Set();
    this.searchMode = false;
    this.truncated = false;
    this.exists = true;
    this.stats = { files: 0, dirs: 0, items: 0, bytes: 0 };
    this.loading = false;
    this.reqSeq = 0;
    this.searchTimer = null;
    this.renderQueued = false;

    this.list = root.querySelector('[data-role="list"]');
    this.spacer = root.querySelector('[data-role="spacer"]');
    this.body = root.querySelector('[data-role="body"]');
    this.emptyEl = root.querySelector('[data-role="empty"]');
    this.loadingEl = root.querySelector('[data-role="loading"]');
    this.crumbsEl = root.querySelector('[data-role="crumbs"]');
    this.searchInput = root.querySelector('[data-role="search"]');
    this.scopeSelect = root.querySelector('[data-role="scope"]');
    this.filterBtn = root.querySelector('[data-role="filter-toggle"]');
    this.filterLabel = root.querySelector('[data-role="filter-label"]');
    this.filterMenu = root.querySelector('[data-role="filter-menu"]');
    this.clearBtn = root.querySelector('[data-role="clear"]');
    this.summaryEl = root.querySelector('[data-role="summary"]');
    this.chipsEl = root.querySelector('[data-role="chips"]');
    this.columnHead = root.querySelector('[data-role="columns"]');
    this.columnButtons = [...root.querySelectorAll('[data-sort]')];
    this.backBtn = root.querySelector('[data-act="back"]');
    this.forwardBtn = root.querySelector('[data-act="forward"]');
    this.upBtn = root.querySelector('[data-act="up"]');
    this.mirrorBtn = root.querySelector('[data-act="mirror"]');
    this.sourceInfoBtn = root.querySelector('[data-role="source-info"]');

    this.bind();
    this.applyColumns(false);
    this.updateSortIndicators();
    this.buildStatusFilter();

    this.list.addEventListener('scroll', () => this.scheduleRender());
    window.addEventListener('resize', () => this.scheduleRender());
  }

  get other() {
    return this.side === 'local' ? panes.remote : panes.local;
  }

  get rootLabel() {
    return this.side === 'local'
      ? BASE
      : (currentProvider().root_label || 'Archive');
  }

  baseEntries() {
    return this.searchMode ? this.results : this.entries;
  }

  currentEntries() {
    const base = this.baseEntries();
    if (!this.statusFilters.size) return base;
    return base.filter(e => this.statusFilters.has(e.status));
  }

  selectedEntry() {
    if (!this.selected) return null;
    return this.currentEntries().find(e => e.path === this.selected) || null;
  }

  bind() {
    this.root.addEventListener('pointerdown', () => setActive(this.side));

    this.root.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'back') this.back();
        else if (act === 'forward') this.forward();
        else if (act === 'up') this.up();
        else if (act === 'mirror') this.mirror();
      });
    });

    if (this.sourceInfoBtn) {
      this.sourceInfoBtn.addEventListener('click', ev => {
        ev.stopPropagation();
        openSourcePanel(this.side);
      });
    }

    this.columnButtons.forEach(btn => {
      btn.addEventListener('click', () => this.setSort(btn.dataset.sort));
    });

    this.columnHead.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      openColumnsPanel();
    });
    this.list.addEventListener('contextmenu', ev => {
      const row = ev.target.closest('.row');
      if (!row) {
        ev.preventDefault();
        openColumnsPanel();
        return;
      }
      ev.preventDefault();
      setActive(this.side);
      this.select(row.dataset.path);
      const entry = this.currentEntries().find(e => e.path === row.dataset.path);
      if (entry) openDetailPanel(this, entry);
    });

    this.body.addEventListener('click', ev => {
      const row = ev.target.closest('.row');
      if (!row) return;
      setActive(this.side);
      this.select(row.dataset.path);
      this.list.focus({ preventScroll: true });
    });

    this.body.addEventListener('dblclick', ev => {
      const row = ev.target.closest('.row');
      if (!row) return;
      const entry = this.currentEntries().find(e => e.path === row.dataset.path);
      if (entry) this.activate(entry);
    });

    this.list.addEventListener('keydown', ev => this.onKey(ev));
    this.list.addEventListener('focus', () => setActive(this.side));

    this.searchInput.addEventListener('input', () => this.onSearchInput());
    this.searchInput.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        this.clearSearch();
      } else if (ev.key === 'ArrowDown' || ev.key === 'Enter') {
        const entries = this.currentEntries();
        if (this.searchMode && entries.length) {
          ev.preventDefault();
          this.select(entries[0].path);
          this.list.focus();
        }
      }
    });
    this.scopeSelect.addEventListener('change', () => {
      this.scope = this.scopeSelect.value;
      if (this.searchMode && this.query) this.runSearch(this.query);
    });
    this.filterBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      const opening = this.filterMenu.hidden;
      this.setFilterMenuOpen(opening);
      if (opening && ev.detail === 0) {
        const first = this.filterMenu.querySelector('input');
        if (first) first.focus();
      }
    });
    this.filterBtn.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && !this.filterMenu.hidden) {
        ev.preventDefault();
        this.setFilterMenuOpen(false);
      }
    });
    this.filterMenu.addEventListener('click', ev => ev.stopPropagation());
    this.filterMenu.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        this.setFilterMenuOpen(false);
        this.filterBtn.focus();
      }
    });
    document.addEventListener('click', () => this.setFilterMenuOpen(false));
    this.clearBtn.addEventListener('click', () => this.clearSearch());
  }

  /* ------------------------------------------------------------ filtering */

  statusFilterOptions() {
    const order = STATUS_FILTER_ORDER[this.side] || STATUS_FILTER_ORDER.remote;
    return order.map(status => ({
      value: status,
      label: statusLabel({ status }, this.side),
    }));
  }

  activeStatusFilters() {
    const order = STATUS_FILTER_ORDER[this.side] || STATUS_FILTER_ORDER.remote;
    return order.filter(status => this.statusFilters.has(status));
  }

  statusFilterLabel() {
    return this.activeStatusFilters()
      .map(status => statusLabel({ status }, this.side))
      .join(', ');
  }

  updateFilterButton() {
    const active = this.activeStatusFilters();
    this.filterLabel.textContent = active.length === 0
      ? 'Filter'
      : active.length === 1 ? active[0] : `Filter · ${active.length}`;
    this.filterBtn.classList.toggle('active', active.length > 0);
    this.filterBtn.title = active.length
      ? `Filtering by: ${active.join(', ')}`
      : 'Filter by status';
  }

  setFilterMenuOpen(open) {
    this.filterMenu.hidden = !open;
    this.filterBtn.setAttribute('aria-expanded', String(open));
    this.filterBtn.classList.toggle('open', open);
    if (open) {
      Object.values(panes).forEach(pane => {
        if (pane && pane !== this) pane.setFilterMenuOpen(false);
      });
    }
  }

  buildStatusFilter() {
    const options = this.statusFilterOptions();
    const valid = new Set(options.map(option => option.value));
    this.statusFilters.forEach(status => {
      if (!valid.has(status)) this.statusFilters.delete(status);
    });

    const head = document.createElement('div');
    head.className = 'filter-menu-head';
    const caption = document.createElement('span');
    caption.textContent = 'Show only';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'filter-clear';
    clear.textContent = 'Clear all';
    clear.addEventListener('click', () => this.clearStatusFilters());
    head.append(caption, clear);

    const rows = options.map(option => {
      const row = document.createElement('label');
      row.className = 'filter-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = option.value;
      input.checked = this.statusFilters.has(option.value);
      input.addEventListener('change', () => {
        if (input.checked) this.statusFilters.add(option.value);
        else this.statusFilters.delete(option.value);
        this.onStatusFilterChange();
      });
      const dot = document.createElement('span');
      dot.className = `filter-dot st-${option.value}`;
      const text = document.createElement('span');
      text.textContent = option.label;
      row.append(input, dot, text);
      return row;
    });

    this.filterMenu.replaceChildren(head, ...rows);
    this.updateFilterButton();
  }

  syncStatusFilterInputs() {
    this.filterMenu.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.checked = this.statusFilters.has(input.value);
    });
  }

  onStatusFilterChange() {
    if (this.selected && !this.currentEntries().some(e => e.path === this.selected)) {
      this.selected = null;
    }
    this.updateFilterButton();
    this.renderAll(true);
    this.updateFooter();
    updateSelectionBar();
  }

  toggleStatusFilter(status) {
    if (this.statusFilters.has(status)) this.statusFilters.delete(status);
    else this.statusFilters.add(status);
    this.syncStatusFilterInputs();
    this.onStatusFilterChange();
  }

  clearStatusFilters() {
    if (!this.statusFilters.size) return;
    this.statusFilters.clear();
    this.syncStatusFilterInputs();
    this.onStatusFilterChange();
  }

  /* ---------------------------------------------------------- navigation */

  async navigate(path, opts = {}) {
    const { push = true, select = null } = opts;
    path = path || '';
    this.exitSearch(false);
    closeDetailPanel();
    this.path = path;
    if (push) {
      if (this.history[this.hIndex] !== path) {
        this.history = this.history.slice(0, this.hIndex + 1);
        this.history.push(path);
        this.hIndex = this.history.length - 1;
      }
    }
    this.selected = select;
    return this.fetchList();
  }

  async fetchList() {
    const seq = ++this.reqSeq;
    this.setLoading(true);
    const url = `/api/list?side=${this.side}` +
      `&provider=${encodeURIComponent(state.provider)}` +
      `&path=${encodeURIComponent(this.path)}` +
      `&sort=${this.sort}&dir=${this.dir}` +
      `&hidden=${state.hidden ? 1 : 0}`;
    try {
      const data = await getJSON(url);
      if (seq !== this.reqSeq) return null;
      this.applyList(data);
      return data;
    } catch (err) {
      if (seq === this.reqSeq) {
        this.entries = [];
        this.exists = false;
        this.renderAll(true);
        this.showEmpty(`Could not load this folder: ${err.message}`);
        toast(err.message);
      }
      return null;
    } finally {
      if (seq === this.reqSeq) this.setLoading(false);
    }
  }

  applyList(data) {
    this.entries = data.entries || [];
    this.stats = data.stats || { files: 0, dirs: 0, items: 0, bytes: 0 };
    this.exists = data.exists !== false;
    if (this.selected && !this.currentEntries().some(e => e.path === this.selected)) {
      this.selected = null;
    }
    this.renderCrumbs(data.crumbs || []);
    this.updateNavButtons();
    this.updateFooter();
    this.renderAll(true);
    this.root.classList.toggle('missing-path', !this.exists);
    updateSelectionBar();
  }

  back() {
    if (this.hIndex <= 0) return;
    this.hIndex -= 1;
    this.navigate(this.history[this.hIndex], { push: false });
  }

  forward() {
    if (this.hIndex >= this.history.length - 1) return;
    this.hIndex += 1;
    this.navigate(this.history[this.hIndex], { push: false });
  }

  up() {
    if (!this.path) return;
    this.navigate(parentOf(this.path));
  }

  async mirror() {
    const data = await this.other.navigate(this.path, { push: true });
    if (data && !data.exists) {
      toast(`“${this.path || '/'}” was not found on the ` +
        `${this.other.side === 'local' ? 'local' : currentProvider().label} side.`);
    }
  }

  updateNavButtons() {
    this.backBtn.disabled = this.hIndex <= 0;
    this.forwardBtn.disabled = this.hIndex >= this.history.length - 1;
    this.upBtn.disabled = !this.path;
  }

  /* -------------------------------------------------------------- search */

  onSearchInput() {
    const q = this.searchInput.value.trim();
    this.clearBtn.hidden = q.length === 0;
    this.root.querySelector('.searchbar').classList.toggle('searching', q.length > 0);
    clearTimeout(this.searchTimer);
    if (!q) {
      if (this.searchMode) this.clearSearch();
      return;
    }
    if (q.length < SEARCH_MIN) {
      if (this.searchMode) {
        this.exitSearch(false);
        this.fetchList();
      }
      return;
    }
    this.searchTimer = setTimeout(() => this.runSearch(q), 260);
  }

  async runSearch(q) {
    const seq = ++this.reqSeq;
    this.searchMode = true;
    this.query = q;
    this.selected = null;
    this.setLoading(true);
    const url = `/api/search?side=${this.side}` +
      `&provider=${encodeURIComponent(state.provider)}` +
      `&q=${encodeURIComponent(q)}` +
      `&scope=${this.scope}&path=${encodeURIComponent(this.path)}` +
      `&hidden=${state.hidden ? 1 : 0}`;
    try {
      const data = await getJSON(url);
      if (seq !== this.reqSeq) return;
      this.results = data.entries || [];
      this.truncated = !!data.truncated;
      this.sortResults();
      this.updateFooter();
      this.renderAll(true);
      updateSelectionBar();
    } catch (err) {
      if (seq === this.reqSeq) toast(`Search failed: ${err.message}`);
    } finally {
      if (seq === this.reqSeq) this.setLoading(false);
    }
  }

  clearSearch() {
    if (!this.searchMode && !this.searchInput.value) return;
    this.exitSearch(false);
    this.searchInput.value = '';
    this.clearBtn.hidden = true;
    this.root.querySelector('.searchbar').classList.remove('searching');
    this.fetchList();
  }

  exitSearch(reload) {
    const wasSearching = this.searchMode;
    this.searchMode = false;
    this.query = '';
    this.results = [];
    this.truncated = false;
    clearTimeout(this.searchTimer);
    if (wasSearching) {
      this.searchInput.value = '';
      this.clearBtn.hidden = true;
      this.root.querySelector('.searchbar').classList.remove('searching');
    }
    if (reload && wasSearching) this.fetchList();
  }

  sortResults() {
    const statusOrder = {
      missing: 0, partial: 1, possible: 2, moved: 3, moved_match: 3,
      type_mismatch: 4, exact: 5, local_only: 6, unmatched: 7,
    };
    let key;
    if (this.sort === 'size') key = e => e.size || 0;
    else if (this.sort === 'modified') key = e => e.modified || 0;
    else if (this.sort === 'status') key = e => statusOrder[e.status] ?? 99;
    else if (this.sort === 'type') key = e => entryType(e).toLocaleLowerCase();
    else key = e => (e.name || '').toLocaleLowerCase();
    const dir = this.dir === 'desc' ? -1 : 1;
    this.results.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      const ak = key(a);
      const bk = key(b);
      if (ak < bk) return -1 * dir;
      if (ak > bk) return 1 * dir;
      return 0;
    });
  }

  setSort(sort) {
    if (this.sort === sort) {
      this.dir = this.dir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sort = sort;
      this.dir = 'asc';
    }
    this.updateSortIndicators();
    if (this.searchMode) {
      this.sortResults();
      this.renderAll(true);
    } else {
      this.fetchList();
    }
  }

  applyColumns(rerender = true) {
    this.columnButtons.forEach(btn => {
      btn.hidden = !state.columns.has(btn.dataset.sort);
    });
    this.root.style.setProperty('--col-template', columnTemplate());
    this.updateSortIndicators();
    if (rerender) this.renderAll(false);
  }

  updateSortIndicators() {
    this.columnButtons.forEach(btn => {
      const active = btn.dataset.sort === this.sort;
      btn.classList.toggle('sorted', active);
      btn.classList.toggle('desc', active && this.dir === 'desc');
    });
  }

  /* -------------------------------------------------------------- render */

  setLoading(on) {
    this.loading = on;
    this.loadingEl.hidden = !on;
  }

  renderAll(resetScroll) {
    const entries = this.currentEntries();
    if (resetScroll) this.list.scrollTop = 0;
    this.spacer.style.height = `${entries.length * ROW_H}px`;
    this.emptyEl.hidden = true;
    if (!entries.length) {
      this.body.replaceChildren();
      this.showEmpty();
      return;
    }
    this.renderWindow();
  }

  scheduleRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.renderWindow();
    });
  }

  renderWindow() {
    const entries = this.currentEntries();
    if (!entries.length) {
      this.body.replaceChildren();
      return;
    }
    const scrollTop = this.list.scrollTop;
    const height = this.list.clientHeight || 400;
    let start = Math.max(0, Math.floor(scrollTop / ROW_H) - 4);
    let end = Math.min(entries.length,
      Math.ceil((scrollTop + height) / ROW_H) + 6);

    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i += 1) {
      frag.appendChild(this.buildRow(entries[i]));
    }
    this.body.replaceChildren(frag);
    this.body.style.transform = `translateY(${start * ROW_H}px)`;
  }

  buildRow(entry) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.path = entry.path;
    if (this.selected === entry.path) row.classList.add('selected');
    const statusClass = `st-${entry.status || 'unmatched'}`;

    const nameCell = document.createElement('div');
    nameCell.className = 'row-cell cell-name';
    const iconWrap = document.createElement('span');
    iconWrap.innerHTML = iconFor(entry); // static icon markup only
    const label = document.createElement('span');
    label.className = 'name-label';
    label.textContent = entry.name || baseOf(entry.path);
    label.title = entry.path;
    nameCell.append(iconWrap.firstElementChild, label);
    if (this.searchMode) {
      const sub = document.createElement('span');
      sub.className = 'subpath';
      sub.textContent = entry.parent || '/';
      sub.title = entry.parent || '/';
      nameCell.append(sub);
    }

    const typeCell = document.createElement('div');
    typeCell.className = 'row-cell cell-type';
    typeCell.textContent = entryType(entry);
    if (!entry.is_dir && entry.size != null) {
      typeCell.title = `${entryType(entry)} file · ${fmtNum(entry.size)} bytes`;
    }

    const statusCell = document.createElement('div');
    statusCell.className = 'row-cell cell-status';
    const chip = document.createElement('span');
    chip.className = `status-chip ${statusClass}`;
    const dot = document.createElement('span');
    dot.className = 'dot';
    const chipLabel = document.createElement('span');
    chipLabel.textContent = statusLabel(entry, this.side);
    chip.append(dot, chipLabel);
    const title = statusTitle(entry);
    if (title) chip.title = title;
    statusCell.append(chip);

    const sizeCell = document.createElement('div');
    sizeCell.className = 'row-cell cell-size';
    if (entry.is_dir) {
      if (entry.child_count != null) {
        sizeCell.textContent = fmtNum(entry.child_count);
        sizeCell.title = `${fmtNum(entry.child_count)} direct items`;
      } else {
        sizeCell.textContent = '—';
      }
    } else {
      sizeCell.textContent = fmtBytes(entry.size);
      sizeCell.title = entry.size != null ? `${fmtNum(entry.size)} bytes` : '';
    }

    const modCell = document.createElement('div');
    modCell.className = 'row-cell cell-mod';
    modCell.textContent = entry.modified ? fmtDate(entry.modified) : '—';

    const cells = {
      name: nameCell,
      type: typeCell,
      status: statusCell,
      size: sizeCell,
      modified: modCell,
    };
    COLUMN_DEFS.forEach(col => {
      if (state.columns.has(col.id)) row.append(cells[col.id]);
    });
    return row;
  }

  showEmpty(message) {
    const entries = this.currentEntries();
    let text = message;
    if (!text) {
      if (!this.exists) {
        text = `“${this.path || '/'}” does not exist in ` +
          (this.side === 'local'
            ? 'the local index.'
            : `the ${currentProvider().label} snapshot.`);
      } else if (this.statusFilters.size && this.baseEntries().length) {
        text = 'No items match the selected status filters.';
      } else if (this.searchMode) {
        text = this.truncated
          ? `Showing the first results for “${this.query}”. Type more to narrow it down.`
          : `No matches for “${this.query}”.`;
      } else {
        text = 'This folder is empty.';
      }
    }
    this.emptyEl.textContent = text;
    this.emptyEl.hidden = false;
    this.spacer.style.height = '0px';
    this.body.replaceChildren();
    if (entries.length) this.emptyEl.hidden = true;
  }

  renderCrumbs(crumbs) {
    this.crumbsEl.replaceChildren();
    if (!crumbs.length) return;
    crumbs.forEach((c, index) => {
      if (index > 0) {
        const sep = document.createElement('span');
        sep.className = 'crumb-sep';
        sep.textContent = '›';
        this.crumbsEl.append(sep);
      }
      const btn = document.createElement('button');
      btn.className = 'crumb';
      btn.textContent = index === 0 ? this.rootLabel : c.name;
      btn.title = c.path || this.rootLabel;
      btn.addEventListener('click', () => this.navigate(c.path));
      this.crumbsEl.append(btn);
    });
    requestAnimationFrame(() => {
      this.crumbsEl.scrollLeft = this.crumbsEl.scrollWidth;
    });
  }

  updateFooter() {
    const entries = this.currentEntries();
    const base = this.baseEntries();
    if (this.searchMode) {
      this.summaryEl.textContent = this.statusFilters.size
        ? `${fmtNum(entries.length)} of ${fmtNum(base.length)} results · ` +
          `${this.statusFilterLabel()}`
        : `${fmtNum(entries.length)}${this.truncated ? '+' : ''} results` +
          (this.truncated ? ' · refine to narrow down' : '');
    } else if (this.statusFilters.size) {
      this.summaryEl.textContent =
        `Showing ${fmtNum(entries.length)} of ${fmtNum(base.length)} items · ` +
        `${this.statusFilterLabel()}`;
    } else {
      const s = this.stats || {};
      this.summaryEl.textContent =
        `${fmtNum(s.items)} items · ${plural(s.dirs, 'folder')} · ` +
        `${plural(s.files, 'file')} · ${fmtBytes(s.bytes)}`;
    }

    const counts = {};
    base.forEach(e => { counts[e.status] = (counts[e.status] || 0) + 1; });
    this.chipsEl.replaceChildren();
    CHIP_ORDER.forEach(status => {
      if (!counts[status]) return;
      if (status === 'exact') return; // the uninteresting default
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `mini-chip st-${status}` +
        (this.statusFilters.has(status) ? ' active' : '');
      chip.title = this.statusFilters.has(status)
        ? 'Remove this status from the filter'
        : `Add ${statusLabel({ status }, this.side)} to the filter`;
      chip.innerHTML = '<span class="dot"></span>';
      const text = document.createElement('span');
      text.textContent = `${statusLabel({ status }, this.side)} ${fmtNum(counts[status])}`;
      chip.append(text);
      chip.addEventListener('click', () => this.toggleStatusFilter(status));
      this.chipsEl.append(chip);
    });
  }

  /* ----------------------------------------------------------- selection */

  select(path) {
    this.selected = path || null;
    this.body.querySelectorAll('.row.selected').forEach(r => r.classList.remove('selected'));
    if (this.selected) {
      const row = [...this.body.querySelectorAll('.row')]
        .find(r => r.dataset.path === this.selected);
      if (row) row.classList.add('selected');
      this.scrollIntoView(this.selected);
    }
    updateSelectionBar();
  }

  scrollIntoView(path) {
    const entries = this.currentEntries();
    const index = entries.findIndex(e => e.path === path);
    if (index < 0) return;
    const top = this.list.scrollTop;
    const height = this.list.clientHeight || 400;
    if (index * ROW_H < top) {
      this.list.scrollTop = index * ROW_H;
    } else if ((index + 1) * ROW_H > top + height) {
      this.list.scrollTop = (index + 1) * ROW_H - height + 2;
    }
    this.scheduleRender();
  }

  activate(entry) {
    if (!entry) return;
    if (this.searchMode) {
      if (entry.is_dir) {
        this.navigate(entry.path);
      } else {
        this.navigate(entry.parent, { select: entry.path });
      }
      return;
    }
    if (entry.is_dir) {
      this.navigate(entry.path);
    } else {
      revealCounterpart(entry, this.side);
    }
  }

  onKey(ev) {
    const entries = this.currentEntries();
    if (!entries.length) return;
    const index = entries.findIndex(e => e.path === this.selected);
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      const next = Math.min(entries.length - 1, index < 0 ? 0 : index + 1);
      this.select(entries[next].path);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      const next = Math.max(0, index < 0 ? 0 : index - 1);
      this.select(entries[next].path);
    } else if (ev.key === 'Home') {
      ev.preventDefault();
      this.select(entries[0].path);
    } else if (ev.key === 'End') {
      ev.preventDefault();
      this.select(entries[entries.length - 1].path);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (index >= 0) this.activate(entries[index]);
    } else if (ev.key === 'Backspace') {
      ev.preventDefault();
      this.up();
    } else if (ev.key === 'Escape') {
      if (this.searchMode || this.searchInput.value) this.clearSearch();
      else this.select(null);
    }
  }
}

/* ------------------------------------------------------------- selection bar */

function setActive(side) {
  if (state.active === side && panes[side] && panes[side].root.classList.contains('active')) {
    return;
  }
  state.active = side;
  Object.entries(panes).forEach(([key, pane]) => {
    pane.root.classList.toggle('active', key === side);
  });
  updateSelectionBar();
}

function updateSelectionBar() {
  const pane = panes[state.active];
  const info = document.getElementById('selection-info');
  const revealBtn = document.getElementById('reveal-btn');
  if (!pane) return;

  const entry = pane.selectedEntry();
  refreshDetailPanel();
  info.replaceChildren();
  info.classList.remove('selection-enter');
  void info.offsetWidth;
  info.classList.add('selection-enter');
  if (!entry) {
    const span = document.createElement('span');
    span.className = 'muted';
    span.textContent = 'Select an item to see details.';
    info.append(span);
    revealBtn.disabled = true;
    revealBtn.textContent = 'Reveal counterpart';
    return;
  }

  const name = document.createElement('span');
  name.className = 'sel-name';
  name.textContent = entry.name || entry.path;
  name.title = entry.path;
  info.append(name);

  const meta = document.createElement('span');
  meta.className = 'sel-meta';
  const bits = [];
  if (entry.is_dir) {
    bits.push('Folder');
    if (entry.child_count != null) bits.push(`${fmtNum(entry.child_count)} items`);
  } else {
    bits.push('File');
    bits.push(fmtBytes(entry.size));
  }
  if (entry.modified) bits.push(fmtDate(entry.modified));
  meta.textContent = bits.join(' · ');
  info.append(meta);

  const chip = document.createElement('span');
  chip.className = `status-chip st-${entry.status || 'unmatched'}`;
  const dot = document.createElement('span');
  dot.className = 'dot';
  const label = document.createElement('span');
  label.textContent = statusLabel(entry, pane.side);
  chip.append(dot, label);
  const title = statusTitle(entry);
  if (title) chip.title = title;
  info.append(chip);

  if (entry.found_at) {
    const found = document.createElement('button');
    found.className = 'sel-found';
    found.textContent = `Found at: ${entry.found_at}`;
    found.title = entry.found_at;
    found.addEventListener('click', () => {
      revealCounterpart(entry, pane.side);
    });
    info.append(found);
  }

  const target = counterpartTarget(entry, pane.side);
  revealBtn.disabled = !target;
  revealBtn.textContent = pane.side === 'remote'
    ? 'Show in local index'
    : `Show in ${currentProvider().label}`;
}

async function revealCounterpart(entry, side) {
  const target = counterpartTarget(entry, side);
  if (!target) {
    toast(side === 'remote'
      ? 'This item has no match on the local side.'
      : `This item has no counterpart in ${currentProvider().label}.`);
    return;
  }
  const dest = side === 'remote' ? panes.local : panes.remote;
  const parent = parentOf(target);
  const name = baseOf(target);
  const data = await dest.navigate(parent, { push: true, select: target });
  if (data && !data.exists) {
    toast(`Counterpart folder not found: ${parent || '/'}`);
    return;
  }
  setActive(dest.side);
  dest.list.focus();
  if (name) dest.select(target);
}

function refreshPane(pane) {
  if (!pane) return;
  if (pane.searchMode && pane.query) pane.runSearch(pane.query);
  else pane.fetchList();
}

function refreshPaneData() {
  Object.values(panes).forEach(refreshPane);
}

function setHidden(value) {
  state.hidden = Boolean(value);
  const toggle = document.getElementById('hidden-toggle');
  if (toggle) toggle.checked = state.hidden;
  refreshPaneData();
}

function setLegendOpen(open) {
  const legend = document.getElementById('legend');
  const button = document.getElementById('legend-toggle');
  if (!legend) return;
  legend.hidden = !open;
  if (button) button.setAttribute('aria-expanded', String(open));
}

/* ------------------------------------------------------------- command bar */

const COMMAND_ICONS = {
  local: svg(
    `<rect x="2.2" y="4" width="11.6" height="3.4" rx="1" stroke="currentColor" stroke-width="1.2"/>` +
    `<rect x="2.2" y="8.4" width="11.6" height="4.4" rx="1.2" stroke="currentColor" stroke-width="1.2"/>` +
    `<circle cx="4.2" cy="5.7" r=".6" fill="currentColor"/>`),
  remote: svg(
    `<path d="M8 2.5a4.2 4.2 0 0 1 4.1 3.5 3 3 0 0 1-.6 5.9H4.5a3.1 3.1 0 0 1-.6-6.1A4.2 4.2 0 0 1 8 2.5Z" stroke="currentColor" stroke-width="1.25"/>`),
  search: svg(
    `<circle cx="7.1" cy="7.1" r="4.2" stroke="currentColor" stroke-width="1.35"/>` +
    `<path d="m10.3 10.3 3 3" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>`),
  home: svg(
    `<path d="M2.6 7.4 8 2.7l5.4 4.7v6H9.8V9.6H6.2v3.8H2.6v-6Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>`),
  back: svg(
    `<path d="m9.6 3.6-4.2 4.4 4.2 4.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`),
  forward: svg(
    `<path d="m6.4 3.6 4.2 4.4-4.2 4.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`),
  up: svg(
    `<path d="M8 13V3.6M3.9 7.7 8 3.6l4.1 4.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`),
  mirror: svg(
    `<path d="M2.4 5.8h8.3M8.7 3.3l2.5 2.5-2.5 2.5M13.6 10.2H5.3m2 2.5-2.5-2.5 2.5-2.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>`),
  reveal: svg(
    `<path d="M1.8 8s2.3-4.1 6.2-4.1S14.2 8 14.2 8s-2.3 4.1-6.2 4.1S1.8 8 1.8 8Z" stroke="currentColor" stroke-width="1.25"/>` +
    `<circle cx="8" cy="8" r="1.8" stroke="currentColor" stroke-width="1.2"/>`),
  hidden: svg(
    `<path d="M1.8 8s2.3-4.1 6.2-4.1S14.2 8 14.2 8s-2.3 4.1-6.2 4.1S1.8 8 1.8 8Z" stroke="currentColor" stroke-width="1.25"/>` +
    `<circle cx="8" cy="8" r="1.8" fill="currentColor" opacity=".7"/>`),
  columns: svg(
    `<rect x="2" y="2.7" width="12" height="10.6" rx="1.4" stroke="currentColor" stroke-width="1.25"/>` +
    `<path d="M5.8 2.9v10.2M9.6 2.9v10.2" stroke="currentColor" stroke-width="1.05"/>`),
  legend: svg(
    `<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3"/>` +
    `<path d="M8 7.3v3.4M8 5.1v.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`),
  sort: svg(
    `<path d="M3.7 3.1v9.4M2 10.8l1.7 1.7 1.7-1.7M8.2 4.1h5.3M9.3 7.1h4.2M10.6 10.1h2.9" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>`),
  filter: svg(
    `<path d="M2.4 3.2h11.2L9.3 8.3v4.2L6.8 14V8.3L2.4 3.2Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>`),
  theme: svg(
    `<circle cx="8" cy="8" r="2.7" stroke="currentColor" stroke-width="1.25"/>` +
    `<path d="M8 1.7v1.5M8 12.8v1.5M1.7 8h1.5M12.8 8h1.5M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`),
  water: svg(
    `<path d="M8 2.1S3.9 6.4 3.9 9.3a4.1 4.1 0 0 0 8.2 0C12.1 6.4 8 2.1 8 2.1Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M6.2 9.5a1.9 1.9 0 0 0 1.8 1.7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity=".65"/>`),
  provider: svg(
    `<path d="M8 2.5a4.2 4.2 0 0 1 4.1 3.5 3 3 0 0 1-.6 5.9H4.5a3.1 3.1 0 0 1-.6-6.1A4.2 4.2 0 0 1 8 2.5Z" stroke="currentColor" stroke-width="1.25"/>` +
    `<path d="M8 6.1v4.2M6.2 8.4 8 10.2l1.8-1.8" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>`),
  details: svg(
    `<rect x="2.3" y="2.7" width="11.4" height="10.6" rx="1.4" stroke="currentColor" stroke-width="1.25"/>` +
    `<path d="M8 5.3v3.2M8 10.6v.1" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>`),
  analytics: svg(
    `<path d="M2.8 13.4V8.2M6.4 13.4V4.1M10 13.4v-3.6M13.6 13.4V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>` +
    `<path d="M2 13.9h12.2" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>`),
  reset: svg(
    `<path d="M13.2 8a5.2 5.2 0 1 1-1.5-3.7M13.1 2.6v3.1H10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`),
  settings: svg(
    `<circle cx="8" cy="8" r="1.9" stroke="currentColor" stroke-width="1.2"/>` +
    `<path d="M8 1.9v1.4M8 12.7v1.4M1.9 8h1.4M12.7 8h1.4M3.7 3.7l1 1M11.3 11.3l1 1M12.3 3.7l-1 1M4.7 11.3l-1 1" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"/>`),
  check: svg(
    `<path d="m3.2 8.2 3.1 3.1 6.5-6.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`),
};

function commandIcon(name) {
  return COMMAND_ICONS[name] || COMMAND_ICONS.settings;
}

const commandState = {
  open: false,
  query: '',
  index: 0,
  items: [],
  loading: false,
  fileError: '',
  requestSeq: 0,
  searchTimer: null,
  hideTimer: null,
  files: { local: [], remote: [] },
  lastFocus: null,
};

function fuzzyScore(text, query) {
  const hay = String(text || '').toLowerCase();
  const needle = String(query || '').toLowerCase();
  if (!needle) return 0;
  if (!hay) return -1;
  const direct = hay.indexOf(needle);
  if (direct >= 0) {
    return 100 - Math.min(direct, 50) - Math.min(hay.length, 200) * 0.08;
  }
  let pos = 0;
  let previous = -2;
  let streak = 0;
  let score = 0;
  for (const ch of needle) {
    const found = hay.indexOf(ch, pos);
    if (found < 0) return -1;
    streak = found === previous + 1 ? streak + 1 : 0;
    score += 4 + streak * 3 - Math.min(found - pos, 8);
    previous = found;
    pos = found + 1;
  }
  return score - Math.min(hay.length, 200) * 0.05;
}

function scoreCommand(cmd, query) {
  const title = fuzzyScore(cmd.title, query);
  const extra = Math.max(
    fuzzyScore(cmd.subtitle, query),
    fuzzyScore(cmd.keywords, query),
    fuzzyScore(cmd.group, query),
  );
  if (title < 0 && extra < 0) return -1;
  return (title < 0 ? 0 : title * 2) + (extra < 0 ? 0 : extra);
}

function commandCatalog() {
  const active = panes[state.active];
  const provider = currentProvider();
  const providerLabel = provider.label || 'remote';
  const selected = active ? active.selectedEntry() : null;
  const list = [];
  const groups = new Map();
  let seq = 0;

  const add = (group, title, opts = {}) => {
    if (!groups.has(group)) groups.set(group, groups.size);
    list.push({
      kind: 'command',
      key: `cmd:${opts.id || `${group}:${title}`}`,
      group,
      groupIndex: groups.get(group),
      seq: seq += 1,
      title,
      subtitle: opts.subtitle || '',
      keywords: opts.keywords || '',
      icon: opts.icon || 'settings',
      check: Boolean(opts.check),
      aside: opts.aside || '',
      run: opts.run || (() => {}),
    });
  };

  // Navigation
  add('Navigation', 'Focus local pane', {
    id: 'focus-local',
    icon: 'local',
    subtitle: 'Move keyboard focus to the local index',
    keywords: 'left side',
    run: () => { setActive('local'); panes.local.list.focus(); },
  });
  add('Navigation', `Focus ${providerLabel} pane`, {
    id: 'focus-remote',
    icon: 'remote',
    subtitle: 'Move keyboard focus to the remote snapshot',
    keywords: 'right side cloud',
    run: () => { setActive('remote'); panes.remote.list.focus(); },
  });
  add('Navigation', 'Go to local root', {
    icon: 'home',
    subtitle: BASE,
    keywords: 'start home top',
    run: () => { setActive('local'); panes.local.navigate(''); },
  });
  add('Navigation', `Go to ${providerLabel} root`, {
    icon: 'home',
    subtitle: provider.root_label || 'Archive',
    keywords: 'start home top cloud',
    run: () => { setActive('remote'); panes.remote.navigate(''); },
  });
  add('Navigation', 'Go back', {
    icon: 'back',
    subtitle: `${active.side === 'local' ? 'Local index' : providerLabel} · ${active.path || '/'}`,
    keywords: 'history previous',
    run: () => active.back(),
  });
  add('Navigation', 'Go forward', {
    icon: 'forward',
    subtitle: `${active.side === 'local' ? 'Local index' : providerLabel} · ${active.path || '/'}`,
    keywords: 'history next',
    run: () => active.forward(),
  });
  add('Navigation', 'Go up one folder', {
    icon: 'up',
    subtitle: active.path ? parentOf(active.path) || '/' : 'Already at the root',
    keywords: 'parent directory',
    run: () => active.up(),
  });
  add('Navigation', 'Show this path in the other pane', {
    icon: 'mirror',
    subtitle: `Mirror ${active.path || '/'}`,
    keywords: 'same path compare',
    run: () => active.mirror(),
  });
  if (selected) {
    add('Navigation', selected.is_dir ? 'Open selected folder' : 'Open selected item', {
      id: 'open-selected',
      icon: selected.is_dir ? 'local' : 'remote',
      subtitle: selected.path,
      keywords: 'enter selected',
      run: () => active.activate(selected),
    });
    if (counterpartTarget(selected, active.side)) {
      add('Navigation', 'Reveal selected counterpart', {
        id: 'reveal-selected',
        icon: 'reveal',
        subtitle: counterpartTarget(selected, active.side),
        keywords: 'find other side match',
        run: () => revealCounterpart(selected, active.side),
      });
    }
  }

  // Search
  add('Search', 'Search the active pane', {
    icon: 'search',
    subtitle: 'Focus the search field in the active pane',
    keywords: 'find filter',
    run: () => {
      const pane = panes[state.active];
      pane.searchInput.focus();
      pane.searchInput.select();
    },
  });
  add('Search', 'Search the local index', {
    icon: 'search',
    subtitle: 'Look for files and folders under /mnt/tank',
    keywords: 'find local',
    run: () => {
      setActive('local');
      panes.local.searchInput.focus();
      panes.local.searchInput.select();
    },
  });
  add('Search', `Search ${providerLabel}`, {
    icon: 'search',
    subtitle: 'Look for files and folders in the remote snapshot',
    keywords: 'find remote cloud',
    run: () => {
      setActive('remote');
      panes.remote.searchInput.focus();
      panes.remote.searchInput.select();
    },
  });

  // View
  add('View', state.hidden ? 'Hide dotfiles' : 'Show dotfiles', {
    id: 'toggle-hidden',
    icon: 'hidden',
    subtitle: 'Include files and folders whose names start with a dot',
    keywords: 'hidden files visibility',
    check: state.hidden,
    run: () => setHidden(!state.hidden),
  });
  add('View', 'Refresh the current folder', {
    icon: 'reset',
    subtitle: `Reload ${active.side === 'local' ? 'the local index' : providerLabel} · ${active.path || '/'}`,
    keywords: 'reload update',
    run: () => refreshPane(active),
  });
  add('View', document.getElementById('legend')?.hidden ? 'Show the legend' : 'Hide the legend', {
    id: 'toggle-legend',
    icon: 'legend',
    subtitle: 'Explain the comparison status colours',
    keywords: 'help key colours colors',
    check: !(document.getElementById('legend')?.hidden),
    run: () => setLegendOpen(Boolean(document.getElementById('legend')?.hidden)),
  });
  add('View', sidebarMode === 'columns' ? 'Close the columns sidebar' : 'Open the columns sidebar', {
    id: 'toggle-columns-panel',
    icon: 'columns',
    subtitle: 'Choose which table columns both panes show',
    keywords: 'table layout settings',
    run: () => (sidebarMode === 'columns' ? closeColumnsPanel() : openColumnsPanel()),
  });
  add('View', sidebarMode === 'analytics' ? 'Close the analytics view' : 'Open the analytics view', {
    id: 'toggle-analytics-panel',
    icon: 'analytics',
    subtitle: 'Snapshot totals, local index entries, and coverage',
    keywords: 'stats statistics metrics summary report numbers',
    run: () => (sidebarMode === 'analytics' ? closeAnalyticsPanel() : openAnalyticsPanel()),
  });
  if (selected) {
    add('View', 'Show details for the selected item', {
      icon: 'details',
      subtitle: selected.path,
      keywords: 'inspector info selected',
      run: () => openDetailPanel(active, selected),
    });
  }

  // Columns
  COLUMN_DEFS.filter(col => !col.required).forEach(col => {
    const shown = state.columns.has(col.id);
    add('Columns', `Toggle the ${col.label} column`, {
      id: `column:${col.id}`,
      icon: 'columns',
      subtitle: shown ? 'Currently visible' : 'Currently hidden',
      keywords: `columns table ${col.id}`,
      check: shown,
      run: () => setColumnVisibility(col.id, !state.columns.has(col.id)),
    });
  });
  add('Columns', 'Reset the columns', {
    icon: 'reset',
    subtitle: 'Show all columns again',
    keywords: 'table layout default',
    run: () => resetColumns(),
  });

  // Sort
  COLUMN_DEFS.forEach(col => {
    add('Sort', `Sort by ${col.label}`, {
      id: `sort:${col.id}`,
      icon: 'sort',
      subtitle: active.sort === col.id
        ? `Active · ${active.dir === 'asc' ? 'ascending' : 'descending'} — choose again to reverse`
        : 'Sort the active pane',
      keywords: `order ${col.id} column`,
      check: active.sort === col.id,
      aside: active.sort === col.id ? (active.dir === 'asc' ? 'Asc' : 'Desc') : '',
      run: () => active.setSort(col.id),
    });
  });

  // Status filters
  active.statusFilterOptions().forEach(option => {
    const on = active.statusFilters.has(option.value);
    add('Filters', `Filter: ${option.label}`, {
      id: `filter:${option.value}`,
      icon: 'filter',
      subtitle: on ? 'Currently filtered' : 'Only show this status in the active pane',
      keywords: `status show only ${option.value}`,
      check: on,
      run: () => active.toggleStatusFilter(option.value),
    });
  });
  if (active.statusFilters.size) {
    add('Filters', 'Clear status filters', {
      icon: 'reset',
      subtitle: 'Show every status in the active pane',
      keywords: 'remove filter status all',
      run: () => active.clearStatusFilters(),
    });
  }

  // Appearance
  const themeMode = document.documentElement.dataset.theme || 'system';
  [
    ['system', 'System', 'Follow the operating system'],
    ['light', 'Light', 'Bright surfaces'],
    ['dark', 'Dark', 'Low-light surfaces'],
    ['water', 'Water', 'Animated water effects'],
  ].forEach(([mode, label, hint]) => {
    add('Appearance', `Use the ${label} theme`, {
      id: `theme:${mode}`,
      icon: mode === 'water' ? 'water' : 'theme',
      subtitle: hint,
      keywords: `appearance color colour ${mode}`,
      check: themeMode === mode,
      run: () => applyThemeMode(mode),
    });
  });
  add('Appearance', themePanelOpen ? 'Close water settings' : 'Open water settings', {
    id: 'toggle-water-panel',
    icon: 'water',
    subtitle: 'Tune the ripple, caustic, and current effects',
    keywords: 'water settings theme',
    run: () => setThemePanelOpen(!themePanelOpen),
  });
  add('Appearance', 'Toggle water effects', {
    id: 'toggle-water-effects',
    icon: 'water',
    subtitle: 'Ripples, drips, and shimmer when the Water theme is active',
    keywords: 'water effects animation theme',
    check: waterSettings.effects,
    run: () => {
      waterSettings.effects = !waterSettings.effects;
      applyWaterSettings({ persist: true });
    },
  });

  // Providers
  providerCatalog.list.forEach(info => {
    if (!info.available) return;
    add('Provider', `Switch to ${info.label}`, {
      id: `provider:${info.key}`,
      icon: 'provider',
      subtitle: state.provider === info.key
        ? `${info.root_label || 'Archive'} · currently active`
        : `Right pane · ${info.root_label || 'Archive'}`,
      keywords: `remote cloud ${info.key}`,
      check: state.provider === info.key,
      run: () => switchProvider(info.key),
    });
  });

  return list;
}

function commandFileItems(entries, side) {
  if (!entries.length) return [];
  const provider = currentProvider();
  const group = side === 'local' ? 'Local index' : (provider.label || 'Remote');
  const groupIndex = side === 'local' ? 1000 : 1001;
  return entries.map(entry => ({
    kind: 'file',
    key: `file:${side}:${entry.path}`,
    group,
    groupIndex,
    title: entry.name || baseOf(entry.path),
    subtitle: `${statusLabel(entry, side)} · ${entry.parent != null ? entry.parent || '/' : '/'}`,
    iconHtml: iconFor(entry),
    aside: entry.is_dir
      ? 'Folder'
      : (entry.size != null ? fmtBytes(entry.size) : entryType(entry)),
    entry,
    side,
  }));
}

function buildCommandItems(query) {
  const commandsOnly = query.startsWith('>');
  const raw = commandsOnly ? query.slice(1).trim() : query.trim();
  const commands = commandCatalog();
  let matches = commands;

  if (raw) {
    matches = commands
      .map(cmd => ({ cmd, score: scoreCommand(cmd, raw) }))
      .filter(match => match.score >= 0)
      .sort((a, b) =>
        a.cmd.groupIndex - b.cmd.groupIndex ||
        b.score - a.score ||
        a.cmd.seq - b.cmd.seq)
      .map(match => match.cmd);
  }

  const items = matches.slice();
  if (!commandsOnly && raw.length >= SEARCH_MIN) {
    items.push(...commandFileItems(commandState.files.local, 'local'));
    items.push(...commandFileItems(commandState.files.remote, 'remote'));
  }
  return { items, raw, commandsOnly };
}

function appendCommandHighlight(el, text, query) {
  if (!query) {
    el.textContent = text;
    return;
  }
  const hay = text.toLowerCase();
  const needle = query.toLowerCase();
  const index = hay.indexOf(needle);
  if (index < 0) {
    el.textContent = text;
    return;
  }
  if (index > 0) el.append(text.slice(0, index));
  const mark = document.createElement('mark');
  mark.textContent = text.slice(index, index + needle.length);
  el.append(mark);
  if (index + needle.length < text.length) {
    el.append(text.slice(index + needle.length));
  }
}

function buildCommandItem(item, index, query) {
  const row = document.createElement('div');
  row.className = 'command-item';
  row.id = `command-option-${index}`;
  row.dataset.index = String(index);
  row.setAttribute('role', 'option');
  row.setAttribute('aria-selected', 'false');
  row.title = item.kind === 'file' ? item.entry.path : (item.subtitle || item.title);

  const icon = document.createElement('span');
  icon.className = 'command-item-icon';
  if (item.kind === 'file') icon.innerHTML = item.iconHtml; // static icon markup only
  else icon.innerHTML = commandIcon(item.icon); // static icon markup only

  const main = document.createElement('span');
  main.className = 'command-item-main';
  const title = document.createElement('span');
  title.className = 'command-item-title';
  if (item.kind === 'file') title.textContent = item.title;
  else appendCommandHighlight(title, item.title, query);
  main.append(title);

  if (item.subtitle) {
    const sub = document.createElement('span');
    sub.className = 'command-item-sub';
    if (item.kind === 'file') {
      const dot = document.createElement('span');
      dot.className = `filter-dot st-${item.entry.status || 'unmatched'}`;
      sub.append(dot);
    }
    sub.append(document.createTextNode(item.subtitle));
    main.append(sub);
  }

  row.append(icon, main);

  if (item.aside) {
    const aside = document.createElement('span');
    aside.className = 'command-item-aside';
    aside.textContent = item.aside;
    row.append(aside);
  }
  if (item.check) {
    const check = document.createElement('span');
    check.className = 'command-item-check';
    check.innerHTML = commandIcon('check'); // static icon markup only
    check.title = 'Active';
    row.append(check);
  }

  row.addEventListener('mousedown', ev => ev.preventDefault());
  return row;
}

function syncCommandSelection(scroll = true) {
  const input = document.getElementById('command-input');
  const results = document.getElementById('command-results');
  if (!input || !results) return;
  const options = results.querySelectorAll('.command-item');
  let active = null;
  options.forEach(option => {
    const isActive = Number(option.dataset.index) === commandState.index;
    option.classList.toggle('active', isActive);
    option.setAttribute('aria-selected', String(isActive));
    if (isActive) active = option;
  });
  if (active) {
    input.setAttribute('aria-activedescendant', active.id);
    if (scroll) active.scrollIntoView({ block: 'nearest' });
  } else {
    input.removeAttribute('aria-activedescendant');
  }
}

function renderCommandPalette() {
  const results = document.getElementById('command-results');
  const empty = document.getElementById('command-empty');
  const emptyTitle = document.getElementById('command-empty-title');
  const emptyHint = document.getElementById('command-empty-hint');
  const loadingEl = document.getElementById('command-loading');
  if (!results || !empty || !emptyTitle || !emptyHint) return;

  const { items, raw, commandsOnly } = buildCommandItems(commandState.query);
  const previous = commandState.items[commandState.index];
  const previousKey = previous ? previous.key : null;
  commandState.items = items;

  if (previousKey) {
    const found = items.findIndex(item => item.key === previousKey);
    commandState.index = found >= 0 ? found : Math.min(commandState.index, items.length - 1);
  } else {
    commandState.index = Math.min(commandState.index, items.length - 1);
  }
  if (commandState.index < 0) commandState.index = 0;

  const frag = document.createDocumentFragment();
  let lastGroup = null;
  items.forEach((item, index) => {
    if (item.group !== lastGroup) {
      lastGroup = item.group;
      const head = document.createElement('div');
      head.className = 'command-group';
      head.setAttribute('role', 'presentation');
      head.textContent = item.group;
      frag.append(head);
    }
    frag.append(buildCommandItem(item, index, raw));
  });

  const showFileStatus = !commandsOnly && raw.length >= SEARCH_MIN;
  if (showFileStatus && commandState.loading && items.length) {
    const note = document.createElement('div');
    note.className = 'command-note';
    note.setAttribute('role', 'presentation');
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    note.append(spinner, document.createTextNode('Searching files and folders…'));
    frag.append(note);
  } else if (showFileStatus && commandState.fileError && items.length &&
      !commandState.files.local.length && !commandState.files.remote.length) {
    const note = document.createElement('div');
    note.className = 'command-note';
    note.setAttribute('role', 'presentation');
    note.textContent = commandState.fileError;
    frag.append(note);
  }

  results.replaceChildren(frag);
  if (loadingEl) loadingEl.hidden = !commandState.loading;

  empty.hidden = items.length > 0;
  if (!items.length) {
    let title = 'No matches';
    let hint = 'Try a different word or command.';
    if (commandState.query.startsWith('>')) {
      title = 'No command matches';
      hint = 'Remove the > to search files and folders too.';
    } else if (commandState.query.trim() && raw.length < SEARCH_MIN) {
      title = `Type ${SEARCH_MIN - raw.length} more character${SEARCH_MIN - raw.length === 1 ? '' : 's'}`;
      hint = 'File and folder search starts after two characters.';
    } else if (commandState.loading) {
      title = 'Searching files and folders…';
      hint = 'Commands that match your text are shown above.';
    } else if (commandState.fileError && showFileStatus) {
      title = 'Could not search files';
      hint = commandState.fileError;
    } else if (raw) {
      title = `No matches for “${raw}”`;
    } else {
      title = 'No commands available';
      hint = 'Try again once the explorer has finished loading.';
    }
    emptyTitle.textContent = title;
    emptyHint.textContent = hint;
  }

  syncCommandSelection(false);
}

function commandSearchUrl(side, query) {
  return `/api/search?side=${side}` +
    `&provider=${encodeURIComponent(state.provider)}` +
    `&q=${encodeURIComponent(query)}` +
    `&scope=all&path=` +
    `&hidden=${state.hidden ? 1 : 0}`;
}

function rankCommandFiles(entries, query) {
  return entries
    .map(entry => {
      const name = entry.name || baseOf(entry.path);
      const nameScore = fuzzyScore(name, query);
      const pathScore = Math.max(
        fuzzyScore(entry.parent || '', query),
        fuzzyScore(entry.path || '', query),
      );
      return {
        entry,
        score: nameScore >= 0 ? nameScore * 2 + Math.max(pathScore, 0) : pathScore,
      };
    })
    .filter(match => match.score >= 0)
    .sort((a, b) =>
      b.score - a.score ||
      (b.entry.is_dir ? 1 : 0) - (a.entry.is_dir ? 1 : 0) ||
      (a.entry.name || '').localeCompare(b.entry.name || ''))
    .slice(0, 24)
    .map(match => match.entry);
}

async function searchCommandFiles(query) {
  const seq = ++commandState.requestSeq;
  try {
    const [local, remote] = await Promise.allSettled([
      getJSON(commandSearchUrl('local', query)),
      getJSON(commandSearchUrl('remote', query)),
    ]);
    if (seq !== commandState.requestSeq || !commandState.open) return;
    commandState.files.local = local.status === 'fulfilled'
      ? rankCommandFiles(local.value.entries || [], query)
      : [];
    commandState.files.remote = remote.status === 'fulfilled'
      ? rankCommandFiles(remote.value.entries || [], query)
      : [];
    commandState.fileError = local.status === 'rejected' && remote.status === 'rejected'
      ? `File search failed: ${local.reason?.message || remote.reason?.message || 'unknown error'}`
      : '';
  } finally {
    if (seq === commandState.requestSeq && commandState.open) {
      commandState.loading = false;
      const loadingEl = document.getElementById('command-loading');
      if (loadingEl) loadingEl.hidden = true;
      renderCommandPalette();
    }
  }
}

function scheduleCommandSearch() {
  clearTimeout(commandState.searchTimer);
  const query = commandState.query;
  const commandsOnly = query.startsWith('>');
  const raw = commandsOnly ? query.slice(1).trim() : query.trim();

  commandState.requestSeq += 1;
  commandState.files = { local: [], remote: [] };
  commandState.fileError = '';

  if (commandsOnly || raw.length < SEARCH_MIN) {
    commandState.loading = false;
    renderCommandPalette();
    return;
  }

  commandState.loading = true;
  const searchSeq = commandState.requestSeq;
  renderCommandPalette();
  commandState.searchTimer = setTimeout(() => {
    if (searchSeq !== commandState.requestSeq || !commandState.open) return;
    searchCommandFiles(raw);
  }, 180);
}

function commandQueryChanged() {
  const input = document.getElementById('command-input');
  if (!input) return;
  commandState.query = input.value;
  commandState.index = 0;
  commandState.items = [];
  scheduleCommandSearch();
}

async function openCommandFile(item) {
  closeCommandBar({ restoreFocus: false });
  const pane = panes[item.side];
  if (!pane) return;
  setActive(item.side);
  const entry = item.entry;
  if (entry.is_dir) {
    await pane.navigate(entry.path);
  } else {
    const parent = entry.parent != null ? entry.parent : parentOf(entry.path);
    await pane.navigate(parent, { select: entry.path });
  }
  pane.list.focus({ preventScroll: true });
}

function runCommandItem(item) {
  if (!item) return;
  if (item.kind === 'file') {
    openCommandFile(item);
    return;
  }
  closeCommandBar();
  try {
    const result = item.run();
    if (result && typeof result.catch === 'function') {
      result.catch(err => toast(err.message || String(err)));
    }
  } catch (err) {
    toast(err.message || String(err));
  }
}

function moveCommandSelection(delta) {
  if (!commandState.items.length) return;
  const count = commandState.items.length;
  commandState.index = (commandState.index + delta + count) % count;
  syncCommandSelection();
}

function openCommandBar() {
  const overlay = document.getElementById('command-overlay');
  const input = document.getElementById('command-input');
  const trigger = document.getElementById('command-open');
  if (!overlay || !input) return;
  clearTimeout(commandState.hideTimer);
  if (commandState.open) {
    input.focus();
    input.select();
    return;
  }
  commandState.lastFocus = document.activeElement;
  commandState.open = true;
  commandState.query = '';
  commandState.index = 0;
  commandState.items = [];
  commandState.files = { local: [], remote: [] };
  commandState.loading = false;
  commandState.fileError = '';
  clearTimeout(commandState.searchTimer);
  commandState.requestSeq += 1;
  input.value = '';
  overlay.hidden = false;
  overlay.classList.add('is-open');
  if (trigger) trigger.setAttribute('aria-expanded', 'true');
  renderCommandPalette();
  requestAnimationFrame(() => input.focus());
}

function closeCommandBar({ restoreFocus = true } = {}) {
  if (!commandState.open) return;
  commandState.open = false;
  clearTimeout(commandState.searchTimer);
  commandState.requestSeq += 1;
  commandState.loading = false;
  const overlay = document.getElementById('command-overlay');
  const trigger = document.getElementById('command-open');
  if (overlay) {
    overlay.classList.remove('is-open');
    clearTimeout(commandState.hideTimer);
    commandState.hideTimer = setTimeout(() => {
      if (!commandState.open && overlay) overlay.hidden = true;
    }, 160);
  }
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus && commandState.lastFocus &&
      typeof commandState.lastFocus.focus === 'function') {
    commandState.lastFocus.focus({ preventScroll: true });
  }
}

function setupCommandBar() {
  const overlay = document.getElementById('command-overlay');
  const input = document.getElementById('command-input');
  const results = document.getElementById('command-results');
  const trigger = document.getElementById('command-open');
  const close = document.getElementById('command-close');
  if (!overlay || !input || !results) return;

  const shortcut = /Mac|iPhone|iPad|iPod/.test(navigator.platform || '')
    ? '⌘K'
    : 'Ctrl K';
  document.querySelectorAll('[data-command-shortcut]').forEach(el => {
    el.textContent = shortcut;
  });
  if (trigger) {
    trigger.title = `Search files and folders or run a command (${shortcut})`;
    trigger.addEventListener('click', openCommandBar);
  }
  if (close) close.addEventListener('click', () => closeCommandBar());

  input.addEventListener('input', commandQueryChanged);
  input.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      moveCommandSelection(1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      moveCommandSelection(-1);
    } else if (ev.key === 'Home' && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      commandState.index = 0;
      syncCommandSelection();
    } else if (ev.key === 'End' && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      commandState.index = Math.max(0, commandState.items.length - 1);
      syncCommandSelection();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      runCommandItem(commandState.items[commandState.index]);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      closeCommandBar();
    }
  });

  results.addEventListener('mousemove', ev => {
    const row = ev.target.closest('.command-item');
    if (!row) return;
    const index = Number(row.dataset.index);
    if (index === commandState.index) return;
    commandState.index = index;
    syncCommandSelection(false);
  });
  results.addEventListener('click', ev => {
    const row = ev.target.closest('.command-item');
    if (!row) return;
    const index = Number(row.dataset.index);
    commandState.index = index;
    runCommandItem(commandState.items[index]);
  });

  overlay.addEventListener('mousedown', ev => {
    if (ev.target === overlay) closeCommandBar();
  });
  overlay.addEventListener('keydown', ev => {
    if (ev.key !== 'Tab') return;
    const focusables = [input, close].filter(el => el && !el.disabled && !el.hidden);
    if (!focusables.length) return;
    ev.preventDefault();
    const index = focusables.indexOf(document.activeElement);
    const next = ev.shiftKey
      ? (index <= 0 ? focusables.length - 1 : index - 1)
      : (index + 1) % focusables.length;
    focusables[next].focus();
  });
}

/* --------------------------------------------------------------------- meta */

function loadMeta(providerKey = state.provider) {
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

/* ------------------------------------------------------------------- legend */

function legendEntries() {
  const label = currentProvider().label;
  return [
    ['lt', `${label} side`],
    ['st-exact', 'Same', 'This path exists in the local index at the same path.'],
    ['st-moved', 'Moved', 'Found in the local index under a different path (same name and size).'],
    ['st-possible', 'Maybe', 'A file with the same name exists locally, but the size differs.'],
    ['st-partial', 'Partial', 'Folder has a mix of present and missing children.'],
    ['st-missing', 'Missing', 'No matching path, name or size was found in the local index.'],
    ['lt', 'Local side'],
    ['st-exact', `In ${label}`, `This local item exists at the same path in ${label}.`],
    ['st-moved_match', 'Moved match', `This local item is the match for a moved ${label} item.`],
    ['st-local_only', 'Local only', `Present in the index but not found anywhere in ${label}.`],
    ['st-unmatched', `Not in ${label}`, `No same-path counterpart in ${label}; it may still have matched another item.`],
    ['st-type_mismatch', 'Type differs', 'A file/folder with the same name exists on the other side.'],
  ];
}

function buildLegend() {
  const legend = document.getElementById('legend');
  const rows = legendEntries().map(([cls, title, desc]) => {
    if (cls === 'lt') {
      const h = document.createElement('h4');
      h.textContent = title;
      return h;
    }
    const row = document.createElement('div');
    row.className = 'legend-row';
    const chip = document.createElement('span');
    chip.className = `status-chip ${cls}`;
    chip.innerHTML = '<span class="dot"></span>';
    const text = document.createElement('span');
    const b = document.createElement('b');
    b.textContent = title;
    text.append(b);
    if (desc) text.append(document.createTextNode(` — ${desc}`));
    row.append(chip, text);
    return row;
  });
  legend.replaceChildren(...rows);
}

/* ---------------------------------------------------------------- providers */

async function loadProviders() {
  const data = await getJSON('/api/providers');
  providerCatalog.list = data.providers || [];
  providerCatalog.byKey = {};
  providerCatalog.list.forEach(p => { providerCatalog.byKey[p.key] = p; });
}

function updateProviderChrome() {
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

async function switchProvider(key) {
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

/* ------------------------------------------------------------------- wiring */

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
