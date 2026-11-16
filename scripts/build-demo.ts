#!/usr/bin/env bun
/**
 * Build the static demo dataset.
 *
 * The regular explorer reads a Bun server and SQLite caches. GitHub Pages is
 * static-only, so the demo ships a small synthetic dataset shaped exactly like
 * the four API responses. Nothing here derives from a real archive: names,
 * sizes and timestamps are generated, so publishing the demo cannot leak data.
 *
 * Output: dist/demo/demo-data.json (or the path passed as the first argument).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname as dirOf, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const DEFAULT_OUT = resolve(ROOT, "dist", "demo", "demo-data.json");
const BASE = "/mnt/tank";
const DEMO_EPOCH = Math.floor(Date.UTC(2026, 10, 9, 14, 32) / 1000);
const DAY = 86_400;

type Side = "local" | "remote";

interface Entry {
  name: string;
  path: string;
  parent: string;
  is_dir: boolean;
  type: string;
  size: number | null;
  modified: number | null;
  status: string;
  found_at: string;
  note: string;
  child_count: number | null;
  folder_size: number | null;
  agg: FolderAgg | null;
}

interface FolderAgg {
  total: number;
  exact: number;
  moved: number;
  possible: number;
  missing: number;
  partial: number;
  found_at: string;
}

interface SourceInfo {
  label: string;
  path: string;
  mtime?: number;
  size?: number;
  missing?: boolean;
}

interface DemoProvider {
  key: string;
  label: string;
  root_label: string;
  subtitle: string;
  accent: string;
  archive: string;
  report_dir: string;
  rclone_remote: string;
  snapshot_version: string;
  snapshot_time: number;
  available: boolean;
  reason: string;
  summary: Record<string, unknown>;
  sources: SourceInfo[];
}

interface DemoData {
  version: 1;
  base: string;
  generated_at: string;
  default: string;
  providers: DemoProvider[];
  listings: Record<string, { local: Entry[]; remote: Entry[] }>;
}

interface Node {
  path: string;
  isDir: boolean;
  size: number;
  modified: number | null;
  status: string;
  foundAt: string;
  note: string;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function entryType(name: string, isDir: boolean): string {
  if (isDir) return "Folder";
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toUpperCase() : "File";
}

function fmtInt(value: number): string {
  return value.toLocaleString("en-US");
}

/** One side of the tree, with the same fields the server builds from SQLite. */
class Tree {
  readonly nodes = new Map<string, Node>();

  constructor(private readonly rand: () => number) {}

  private parents(path: string): void {
    const parts = path.split("/");
    let current = "";
    for (let i = 0; i < parts.length - 1; i += 1) {
      current = current ? `${current}/${parts[i]}` : parts[i];
      const existing = this.nodes.get(current);
      if (!existing) {
        this.nodes.set(current, {
          path: current,
          isDir: true,
          size: 0,
          modified: this.stamp(),
          status: "",
          foundAt: "",
          note: "",
        });
      } else if (!existing.isDir) {
        throw new Error(`Path is both a file and a folder: ${current}`);
      }
    }
  }

  private stamp(): number {
    return Math.floor(DEMO_EPOCH - this.rand() * 540 * DAY);
  }

  dir(path: string, status = "", foundAt = ""): void {
    this.parents(path);
    const existing = this.nodes.get(path);
    if (existing) {
      if (!existing.isDir) throw new Error(`Path is a file: ${path}`);
      if (status) {
        existing.status = status;
        existing.foundAt = foundAt;
      }
      return;
    }
    this.nodes.set(path, {
      path,
      isDir: true,
      size: 0,
      modified: this.stamp(),
      status,
      foundAt,
      note: "",
    });
  }

  file(
    path: string,
    size: number,
    status: string,
    foundAt = "",
    note = "",
  ): void {
    this.parents(path);
    const existing = this.nodes.get(path);
    if (existing?.isDir) throw new Error(`Path is a folder: ${path}`);
    this.nodes.set(path, {
      path,
      isDir: false,
      size,
      modified: this.stamp(),
      status,
      foundAt,
      note,
    });
  }
}

interface Counts {
  total: number;
  exact: number;
  moved: number;
  possible: number;
  missing: number;
}

function childCounts(tree: Tree, path: string): Counts {
  const counts: Counts = { total: 0, exact: 0, moved: 0, possible: 0, missing: 0 };
  for (const node of tree.nodes.values()) {
    if (dirname(node.path) !== path) continue;
    counts.total += 1;
    if (node.status === "exact") counts.exact += 1;
    else if (node.status === "moved" || node.status === "partial") counts.moved += 1;
    else if (node.status === "possible") counts.possible += 1;
    else counts.missing += 1;
  }
  return counts;
}

