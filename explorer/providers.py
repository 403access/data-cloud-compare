#!/usr/bin/env python3
"""Remote providers shown on the right-hand side of the explorer.

Each provider is a snapshot listing (rclone ``lsjson -R``) plus the comparison
report generated from it by ``scripts/compare.py``.  Adding another cloud is
just another entry in :func:`get_providers`.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT_ROOT = ROOT / "snapshots"


def snapshot_base(key: str) -> Path:
    """Directory holding the versions for *key* (honours GDRIVE_SNAPSHOTS)."""
    if key == "google_drive":
        override = os.environ.get("GDRIVE_SNAPSHOTS")
        if override:
            return Path(override).expanduser()
    return SNAPSHOT_ROOT / key


def _safe_version(name: str) -> bool:
    """A version is a single directory name, never a path fragment."""
    return (bool(name) and name not in (".", "..")
            and not name.startswith(".")
            and "/" not in name and "\\" not in name)


def latest_snapshot_dir(key: str, required: str = "") -> tuple[Path | None, str]:
    """Return the newest snapshot directory for *key* and its version name.

    ``LATEST`` is written atomically by the fetch scripts.  If it is missing or
    stale, fall back to the highest version directory.  When *required* is set,
    only versions containing that relative file are considered, so a failed or
    partial fetch can never hide an older usable snapshot.
    """
    base = snapshot_base(key)
    try:
        if not base.is_dir():
            return None, ""
    except OSError:
        return None, ""

    candidates: list[str] = []
    try:
        pointer = (base / "LATEST").read_text(encoding="utf-8").strip()
    except OSError:
        pointer = ""
    if _safe_version(pointer):
        candidates.append(pointer)
    try:
        versions = sorted(
            (child.name for child in base.iterdir()
             if child.is_dir() and _safe_version(child.name)),
            reverse=True)
    except OSError:
        versions = []
    candidates.extend(v for v in versions if v not in candidates)

    for name in candidates:
        version_dir = base / name
        if required and not (version_dir / required).exists():
            continue
        return version_dir, name
    return None, ""


def _snapshot_info(version_dir: Path) -> tuple[float | None, dict]:
    manifest: dict = {}
    try:
        manifest = json.loads(
            (version_dir / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    created = manifest.get("created_at")
    if created is None:
        try:
            created = version_dir.stat().st_mtime
        except OSError:
            created = None
    return created, manifest


@dataclass(frozen=True)
class Provider:
    key: str
    label: str
    archive_json: Path
    report_dir: Path
    rclone_remote: str
    root_label: str
    subtitle: str
    accent: str
    help: str
    snapshot_version: str = ""
    snapshot_time: float | None = None

    @property
    def report_json(self) -> Path:
        return self.report_dir / "report_data.json"

    @property
    def local_only_csv(self) -> Path:
        return self.report_dir / "local_only.csv"

    @property
    def summary_json(self) -> Path:
        return self.report_dir / "summary.json"

    def readiness(self) -> tuple[bool, str]:
        """Return (ready, human-readable reason)."""
        if not self.archive_json.exists():
            return False, (
                f"{self.archive_json.name} is missing. {self.help}")
        if not self.report_json.exists() or not self.local_only_csv.exists():
            return False, (
                f"The comparison report for {self.label} is missing "
                f"({self.report_dir}). {self.help}")
        return True, ""

    def public(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "root_label": self.root_label,
            "subtitle": self.subtitle,
            "accent": self.accent,
            "archive": self.archive_json.name,
            "report_dir": str(self.report_dir),
            "rclone_remote": self.rclone_remote,
            "snapshot_version": self.snapshot_version,
            "snapshot_time": self.snapshot_time,
        }


JOTTACLOUD = Provider(
    key="jottacloud",
    label="Jottacloud",
    archive_json=ROOT / "archive.json",
    report_dir=ROOT / "report",
    rclone_remote="jotta",
    root_label="Archive",
    subtitle="archive.json snapshot · virtual read-only view",
    accent="#5e5ce6",
    help=("Run: python3 scripts/compare.py --db file_indexer.db "
          "--archive archive.json --out report"),
)

GOOGLE_DRIVE = Provider(
    key="google_drive",
    label="Google Drive",
    archive_json=ROOT / "google_drive.json",
    report_dir=ROOT / "report" / "google_drive",
    rclone_remote="gdrive",
    root_label="My Drive",
    subtitle="google_drive.json snapshot · virtual read-only view",
    accent="#1a73e8",
    help=("Configure an rclone remote named gdrive, then run "
          "scripts/fetch_google_drive.sh"),
)

# Prefer the newest versioned snapshot.  The flat root files remain the
# fallback for older checkouts that have not been migrated yet.
_GD_VERSION_DIR, _GD_VERSION = latest_snapshot_dir(
    GOOGLE_DRIVE.key, required=GOOGLE_DRIVE.archive_json.name)
if _GD_VERSION_DIR is not None:
    _GD_TIME, _ = _snapshot_info(_GD_VERSION_DIR)
    GOOGLE_DRIVE = Provider(
        key=GOOGLE_DRIVE.key,
        label=GOOGLE_DRIVE.label,
        archive_json=_GD_VERSION_DIR / GOOGLE_DRIVE.archive_json.name,
        report_dir=_GD_VERSION_DIR / "report",
        rclone_remote=GOOGLE_DRIVE.rclone_remote,
        root_label=GOOGLE_DRIVE.root_label,
        subtitle=f"snapshot {_GD_VERSION} · virtual read-only view",
        accent=GOOGLE_DRIVE.accent,
        help=GOOGLE_DRIVE.help,
        snapshot_version=_GD_VERSION,
        snapshot_time=_GD_TIME,
    )

DEFAULT_PROVIDER = JOTTACLOUD.key


def get_providers() -> list[Provider]:
    return [JOTTACLOUD, GOOGLE_DRIVE]


def get_provider(key: str) -> Provider | None:
    for provider in get_providers():
        if provider.key == key:
            return provider
    return None
