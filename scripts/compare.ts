#!/usr/bin/env bun
/**
 * Compare a cloud listing (rclone lsjson -R) against the local file_indexer.db.
 *
 * The DB is treated as the source of truth. DB paths are rooted at /mnt/tank,
 * so that prefix is stripped before comparison. Archive paths are relative to
 * the archive mountpoint (an optional leading "Archive/" is stripped).
 *
 * Matching strategy per remote item:
 *   1. exact relative path
 *   2. case-insensitive relative path
 *   3. files: same basename + same size anywhere in the DB (=> moved)
 *   4. files: same basename, different size anyway (=> possible / size differs)
 *   5. folders: same folder name elsewhere, or all children found elsewhere
 *
 * Outputs (in --out, default ./report):
 *   summary.json
 *   missing.csv
 *   moved.csv
 *   local_only.csv
 *   report.html   (self-contained visual diff)
 *   report_data.json
 */

import { Database } from "bun:sqlite";
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { resolve } from "node:path";

const BASE = "/mnt/tank";

const FW: Record<string, string> = {
  "\uff02": '"',
  "\uff0a": "*",
  "\uff1a": ":",
  "\uff1c": "<",
  "\uff1e": ">",
  "\uff1f": "?",
  "\uff7c": "|",
  "\uff05": "%",
};

export function normPath(value: unknown): string {
  if (value == null) return "";
  let path = String(value).normalize("NFC");
  path = path.replace(/[\uff02\uff0a\uff1a\uff1c\uff1e\uff1f\uff7c\uff05]/g, (ch) => FW[ch] ?? ch);
  path = path.replace(/\\/g, "/").replace(/\/+/g, "/");
  return path.replace(/^\/+|\/+$/g, "");
}

export interface ArchiveEntry {
  rel: string;
  isdir: boolean;
  size: number;
  md5: string;
  mod: string;
}

export function loadArchive(path: string, stripArchivePrefix = true): ArchiveEntry[] {
  let text: string | null = readFileSync(path, "utf8");
  let data: any = JSON.parse(text);
  text = null;
  if (!Array.isArray(data)) data = data?.items ?? data?.files ?? [];
  let entries: ArchiveEntry[] = [];
  const prefixes = new Set<string>();
  for (const item of data) {
    const rel = normPath(item?.Path || item?.path || item?.Name || "");
    if (!rel) continue;
    const isdir = Boolean(item?.IsDir ?? item?.is_dir ?? false);
    let size = 0;
    try {
      size = Math.trunc(Number(item?.Size ?? item?.size ?? 0));
      if (!Number.isFinite(size)) size = 0;
    } catch {
      size = 0;
    }
    entries.push({
      rel,
      isdir,
      size,
      md5: item?.Hashes?.MD5 || item?.md5 || "",
      mod: item?.ModTime || item?.mod || "",
    });
    prefixes.add(rel.split("/", 1)[0]);
  }
  data = null;

  if (stripArchivePrefix && prefixes.size === 1 && prefixes.has("Archive")) {
    for (const entry of entries) {
      if (entry.rel === "Archive") entry.rel = "";
      else if (entry.rel.startsWith("Archive/")) entry.rel = entry.rel.slice("Archive/".length);
    }
    entries = entries.filter((entry) => entry.rel);
  }

  // Ensure every parent folder is present, even when a listing omits dirs.
  const seenDirs = new Set(entries.filter((entry) => entry.isdir).map((entry) => entry.rel));
  const extra: ArchiveEntry[] = [];
  for (const entry of entries) {
    const parts = entry.rel.split("/");
    for (let i = 1; i < parts.length; i += 1) {
      const dir = parts.slice(0, i).join("/");
      if (!seenDirs.has(dir)) {
        seenDirs.add(dir);
        extra.push({ rel: dir, isdir: true, size: 0, md5: "", mod: "" });
      }
    }
  }
  entries.push(...extra);
  return entries;
}

interface DbEntry {
  size: number;
  isdir: boolean;
  isfile: boolean;
}

