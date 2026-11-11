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
  bun "$ROOT/scripts/compare.ts" \
    --db "$ROOT/file_indexer.db" \
    --archive "$ARCHIVE" \
    --out "$REPORT" \
    --label "Google Drive" \
    --no-strip-archive
fi

if [[ "$VERSIONED" == "1" ]]; then
  bun "$ROOT/scripts/snapshot-manifest.ts" \
    "$ARCHIVE" "$VERSION_DIR/manifest.json" "$STAMP" \
    "$REMOTE" "$REMOTE_PATH"

  # Atomically point LATEST at the snapshot that just completed.
  printf '%s\n' "$STAMP" > "$SNAPSHOTS/.LATEST.tmp"
  mv "$SNAPSHOTS/.LATEST.tmp" "$SNAPSHOTS/LATEST"

  bun "$ROOT/scripts/prune-snapshots.ts" "$SNAPSHOTS" "$KEEP" "$STAMP"

  COMPLETE=1
  echo
  echo "Latest snapshot: $VERSION_DIR"
fi

echo "Done. Start the explorer with:"
echo "  bun run start --open"
