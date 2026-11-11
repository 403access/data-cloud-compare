/* Water theme settings and the ripple/caustic canvas. */

export interface WaterSettings {
  effects: boolean;
  drips: boolean;
  clickRipples: boolean;
  caustics: boolean;
  rowMotion: boolean;
  glass: boolean;
  tone: string;
  speed: string;
  intensity: string;
}

export const WATER_SETTINGS_KEY = "explorer-water-settings";

export const WATER_DEFAULTS: WaterSettings = {
  effects: true,
  drips: true,
  clickRipples: true,
  caustics: true,
  rowMotion: true,
  glass: true,
  tone: "ocean",
  speed: "flowing",
  intensity: "subtle",
};

const WATER_TONES: Record<string, string> = {
  lagoon: "85, 240, 224",
  ocean: "56, 214, 255",
  deep: "72, 183, 255",
};

const WATER_SPEEDS: Record<string, number> = { calm: 0.65, flowing: 1, rapid: 1.6 };

const WATER_INTENSITY: Record<
  string,
  { minDist: number; throttle: number; alpha: number; grow: number; clickAlpha: number }
> = {
  subtle: { minDist: 32, throttle: 100, alpha: 0.16, grow: 9, clickAlpha: 0.26 },
  balanced: { minDist: 22, throttle: 74, alpha: 0.22, grow: 13, clickAlpha: 0.32 },
  lively: { minDist: 14, throttle: 50, alpha: 0.28, grow: 17, clickAlpha: 0.38 },
};

export function readWaterSettings(): WaterSettings {
  let saved: any = null;
  try {
    saved = JSON.parse(localStorage.getItem(WATER_SETTINGS_KEY) || "null");
  } catch {
    /* ignore */
  }
  if (!saved || typeof saved !== "object") return { ...WATER_DEFAULTS };
  const pick = (value: unknown, allowed: string[], fallback: string) =>
    typeof value === "string" && allowed.includes(value) ? value : fallback;
  return {
    effects: saved.effects !== false,
    drips: saved.drips !== false,
    clickRipples: saved.clickRipples !== false,
    caustics: saved.caustics !== false,
    rowMotion: saved.rowMotion !== false,
    glass: saved.glass !== false,
    tone: pick(saved.tone, Object.keys(WATER_TONES), WATER_DEFAULTS.tone),
    speed: pick(saved.speed, Object.keys(WATER_SPEEDS), WATER_DEFAULTS.speed),
    intensity: pick(
      saved.intensity,
      Object.keys(WATER_INTENSITY),
      WATER_DEFAULTS.intensity,
    ),
  };
}

export function saveWaterSettings(settings: WaterSettings): void {
  try {
    localStorage.setItem(WATER_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

function waterSpeedFactor(settings: WaterSettings): number {
  return WATER_SPEEDS[settings.speed] || 1;
}

interface Particle {
  x: number;
  y: number;
  age: number;
  life: number;
  start: number;
  grow: number;
  alpha: number;
  width: number;
  wobble: number;
}

export class WaterFX {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private active = false;
  private running = false;
  private particles: Particle[] = [];
  private pointer: { x: number; y: number; at: number } | null = null;
  private lastSpawn = 0;
  private lastX = 0;
  private lastY = 0;
  private w = 0;
  private h = 0;
  private raf = 0;
  private lastFrame = 0;
  private settings: WaterSettings = WATER_DEFAULTS;
  private onResize = () => this.resize();
  private onPointerMove = (event: PointerEvent) => this.pointerMove(event);
  private onPointerDown = (event: PointerEvent) => this.pointerDown(event);

  constructor(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas as HTMLCanvasElement;
    this.ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    window.addEventListener("resize", this.onResize, { passive: true });
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("pointerdown", this.onPointerDown, { passive: true });
  }

  destroy(): void {
    this.stop();
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  configure(settings: WaterSettings, active: boolean): void {
    this.settings = settings;
    const shouldRun = Boolean(active) && Boolean(this.ctx) && !this.prefersReducedMotion();
    this.active = shouldRun;
    if (shouldRun) this.start();
    else this.stop();
  }

  private resize(): void {
    if (!this.ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.max(1, Math.round(this.w * dpr));
    this.canvas.height = Math.max(1, Math.round(this.h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private start(): void {
    if (this.running) return;
    this.resize();
    this.lastFrame = performance.now();
    this.running = true;
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.particles = [];
    this.pointer = null;
    if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
  }

  private pointerMove(event: PointerEvent): void {
    this.pointer = { x: event.clientX, y: event.clientY, at: performance.now() };
    if (!this.active || !this.settings.effects || !this.settings.drips) return;
    const cfg = WATER_INTENSITY[this.settings.intensity] || WATER_INTENSITY.subtle;
    const now = performance.now();
    if (now - this.lastSpawn < cfg.throttle) return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    if (Math.hypot(dx, dy) < cfg.minDist) return;
    this.lastSpawn = now;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.spawn(event.clientX, event.clientY, "drip");
  }

  private pointerDown(event: PointerEvent): void {
    if (!this.active || !this.settings.effects || !this.settings.clickRipples) return;
    this.spawn(event.clientX, event.clientY, "click");
  }

  private spawn(x: number, y: number, kind: "drip" | "click"): void {
    const cfg = WATER_INTENSITY[this.settings.intensity] || WATER_INTENSITY.subtle;
    const click = kind === "click";
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

  private drawCaustics(now: number): void {
    if (!this.ctx || !this.settings.caustics) return;
    const rgb = WATER_TONES[this.settings.tone] || WATER_TONES.ocean;
    const t = now * 0.001 * waterSpeedFactor(this.settings);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
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

  private drawPointer(now: number): void {
    if (!this.ctx || !this.settings.drips || !this.pointer) return;
    const age = now - this.pointer.at;
    if (age > 2200) return;
    const fade = Math.max(0, 1 - age / 2200);
    const rgb = WATER_TONES[this.settings.tone] || WATER_TONES.ocean;
    const ctx = this.ctx;
    const gradient = ctx.createRadialGradient(
      this.pointer.x,
      this.pointer.y,
      0,
      this.pointer.x,
      this.pointer.y,
      74,
    );
    gradient.addColorStop(0, `rgba(${rgb}, ${0.055 * fade})`);
    gradient.addColorStop(0.45, `rgba(${rgb}, ${0.022 * fade})`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.pointer.x, this.pointer.y, 74, 0, Math.PI * 2);
    ctx.fill();
  }

  private frame = (now: number): void => {
    if (!this.running || !this.ctx) return;
    const dt = Math.min(48, now - this.lastFrame);
    this.lastFrame = now;
    const ctx = this.ctx;
    const rgb = WATER_TONES[this.settings.tone] || WATER_TONES.ocean;
    const speed = waterSpeedFactor(this.settings);

    ctx.clearRect(0, 0, this.w, this.h);
    this.drawCaustics(now);
    this.drawPointer(now);

    const alive: Particle[] = [];
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
  };
}
