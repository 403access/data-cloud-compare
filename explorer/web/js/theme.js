/* Theme switching, persisted water settings and the ripple canvas. */

import { THEME_STORAGE_KEY, WATER_SETTINGS_KEY } from './config.js';
import { sidebarHideDelay } from './sidebar.js';
import { toast } from './toast.js';

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

export let waterSettings = readWaterSettings();
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

export function applyWaterSettings({ persist = false } = {}) {
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

export function applyThemeMode(mode, { persist = true, openPanel = false } = {}) {
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

export let themePanelOpen = false;
let themeHideTimer = null;

export function setThemePanelOpen(open) {
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

export function setupTheme() {
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
