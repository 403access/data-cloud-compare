#!/usr/bin/env bun
/** Write the manifest for a versioned Google Drive snapshot. */

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const [archive, out, version, remote, remotePath] = Bun.argv.slice(2);
if (!archive || !out || !version || !remote) {
  console.error(
    "Usage: bun scripts/snapshot-manifest.ts ARCHIVE OUT VERSION REMOTE [REMOTE_PATH]",
  );
  process.exit(2);
}

let data: any = JSON.parse(readFileSync(archive, "utf8"));
if (!Array.isArray(data)) data = data?.items ?? data?.files ?? [];
let files = 0;
let dirs = 0;
let size = 0;
for (const entry of data) {
  if (entry?.IsDir ?? entry?.is_dir ?? false) dirs += 1;
  else {
    files += 1;
    const value = Math.trunc(Number(entry?.Size ?? entry?.size ?? 0));
    if (Number.isFinite(value)) size += Math.max(0, value);
  }
}

const stat = statSync(archive, { bigint: true });
const createdSeconds = Number(stat.mtimeNs / 1_000_000_000n);
const micros = Number((stat.mtimeNs / 1_000n) % 1_000_000n);
const base = new Date(createdSeconds * 1000).toISOString().replace(/\.\d{3}Z$/, "");
const created = micros
  ? `${base}.${String(micros).padStart(6, "0")}Z`
  : `${base}Z`;

const manifest = {
  version,
  created_at: Number(stat.mtimeNs) / 1_000_000_000,
  created,
  remote,
  remote_path: remotePath || "",
  archive: basename(archive),
  files,
  dirs,
  bytes: size,
  report: existsSync(resolve(dirname(archive), "report")),
};

writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