function aggFrom(counts: Counts, foundAt = ""): FolderAgg {
  return {
    total: counts.total,
    exact: counts.exact,
    moved: counts.moved,
    possible: counts.possible,
    missing: counts.missing,
    partial: 0,
    found_at: foundAt,
  };
}

function folderSizes(tree: Tree): Map<string, number> {
  const totals = new Map<string, number>();
  for (const node of tree.nodes.values()) {
    if (node.isDir) continue;
    let parent = dirname(node.path);
    while (parent) {
      totals.set(parent, (totals.get(parent) ?? 0) + node.size);
      parent = dirname(parent);
    }
  }
  return totals;
}

/** Resolve remote folder statuses bottom-up, exactly like the comparison report. */
function finalizeRemote(remote: Tree, local: Tree): Map<string, FolderAgg> {
  const dirs = [...remote.nodes.values()].filter((node) => node.isDir);
  dirs.sort((a, b) => b.path.split("/").length - a.path.split("/").length);
  const aggs = new Map<string, FolderAgg>();
  for (const dir of dirs) {
    const counts = childCounts(remote, dir.path);
    const localDir = local.nodes.get(dir.path);
    if (!dir.status) {
      if (localDir?.isDir) {
        dir.status = "exact";
      } else {
        const present = counts.exact + counts.moved;
        if (present > 0 && counts.missing > 0) dir.status = "partial";
        else if (present > 0) dir.status = "moved";
        else dir.status = "missing";
      }
    }
    aggs.set(dir.path, aggFrom(counts, dir.foundAt));
  }
  return aggs;
}

/** Resolve local folders from their remote counterparts and direct children. */
function finalizeLocal(
  local: Tree,
  remote: Tree,
  remoteAggs: Map<string, FolderAgg>,
  childCount: Map<string, number>,
): Map<string, FolderAgg | null> {
  const aggs = new Map<string, FolderAgg | null>();
  const dirs = [...local.nodes.values()].filter((node) => node.isDir);
  dirs.sort((a, b) => b.path.split("/").length - a.path.split("/").length);
  for (const dir of dirs) {
    const remoteDir = remote.nodes.get(dir.path);
    let agg: FolderAgg | null = null;
    if (!dir.status) {
      if (remoteDir?.isDir) dir.status = remoteDir.status || "exact";
      else dir.status = "local_only";
    }
    if (remoteDir?.isDir) agg = remoteAggs.get(dir.path) ?? null;
    aggs.set(dir.path, agg);
  }
  for (const node of local.nodes.values()) {
    if (!node.isDir) continue;
    const counts = childCounts(local, node.path);
    childCount.set(node.path, counts.total);
  }
  return aggs;
}