interface DbIndex {
  total: number;
  exact: Map<string, DbEntry>;
  lower: Map<string, string[]>;
  nameSize: Map<string, string[]>;
  nameAny: Map<string, Array<[string, boolean, number]>>;
  dirName: Map<string, Array<[string, number]>>;
}

function nameSizeKey(name: string, size: number): string {
  return `${name}\u0000${size}`;
}

export function loadDb(path: string): DbIndex {
  const con = new Database(path, { readonly: true });
  const exact = new Map<string, DbEntry>();
  const lower = new Map<string, string[]>();
  const nameSize = new Map<string, string[]>();
  const nameAny = new Map<string, Array<[string, boolean, number]>>();
  const dirName = new Map<string, Array<[string, number]>>();
  let total = 0;
  try {
    const rows = con.query("SELECT path, size, is_directory, is_file FROM files").iterate() as Iterable<any>;
    for (const row of rows) {
      total += 1;
      const pathValue = String(row.path);
      let rel: string;
      if (pathValue === BASE) rel = "";
      else if (pathValue.startsWith(`${BASE}/`)) rel = pathValue.slice(BASE.length + 1);
      else rel = normPath(pathValue);
      const isdir = Boolean(row.is_directory);
      const isfile = Boolean(row.is_file);
      const size = Number(row.size ?? 0);
      exact.set(rel, { size, isdir, isfile });
      const lowerKey = rel.toLowerCase();
      const lowerList = lower.get(lowerKey);
      if (lowerList) lowerList.push(rel);
      else lower.set(lowerKey, [rel]);
      const name = rel.slice(rel.lastIndexOf("/") + 1);
      const anyList = nameAny.get(name);
      if (anyList) anyList.push([rel, isdir, size]);
      else nameAny.set(name, [[rel, isdir, size]]);
      if (isdir) {
        const dirKey = name.toLowerCase();
        const dirList = dirName.get(dirKey);
        if (dirList) dirList.push([rel, size]);
        else dirName.set(dirKey, [[rel, size]]);
      }
      if (isfile) {
        const key = nameSizeKey(name, size);
        const list = nameSize.get(key);
        if (list) list.push(rel);
        else nameSize.set(key, [rel]);
      }
    }
  } finally {
    con.close();
  }
  return { total, exact, lower, nameSize, nameAny, dirName };
}

/** Higher is a better moved-to candidate. */
function pathScore(candidateRel: string, remoteRel: string): number {
  const cr = candidateRel.split("/");
  const rr = remoteRel.split("/");
  let score = 0;
  if ((cr.length >= 2 ? cr[cr.length - 2] : "") === (rr.length >= 2 ? rr[rr.length - 2] : "")) {
    score += 4;
  }
  if ((cr[0] ?? "") === (rr[0] ?? "")) score += 2;
  score -= Math.abs(cr.length - rr.length);
  score -= cr.length * 0.01;
  return score;
}

function pickCandidate(cands: string[], remoteRel: string): [string, number] {
  let best = cands[0];
  let bestScore = pathScore(best, remoteRel);
  for (let i = 1; i < cands.length; i += 1) {
    const score = pathScore(cands[i], remoteRel);
    if (score > bestScore) {
      best = cands[i];
      bestScore = score;
    }
  }
  return [best, cands.length - 1];
}

interface ResultRecord {
  status: string;
  isdir: boolean;
  size: number;
  found: string;
  note: string;
}

type Bucket = "exact" | "moved" | "possible" | "missing";

const STATUS_LABEL: Record<string, string> = {
  present_exact: "Present (same path)",
  size_mismatch: "Present (size differs)",
  present_moved: "Present (moved)",
  possible: "Possible (name only)",
  partial: "Partially present",
  missing: "Missing",
  unresolved: "Unresolved",
};

function formatInt(value: number): string {
  return value.toLocaleString("en-US");
}

function human(n: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i];
    if (value < 1024 || unit === "TB") {
      return unit === "B" ? `${value} B` : `${value.toFixed(1)} ${unit}`;
    }
    value /= 1024;
  }
  return `${value} B`;
}

