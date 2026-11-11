#!/usr/bin/env python3
"""Two-pane explorer: /mnt/tank index vs Jottacloud / Google Drive snapshots.

Run:
    python3 explorer/server.py          # http://127.0.0.1:8787
    python3 explorer/server.py --open   # also open the browser
"""

from __future__ import annotations

import argparse
import sys
import traceback
import webbrowser
from http.server import ThreadingHTTPServer

try:
    from . import runtime
    from .cache import build_cache, ensure_local_folder_sizes
    from .search_index import load_indexes
    from .webapp import Handler
except ImportError:
    import runtime  # type: ignore[no-redef]
    from cache import build_cache, ensure_local_folder_sizes
    from search_index import load_indexes
    from webapp import Handler


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--open", action="store_true",
                        help="open the explorer in the default browser")
    parser.add_argument("--rebuild", action="store_true",
                        help="rebuild all provider caches from their snapshots")
    args = parser.parse_args()

    if not runtime.LOCAL_DB.exists():
        _ = sys.stderr.write(f"Local index not found: {runtime.LOCAL_DB}\n")
        raise SystemExit(1)

    runtime.LOCAL_SIZE_DB = ensure_local_folder_sizes(
        runtime.LOCAL_DB, runtime.BASE)
    print(f"  local folder sizes: {runtime.LOCAL_SIZE_DB}")

    for provider in runtime.PROVIDERS.values():
        ready, reason = provider.readiness()
        if not ready:
            runtime.PROVIDER_STATE[provider.key] = {
                "ready": False, "reason": reason}
            print(f"  {provider.label:12s}: unavailable — {reason}")
            continue
        try:
            db_path = build_cache(provider, force=args.rebuild)
            runtime.SEARCH[provider.key] = load_indexes(
                db_path, runtime.LOCAL_DB, provider)
            runtime.PROVIDER_STATE[provider.key] = {
                "ready": True, "reason": ""}
        except Exception as exc:  # keep the other providers usable
            traceback.print_exc()
            runtime.PROVIDER_STATE[provider.key] = {
                "ready": False,
                "reason": f"Could not load {provider.label}: {exc}",
            }

    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    httpd.daemon_threads = True
    url = f"http://{args.host}:{args.port}/"
    print(f"Explorer running at {url}")
    print("  left  : /mnt/tank index (file_indexer.db)")
    for provider in runtime.PROVIDERS.values():
        state = runtime.PROVIDER_STATE.get(provider.key) or {}
        if state.get("ready"):
            print(f"  right : {provider.label} — {provider.archive_json.name}")
        else:
            print(f"  right : {provider.label} — unavailable")
    print("Press Ctrl+C to stop.")
    if args.open:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
