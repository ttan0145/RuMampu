#!/usr/bin/env bash
# Takes a fresh snapshot of the local app database for Grafana.
# Uses SQLite's online backup, so it is safe while the backend is running.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="${RUMAMPU_DB:-$DIR/../backend/db.sqlite3}"
DEST="$DIR/.data/rumampu-local.sqlite3"
mkdir -p "$DIR/.data"
if [ ! -f "$SRC" ]; then
  echo "No database at $SRC. Run the backend once (python manage.py migrate) or set RUMAMPU_DB." >&2
  exit 1
fi
sqlite3 "$SRC" ".backup '$DEST.tmp'"
# The backend database uses WAL mode and the copy inherits it. Grafana runs
# several panel queries at once, and in WAL mode they can trip over each other
# ("database is locked (261)"). A plain rollback journal avoids that for a
# copy that is only ever read.
sqlite3 "$DEST.tmp" "PRAGMA journal_mode=DELETE;" >/dev/null
mv "$DEST.tmp" "$DEST"
rm -f "$DEST-wal" "$DEST-shm"
echo "Snapshot taken: $DEST ($(du -h "$DEST" | cut -f1)) at $(date '+%Y-%m-%d %H:%M')"
