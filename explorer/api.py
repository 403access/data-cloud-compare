#!/usr/bin/env python3
"""JSON payloads describing providers, local sources and snapshots."""

from __future__ import annotations

try:
    from . import runtime
    from .cache import cache_path, load_summary
    from .providers import DEFAULT_PROVIDER
except ImportError:
    import runtime  # type: ignore[no-redef]
    from cache import cache_path, load_summary
    from providers import DEFAULT_PROVIDER


def provider_sources(provider) -> list:
    sources = []
    for label, path in (
            ("local_db", runtime.LOCAL_DB),
            ("archive", provider.archive_json),
            ("report", provider.report_json),
            ("local_only", provider.local_only_csv)):
        try:
            st = path.stat()
            sources.append({"label": label, "path": str(path),
                            "mtime": st.st_mtime, "size": st.st_size})
        except OSError:
            sources.append({"label": label, "path": str(path), "missing": True})
    return sources


def provider_record(provider) -> dict:
    state = runtime.PROVIDER_STATE.get(provider.key) or {}
    record = provider.public()
    record.update({
        "available": bool(state.get("ready")),
        "reason": state.get("reason") or "",
        "summary": load_summary(provider),
        "sources": provider_sources(provider),
    })
    return record


def api_providers() -> dict:
    return {
        "default": DEFAULT_PROVIDER,
        "providers": [provider_record(p) for p in runtime.PROVIDERS.values()],
    }


def api_meta(provider) -> dict:
    return {"provider": provider.public(),
            "summary": load_summary(provider),
            "sources": provider_sources(provider),
            "base": runtime.BASE,
            "cache": str(cache_path(provider))}
