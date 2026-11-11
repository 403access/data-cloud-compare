/** Remote providers shown on the right-hand side of the explorer. */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import { ROOT } from "./paths";

export const SNAPSHOT_ROOT = resolve(ROOT, "snapshots");

export interface Provider {
  key: string;
  label: string;
  archiveJson: string;
  reportDir: string;
  rcloneRemote: string;
  rootLabel: string;
  subtitle: string;
  accent: string;
  help: string;
  snapshotVersion: string;
  snapshotTime: number | null;
}

export interface PublicProvider {
  key: string;
  label: string;
  root_label: string;
  subtitle: string;
  accent: string;
  archive: string;
  report_dir: string;
  rclone_remote: string;
  snapshot_version: string;
  snapshot_time: number | null;
}

function snapshotBase(key: string): string {
  if (key === "google_drive") {
    const override = process.env.GDRIVE_SNAPSHOTS;
    if (override) {
      return override.startsWith("~")
        ? resolve(homedir(), override.slice(1).replace(/^\//, ""))
        : resolve(override);
    }
  }
  return resolve(SNAPSHOT_ROOT, key);
}

function safeVersion(name: string): boolean {
  return (
    Boolean(name) &&
    name !== "." &&
    name !== ".." &&
    !name.startsWith(".") &&
    !name.includes("/") &&
    !name.includes("\\")
  );
}

/** Newest snapshot directory for *key*, preferring the LATEST pointer. */
export function latestSnapshotDir(
  key: string,
  required = "",
): { dir: string | null; version: string } {
  const base = snapshotBase(key);
  if (!existsSync(base)) return { dir: null, version: "" };

  const candidates: string[] = [];
  try {
    const pointer = readFileSync(resolve(base, "LATEST"), "utf8").trim();
    if (safeVersion(pointer)) candidates.push(pointer);
  } catch {
    /* no pointer */
  }

  let versions: string[] = [];
  try {
    versions = readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && safeVersion(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse();
  } catch {
    /* unreadable */
  }
  for (const version of versions) {
    if (!candidates.includes(version)) candidates.push(version);
  }

  for (const name of candidates) {
    const versionDir = resolve(base, name);
    if (required && !existsSync(resolve(versionDir, required))) continue;
    return { dir: versionDir, version: name };
  }
  return { dir: null, version: "" };
}

function snapshotInfo(versionDir: string): { created: number | null; manifest: any } {
  let manifest: any = {};
  try {
    manifest = JSON.parse(readFileSync(resolve(versionDir, "manifest.json"), "utf8"));
  } catch {
    /* ignore */
  }
  let created = typeof manifest.created_at === "number" ? manifest.created_at : null;
  if (created == null) {
    try {
      created = statSync(versionDir).mtimeMs / 1000;
    } catch {
      created = null;
    }
  }
  return { created, manifest };
}

export function reportJson(provider: Provider): string {
  return resolve(provider.reportDir, "report_data.json");
}
export function localOnlyCsv(provider: Provider): string {
  return resolve(provider.reportDir, "local_only.csv");
}
export function summaryJson(provider: Provider): string {
  return resolve(provider.reportDir, "summary.json");
}

export function readiness(provider: Provider): { ready: boolean; reason: string } {
  if (!existsSync(provider.archiveJson)) {
    return {
      ready: false,
      reason: `${basename(provider.archiveJson)} is missing. ${provider.help}`,
    };
  }
  if (!existsSync(reportJson(provider)) || !existsSync(localOnlyCsv(provider))) {
    return {
      ready: false,
      reason:
        `The comparison report for ${provider.label} is missing ` +
        `(${provider.reportDir}). ${provider.help}`,
    };
  }
  return { ready: true, reason: "" };
}

export function publicProvider(provider: Provider): PublicProvider {
  return {
    key: provider.key,
    label: provider.label,
    root_label: provider.rootLabel,
    subtitle: provider.subtitle,
    accent: provider.accent,
    archive: basename(provider.archiveJson),
    report_dir: provider.reportDir,
    rclone_remote: provider.rcloneRemote,
    snapshot_version: provider.snapshotVersion,
    snapshot_time: provider.snapshotTime,
  };
}

let JOTTACLOUD: Provider = {
  key: "jottacloud",
  label: "Jottacloud",
  archiveJson: resolve(ROOT, "archive.json"),
  reportDir: resolve(ROOT, "report"),
  rcloneRemote: "jotta",
  rootLabel: "Archive",
  subtitle: "archive.json snapshot · virtual read-only view",
  accent: "#5e5ce6",
  help:
    "Run: python3 scripts/compare.py --db file_indexer.db " +
    "--archive archive.json --out report",
  snapshotVersion: "",
  snapshotTime: null,
};

let GOOGLE_DRIVE: Provider = {
  key: "google_drive",
  label: "Google Drive",
  archiveJson: resolve(ROOT, "google_drive.json"),
  reportDir: resolve(ROOT, "report", "google_drive"),
  rcloneRemote: "gdrive",
  rootLabel: "My Drive",
  subtitle: "google_drive.json snapshot · virtual read-only view",
  accent: "#1a73e8",
  help:
    "Configure an rclone remote named gdrive, then run " +
    "scripts/fetch_google_drive.sh",
  snapshotVersion: "",
  snapshotTime: null,
};

// Prefer the newest versioned snapshot, exactly like the legacy explorer.
{
  const { dir, version } = latestSnapshotDir(
    GOOGLE_DRIVE.key,
    basename(GOOGLE_DRIVE.archiveJson),
  );
  if (dir !== null) {
    const { created } = snapshotInfo(dir);
    GOOGLE_DRIVE = {
      ...GOOGLE_DRIVE,
      archiveJson: resolve(dir, basename(GOOGLE_DRIVE.archiveJson)),
      reportDir: resolve(dir, "report"),
      subtitle: `snapshot ${version} · virtual read-only view`,
      snapshotVersion: version,
      snapshotTime: created,
    };
  }
}

export const DEFAULT_PROVIDER = JOTTACLOUD.key;

export function getProviders(): Provider[] {
  return [JOTTACLOUD, GOOGLE_DRIVE];
}

export function getProvider(key: string): Provider | null {
  return getProviders().find((provider) => provider.key === key) ?? null;
}
