#!/usr/bin/env bash
# Fetch a fresh Google Drive listing and compare it with file_indexer.db.
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
#   GDRIVE_ARCHIVE=google_drive.json
#   GDRIVE_REPORT=report/google_drive
#   RCLONE_CONFIG=/path/to/rclone.conf
#   SKIP_COMPARE=1                 only refresh the snapshot
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${GDRIVE_REMOTE:-gdrive}"
REMOTE_PATH="${GDRIVE_PATH:-}"
ARCHIVE="${GDRIVE_ARCHIVE:-$ROOT/google_drive.json}"
REPORT="${GDRIVE_REPORT:-$ROOT/report/google_drive}"

TARGET="${REMOTE}:${REMOTE_PATH}"

RCLONE_ARGS=()
if [[ -n "${RCLONE_CONFIG:-}" ]]; then
  RCLONE_ARGS+=(--config "$RCLONE_CONFIG")
elif [[ -f "$ROOT/rclone.conf" ]] && grep -q '^\[gdrive\]' "$ROOT/rclone.conf"; then
  RCLONE_ARGS+=(--config "$ROOT/rclone.conf")
fi

echo "Listing ${TARGET} → ${ARCHIVE}"
rclone "${RCLONE_ARGS[@]}" lsjson "$TARGET" -R > "${ARCHIVE}.tmp"
mv "${ARCHIVE}.tmp" "$ARCHIVE"

if [[ "${SKIP_COMPARE:-0}" == "1" ]]; then
  echo "Snapshot updated. Skipping comparison (SKIP_COMPARE=1)."
  exit 0
fi

echo "Comparing with file_indexer.db → ${REPORT}"
python3 "$ROOT/scripts/compare.py" \
  --db "$ROOT/file_indexer.db" \
  --archive "$ARCHIVE" \
  --out "$REPORT" \
  --label "Google Drive" \
  --no-strip-archive

echo
echo "Done. Start the explorer with:"
echo "  python3 explorer/server.py --open"
