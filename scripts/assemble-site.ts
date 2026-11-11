#!/usr/bin/env bun
/**
 * Assemble the GitHub Pages artifact:
 *
 *   dist/                marketing site (served at /)
 *   dist/docs/           Docusaurus build (served at /docs/)
 *   dist/design-system/  shared water design system + component showcase
 *
 * The docs are built with DOCS_BASE_URL pointing at /docs/, so all of their
 * asset URLs already resolve inside dist/docs when the artifact is deployed.
 * The marketing interactions are compiled from TypeScript into dist/main.js.
 */

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const marketing = join(root, "marketing");
const docsBuild = join(root, "docs", "build");
const designSystem = join(root, "design-system");
const dist = join(root, "dist");

for (const [label, path] of [
  ["marketing/", marketing],
  ["docs/build/", docsBuild],
  ["design-system/", designSystem],
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

// GitHub Pages should serve files as-is, not run them through Jekyll.
writeFileSync(join(dist, ".nojekyll"), "");

console.log(`Assembled ${dist}`);
console.log(`  /                 <- marketing/`);
console.log(`  /docs/            <- docs/build/`);
console.log(`  /design-system/   <- design-system/`);
