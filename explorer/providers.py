#!/usr/bin/env python3
"""Remote providers shown on the right-hand side of the explorer.

Each provider is a snapshot listing (rclone ``lsjson -R``) plus the comparison
report generated from it by ``scripts/compare.py``.  Adding another cloud is
just another entry in :func:`get_providers`.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


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

DEFAULT_PROVIDER = JOTTACLOUD.key


def get_providers() -> list[Provider]:
    return [JOTTACLOUD, GOOGLE_DRIVE]


def get_provider(key: str) -> Provider | None:
    for provider in get_providers():
        if provider.key == key:
            return provider
    return None
