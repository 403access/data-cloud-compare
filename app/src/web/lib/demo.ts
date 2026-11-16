/**
 * Static demo mode.
 *
 * The explorer normally talks to a local Bun server that reads SQLite. When the
 * page is built for the public demo (see `scripts/build-demo.ts` and
 * `scripts/assemble-site.ts`), `window.__DCA_DEMO__` is set in the HTML shell
 * and every `/api/*` request is answered from a small synthetic dataset
 * instead. The response shapes are identical, so no UI code changes.
 */

import {
  buildStats,
  cleanRel,
  makeCrumbs,
  sortEntries,
} from "../../shared/entry";
import type { Entry } from "./types";

const SIZE_MODES = ["bytes", "files", "both"] as const;
const SEARCH_LIMIT = 400;
const SORT_KEYS = ["name", "type", "size", "modified", "status"];

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
  snapshot_time: number | null;
  available: boolean;
  reason: string;
  summary: Record<string, unknown>;
  sources: Array<{
    label: string;
    path: string;
    mtime?: number;
    size?: number;
    missing?: boolean;
  }>;
}

interface DemoDataset {
  version: number;
  base: string;
  generated_at: string;
  default: string;
  providers: DemoProvider[];
  listings: Record<string, { local: Entry[]; remote: Entry[] }>;
}

export interface DemoGlobal {
  /** Relative URL of the dataset, resolved against the demo page. */
  data?: string;
}

export function demoConfig(): DemoGlobal | null {
  const cfg = (globalThis as any).__DCA_DEMO__ as DemoGlobal | undefined;
  return cfg ?? null;
}

export function isDemo(): boolean {
  return demoConfig() !== null;
}

let datasetPromise: Promise<DemoDataset> | null = null;
let cache: DemoDataset | null = null;

function loadDataset(): Promise<DemoDataset> {
  if (!datasetPromise) {
    const url = demoConfig()?.data || "demo-data.json";
    datasetPromise = fetch(url, { headers: { Accept: "application/json" } })
      .then((res) => {
        if (!res.ok) throw new Error(`Demo data unavailable (HTTP ${res.status})`);
        return res.json() as Promise<DemoDataset>;
      })
      .then((data) => {
        cache = data;
        return data;
      })
      .catch((error) => {
        datasetPromise = null;
        throw error;
      });
  }
  return datasetPromise;
}

function publicProvider(provider: DemoProvider) {
  return {
    key: provider.key,
    label: provider.label,
    root_label: provider.root_label,
    subtitle: provider.subtitle,
    accent: provider.accent,
    archive: provider.archive,
    report_dir: provider.report_dir,
    rclone_remote: provider.rclone_remote,
    snapshot_version: provider.snapshot_version,
    snapshot_time: provider.snapshot_time,
  };
}

function findProvider(data: DemoDataset, key: string): DemoProvider {
  return data.providers.find((provider) => provider.key === key) ?? data.providers[0];
}

function byParent(entries: Entry[]): Map<string, Entry[]> {
  const map = new Map<string, Entry[]>();
  for (const entry of entries) {
    const list = map.get(entry.parent);
    if (list) list.push(entry);
    else map.set(entry.parent, [entry]);
  }
  return map;
}

/** Folder map: path -> Entry for every directory, for `exists` checks. */
function dirMap(entries: Entry[]): Map<string, Entry> {
  const map = new Map<string, Entry>();
  for (const entry of entries) {
    if (entry.is_dir) map.set(entry.path, entry);
  }
  return map;
}

function param(params: URLSearchParams, name: string, fallback: string): string {
  const all = params.getAll(name);
  return all.length ? all[all.length - 1] : fallback;
}

function hiddenFlag(params: URLSearchParams): boolean {
  return ["1", "true", "yes"].includes(param(params, "hidden", "0"));
}

function sidebar(side: string): "local" | "remote" | null {
  return side === "local" || side === "remote" ? side : null;
}

/** `scope=folder` limits search to the subtree of `path`, like the server. */
function inScope(entry: Entry, scope: string | null): boolean {
  if (!scope) return true;
  return entry.parent === scope || entry.parent.startsWith(`${scope}/`);
}

function listProviders(data: DemoDataset) {
  return {
    default: data.default,
    providers: data.providers.map((provider) => ({
      ...publicProvider(provider),
      available: provider.available,
      reason: provider.reason,
      summary: provider.summary,
      sources: provider.sources,
    })),
  };
}

