#!/usr/bin/env python3
"""HTTP handler: JSON API plus static assets from :mod:`runtime`."""

from __future__ import annotations

import gzip
import json
import mimetypes
import sys
import traceback
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, unquote, urlparse

try:
    from . import runtime
    from .api import api_meta, api_providers
    from .local import list_local, search_local
    from .model import clean_rel
    from .providers import DEFAULT_PROVIDER
    from .remote import list_remote, search_remote
except ImportError:
    import runtime  # type: ignore[no-redef]
    from api import api_meta, api_providers
    from local import list_local, search_local
    from model import clean_rel
    from providers import DEFAULT_PROVIDER
    from remote import list_remote, search_remote


class Handler(BaseHTTPRequestHandler):
    server_version = "TankCloudExplorer/1.1"

    def log_message(self, fmt, *args):
        # Keep the console quiet; only errors are interesting.
        if args and str(args[0]).startswith(("4", "5")):
            sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def send_bytes(self, body: bytes, content_type: str, status: int = 200,
                   cache: bool = False) -> None:
        headers = [("Content-Type", content_type)]
        if "gzip" in self.headers.get("Accept-Encoding", "") and len(body) > 2048:
            body = gzip.compress(body, compresslevel=5)
            headers.append(("Content-Encoding", "gzip"))
            headers.append(("Vary", "Accept-Encoding"))
        self.send_response(status)
        for k, v in headers:
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        if cache:
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except BrokenPipeError:
            pass

    def send_json(self, obj, status: int = 200) -> None:
        body = json.dumps(obj, ensure_ascii=False,
                          separators=(",", ":")).encode("utf-8")
        self.send_bytes(body, "application/json; charset=utf-8", status)

    def send_error_json(self, status: int, message: str) -> None:
        self.send_json({"error": message}, status)

    def do_GET(self):
        try:
            self.handle_get()
        except ValueError as exc:
            self.send_error_json(400, str(exc))
        except BrokenPipeError:
            pass
        except Exception:
            traceback.print_exc()
            try:
                self.send_error_json(500, "internal server error")
            except Exception:
                pass

    def handle_get(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        params = {k: v[-1] for k, v in parse_qs(parsed.query).items()}

        if path.startswith("/api/"):
            self.handle_api(path, params)
            return
        self.serve_static(path)

    def require_provider(self, params: dict):
        key = params.get("provider") or DEFAULT_PROVIDER
        provider = runtime.PROVIDERS.get(key)
        if provider is None:
            self.send_error_json(400, "unknown provider")
            return None
        state = runtime.PROVIDER_STATE.get(key) or {}
        if not state.get("ready"):
            self.send_error_json(
                503, state.get("reason") or f"{provider.label} is not ready")
            return None
        return provider

    def handle_api(self, path: str, params: dict):
        if path == "/api/providers":
            self.send_json(api_providers())
            return
        if path == "/api/meta":
            provider = self.require_provider(params)
            if provider is not None:
                self.send_json(api_meta(provider))
            return
        if path == "/api/list":
            provider = self.require_provider(params)
            if provider is None:
                return
            side = params.get("side", "local")
            rel = clean_rel(params.get("path", ""))
            sort = params.get("sort", "name")
            direction = params.get("dir", "asc")
            size_mode = params.get("sizemode", "bytes")
            hidden = params.get("hidden", "0") in ("1", "true", "yes")
            if sort not in ("name", "type", "size", "modified", "status"):
                sort = "name"
            if direction not in ("asc", "desc"):
                direction = "asc"
            if size_mode not in runtime.SIZE_MODES:
                size_mode = "bytes"
            if side == "remote":
                self.send_json(
                    list_remote(provider, rel, sort, direction, hidden,
                                size_mode))
            elif side == "local":
                self.send_json(
                    list_local(provider, rel, sort, direction, hidden,
                               size_mode))
            else:
                self.send_error_json(400, "unknown side")
            return
        if path == "/api/search":
            provider = self.require_provider(params)
            if provider is None:
                return
            side = params.get("side", "local")
            q = (params.get("q") or "").strip()
            scope = params.get("scope", "all")
            rel = clean_rel(params.get("path", ""))
            hidden = params.get("hidden", "0") in ("1", "true", "yes")
            if len(q) < 2:
                self.send_json({"side": side, "provider": provider.key,
                                "query": q, "scope": scope,
                                "entries": [], "truncated": False})
                return
            if side == "remote":
                self.send_json(
                    search_remote(provider, q, scope, rel, hidden))
            elif side == "local":
                self.send_json(
                    search_local(provider, q, scope, rel, hidden))
            else:
                self.send_error_json(400, "unknown side")
            return
        self.send_error_json(404, "unknown endpoint")

    def serve_static(self, path: str):
        if path in ("", "/"):
            path = "/index.html"
        # Prevent path traversal outside web/.
        rel = path.lstrip("/")
        target = (runtime.WEB_DIR / rel).resolve()
        try:
            target.relative_to(runtime.WEB_DIR.resolve())
        except ValueError:
            self.send_error_json(403, "forbidden")
            return
        if not target.is_file():
            self.send_error_json(404, "not found")
            return
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in (
                "application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        self.send_bytes(target.read_bytes(), ctype, cache=True)
