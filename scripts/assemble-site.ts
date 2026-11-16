#!/usr/bin/env bun
/**
 * Assemble the GitHub Pages artifact:
 *
 *   dist/                marketing site (served at /)
 *   dist/docs/           Docusaurus build (served at /docs/)
 *   dist/design-system/  shared water design system + component showcase
 *   dist/demo/           read-only explorer running on synthetic demo data
 *
 * The docs are built with DOCS_BASE_URL pointing at /docs/, so all of their
 * asset URLs already resolve inside dist/docs when the artifact is deployed.
 * The marketing interactions are compiled from TypeScript into dist/main.js.
 *
 * The demo has no server: it is the normal explorer bundle plus a small static
 * dataset, and `window.__DCA_DEMO__` switches the client to that dataset.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { writeDemoData } from "./build-demo";

const root = resolve(import.meta.dir, "..");
const marketing = join(root, "marketing");
const docsBuild = join(root, "docs", "build");
const designSystem = join(root, "design-system");
const appDir = join(root, "app");
const appPublic = join(appDir, "public");
const dist = join(root, "dist");

for (const [label, path] of [
  ["marketing/", marketing],
  ["docs/build/", docsBuild],
  ["design-system/", designSystem],
  ["app/public/", appPublic],
] as const) {
  if (!existsSync(path)) {
    console.error(`Missing ${label} at ${path}`);
    if (label === "docs/build/") {
      console.error("Run the Docusaurus build first (npm run build:docs).");
    }
    process.exit(1);
  }
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "docs"), { recursive: true });

// Copy the static marketing files, but keep TypeScript sources out of dist.
cpSync(marketing, dist, {
  recursive: true,
  filter: (source) => !source.endsWith(".ts"),
});
cpSync(docsBuild, join(dist, "docs"), { recursive: true });
cpSync(designSystem, join(dist, "design-system"), {
  recursive: true,
  filter: (source) => !source.endsWith(".md"),
});

const result = await Bun.build({
  entrypoints: [join(marketing, "main.ts")],
  outdir: dist,
  target: "browser",
  minify: true,
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

// ---------------------------------------------------------------- demo build

const demoDir = join(dist, "demo");

// The explorer shell uses root-absolute asset URLs for the Bun server. The demo
// is served from a subpath, so rewrite them to relative ones.
let shell = readFileSync(join(appPublic, "index.html"), "utf8");
shell = shell
  .replaceAll('href="/style.css"', 'href="./style.css"')
  .replaceAll('src="/js/main.js"', 'src="./js/main.js"')
  .replaceAll("<title>Tank ⇄ Jottacloud</title>", "<title>Demo · Tank ⇄ Jottacloud</title>");
const demoFlag = `<script>window.__DCA_DEMO__={data:"demo-data.json"};</script>\n`;
shell = shell.replace('<link rel="stylesheet" href="./style.css">', `${demoFlag}<link rel="stylesheet" href="./style.css">`);
if (!shell.includes("__DCA_DEMO__")) {
  console.error("Could not inject the demo flag into app/public/index.html");
  process.exit(1);
}
mkdirSync(join(demoDir, "js"), { recursive: true });
writeFileSync(join(demoDir, "index.html"), shell);

cpSync(join(appPublic, "style.css"), join(demoDir, "style.css"));
cpSync(join(appPublic, "css"), join(demoDir, "css"), { recursive: true });

const demoBundle = await Bun.build({
  entrypoints: [join(appDir, "src", "web", "main.tsx")],
  outdir: join(demoDir, "js"),
  target: "browser",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
if (!demoBundle.success) {
  for (const log of demoBundle.logs) console.error(log);
  process.exit(1);
}

const demo = writeDemoData(join(demoDir, "demo-data.json"));

// GitHub Pages should serve files as-is, not run them through Jekyll.
writeFileSync(join(dist, ".nojekyll"), "");

console.log(`Assembled ${dist}`);
console.log(`  /                 <- marketing/`);
console.log(`  /docs/            <- docs/build/`);
console.log(`  /design-system/   <- design-system/`);
console.log(
  `  /demo/            <- app/ on synthetic data ` +
    `(${demo.providers.map((provider) => provider.label).join(", ")})`,
);
