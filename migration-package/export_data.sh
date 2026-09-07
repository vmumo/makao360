#!/usr/bin/env bash
# =====================================================================
# Makao360 — data export / import helper
# Run this on YOUR machine. Nothing here changes the source project.
#
# Prereqs: postgresql-client (psql, pg_dump) 15+ and the two connection
# strings below.
#
#   SRC_URL = source (Lovable Cloud) Postgres connection string
#             Get it from: Lovable → Cloud → Advanced settings → Export data
#             (that page also produces a ready-made full dump — use it if
#              you prefer a single file and skip step 2 here)
#   DST_URL = your own Supabase project connection string
#             Supabase Dashboard → Project Settings → Database → Connection string
# =====================================================================
set -euo pipefail

SRC_URL="${SRC_URL:?set SRC_URL to the source Postgres connection string}"
DST_URL="${DST_URL:?set DST_URL to your Supabase Postgres connection string}"
OUT="${OUT:-./makao360-dump}"
mkdir -p "$OUT"

# ---------------------------------------------------------------------
# 1. Schema — use the numbered .sql files shipped alongside this script.
#    Apply them to the destination IN THIS ORDER:
# ---------------------------------------------------------------------
apply_schema() {
  for f in 01_extensions_types.sql 02_tables.sql 03_views.sql \
           04_functions.sql 05_triggers.sql 06_grants.sql 07_rls_policies.sql; do
    echo ">> applying $f"
    psql "$DST_URL" -v ON_ERROR_STOP=1 -f "$f"
  done
}

# ---------------------------------------------------------------------
# 2. Auth users FIRST (preserves UUIDs + bcrypt passwords), then data.
#    auth.users must exist before public tables that reference user ids.
# ---------------------------------------------------------------------
dump_auth() {
  pg_dump "$SRC_URL" --data-only --no-owner --no-privileges \
    -t 'auth.users' -t 'auth.identities' \
    --column-inserts -f "$OUT/auth_data.sql"
}

dump_public() {
  pg_dump "$SRC_URL" --data-only --no-owner --no-privileges \
    --disable-triggers --schema=public -f "$OUT/public_data.sql"
}

load_data() {
  psql "$DST_URL" -v ON_ERROR_STOP=1 -f "$OUT/auth_data.sql"
  psql "$DST_URL" -v ON_ERROR_STOP=1 -f "$OUT/public_data.sql"
  # resync sequences
  psql "$DST_URL" -Atc "
    select 'select setval('||quote_literal(quote_ident(schemaname)||'.'||quote_ident(sequencename))
           ||', coalesce((select max('||quote_ident(a.attname)||') from '
           ||quote_ident(schemaname)||'.'||quote_ident(c.relname)||'),1));'
    from pg_sequences s
    join pg_class sc on sc.relname = s.sequencename
    join pg_depend d on d.objid = sc.oid and d.deptype='a'
    join pg_class c on c.oid = d.refobjid
    join pg_attribute a on a.attrelid=c.oid and a.attnum=d.refobjsubid
    where s.schemaname='public';" | psql "$DST_URL"
}

case "${1:-all}" in
  schema) apply_schema ;;
  dump)   dump_auth; dump_public ;;
  load)   load_data ;;
  all)    apply_schema; dump_auth; dump_public; load_data ;;
  *) echo "usage: $0 [schema|dump|load|all]"; exit 1 ;;
esac

echo "Done. Files in $OUT"
