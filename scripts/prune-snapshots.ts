#!/usr/bin/env bun
/** Keep only the newest N versioned snapshots. */

import { readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const [base, keepArg, current] = Bun.argv.slice(2);
if (!base) {
  console.error("Usage: bun scripts/prune-snapshots.ts BASE [KEEP] [CURRENT]");
  process.exit(2);
}

let keep = Number.parseInt(keepArg ?? "5", 10);
if (!Number.isFinite(keep)) keep = 5;
if (keep <= 0) process.exit(0);

let versions: string[] = [];
try {
  versions = readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort()
    .reverse();
} catch {
  process.exit(0);
}

for (const name of versions.slice(keep)) {
  if (name === current) continue;
  rmSync(resolve(base, name), { recursive: true, force: true });
  console.log(`Pruned old snapshot ${name}`);
}
