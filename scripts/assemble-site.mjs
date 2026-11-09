#!/usr/bin/env node
/**
 * Assemble the GitHub Pages artifact:
 *
 *   dist/            marketing site (served at /)
 *   dist/docs/       Docusaurus build (served at /docs/)
 *
 * The docs are built with DOCS_BASE_URL pointing at /docs/, so all of their
 * asset URLs already resolve inside dist/docs when the artifact is deployed.
 */

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const marketing = join(root, 'marketing');
const docsBuild = join(root, 'docs', 'build');
const dist = join(root, 'dist');

for (const [label, path] of [
  ['marketing/', marketing],
  ['docs/build/', docsBuild],
]) {
  if (!existsSync(path)) {
    console.error(`Missing ${label} at ${path}`);
    if (label === 'docs/build/') {
      console.error('Run the Docusaurus build first (npm run build:docs).');
    }
    process.exit(1);
  }
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'docs'), { recursive: true });

cpSync(marketing, dist, { recursive: true });
cpSync(docsBuild, join(dist, 'docs'), { recursive: true });

// GitHub Pages should serve files as-is, not run them through Jekyll.
writeFileSync(join(dist, '.nojekyll'), '');

console.log(`Assembled ${dist}`);
console.log(`  /        <- marketing/`);
console.log(`  /docs/   <- docs/build/`);
