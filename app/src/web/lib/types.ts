/** Shared client-side types for the explorer UI. */

export type Side = "local" | "remote";
export type SortKey = "name" | "type" | "status" | "size" | "modified";
export type SortDir = "asc" | "desc";
export type SizeMode = "bytes" | "files" | "both";
export type ThemeMode = "system" | "light" | "dark" | "water";

export interface FolderAgg {
  total: number;
  exact: number;
  moved: number;
  possible: number;
  missing: number;
  partial: number;
  found_at: string;
}

export interface Entry {
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

export interface Stats {
  files: number;
  dirs: number;
  items: number;
  bytes: number;
}

export interface Crumb {
  name: string;
  path: string;
}

export interface ListResponse {
  side: Side;
  provider: string;
  path: string;
  exists: boolean;
  crumbs: Crumb[];
  entries: Entry[];
  stats: Stats;
}

export interface SearchResponse {
  side: Side;
  provider: string;
  query: string;
  scope: string;
  entries: Entry[];
  truncated: boolean;
}

export interface ProviderInfo {
  key: string;
  label: string;
  root_label: string;
  subtitle: string;
  accent: string;
  archive: string;
  report_dir?: string;
  rclone_remote?: string;
  snapshot_version?: string;
  snapshot_time?: number | null;
  available: boolean;
  reason: string;
  summary?: Record<string, any>;
  sources?: SourceInfo[];
}

export interface SourceInfo {
  label: string;
  path: string;
  mtime?: number;
  size?: number;
  missing?: boolean;
}

export interface Meta {
  provider: ProviderInfo;
  summary: Record<string, any>;
  sources: SourceInfo[];
  base: string;
  cache: string;
}

export interface ProviderCatalog {
  list: ProviderInfo[];
  byKey: Record<string, ProviderInfo>;
}
