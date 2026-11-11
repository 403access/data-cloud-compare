/**
 * Compact, memory-resident substring index for file names.
 *
 * The on-disk format matches the legacy Python implementation (magic TJSI2)
 * so existing indexes are reused. Both sides are packed into one byte buffer
 * of lower-cased names, with parallel offset/id/parent arrays.
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CACHE_DIR, LOCAL_DB } from "./paths";
import type { Provider } from "./providers";
import { cachePath } from "./cache";

const MAGIC = "TJSI2\0\0\0";
const VERSION = 2;
const HEADER_BYTES = 8 + 32;
const BASE = "/mnt/tank";

export function indexPath(provider: Provider): string {
  const name =
    provider.key === "jottacloud" ? "search.index" : `search-${provider.key}.index`;
  return resolve(CACHE_DIR, name);
}

export function metaPath(provider: Provider): string {
  return `${indexPath(provider)}.json`;
}

function log(message: string): void {
  process.stderr.write(`${message}\n`);
}

export function signature(cacheDb: string, localDb: string): string {
  const con = new Database(cacheDb);
  let cacheSignature = "";
  try {
    const rows = con.query("SELECT key,value FROM meta").all() as Array<{
      key: string;
      value: string;
    }>;
    cacheSignature = rows.find((row) => row.key === "signature")?.value ?? "";
  } finally {
    con.close();
  }
  const st = statSync(localDb, { bigint: true });
  return `${cacheSignature}|local:${st.size}:${st.mtimeNs}`;
}

class ByteBuilder {
  private data: Buffer;
  private length = 0;

  constructor(initial = 1 << 20) {
    this.data = Buffer.allocUnsafe(initial);
  }

  get size(): number {
    return this.length;
  }

  append(bytes: Buffer): number {
    const offset = this.length;
    this.reserve(bytes.length);
    bytes.copy(this.data, this.length);
    this.length += bytes.length;
    return offset;
  }

  byte(value: number): void {
    this.reserve(1);
    this.data[this.length] = value;
    this.length += 1;
  }

  private reserve(extra: number): void {
    if (this.length + extra <= this.data.length) return;
    let capacity = this.data.length * 2;
    while (capacity < this.length + extra) capacity *= 2;
    const next = Buffer.allocUnsafe(capacity);
    this.data.copy(next, 0, 0, this.length);
    this.data = next;
  }

  finish(): Buffer {
    return this.data.subarray(0, this.length);
  }
}

interface PackedNames {
  names: Buffer;
  offsets: Uint32Array;
  parentIds: Uint32Array;
  parentsBlob: Buffer;
  ids: BigUint64Array;
}

function packNames(
  rows: Iterable<{ id: number; name: string; parent: string }>,
  basename = false,
): PackedNames {
  const names = new ByteBuilder(16 << 20);
  const offsets: number[] = [];
  const ids: number[] = [];
  const parentIds: number[] = [];
  const parents: string[] = [];
  const parentMap = new Map<string, number>();

  for (const row of rows) {
    let name = row.name;
    let parent = row.parent;
    if (basename) {
      const original = row.name;
      const slash = original.lastIndexOf("/");
      name = slash < 0 ? original : original.slice(slash + 1);
      parent = slash < 0 ? "" : original.slice(0, slash);
    }
    name = name.replace(/\n/g, " ").toLowerCase();
    if (!name) continue;
    let pid = parentMap.get(parent);
    if (pid === undefined) {
      pid = parents.length;
      parentMap.set(parent, pid);
      parents.push(parent);
    }
    offsets.push(names.size);
    parentIds.push(pid);
    ids.push(Number(row.id));
    names.append(Buffer.from(name, "utf8"));
    names.byte(10); // '\n' separator; queries never include a newline
  }

  return {
    names: names.finish(),
    offsets: Uint32Array.from(offsets),
    parentIds: Uint32Array.from(parentIds),
    parentsBlob: Buffer.from(JSON.stringify(parents), "utf8"),
    ids: bigIds(ids),
  };
}

function bigIds(values: number[]): BigUint64Array {
  const out = new BigUint64Array(values.length);
  for (let i = 0; i < values.length; i += 1) out[i] = BigInt(values[i]);
  return out;
}

function writeIndex(path: string, archiveRows: PackedNames, localRows: PackedNames): void {
  const sections = [
    archiveRows.names,
    localRows.names,
    archiveRows.parentsBlob,
    localRows.parentsBlob,
    u8(archiveRows.offsets),
    u8(localRows.offsets),
    u8(archiveRows.parentIds),
    u8(localRows.parentIds),
    u8(archiveRows.ids),
    u8(localRows.ids),
  ];
  const total = HEADER_BYTES + sections.reduce((sum, section) => sum + section.length, 0);
  const out = Buffer.allocUnsafe(total);
  out.write(MAGIC, 0, "latin1");
  const header = [
    archiveRows.ids.length,
    archiveRows.names.length,
    localRows.ids.length,
    localRows.names.length,
    archiveRows.parentsBlob.length,
    archiveRows.offsets.length,
    localRows.parentsBlob.length,
    localRows.offsets.length,
  ];
  header.forEach((value, index) => out.writeUInt32LE(value, 8 + index * 4));
  let pos = HEADER_BYTES;
  for (const section of sections) {
    section.copy(out, pos);
    pos += section.length;
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, out);
  renameSync(tmp, path);
}

function u8(view: Uint32Array | BigUint64Array): Buffer {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}

export function buildIndex(
  cacheDb: string,
  localDb: string,
  provider: Provider,
  force = false,
): void {
  const path = indexPath(provider);
  const metaPath_ = metaPath(provider);
  const sig = signature(cacheDb, localDb);
  if (!force && existsSync(path)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath_, "utf8"));
      if (meta.signature === sig && meta.version === VERSION) return;
    } catch {
      /* rebuild */
    }
  }

  log(`Building ${provider.label} search index (one-time) …`);
  const t0 = performance.now();
  const archiveCon = new Database(cacheDb);
  let archiveRows: PackedNames;
  try {
    archiveRows = packNames(
      archiveCon
        .query("SELECT rowid AS id,name,parent FROM archive")
        .iterate() as Iterable<{ id: number; name: string; parent: string }>,
    );
  } finally {
    archiveCon.close();
  }
  const localCon = new Database(localDb, { readonly: true });
  let localRows: PackedNames;
  try {
    const rows = localCon
      .query("SELECT id,path,'' FROM files WHERE path LIKE ?")
      .iterate(`${BASE}/%`) as Iterable<{ id: number; path: string }>;
    localRows = packNames(
      (function* () {
        for (const row of rows) yield { id: row.id, name: row.path, parent: "" };
      })(),
      true,
    );
  } finally {
    localCon.close();
  }

  writeIndex(path, archiveRows, localRows);
  writeFileSync(metaPath_, JSON.stringify({ signature: sig, version: VERSION }));
  log(
    `${provider.label} search index ready in ` +
      `${((performance.now() - t0) / 1000).toFixed(1)}s`,
  );
}

