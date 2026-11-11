#!/usr/bin/env bun
/** Serve the assembled `dist/` artifact locally . */

import { existsSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "../dist");
const port = Number(process.env.PORT || 4173);
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const server = Bun.serve({
  port,
  fetch(request) {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const target = resolve(root, `.${pathname}`);
    if (target !== root && !target.startsWith(root + sep)) {
      return new Response("forbidden", { status: 403 });
    }
    if (!existsSync(target) || !statSync(target).isFile()) {
      return new Response("not found", { status: 404 });
    }
    return new Response(Bun.file(target), {
      headers: {
        "Content-Type": types[extname(target).toLowerCase()] || "application/octet-stream",
      },
    });
  },
});

console.log(`Serving ${root} at http://127.0.0.1:${server.port}/`);
