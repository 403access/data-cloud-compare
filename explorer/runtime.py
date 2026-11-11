#!/usr/bin/env python3
"""Shared constants and mutable runtime state for the explorer.

Everything here is populated once by :mod:`server` during start-up.  Other
modules read the same objects (or, for :data:`LOCAL_SIZE_DB`, the same module
attribute) so a running server sees one consistent view.
"""

from __future__ import annotations

from pathlib import Path

try:
    from .providers import ROOT, get_providers
except ImportError:
    from providers import ROOT, get_providers

BASE = "/mnt/tank"
LOCAL_DB = ROOT / "file_indexer.db"
WEB_DIR = Path(__file__).resolve().parent / "web"
SEARCH_LIMIT = 400

PROVIDERS = {p.key: p for p in get_providers()}
PROVIDER_STATE: dict[str, dict] = {}
SEARCH: dict[str, object] = {}  # provider key -> SearchIndexes, set in main()
LOCAL_SIZE_DB: Path | None = None

SIZE_MODES = ("bytes", "files", "both")

STATUS_ORDER = {
    "missing": 0,
    "partial": 1,
    "possible": 2,
    "moved": 3,
    "moved_match": 3,
    "type_mismatch": 4,
    "exact": 5,
    "local_only": 6,
    "unmatched": 7,
}