function readU32(buffer: Buffer, offset: number, count: number): Uint32Array {
  const start = buffer.byteOffset + offset;
  if (start % 4 === 0) {
    return new Uint32Array(buffer.buffer, start, count);
  }
  const copy = new Uint8Array(buffer.subarray(offset, offset + count * 4));
  return new Uint32Array(copy.buffer, 0, count);
}

function readU64(buffer: Buffer, offset: number, count: number): BigUint64Array {
  const start = buffer.byteOffset + offset;
  if (start % 8 === 0) {
    return new BigUint64Array(buffer.buffer, start, count);
  }
  const copy = new Uint8Array(buffer.subarray(offset, offset + count * 8));
  return new BigUint64Array(copy.buffer, 0, count);
}

function upperBound(values: Uint32Array, needle: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (values[mid] <= needle) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export class NameIndex {
  readonly raw: Buffer;
  readonly start: number;
  readonly length: number;
  readonly offsets: Uint32Array;
  readonly ids: BigUint64Array;
  readonly parentIds: Uint32Array;
  readonly parents: string[];

  constructor(
    raw: Buffer,
    start: number,
    length: number,
    offsets: Uint32Array,
    ids: BigUint64Array,
    parentIds: Uint32Array,
    parents: string[],
  ) {
    this.raw = raw;
    this.start = start;
    this.length = length;
    this.offsets = offsets;
    this.ids = ids;
    this.parentIds = parentIds;
    this.parents = parents;
  }

  get count(): number {
    return this.ids.length;
  }

  /** Matches are unique and in index order. scope limits to a folder subtree. */
  search(
    query: string,
    wanted: number,
    scope: string | null = null,
    scanCap = 250000,
  ): { ids: number[]; truncated: boolean } {
    const needle = Buffer.from(query.replace(/\n/g, " ").toLowerCase(), "utf8");
    if (!needle.length) return { ids: [], truncated: false };
    const end = this.start + this.length;
    let pos = this.start;
    const found: number[] = [];
    const seen = new Set<number>();
    let scanned = 0;
    const scoped = Boolean(scope);
    const prefix = scoped ? `${scope}/` : "";
    let truncated = false;

    while (found.length < wanted) {
      const hit = this.raw.indexOf(needle, pos);
      if (hit < 0 || hit >= end) break;
      scanned += 1;
      if (scanned >= scanCap) {
        truncated = true;
        break;
      }
      const rel = hit - this.start;
      const index = upperBound(this.offsets, rel) - 1;
      if (index >= 0) {
        if (scoped) {
          const parent = this.parents[this.parentIds[index]];
          if (parent !== scope && !parent.startsWith(prefix)) {
            pos = hit + 1;
            continue;
          }
        }
        const rowId = Number(this.ids[index]);
        if (!seen.has(rowId)) {
          seen.add(rowId);
          found.push(rowId);
        }
      }
      pos = hit + 1;
    }
    if (found.length >= wanted) truncated = true;
    return { ids: found, truncated };
  }
}

export class SearchIndexes {
  constructor(
    readonly archive: NameIndex,
    readonly local: NameIndex,
  ) {}
}

export function loadIndexes(
  cacheDb: string,
  localDb: string,
  provider: Provider,
): SearchIndexes {
  buildIndex(cacheDb, localDb, provider);
  const path = indexPath(provider);
  const raw = readFileSync(path);
  if (raw.subarray(0, 8).toString("latin1") !== MAGIC) {
    throw new Error("search index has an unknown format");
  }
  const header = new Array<number>(8);
  for (let i = 0; i < 8; i += 1) header[i] = raw.readUInt32LE(8 + i * 4);
  const [nA, lenA, nL, lenL, lenPA, nPidA, lenPL, nPidL] = header;

  let pos = HEADER_BYTES;
  const aStart = pos;
  pos += lenA;
  const lStart = pos;
  pos += lenL;
  const aParentsStart = pos;
  pos += lenPA;
  const lParentsStart = pos;
  pos += lenPL;
  const aOffStart = pos;
  pos += nA * 4;
  const lOffStart = pos;
  pos += nL * 4;
  const aPidStart = pos;
  pos += nPidA * 4;
  const lPidStart = pos;
  pos += nPidL * 4;
  const aIdStart = pos;
  pos += nA * 8;
  const lIdStart = pos;

  const parents = (offset: number, length: number): string[] =>
    length ? JSON.parse(raw.subarray(offset, offset + length).toString("utf8")) : [];

  return new SearchIndexes(
    new NameIndex(
      raw,
      aStart,
      lenA,
      readU32(raw, aOffStart, nA),
      readU64(raw, aIdStart, nA),
      readU32(raw, aPidStart, nPidA),
      parents(aParentsStart, lenPA),
    ),
    new NameIndex(
      raw,
      lStart,
      lenL,
      readU32(raw, lOffStart, nL),
      readU64(raw, lIdStart, nL),
      readU32(raw, lPidStart, nPidL),
      parents(lParentsStart, lenPL),
    ),
  );
}

export function defaultLocalDb(): string {
  return LOCAL_DB;
}

export function cacheDbFor(provider: Provider): string {
  return cachePath(provider);
}