function listMeta(data: DemoDataset, params: URLSearchParams) {
  const provider = findProvider(data, param(params, "provider", data.default));
  return {
    provider: publicProvider(provider),
    summary: provider.summary,
    sources: provider.sources,
    base: data.base,
    cache: `demo/${provider.key}/explorer.db`,
  };
}

function listDir(data: DemoDataset, params: URLSearchParams) {
  const side = sidebar(param(params, "side", "local"));
  if (!side) return { error: "unknown side", status: 400 };

  const provider = findProvider(data, param(params, "provider", data.default));
  if (!provider.available) {
    return { error: provider.reason || `${provider.label} is not ready`, status: 503 };
  }

  const rel = cleanRel(param(params, "path", ""));
  const sort = param(params, "sort", "name");
  const direction = param(params, "dir", "asc");
  const sizeMode = param(params, "sizemode", "bytes");
  const hidden = hiddenFlag(params);

  const source = data.listings[provider.key]?.[side] ?? [];
  const children = byParent(source).get(rel) ?? [];
  let entries = children.map((entry) => ({ ...entry }));
  if (!hidden) entries = entries.filter((entry) => !entry.name.startsWith("."));

  sortEntries(
    entries,
    SORT_KEYS.includes(sort) ? sort : "name",
    direction === "desc" ? "desc" : "asc",
    (SIZE_MODES as readonly string[]).includes(sizeMode) ? sizeMode : "bytes",
  );

  const exists = rel === "" || dirMap(source).has(rel);
  return {
    side,
    provider: provider.key,
    path: rel,
    exists,
    crumbs: makeCrumbs(rel, side === "local" ? data.base : provider.root_label),
    entries,
    stats: buildStats(entries),
  };
}

function runSearch(data: DemoDataset, params: URLSearchParams) {
  const side = sidebar(param(params, "side", "local"));
  if (!side) return { error: "unknown side", status: 400 };

  const provider = findProvider(data, param(params, "provider", data.default));
  if (!provider.available) {
    return { error: provider.reason || `${provider.label} is not ready`, status: 503 };
  }

  const query = param(params, "q", "").trim();
  const scopeMode = param(params, "scope", "all");
  const rel = cleanRel(param(params, "path", ""));
  const hidden = hiddenFlag(params);

  if (query.length < 2) {
    return {
      side,
      provider: provider.key,
      query,
      scope: scopeMode,
      entries: [],
      truncated: false,
    };
  }

  const needle = query.toLowerCase();
  const source = data.listings[provider.key]?.[side] ?? [];
  const scope = scopeMode === "folder" && rel ? rel : null;

  const matches: Array<{ entry: Entry; rank: number }> = [];
  for (const entry of source) {
    if (!hidden && entry.name.startsWith(".")) continue;
    if (!inScope(entry, scope)) continue;
    const name = entry.name.toLowerCase();
    const at = name.indexOf(needle);
    if (at < 0) continue;
    // Prefer prefix matches, then shorter names, then shallower paths.
    const rank =
      (at === 0 ? 0 : 1) * 1_000_000 +
      entry.name.length * 100 +
      entry.path.split("/").length;
    matches.push({ entry, rank });
  }
  matches.sort((a, b) => a.rank - b.rank || a.entry.path.localeCompare(b.entry.path));

  const truncated = matches.length > SEARCH_LIMIT;
  const entries = matches.slice(0, SEARCH_LIMIT).map((match) => ({ ...match.entry }));
  sortEntries(entries, "name", "asc");

  return { side, provider: provider.key, query, scope: scopeMode, entries, truncated };
}

type DemoResult = Record<string, unknown>;

/** Answer an `/api/*` request from the bundled dataset. */
export async function demoGet<T = any>(url: string): Promise<T> {
  const data = cache ?? (await loadDataset());
  const parsed = new URL(url, "https://demo.invalid/");
  const params = parsed.searchParams;
  const path = parsed.pathname;

  let result: DemoResult;
  if (path === "/api/providers") result = listProviders(data);
  else if (path === "/api/meta") result = listMeta(data, params);
  else if (path === "/api/list") result = listDir(data, params);
  else if (path === "/api/search") result = runSearch(data, params);
  else throw new Error(`Unknown demo endpoint: ${path}`);

  if (typeof result.error === "string" && typeof result.status === "number") {
    throw new Error(result.error);
  }
  return result as T;
}
