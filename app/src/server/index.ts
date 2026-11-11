#!/usr/bin/env bun
/**
 * Two-pane explorer: /mnt/tank index vs Jottacloud / Google Drive snapshots.
 *
 * Run:
 *   bun run app/src/server/index.ts          # http://127.0.0.1:8787
 *   bun run app/src/server/index.ts --open   # also open the browser
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { BASE, LOCAL_DB, PUBLIC_DIR, SIZE_MODES } from "./paths";
import { buildCache, ensureLocalFolderSizes } from "./cache";
import { cleanRel } from "./model";
import { apiMeta, apiProviders } from "./api";
import { listLocal, listRemote, searchLocal, searchRemote } from "./listings";
import {
  DEFAULT_PROVIDER,
  getProviders,
  readiness,
  type Provider,
} from "./providers";
import { loadIndexes } from "./search-index";
import { PROVIDERS, PROVIDER_STATE, SEARCH, setLocalSizeDb } from "./state";

interface Args {
  host: string;
  port: number;
  open: boolean;
  rebuild: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { host: "127.0.0.1", port: 8787, open: false, rebuild: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--host") args.host = argv[++i] ?? args.host;
    else if (arg === "--port") args.port = Number(argv[++i] ?? args.port);
    else if (arg === "--open") args.open = true;
    else if (arg === "--rebuild") args.rebuild = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: bun run app/src/server/index.ts [--host HOST] [--port PORT] " +
          "[--open] [--rebuild]",
      );
      process.exit(0);
    }
  }
  return args;
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function errorJson(status: number, message: string): Response {
  return json({ error: message }, status);
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function serveStatic(pathname: string): Response {
  let path = pathname;
  if (path === "" || path === "/") path = "/index.html";
  const target = resolve(PUBLIC_DIR, `.${path}`);
  if (target !== PUBLIC_DIR && !target.startsWith(PUBLIC_DIR + sep)) {
    return errorJson(403, "forbidden");
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    return errorJson(404, "not found");
  }
  const body = readFileSync(target);
  return new Response(body, {
    headers: {
      "Content-Type": MIME[extname(target).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    },
  });
}

function requireProvider(params: URLSearchParams): Provider | Response {
  const key = params.get("provider") || DEFAULT_PROVIDER;
  const provider = PROVIDERS.get(key);
  if (!provider) return errorJson(400, "unknown provider");
  const state = PROVIDER_STATE.get(key);
  if (!state?.ready) {
    return errorJson(503, state?.reason || `${provider.label} is not ready`);
  }
  return provider;
}

function param(params: URLSearchParams, name: string, fallback: string): string {
  const all = params.getAll(name);
  return all.length ? all[all.length - 1] : fallback;
}

async function handleApi(url: URL): Promise<Response> {
  const path = url.pathname;
  const params = url.searchParams;

  if (path === "/api/providers") return json(apiProviders());

  const found = requireProvider(params);
  if (found instanceof Response) return found;
  const provider = found;

  if (path === "/api/meta") return json(apiMeta(provider));

  if (path === "/api/list") {
    const side = param(params, "side", "local");
    const rel = cleanRel(param(params, "path", ""));
    let sort = param(params, "sort", "name");
    let direction = param(params, "dir", "asc");
    let sizeMode = param(params, "sizemode", "bytes");
    const hidden = ["1", "true", "yes"].includes(param(params, "hidden", "0"));
    if (!["name", "type", "size", "modified", "status"].includes(sort)) sort = "name";
    if (!["asc", "desc"].includes(direction)) direction = "asc";
    if (!(SIZE_MODES as readonly string[]).includes(sizeMode)) sizeMode = "bytes";

    if (side === "remote") {
      return json(listRemote(provider, rel, sort, direction, hidden, sizeMode));
    }
    if (side === "local") {
      return json(listLocal(provider, rel, sort, direction, hidden, sizeMode));
    }
    return errorJson(400, "unknown side");
  }

  if (path === "/api/search") {
    const side = param(params, "side", "local");
    const q = param(params, "q", "").trim();
    const scope = param(params, "scope", "all");
    const rel = cleanRel(param(params, "path", ""));
    const hidden = ["1", "true", "yes"].includes(param(params, "hidden", "0"));
    if (q.length < 2) {
      return json({
        side,
        provider: provider.key,
        query: q,
        scope,
        entries: [],
        truncated: false,
      });
    }
    if (side === "remote") return json(searchRemote(provider, q, scope, rel, hidden));
    if (side === "local") return json(searchLocal(provider, q, scope, rel, hidden));
    return errorJson(400, "unknown side");
  }

  return errorJson(404, "unknown endpoint");
}

function startup(): void {
  if (!existsSync(LOCAL_DB)) {
    process.stderr.write(`Local index not found: ${LOCAL_DB}\n`);
    process.exit(1);
  }

  const sizes = ensureLocalFolderSizes(LOCAL_DB, BASE);
  setLocalSizeDb(sizes);
  console.log(`  local folder sizes: ${sizes}`);

  // Keep provider metadata in the shared state map.
  for (const provider of getProviders()) PROVIDERS.set(provider.key, provider);

  for (const provider of PROVIDERS.values()) {
    const { ready, reason } = readiness(provider);
    if (!ready) {
      PROVIDER_STATE.set(provider.key, { ready: false, reason });
      console.log(`  ${provider.label.padEnd(12)}: unavailable — ${reason}`);
      continue;
    }
    try {
      const dbPath = buildCache(provider, rebuild);
      SEARCH.set(provider.key, loadIndexes(dbPath, LOCAL_DB, provider));
      PROVIDER_STATE.set(provider.key, { ready: true, reason: "" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(error);
      PROVIDER_STATE.set(provider.key, {
        ready: false,
        reason: `Could not load ${provider.label}: ${message}`,
      });
    }
  }
}

let rebuild = false;

const args = parseArgs(Bun.argv.slice(2));
rebuild = args.rebuild;
startup();

const server = Bun.serve({
  hostname: args.host,
  port: args.port,
  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(url);
      return serveStatic(decodeURIComponent(url.pathname));
    } catch (error) {
      if (error instanceof Error && /path traversal|invalid path/.test(error.message)) {
        return errorJson(400, error.message);
      }
      console.error(error);
      return errorJson(500, "internal server error");
    }
  },
  error(error) {
    console.error(error);
    return errorJson(500, "internal server error");
  },
});

const url = `http://${args.host}:${server.port}/`;
console.log(`Explorer running at ${url}`);
console.log("  left  : /mnt/tank index (file_indexer.db)");
for (const provider of PROVIDERS.values()) {
  const state = PROVIDER_STATE.get(provider.key);
  if (state?.ready) {
    console.log(`  right : ${provider.label} — ${provider.archiveJson.split("/").pop()}`);
  } else {
    console.log(`  right : ${provider.label} — unavailable`);
  }
}
console.log("Press Ctrl+C to stop.");

if (args.open && process.platform === "darwin") {
  Bun.spawn(["open", url]);
}

process.on("SIGINT", () => {
  console.log("\nStopped.");
  server.stop();
  process.exit(0);
});
