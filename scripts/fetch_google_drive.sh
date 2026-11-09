#!/usr/bin/env bash
# Fetch a fresh Google Drive listing and compare it with file_indexer.db.
#
# Every run is kept as a versioned snapshot under
#   snapshots/google_drive/<UTC timestamp>/
# and the newest one is recorded in snapshots/google_drive/LATEST.  The
# explorer always resolves LATEST, so it shows the most recent snapshot.
#
# Prerequisites:
#   rclone config          # create a Google Drive remote named "gdrive"
#
# Usage:
#   scripts/fetch_google_drive.sh
#
# Environment overrides:
#   GDRIVE_REMOTE=gdrive           rclone remote name
#   GDRIVE_PATH=                   optional folder inside the drive (e.g. "Backup")
#   GDRIVE_SNAPSHOTS=...           version root (default: snapshots/google_drive)
#   GDRIVE_KEEP=5                  versions to keep; 0 keeps every version
#   GDRIVE_STAMP=...               explicit version name (default: UTC timestamp)
#   RCLONE_CONFIG=/path/to/rclone.conf
#   SKIP_COMPARE=1                 only refresh the snapshot
#
# Legacy single-snapshot mode (no versioning) is used when GDRIVE_ARCHIVE or
# GDRIVE_REPORT is set explicitly:
#   GDRIVE_ARCHIVE=google_drive.json
#   GDRIVE_REPORT=report/google_drive
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${GDRIVE_REMOTE:-gdrive}"
REMOTE_PATH="${GDRIVE_PATH:-}"
SNAPSHOTS="${GDRIVE_SNAPSHOTS:-$ROOT/snapshots/google_drive}"
KEEP="${GDRIVE_KEEP:-5}"

TARGET="${REMOTE}:${REMOTE_PATH}"

RCLONE_ARGS=()
if [[ -n "${RCLONE_CONFIG:-}" ]]; then
  RCLONE_ARGS+=(--config "$RCLONE_CONFIG")
elif [[ -f "$ROOT/rclone.conf" ]] && grep -q '^\[gdrive\]' "$ROOT/rclone.conf"; then
  RCLONE_ARGS+=(--config "$ROOT/rclone.conf")
fi

VERSIONED=0
COMPLETE=0
VERSION_DIR=""

if [[ -n "${GDRIVE_ARCHIVE:-}" || -n "${GDRIVE_REPORT:-}" ]]; then
  # Legacy behaviour: write one snapshot in place, no version history.
  ARCHIVE="${GDRIVE_ARCHIVE:-$ROOT/google_drive.json}"
  REPORT="${GDRIVE_REPORT:-$ROOT/report/google_drive}"
else
  VERSIONED=1
  STAMP="${GDRIVE_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
  VERSION_DIR="$SNAPSHOTS/$STAMP"
  if [[ -e "$VERSION_DIR" ]]; then
    suffix=2
    while [[ -e "${VERSION_DIR}-$suffix" ]]; do
      suffix=$((suffix + 1))
    done
    STAMP="$STAMP-$suffix"
    VERSION_DIR="$SNAPSHOTS/$STAMP"
  fi
  ARCHIVE="$VERSION_DIR/google_drive.json"
  REPORT="$VERSION_DIR/report"
  mkdir -p "$VERSION_DIR"
fi

cleanup() {
  local status=$?
  if [[ $status -ne 0 && "$VERSIONED" == "1" && "$COMPLETE" != "1" ]]; then
    rm -rf "$VERSION_DIR"
    echo "Removed incomplete snapshot: $VERSION_DIR" >&2
  fi
}
trap cleanup EXIT

echo "Listing ${TARGET} → ${ARCHIVE}"
mkdir -p "$(dirname "$ARCHIVE")"
rclone "${RCLONE_ARGS[@]}" lsjson "$TARGET" -R > "${ARCHIVE}.tmp"
mv "${ARCHIVE}.tmp" "$ARCHIVE"

if [[ "${SKIP_COMPARE:-0}" == "1" ]]; then
  echo "Snapshot updated. Skipping comparison (SKIP_COMPARE=1)."
else
  echo "Comparing with file_indexer.db → ${REPORT}"
  python3 "$ROOT/scripts/compare.py" \
    --db "$ROOT/file_indexer.db" \
    --archive "$ARCHIVE" \
    --out "$REPORT" \
    --label "Google Drive" \
    --no-strip-archive
fi

if [[ "$VERSIONED" == "1" ]]; then
  python3 - "$ARCHIVE" "$VERSION_DIR/manifest.json" "$STAMP" \
    "$REMOTE" "$REMOTE_PATH" <<'PY'
import datetime as dt
import json
import os
import sys

archive, out, version, remote, remote_path = sys.argv[1:6]
with open(archive, "r", encoding="utf-8") as f:
    data = json.load(f)
if isinstance(data, dict):
    data = data.get("items") or data.get("files") or []
files = dirs = size = 0
for e in data:
    if e.get("IsDir", e.get("is_dir", False)):
        dirs += 1
    else:
        files += 1
        try:
            size += max(0, int(e.get("Size") or e.get("size") or 0))
        except (TypeError, ValueError):
            pass
st = os.stat(archive)
created = st.st_mtime
manifest = {
    "version": version,
    "created_at": created,
    "created": dt.datetime.fromtimestamp(
        created, dt.timezone.utc).isoformat().replace("+00:00", "Z"),
    "remote": remote,
    "remote_path": remote_path,
    "archive": os.path.basename(archive),
    "files": files,
    "dirs": dirs,
    "bytes": size,
    "report": os.path.isdir(os.path.join(os.path.dirname(archive), "report")),
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
    f.write("\n")
PY

  # Atomically point LATEST at the snapshot that just completed.
  printf '%s\n' "$STAMP" > "$SNAPSHOTS/.LATEST.tmp"
  mv "$SNAPSHOTS/.LATEST.tmp" "$SNAPSHOTS/LATEST"

  python3 - "$SNAPSHOTS" "$KEEP" "$STAMP" <<'PY'
import os
import shutil
import sys

base, keep_arg, current = sys.argv[1:4]
try:
    keep = int(keep_arg)
except ValueError:
    keep = 5
if keep <= 0:
    sys.exit(0)
versions = sorted(
    (name for name in os.listdir(base)
     if os.path.isdir(os.path.join(base, name)) and not name.startswith(".")),
    reverse=True)
for name in versions[keep:]:
    if name == current:
        continue
    shutil.rmtree(os.path.join(base, name), ignore_errors=True)
    print(f"Pruned old snapshot {name}")
PY

  COMPLETE=1
  echo
  echo "Latest snapshot: $VERSION_DIR"
fi

echo "Done. Start the explorer with:"
echo "  python3 explorer/server.py --open"
