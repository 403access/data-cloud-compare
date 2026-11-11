#!/usr/bin/env bun
/**
 * Capture the Bun + React explorer and compare it with the checked-in
 * reference screenshots from the original implementation.
 *
 *   bun run tools/screenshots/run.ts                  # capture + diff
 *   bun run tools/screenshots/run.ts --target reference
 *   bun run tools/screenshots/run.ts --target after
 *   bun run tools/screenshots/run.ts --target compare
 *
 * The app server is started automatically when its URL is not already
 * responding. Output: screenshots/{baseline,after,diff}/<scenario>.png and
 * report.{json,md}. The baseline is copied from tools/screenshots/reference/.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { closeSync, cpSync, existsSync, openSync, readFileSync, rmSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const ROOT = resolve(import.meta.dir, "../..");
const OUT = resolve(ROOT, "screenshots");
const LOGS = resolve(OUT, "logs");
const REFERENCE = resolve(import.meta.dir, "reference");

interface Args {
  target: "both" | "reference" | "after" | "compare";
  afterUrl: string;
  only: string[];
  threshold: number;
  noServer: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    target: "both",
    afterUrl: "http://127.0.0.1:8791",
    only: [],
    threshold: 0.0001,
    noServer: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--target") args.target = argv[++i] as Args["target"];
    else if (arg.startsWith("--target=")) args.target = arg.split("=")[1] as Args["target"];
    else if (arg === "--after-url") args.afterUrl = argv[++i];
    else if (arg === "--only") args.only = (argv[++i] || "").split(",").filter(Boolean);
    else if (arg === "--threshold") args.threshold = Number(argv[++i]);
    else if (arg === "--no-server") args.noServer = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: bun run tools/screenshots/run.ts [--target both|reference|after|compare]\n" +
          "       [--after-url URL] [--only name,name]\n" +
          "       [--threshold 0.0001] [--no-server]",
      );
      process.exit(0);
    }
  }
  // Keep the old spelling working after the legacy app was removed.
  if ((args.target as string) === "baseline") args.target = "reference";
  return args;
}

const args = parseArgs(Bun.argv.slice(2));

interface Scenario {
  name: string;
  viewport: { width: number; height: number };
  theme: "light" | "dark" | "water";
  steps?: (page: Page) => Promise<void>;
}

const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  #water-fx { display: none !important; }
  html { scroll-behavior: auto !important; }
`;

const SCENARIOS: Scenario[] = [
  {
    name: "default-light",
    viewport: { width: 1440, height: 900 },
    theme: "light",
  },
  {
    name: "default-dark",
    viewport: { width: 1440, height: 900 },
    theme: "dark",
  },
  {
    name: "water",
    viewport: { width: 1440, height: 900 },
    theme: "water",
  },
  {
    name: "water-settings",
    viewport: { width: 1440, height: 900 },
    theme: "water",
    steps: async (page) => {
      await page.click("#theme-settings-toggle");
      await page.waitForSelector("#theme-panel.is-open", { timeout: 10000 });
    },
  },
  {
    name: "legend",
    viewport: { width: 1440, height: 900 },
    theme: "light",
    steps: async (page) => {
      await page.click("#legend-toggle");
      await page.waitForSelector("#legend:not([hidden])", { timeout: 10000 });
    },
  },
  {
    name: "filter-menu",
    viewport: { width: 1440, height: 900 },
    theme: "light",
    steps: async (page) => {
      await page.click('#pane-local [data-role="filter-toggle"]');
      await page.waitForSelector("#pane-local .filter-menu:not([hidden])", {
        timeout: 10000,
      });
    },
  },
  {
    name: "command-bar",
    viewport: { width: 1440, height: 900 },
    theme: "light",
    steps: async (page) => {
      await page.click("#command-open");
      await page.waitForSelector("#command-overlay.is-open", { timeout: 10000 });
      await page.waitForFunction(
        () => document.querySelectorAll("#command-results .command-item").length > 10,
      );
    },
  },
  {
    name: "command-search",
    viewport: { width: 1440, height: 900 },
    theme: "light",
    steps: async (page) => {
      await page.click("#command-open");
      await page.waitForSelector("#command-overlay.is-open", { timeout: 10000 });
      await page.fill("#command-input", "backup");
      await page.waitForFunction(
        () => {
          const loading = document.querySelector<HTMLElement>("#command-loading");
          const fileDots = document.querySelectorAll(
            "#command-results .command-item .filter-dot",
          );
          return loading && loading.hidden && fileDots.length > 5;
        },
        { timeout: 20000 },
      );
    },
  },
  {
    name: "pane-search",
    viewport: { width: 1440, height: 900 },
    theme: "light",
    steps: async (page) => {
      await page.fill('#pane-local [data-role="search"]', "backup");
      await page.waitForFunction(
        () => {
          const loading = document.querySelector<HTMLElement>("#pane-local .loading");
          return (
            loading &&
            loading.hidden &&
            document.querySelectorAll("#pane-local .row .subpath").length > 3
          );
        },
        { timeout: 20000 },
      );
    },
  },
  {
    name: "columns-panel",
    viewport: { width: 1440, height: 900 },
    theme: "light",
    steps: async (page) => {
      await page.click("#pane-local .column-head", { button: "right" });
      await page.waitForSelector("#columns-panel.is-open", { timeout: 10000 });
    },
  },
  {
    name: "analytics-panel",
    viewport: { width: 1440, height: 900 },
    theme: "light",
    steps: async (page) => {
      await page.click("#analytics-toggle");
      await page.waitForSelector("#analytics-panel.is-open", { timeout: 10000 });
      await page.waitForFunction(() => {
        const body = document.querySelector("#analytics-body");
        return body && !body.textContent?.includes("Loading analytics");
      }, { timeout: 20000 });
    },
  },
  {
    name: "source-panel",
    viewport: { width: 1440, height: 900 },
    theme: "light",
    steps: async (page) => {
      await page.click('#pane-local [data-role="source-info"]');
      await page.waitForSelector("#source-panel.is-open", { timeout: 10000 });
      await page.waitForFunction(() => {
        const body = document.querySelector("#source-body");
        return body && !body.textContent?.includes("Loading source details");
      }, { timeout: 20000 });
    },
  },
  {
    name: "detail-panel",
    viewport: { width: 1440, height: 900 },
    theme: "light",
    steps: async (page) => {
      await page.click("#pane-local .vlist-body .row", { button: "right" });
      await page.waitForSelector("#detail-panel.is-open", { timeout: 10000 });
    },
  },
  {
    name: "google-drive",
    viewport: { width: 1440, height: 900 },
    theme: "light",
    steps: async (page) => {
      await page.click('#provider-switch [data-provider="google_drive"]');
      await page.waitForFunction(
        () => {
          const name = document.querySelector("#remote-provider-name")?.textContent;
          return (
            name?.includes("Google Drive") &&
            document.querySelectorAll("#pane-remote .row").length > 0 &&
            document.querySelector<HTMLElement>("#pane-remote .loading")?.hidden
          );
        },
        { timeout: 20000 },
      );
    },
  },
  {
    name: "hidden-files",
    viewport: { width: 1440, height: 900 },
    theme: "light",
    steps: async (page) => {
      await page.evaluate(() => {
        document.querySelector<HTMLInputElement>("#hidden-toggle")?.click();
      });
      await page.waitForFunction(
        () => {
          const loading = document.querySelector<HTMLElement>("#pane-local .loading");
          return loading && loading.hidden;
        },
        { timeout: 20000 },
      );
    },
  },
  {
    name: "sort-size",
    viewport: { width: 1440, height: 900 },
    theme: "light",
    steps: async (page) => {
      await page.click('#pane-local [data-sort="size"]');
      await page.waitForFunction(
        () => document.querySelector<HTMLElement>("#pane-local .loading")?.hidden,
        { timeout: 20000 },
      );
    },
  },
  {
    name: "narrow",
    viewport: { width: 1024, height: 768 },
    theme: "light",
  },
  {
    name: "mobile",
    viewport: { width: 760, height: 1000 },
    theme: "light",
  },
];

const INIT_SCRIPT = ({ theme }: { theme: string }) => {
  try {
    localStorage.setItem("explorer-columns", JSON.stringify(["name", "type", "status", "size", "modified"]));
    localStorage.setItem("explorer-size-mode", "bytes");
    localStorage.setItem("explorer-provider", "jottacloud");
    localStorage.setItem("explorer-theme", theme);
    localStorage.setItem(
      "explorer-water-settings",
      JSON.stringify({
        effects: true,
        drips: true,
        clickRipples: true,
        caustics: true,
        rowMotion: true,
        glass: true,
        tone: "ocean",
        speed: "flowing",
        intensity: "subtle",
      }),
    );
  } catch {
    /* ignore */
  }
};

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

