/** Server-side helpers re-exported from the shared entry module. */

import { Database } from "bun:sqlite";
import { BASE } from "./paths";

export {
  STATUS_ORDER,
  basename,
  buildStats,
  cleanRel,
  dirname,
  entryType,
  folderAgg,
  makeCrumbs,
  normPath,
  sortEntries,
} from "../shared/entry";
export type { FolderAgg, SortableEntry } from "../shared/entry";

export function connectRO(path: string): Database {
  const con = new Database(path, { readonly: true });
  con.exec("PRAGMA query_only = ON");
  return con;
}

export function localAbs(rel: string): string {
  return rel ? `${BASE}/${rel}` : BASE;
}

export function* chunks<T>(values: T[], size = 400): Generator<T[]> {
  for (let i = 0; i < values.length; i += size) {
    yield values.slice(i, i + size);
  }
}

export function placeholders(n: number): string {
  return new Array(n).fill("?").join(",");
}