function toEntries(
  tree: Tree,
  side: Side,
  aggs: Map<string, FolderAgg | null>,
  sizes: Map<string, number>,
  childCount: Map<string, number>,
): Entry[] {
  const entries: Entry[] = [];
  for (const node of tree.nodes.values()) {
    const name = basename(node.path);
    const parent = dirname(node.path);
    const agg = aggs.get(node.path) ?? null;
    entries.push({
      name,
      path: node.path,
      parent,
      is_dir: node.isDir,
      type: entryType(name, node.isDir),
      size: node.isDir ? null : node.size,
      modified: side === "remote" ? null : node.modified,
      status: node.status || "exact",
      found_at: node.foundAt,
      note: node.note,
      child_count: node.isDir
        ? side === "local"
          ? childCount.get(node.path) || (agg ? agg.total : null)
          : null
        : null,
      folder_size: node.isDir ? sizes.get(node.path) ?? 0 : null,
      agg: node.isDir ? agg : null,
    });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

interface BuildResult {
  listings: { local: Entry[]; remote: Entry[] };
  summary: Record<string, unknown>;
}

function buildProvider(key: "jottacloud" | "google_drive"): BuildResult {
  const drive = key === "google_drive";
  const rand = mulberry32(drive ? 0x51ee_2026 : 0x70a7_2026);
  const local = new Tree(rand);
  const remote = new Tree(rand);
  const size = (min: number, max: number) =>
    Math.floor(min + rand() * Math.max(1, max - min));

  const exact = (path: string, bytes?: number) => {
    const value = bytes ?? size(24_000, 4_800_000);
    local.file(path, value, "exact");
    remote.file(path, value, "exact");
    return value;
  };
  const missing = (path: string, bytes?: number) => {
    const value = bytes ?? size(18_000, 12_000_000);
    remote.file(path, value, "missing", "", "not present in the local index");
  };
  const localOnly = (path: string, bytes?: number) => {
    local.file(path, bytes ?? size(8_000, 900_000), "local_only");
  };
  const unmatched = (path: string, bytes?: number) => {
    local.file(path, bytes ?? size(8_000, 900_000), "unmatched");
  };
  const possibleSize = (path: string, remoteBytes: number, localBytes: number) => {
    local.file(path, localBytes, "exact");
    remote.file(
      path,
      remoteBytes,
      "possible",
      path,
      `size differs: archive ${fmtInt(remoteBytes)} / local ${fmtInt(localBytes)}`,
    );
  };
  const possibleName = (
    localPath: string,
    remotePath: string,
    localBytes: number,
    remoteBytes: number,
  ) => {
    local.file(localPath, localBytes, "unmatched");
    remote.file(
      remotePath,
      remoteBytes,
      "possible",
      localPath,
      `same name, different size (local ${fmtInt(localBytes)})`,
    );
  };
  const moved = (localPath: string, remotePath: string, bytes: number) => {
    local.file(localPath, bytes, "moved_match", remotePath);
    remote.file(remotePath, bytes, "moved", localPath, "+1 other location(s)");
  };

  const contractNames = [
    "MSA-Acme-2024.pdf",
    "NDA-Northwind-2023.pdf",
    "SOW-Borealis-2025.pdf",
    "DPA-Cascade-2024.pdf",
    "Vendor-Agreement-2022.pdf",
    "Addendum-Aurora-2025.pdf",
  ];
  for (const name of contractNames) exact(`Documents/Contracts/${name}`);
  possibleSize(
    "Documents/Contracts/MSA-Acme-2025.pdf",
    size(2_600_000, 3_100_000),
    size(2_100_000, 2_400_000),
  );
  moved(
    "Documents/Contracts/Vendor-Agreement-2021.pdf",
    "Documents/Contracts/Archive/Vendor-Agreement-2021.pdf",
    size(420_000, 700_000),
  );
  if (drive) missing("Documents/Contracts/Vendor-Agreement-2026.pdf");

  for (const year of [2023, 2024, 2025]) {
    const count = year === 2025 ? (drive ? 4 : 6) : 8;
    for (let i = 1; i <= count; i += 1) {
      const name = `invoice-${year}-${String(i).padStart(3, "0")}.pdf`;
      if (drive && i === count) missing(`Documents/Invoices/${year}/${name}`);
      else exact(`Documents/Invoices/${year}/${name}`);
    }
  }
  exact("Documents/Invoices/2025/summary.csv", 182_000);

  for (const name of [
    "meeting-2025-01.md",
    "meeting-2025-04.md",
    "meeting-2025-07.md",
    "meeting-2026-02.md",
    "release-checklist.md",
  ]) {
    exact(`Documents/Notes/${name}`);
  }
  possibleName(
    "Documents/Notes/retro-2024.md",
    "Documents/Notes/2024/retro-2024.md",
    18_400,
    21_900,
  );

  const photoNames = [
    "aurora",
    "coast",
    "cabin",
    "forest",
    "harbor",
    "mountain",
    "reef",
    "rooftop",
    "snow",
    "trail",
    "valley",
    "waterfall",
  ];
  for (const year of [2021, 2022, 2023, 2024, 2025]) {
    const count = drive ? 7 : 10;
    for (let i = 0; i < count; i += 1) {
      const name = `${photoNames[(i + year) % photoNames.length]}-${year}-${i + 1}.jpg`;
      const path = `Photos/${year}/${name}`;
      const bytes = size(1_200_000, 9_500_000);
      if (drive && i >= count - 2) missing(path, bytes);
      else if (!drive && year === 2022 && i < 2) {
        moved(path, `Imports/2022/${name}`, bytes);
      } else if (!drive && year === 2023 && i === 1) {
        moved(path, `Imports/2023/${name}`, bytes);
      } else if (!drive && year === 2023 && i === 2) {
        missing(`Imports/2023/${name}`, bytes);
      } else if (!drive && year === 2024 && i === 3) {
        possibleSize(path, bytes, Math.max(90_000, bytes - 240_000));
      } else {
        exact(path, bytes);
      }
    }
  }
  for (let i = 1; i <= 5; i += 1) {
    exact(`Photos/Screenshots/shot-${String(i).padStart(2, "0")}.png`);
  }
  localOnly("Photos/Exports/family-2024.zip", 3_400_000);
  localOnly("Photos/Exports/raw-2025.zip", 8_900_000);

  const auroraSources = [
    "main.ts",
    "api.ts",
    "cache.ts",
    "model.ts",
    "search.ts",
    "settings.ts",
    "types.ts",
    "ui.ts",
  ];
  for (const name of auroraSources) exact(`Projects/Aurora/src/${name}`);
  for (const name of ["architecture.md", "matching.md", "release-notes.md"])
    exact(`Projects/Aurora/docs/${name}`);
  exact("Projects/Aurora/package.json", 2_900);
  if (drive) {
    exact("Projects/Aurora/README.md", 12_800);
  } else {
    moved(
      "Projects/Aurora/README.md",
      "Projects/Archive/README.md",
      12_800,
    );
  }
  for (let i = 1; i <= 6; i += 1) {
    localOnly(`Projects/Aurora/node_modules/pkg-${i}/index.js`, size(3_000, 48_000));
  }
  localOnly("Projects/Aurora/node_modules/.package-lock.json", 22_400);
  localOnly("Projects/Aurora/dist/main.js", 486_000);
  localOnly("Projects/Aurora/dist/main.js.map", 1_240_000);
  localOnly("Projects/Aurora/dist/assets/app.css", 92_000);

  for (const name of ["README.md", "schema.sql", "worker.ts", "routes.ts", "config.ts"])
    exact(`Projects/Borealis/${name}`, size(9_000, 220_000));
  missing("Projects/Borealis/CHANGELOG.md", 14_600);

  for (const name of ["index.html", "app.ts", "styles.css", "tokens.css"])
    exact(`Projects/Cascade/${name}`, size(6_000, 160_000));
  missing("Projects/Cascade/deploy.md", 8_200);
  if (!drive) {
    local.file("Projects/Cascade/status", 340, "type_mismatch", "", "archive path is a folder");
    remote.dir("Projects/Cascade/status");
  }

  for (const name of [
    "legacy-export-2018.csv",
    "legacy-notes.txt",
    "vendor-list.csv",
    "migration.sql",
    "old-readme.md",
    "archive-index.json",
    "final-report.pdf",
  ]) {
    missing(`Projects/Legacy/${name}`, size(20_000, 840_000));
  }

  for (const name of ["ambient-01.flac", "ambient-02.flac", "live-set.flac", "studio-take.flac", "mixdown.flac", "outro.flac"])
    exact(`Media/Music/${name}`, size(18_000_000, 72_000_000));
  for (const name of ["launch.mp4", "walkthrough.mp4", "demo-2025.mp4", "conference-talk.mp4"])
    exact(`Media/Video/${name}`, size(40_000_000, 420_000_000));
  localOnly("Media/Video/render-draft.mov", 612_000_000);
  unmatched("Media/playlist-export.tmp", 3_800);

  if (drive) {
    for (let i = 1; i <= 2; i += 1) missing(`Backups/phone-2025/backup-${i}.zip`, size(2_000_000, 8_000_000));
    for (let i = 1; i <= 2; i += 1) {
      const name = `${photoNames[i]}-2021-${i}.jpg`;
      moved(`Photos/2021/${name}`, `Imports/2021/${name}`, size(1_500_000, 4_200_000));
    }
  } else {
    for (let i = 1; i <= 3; i += 1) {
      missing(`Backups/laptop-2025/laptop-${i}.tar.gz`, size(800_000_000, 2_400_000_000));
    }
  }

  localOnly(".DS_Store", 6_148);
  localOnly(".cache/thumbnails/index.db", 184_320);
  for (let i = 1; i <= 4; i += 1) {
    localOnly(`.cache/thumbnails/${String(i).padStart(4, "0")}.jpg`, size(18_000, 90_000));
  }
  exact(".projects.json", 1_840);
  missing(".archive-meta.json", 2_120);

  // Resolve statuses and derived fields.
  const remoteAggs = finalizeRemote(remote, local);
  const localChildCount = new Map<string, number>();
  const localAggs = finalizeLocal(local, remote, remoteAggs, localChildCount);
  const localSizes = folderSizes(local);
  const remoteSizes = folderSizes(remote);

  const localEntries = toEntries(local, "local", localAggs, localSizes, localChildCount);
  const remoteEntries = toEntries(remote, "remote", remoteAggs, remoteSizes, localChildCount);

  const buckets = {
    exact: { files: 0, dirs: 0, bytes: 0 },
    moved: { files: 0, dirs: 0, bytes: 0 },
    possible: { files: 0, dirs: 0, bytes: 0 },
    missing: { files: 0, dirs: 0, bytes: 0 },
  };
  const archive = { files: 0, dirs: 0, bytes: 0 };
  for (const node of remote.nodes.values()) {
    if (node.isDir) archive.dirs += 1;
    else {
      archive.files += 1;
      archive.bytes += node.size;
    }
    const bucket =
      node.status === "missing"
        ? "missing"
        : node.status === "possible"
          ? "possible"
          : node.status === "moved" || node.status === "partial"
            ? "moved"
            : "exact";
    if (node.isDir) buckets[bucket].dirs += 1;
    else {
      buckets[bucket].files += 1;
      buckets[bucket].bytes += node.size;
    }
  }
  const presentFiles = buckets.exact.files + buckets.moved.files + buckets.possible.files;
  const localOnlyCount = [...local.nodes.values()].filter(
    (node) => node.status === "local_only" || node.status === "unmatched",
  ).length;

  const summary = {
    archive,
    buckets,
    present_files: presentFiles,
    missing_files: buckets.missing.files,
    present_pct: archive.files ? (presentFiles / archive.files) * 100 : 0,
    db_entries: local.nodes.size,
    local_only_count: localOnlyCount,
  };

  return { listings: { local: localEntries, remote: remoteEntries }, summary };
}

function sources(key: string): SourceInfo[] {
  const prefix = `demo/${key}`;
  return [
    {
      label: "local_db",
      path: "demo/file_indexer.db",
      mtime: DEMO_EPOCH,
      size: 1_842_176,
    },
    {
      label: "archive",
      path: `${prefix}/archive.json`,
      mtime: DEMO_EPOCH,
      size: key === "google_drive" ? 196_608 : 284_672,
    },
    {
      label: "report",
      path: `${prefix}/report`,
      mtime: DEMO_EPOCH,
      size: 131_072,
    },
    {
      label: "local_only",
      path: `${prefix}/report/local_only.csv`,
      mtime: DEMO_EPOCH,
      size: 9_216,
    },
  ];
}

export function buildDemoData(): DemoData {
  const jotta = buildProvider("jottacloud");
  const drive = buildProvider("google_drive");

  const providers: DemoProvider[] = [
    {
      key: "jottacloud",
      label: "Jottacloud",
      root_label: "Archive",
      subtitle: "synthetic demo snapshot · virtual read-only view",
      accent: "#5e5ce6",
      archive: "jotta-archive-demo.json",
      report_dir: "demo/jottacloud/report",
      rclone_remote: "jotta",
      snapshot_version: "demo-2026-11",
      snapshot_time: DEMO_EPOCH,
      available: true,
      reason: "",
      summary: jotta.summary,
      sources: sources("jottacloud"),
    },
    {
      key: "google_drive",
      label: "Google Drive",
      root_label: "My Drive",
      subtitle: "synthetic demo snapshot · virtual read-only view",
      accent: "#1a73e8",
      archive: "gdrive-archive-demo.json",
      report_dir: "demo/google_drive/report",
      rclone_remote: "gdrive",
      snapshot_version: "demo-2026-11",
      snapshot_time: DEMO_EPOCH,
      available: true,
      reason: "",
      summary: drive.summary,
      sources: sources("google_drive"),
    },
  ];

  return {
    version: 1,
    base: BASE,
    generated_at: new Date(DEMO_EPOCH * 1000).toISOString(),
    default: "jottacloud",
    providers,
    listings: {
      jottacloud: jotta.listings,
      google_drive: drive.listings,
    },
  };
}

export function writeDemoData(outPath = DEFAULT_OUT): DemoData {
  const data = buildDemoData();
  mkdirSync(dirOf(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(data));
  return data;
}

if (import.meta.main) {
  const out = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_OUT;
  const data = writeDemoData(out);
  const bytes = JSON.stringify(data).length;
  console.log(`Demo dataset written to ${out}`);
  console.log(`  ${(bytes / 1024).toFixed(1)} KB · ${data.providers.length} providers`);
  for (const provider of data.providers) {
    const listing = data.listings[provider.key];
    console.log(
      `  ${provider.label.padEnd(12)} ${listing.local.length} local / ${listing.remote.length} remote entries`,
    );
  }
}