async function waitForServer(url: string, timeoutMs = 180000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/providers`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.providers)) return;
      }
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become ready: ${url}`);
}

async function isUp(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/providers`, {
      signal: AbortSignal.timeout(1200),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return Array.isArray(data?.providers);
  } catch {
    return false;
  }
}

interface ServerHandle {
  child: ChildProcess | null;
}

async function ensureServer(url: string): Promise<ServerHandle> {
  if (await isUp(url)) {
    log(`  after: reusing ${url}`);
    return { child: null };
  }
  if (args.noServer) throw new Error(`after server is not running at ${url}`);
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error(`Cannot start a local server for ${url}`);
  }
  const port = parsed.port || "80";
  await mkdir(LOGS, { recursive: true });
  const logPath = resolve(LOGS, "after.log");
  const out = openSync(logPath, "w");
  const command = ["bun", "run", "app/src/server/index.ts", "--port", port];
  log(`  after: starting ${command.join(" ")}`);
  const child = spawn(command[0], command.slice(1), {
    cwd: ROOT,
    stdio: ["ignore", out, out],
  });
  closeSync(out);
  try {
    await waitForServer(url);
  } catch (error) {
    child.kill("SIGTERM");
    const text = await readFile(logPath, "utf8").catch(() => "");
    throw new Error(`${(error as Error).message}\n${text}`);
  }
  return { child };
}

async function stopServer(handle: ServerHandle): Promise<void> {
  const child = handle.child;
  if (!child) return;
  if (child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
      resolve();
    }, 1500);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function waitForApp(page: Page): Promise<void> {
  await page.waitForSelector("#pane-local .row", { timeout: 45000 });
  await page.waitForFunction(
    () => {
      const summaries = [
        ...document.querySelectorAll('.pane-foot [data-role="summary"]'),
      ].map((element) => element.textContent || "");
      const loading = [
        ...document.querySelectorAll(".vlist .loading"),
      ].every((element) => (element as HTMLElement).hidden);
      return (
        summaries.length === 2 &&
        summaries.every((text) => text.includes("items")) &&
        loading
      );
    },
    { timeout: 45000 },
  );
  await page.waitForTimeout(250);
}

async function capture(
  baseUrl: string,
  scenario: Scenario,
  outDir: string,
): Promise<void> {
  // A fresh browser per scenario avoids stale pooled HTTP/1.0 sockets from the
  // previous server, which could otherwise make a later navigation fail.
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: scenario.viewport,
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "Europe/Oslo",
  });
  await context.addInitScript(INIT_SCRIPT, { theme: scenario.theme });
  const page = await context.newPage();
  try {
    // The reference server occasionally reset one of the many
    // parallel module requests. Retry the load before declaring failure.
    let loaded = false;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 4 && !loaded; attempt += 1) {
      try {
        await page.goto(`${baseUrl}/?theme=${scenario.theme}`, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        await page.addStyleTag({ content: FREEZE_CSS });
        await page.waitForSelector("#pane-local .row", { timeout: 20000 });
        loaded = true;
      } catch (error) {
        lastError = error;
        await page.waitForTimeout(400);
      }
    }
    if (!loaded) throw lastError;
    await waitForApp(page);
    if (scenario.steps) await scenario.steps(page);
    await page.waitForTimeout(300);
    await mkdir(outDir, { recursive: true });
    await page.screenshot({
      path: resolve(outDir, `${scenario.name}.png`),
      animations: "disabled",
    });
  } finally {
    await context.close();
    await browser.close();
  }
}

function readPng(path: string): PNG {
  return PNG.sync.read(readFileSync(path));
}

function maxChannelDelta(a: Buffer, b: Buffer): number {
  let max = 0;
  for (let i = 0; i < a.length; i += 4) {
    const delta = Math.max(
      Math.abs(a[i] - b[i]),
      Math.abs(a[i + 1] - b[i + 1]),
      Math.abs(a[i + 2] - b[i + 2]),
    );
    if (delta > max) max = delta;
  }
  return max;
}

interface Result {
  name: string;
  viewport: string;
  diffPixels: number;
  totalPixels: number;
  ratio: number;
  maxDelta: number;
  passed: boolean;
  baseline?: string;
  after?: string;
  diff?: string;
}

async function compare(
  baselineDir: string,
  afterDir: string,
  scenarios: Scenario[],
): Promise<Result[]> {
  const diffDir = resolve(OUT, "diff");
  await mkdir(diffDir, { recursive: true });
  const results: Result[] = [];
  for (const scenario of scenarios) {
    const baselinePath = resolve(baselineDir, `${scenario.name}.png`);
    const afterPath = resolve(afterDir, `${scenario.name}.png`);
    if (!existsSync(baselinePath) || !existsSync(afterPath)) {
      results.push({
        name: scenario.name,
        viewport: `${scenario.viewport.width}x${scenario.viewport.height}`,
        diffPixels: -1,
        totalPixels: 0,
        ratio: 1,
        maxDelta: 255,
        passed: false,
      });
      continue;
    }
    const baseline = readPng(baselinePath);
    const after = readPng(afterPath);
    if (baseline.width !== after.width || baseline.height !== after.height) {
      results.push({
        name: scenario.name,
        viewport: `${scenario.viewport.width}x${scenario.viewport.height}`,
        diffPixels: -1,
        totalPixels: baseline.width * baseline.height,
        ratio: 1,
        maxDelta: 255,
        passed: false,
      });
      continue;
    }
    const diff = new PNG({ width: baseline.width, height: baseline.height });
    const diffPixels = pixelmatch(
      baseline.data,
      after.data,
      diff.data,
      baseline.width,
      baseline.height,
      { threshold: 0.1, includeAA: false, alpha: 0.4, diffColor: [255, 0, 64] },
    );
    const diffPath = resolve(diffDir, `${scenario.name}.png`);
    await writeFile(diffPath, PNG.sync.write(diff));
    const totalPixels = baseline.width * baseline.height;
    const ratio = diffPixels / totalPixels;
    results.push({
      name: scenario.name,
      viewport: `${scenario.viewport.width}x${scenario.viewport.height}`,
      diffPixels,
      totalPixels,
      ratio,
      maxDelta: maxChannelDelta(baseline.data, after.data),
      passed: ratio <= args.threshold || diffPixels <= 24,
      baseline: `baseline/${scenario.name}.png`,
      after: `after/${scenario.name}.png`,
      diff: `diff/${scenario.name}.png`,
    });
  }
  return results;
}

async function writeReport(results: Result[]): Promise<void> {
  const payload = {
    generatedAt: new Date().toISOString(),
    reference: "tools/screenshots/reference",
    afterUrl: args.afterUrl,
    threshold: args.threshold,
    scenarios: results,
  };
  await writeFile(resolve(OUT, "report.json"), JSON.stringify(payload, null, 2));
  const lines = [
    "# Explorer rendering comparison",
    "",
    `Generated ${payload.generatedAt}`,
    "",
    `Threshold: ${(args.threshold * 100).toFixed(3)}% (or ≤ 24 pixels)`,
    "",
    "| Scenario | Viewport | Changed pixels | Ratio | Max Δ | Result |",
    "| --- | --- | ---: | ---: | ---: | :---: |",
  ];
  for (const result of results) {
    const pct = result.diffPixels < 0 ? "n/a" : `${(result.ratio * 100).toFixed(4)}%`;
    lines.push(
      `| [${result.name}](${result.diff || ""}) | ${result.viewport} | ${
        result.diffPixels < 0 ? "missing" : result.diffPixels
      } | ${pct} | ${result.maxDelta} | ${result.passed ? "PASS" : "FAIL"} |`,
    );
  }
  lines.push(
    "",
    "Reference: `tools/screenshots/reference/` (copied to `screenshots/baseline/`) · " +
      "After: `screenshots/after/` · Diff: `screenshots/diff/`",
  );
  await writeFile(resolve(OUT, "report.md"), lines.join("\n") + "\n");
  log(`\nReport: ${resolve(OUT, "report.md")}`);
  for (const result of results) {
    log(
      `  ${result.passed ? "PASS" : "FAIL"}  ${result.name.padEnd(18)} ` +
        `${result.diffPixels < 0 ? "missing" : `${result.diffPixels}px`} ` +
        `(${(result.ratio * 100).toFixed(4)}%)`,
    );
  }
}

async function main(): Promise<void> {
  const selected = args.only.length
    ? SCENARIOS.filter((scenario) => args.only.includes(scenario.name))
    : SCENARIOS;
  if (!selected.length) throw new Error("No matching scenarios");

  const materializeReference = () => {
    const dir = resolve(OUT, "baseline");
    rmSync(dir, { recursive: true, force: true });
    cpSync(REFERENCE, dir, { recursive: true });
  };

  if (args.target === "reference") {
    await mkdir(OUT, { recursive: true });
    materializeReference();
    log(`Reference screenshots: ${REFERENCE}`);
    return;
  }

  if (args.target === "compare") {
    materializeReference();
    const results = await compare(REFERENCE, resolve(OUT, "after"), selected);
    await writeReport(results);
    if (results.some((result) => !result.passed)) process.exitCode = 1;
    return;
  }

  await mkdir(OUT, { recursive: true });

  const needAfter = args.target === "both" || args.target === "after";

  let afterServer: ServerHandle = { child: null };

  try {
    if (needAfter) {
      log("  after: building the web bundle");
      const build = spawn(
        "bun",
        [
          "build",
          "app/src/web/main.tsx",
          "--outdir",
          "app/public/js",
          "--target",
          "browser",
          "--minify",
          "--sourcemap=external",
          "--define",
          'process.env.NODE_ENV="production"',
        ],
        { cwd: ROOT, stdio: "inherit" },
      );
      const code = await new Promise<number>((resolve) =>
        build.on("exit", (value) => resolve(value ?? 1)),
      );
      if (code !== 0) throw new Error("Web build failed");
      afterServer = await ensureServer(args.afterUrl);
    }

    if (needAfter) {
      const dir = resolve(OUT, "after");
      await rm(dir, { recursive: true, force: true });
      log(`\nCapturing after (${args.afterUrl})`);
      for (const scenario of selected) {
        log(`  ${scenario.name}`);
        await capture(args.afterUrl, scenario, dir);
      }
    }
  } finally {
    await stopServer(afterServer);
  }

  if (args.target === "both") {
    materializeReference();
    const results = await compare(REFERENCE, resolve(OUT, "after"), selected);
    await writeReport(results);
    if (results.some((result) => !result.passed)) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