function bucketFor(status: string): Bucket {
  if (status === "missing" || status === "unresolved") return "missing";
  if (status === "possible") return "possible";
  if (status === "present_moved" || status === "partial") return "moved";
  return "exact";
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function csvField(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCsv(path: string, header: string[], rows: unknown[][]): void {
  const lines: string[] = [header.map(csvField).join(",")];
  for (const row of rows) lines.push(row.map(csvField).join(","));
  writeFileSync(path, `${lines.join("\r\n")}\r\n`);
}

class ChunkWriter {
  private fd: number;
  private chunks: string[] = [];
  private size = 0;

  constructor(path: string) {
    this.fd = openSync(path, "w");
  }

  write(text: string): void {
    this.chunks.push(text);
    this.size += text.length;
    if (this.size >= 1 << 20) this.flush();
  }

  private flush(): void {
    if (!this.chunks.length) return;
    const buffer = Buffer.from(this.chunks.join(""), "utf8");
    this.chunks = [];
    this.size = 0;
    let offset = 0;
    while (offset < buffer.length) {
      offset += writeSync(this.fd, buffer, offset, buffer.length - offset);
    }
  }

  close(): void {
    this.flush();
    closeSync(this.fd);
  }
}

export interface CompareOptions {
  db: string;
  archive: string;
  out: string;
  label: string;
  stripArchivePrefix: boolean;
}

export function compare(options: CompareOptions): void {
  const { db: dbPath, archive: archivePath, out, label, stripArchivePrefix } = options;
  mkdirSync(out, { recursive: true });

  console.error("Loading archive listing...");
  const remote = loadArchive(archivePath, stripArchivePrefix);
  console.error(`  ${formatInt(remote.length)} archive entries`);

  console.error("Loading local index...");
  const db = loadDb(dbPath);
  console.error(`  ${formatInt(db.total)} local entries`);

  const files = remote.filter((entry) => !entry.isdir);
  const dirs = remote.filter((entry) => entry.isdir);
  const results = new Map<string, ResultRecord>();
  const matchedLocal = new Set<string>();

  function exactLookup(entry: ArchiveEntry, wantDir: boolean): [string | null, boolean] {
    const rel = entry.rel;
    const record = db.exact.get(rel);
    if (record && record.isdir === wantDir) return [rel, true];
    for (const candidate of db.lower.get(rel.toLowerCase()) ?? []) {
      const other = db.exact.get(candidate);
      if (other && other.isdir === wantDir) return [candidate, false];
    }
    return [null, false];
  }

  function mark(
    rel: string,
    status: string,
    opts: { isdir?: boolean; size?: number; found?: string; note?: string } = {},
  ): void {
    results.set(rel, {
      status,
      isdir: opts.isdir ?? false,
      size: opts.size ?? 0,
      found: opts.found ?? "",
      note: opts.note ?? "",
    });
  }

  // ---- files ----
  const unmatched: ArchiveEntry[] = [];
  for (const entry of files) {
    const rel = entry.rel;
    const size = entry.size;
    const [candidate] = exactLookup(entry, false);
    if (candidate !== null) {
      const localSize = db.exact.get(candidate)!.size;
      const same = localSize === size;
      const note = same
        ? ""
        : `size differs: archive ${formatInt(size)} / local ${formatInt(localSize)}`;
      mark(rel, same ? "present_exact" : "size_mismatch", {
        isdir: false,
        size,
        found: candidate,
        note,
      });
      matchedLocal.add(candidate);
      continue;
    }
    unmatched.push(entry);
  }

  for (const entry of unmatched) {
    const { rel, size } = entry;
    const name = rel.slice(rel.lastIndexOf("/") + 1);
    const candidates = db.nameSize.get(nameSizeKey(name, size)) ?? [];
    if (candidates.length) {
      const [best, others] = pickCandidate(candidates, rel);
      mark(rel, "present_moved", {
        isdir: false,
        size,
        found: best,
        note: others ? `+${others} other location(s)` : "",
      });
      matchedLocal.add(best);
      continue;
    }
    const anyCandidates = db.nameAny.get(name) ?? [];
    if (anyCandidates.length) {
      const fileCandidates = anyCandidates.filter(([, isdir]) => !isdir);
      if (fileCandidates.length) {
        const [best, others] = pickCandidate(fileCandidates.map(([relValue]) => relValue), rel);
        const bestSize = fileCandidates.find(([relValue]) => relValue === best)?.[2] ?? 0;
        mark(rel, "possible", {
          isdir: false,
          size,
          found: best,
          note:
            `same name, different size (local ${formatInt(bestSize)})` +
            (others ? `; +${others} more` : ""),
        });
        matchedLocal.add(best);
        continue;
      }
    }
    mark(rel, "missing", { isdir: false, size });
  }

  // ---- dirs ----
  const dirChildren = new Map<string, string[]>();
  for (const entry of dirs) {
    const rel = entry.rel;
    const parent = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
    const kids = dirChildren.get(parent);
    if (kids) kids.push(rel);
    else dirChildren.set(parent, [rel]);
    const [candidate] = exactLookup(entry, true);
    if (candidate !== null) {
      mark(rel, "present_exact", { isdir: true, size: entry.size, found: candidate });
      matchedLocal.add(candidate);
    }
  }

  for (const entry of dirs) {
    const rel = entry.rel;
    if (results.get(rel)?.status === "present_exact") continue;
    const name = rel.slice(rel.lastIndexOf("/") + 1);
    const candidates = db.dirName.get(name.toLowerCase()) ?? [];
    if (candidates.length) {
      const [best, others] = pickCandidate(candidates.map(([relValue]) => relValue), rel);
      mark(rel, "present_moved", {
        isdir: true,
        size: entry.size,
        found: best,
        note: others ? `+${others} other folder(s)` : "same folder name",
      });
      matchedLocal.add(best);
    } else {
      mark(rel, "unresolved", { isdir: true, size: entry.size });
    }
  }

  // Second pass (deepest first): folder status from children.
  const depth = new Map(dirs.map((entry) => [entry.rel, entry.rel.split("/").length]));
  const deepest = dirs.slice().sort((a, b) => depth.get(b.rel)! - depth.get(a.rel)!);
  for (const entry of deepest) {
    const rel = entry.rel;
    if (results.get(rel)?.status !== "unresolved") continue;
    const kids = dirChildren.get(rel) ?? [];
    if (!kids.length) {
      results.get(rel)!.status = "missing";
      continue;
    }
    const counts = new Map<string, number>();
    for (const kid of kids) {
      const status = results.get(kid)?.status ?? "missing";
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    counts.set(
      "present_exact",
      (counts.get("present_exact") ?? 0) + (counts.get("size_mismatch") ?? 0),
    );
    const present = (counts.get("present_exact") ?? 0) + (counts.get("present_moved") ?? 0);
    const missing = counts.get("missing") ?? 0;
    const record = results.get(rel)!;
    if (present && !missing) {
      record.status = "present_moved";
      record.note = "structure differs but all children found";
    } else if (present) {
      record.status = "partial";
      record.note = `${present} present / ${missing} missing child item(s)`;
    } else {
      record.status = "missing";
    }
  }

  // ---- aggregate ----
  const summary = new Map<string, { files: number; dirs: number; bytes: number }>();
  const summaryRecord = (bucket: string) => {
    let record = summary.get(bucket);
    if (!record) {
      record = { files: 0, dirs: 0, bytes: 0 };
      summary.set(bucket, record);
    }
    return record;
  };
  for (const entry of remote) {
    const status = results.get(entry.rel)!.status;
    const bucket = bucketFor(status);
    const record = summaryRecord(bucket);
    if (entry.isdir) record.dirs += 1;
    else {
      record.files += 1;
      record.bytes += entry.size;
    }
  }

  const totalFiles = files.length;
  const totalDirs = dirs.length;
  const totalBytes = files.reduce((sum, entry) => sum + entry.size, 0);
  const exactBucket = summaryRecord("exact");
  const movedBucket = summaryRecord("moved");
  const possibleBucket = summaryRecord("possible");
  const missingBucket = summaryRecord("missing");
  const presentFiles = exactBucket.files + movedBucket.files + possibleBucket.files;
  const missingFiles = missingBucket.files;

  const summaryOut: Record<string, any> = {
    archive: { files: totalFiles, dirs: totalDirs, bytes: totalBytes },
    buckets: Object.fromEntries(summary),
    present_files: presentFiles,
    missing_files: missingFiles,
    present_pct: totalFiles ? (100.0 * presentFiles) / totalFiles : 0.0,
    db_entries: db.total,
  };

  // ---- top level breakdown ----
  const top = new Map<
    string,
    { files: number; dirs: number; exact: number; moved: number; possible: number; missing: number; bytes: number }
  >();
  for (const entry of remote) {
    if (entry.rel === "") continue;
    const key = entry.rel.split("/", 1)[0];
    let record = top.get(key);
    if (!record) {
      record = { files: 0, dirs: 0, exact: 0, moved: 0, possible: 0, missing: 0, bytes: 0 };
      top.set(key, record);
    }
    const status = results.get(entry.rel)!.status;
    const bucket = bucketFor(status);
    record[bucket] += 1;
    if (entry.isdir) record.dirs += 1;
    else {
      record.files += 1;
      record.bytes += entry.size;
    }
  }
  const topList = [...top.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, record]) => ({ name, ...record }));

  // ---- write csvs ----
  const movedRows: unknown[][] = [];
  const missingRows: unknown[][] = [];
  for (const entry of remote) {
    const record = results.get(entry.rel)!;
    const row = [
      entry.rel,
      entry.isdir ? "dir" : "file",
      record.status,
      entry.size,
      record.found,
      record.note,
    ];
    if (record.status === "missing" || record.status === "unresolved") missingRows.push(row);
    else if (
      record.status === "present_moved" ||
      record.status === "possible" ||
      record.status === "partial"
    ) {
      movedRows.push(row);
    }
  }
  const header = ["archive_path", "type", "status", "size", "found_at", "note"];
  writeCsv(resolve(out, "moved.csv"), header, movedRows);
  writeCsv(resolve(out, "missing.csv"), header, missingRows);

  const localOnly: unknown[][] = [];
  for (const [rel, record] of db.exact) {
    if (rel === "") continue;
    if (!matchedLocal.has(rel)) localOnly.push([rel, record.isdir ? "dir" : "file", record.size]);
  }
  writeCsv(resolve(out, "local_only.csv"), ["local_path", "type", "size"], localOnly);
  summaryOut.local_only_count = localOnly.length;

  writeFileSync(resolve(out, "summary.json"), JSON.stringify(summaryOut, null, 2));

  // ---- report data ----
  const folders: Array<Record<string, any>> = [];
  for (const entry of dirs) {
    const record = results.get(entry.rel)!;
    const kids = dirChildren.get(entry.rel) ?? [];
    const counts = new Map<string, number>();
    for (const kid of kids) {
      const status = results.get(kid)?.status ?? "missing";
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    counts.set(
      "present_exact",
      (counts.get("present_exact") ?? 0) + (counts.get("size_mismatch") ?? 0),
    );
    folders.push({
      p: entry.rel,
      s: record.status,
      n: kids.length,
      e: counts.get("present_exact") ?? 0,
      m: counts.get("present_moved") ?? 0,
      x: counts.get("missing") ?? 0,
      f: record.found,
    });
  }

  const SAMPLES: Record<string, number> = {
    missing: 25000,
    possible: 10000,
    present_moved: 10000,
    partial: 4000,
    size_mismatch: 4000,
  };
  const issueCounts = new Map<string, number>();
  const sampleCounts = new Map<string, number>();
  const issuesSample: Array<Record<string, any>> = [];
  const dataPath = resolve(out, "report_data.json");
  const writer = new ChunkWriter(dataPath);
  try {
    writer.write(`{"summary":${JSON.stringify(summaryOut)}`);
    writer.write(`,"top":${JSON.stringify(topList)}`);
    writer.write(`,"folders":${JSON.stringify(folders)}`);
    writer.write(`,"issues":[`);
    let first = true;
    for (const entry of remote) {
      const record = results.get(entry.rel)!;
      const status = record.status;
      if (status === "present_exact") continue;
      issueCounts.set(status, (issueCounts.get(status) ?? 0) + 1);
      const issue = {
        p: entry.rel,
        d: entry.isdir ? 1 : 0,
        s: status,
        z: entry.size,
        f: record.found,
        n: record.note,
      };
      if (!first) writer.write(",");
      writer.write(JSON.stringify(issue));
      first = false;
      const count = sampleCounts.get(status) ?? 0;
      if (count < (SAMPLES[status] ?? 0)) {
        sampleCounts.set(status, count + 1);
        issuesSample.push(issue);
      }
    }
    writer.write(`],"issue_counts":${JSON.stringify(Object.fromEntries(issueCounts))}}`);
  } finally {
    writer.close();
  }
  const issueCount = [...issueCounts.values()].reduce((sum, value) => sum + value, 0);

  const payload = {
    summary: summaryOut,
    top: topList,
    folders,
    issues: issuesSample,
    issue_counts: Object.fromEntries(issueCounts),
    status_labels: STATUS_LABEL,
    samples: SAMPLES,
  };
  writeHtml(out, payload, issueCount, missingRows.length, movedRows.length, label);

  console.error(
    `\nArchive: ${formatInt(totalFiles)} files, ${formatInt(totalDirs)} dirs, ${human(totalBytes)}`,
  );
  for (const key of ["exact", "moved", "possible", "missing"] as const) {
    const bucket = summaryRecord(key);
    console.error(
      `  ${key.padEnd(9)}: ${formatInt(bucket.files)} files / ${formatInt(bucket.dirs)} dirs`,
    );
  }
  console.error(`Local-only DB entries: ${formatInt(localOnly.length)}`);
  console.error(`Report: ${resolve(out, "report.html")}`);
}

function writeHtml(
  outdir: string,
  payload: Record<string, any>,
  issueCount: number,
  _missingCount: number,
  _movedCount: number,
  label = "Jottacloud Archive",
): void {
  const templatePath = resolve(import.meta.dir, "report-template.html");
  let doc = readFileSync(templatePath, "utf8");
  const data = JSON.stringify(payload);
  const labels = JSON.stringify(payload.status_labels);
  // Resolve template placeholders before injecting the data, so file paths
  // that happen to look like a placeholder are never rewritten.
  doc = doc
    .replace("__LABELS__", labels)
    .replaceAll("__TITLE__", htmlEscape(`${label} vs local index`))
    .replace("__N_ISSUES__", String(issueCount))
    .replace("__DATA__", data);
  writeFileSync(resolve(outdir, "report.html"), doc);
}

function parseArgs(argv: string[]): CompareOptions {
  const options: CompareOptions = {
    db: "file_indexer.db",
    archive: "",
    out: "report",
    label: "Jottacloud Archive",
    stripArchivePrefix: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--db") options.db = argv[++i] ?? options.db;
    else if (arg === "--archive") options.archive = argv[++i] ?? "";
    else if (arg === "--out") options.out = argv[++i] ?? options.out;
    else if (arg === "--label") options.label = argv[++i] ?? options.label;
    else if (arg === "--no-strip-archive") options.stripArchivePrefix = false;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: bun scripts/compare.ts --archive ARCHIVE [--db DB] [--out DIR]\n" +
          "       [--label LABEL] [--no-strip-archive]",
      );
      process.exit(0);
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(2);
    }
  }
  if (!options.archive) {
    console.error("Error: --archive is required");
    process.exit(2);
  }
  return options;
}

if (import.meta.main) {
  compare(parseArgs(Bun.argv.slice(2)));
}

export { human, formatInt, htmlEscape };
