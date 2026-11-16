/**
 * Repository paths and shared constants.
 *
 * The server is normally started from the repository root, but every path is
 * resolved from this file so it also works from `app/`.
 */

import { resolve } from "node:path";

export const ROOT = resolve(import.meta.dir, "../../..");
export const APP_DIR = resolve(ROOT, "app");
export const PUBLIC_DIR = resolve(APP_DIR, "public");
export const CACHE_DIR = resolve(APP_DIR, ".cache");
export const BASE = "/mnt/tank";
export const LOCAL_DB = resolve(ROOT, "file_indexer.db");
export const SEARCH_LIMIT = 400;
export const SIZE_MODES = ["bytes", "files", "both"] as const;
