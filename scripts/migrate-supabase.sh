#!/usr/bin/env bash
set -euo pipefail

if ! command -v pg_dump >/dev/null || ! command -v psql >/dev/null; then
  echo "PostgreSQL client tools (pg_dump and psql) are required." >&2
  exit 1
fi

read -r -s -p "Source Supabase Postgres URL: " SOURCE_DB
echo
read -r -s -p "Target Supabase Postgres URL: " TARGET_DB
echo

OUT_DIR="${1:-./supabase-export}"
mkdir -p "$OUT_DIR"

echo "Exporting public data from source..."
pg_dump "$SOURCE_DB" --data-only --schema=public --no-owner --no-privileges \
  --format=plain --file="$OUT_DIR/public-data.sql"

echo "Importing public data into target..."
psql "$TARGET_DB" --set ON_ERROR_STOP=1 --file="$OUT_DIR/public-data.sql"

echo "Public data migration complete. Auth users and Storage objects require Supabase's supported migration path."
