# Makao360 — migration export to your own Supabase project

Generated 7 Sep 2026 from the live Lovable Cloud database. **No changes were
made to the source project** — everything here is read-only output.

## What's in this folder

| File | Contents |
|---|---|
| `01_extensions_types.sql` | 6 extensions (`pg_cron`, `pg_net`, `pgcrypto`, `uuid-ossp`, `supabase_vault`, `pg_stat_statements`) + all 30 enum types |
| `02_tables.sql` | All 47 public tables, defaults, primary/unique/check constraints, foreign keys, and non-constraint indexes |
| `03_views.sql` | Views (none exist — file is a placeholder) |
| `04_functions.sql` | All 80 functions/procedures, full bodies, including every `SECURITY DEFINER` helper (`has_role`, `is_property_tenant`, `book_viewing`, `request_rent_fuliza`, `screen_application`, `dispatch_viewing_reminders`, …) |
| `05_triggers.sql` | All 57 triggers (audit logging, `updated_at`, invoice/arrears clearing, booking conflict checks, tenant-field guards) |
| `06_grants.sql` | Table grants for `anon` / `authenticated` / `service_role`, plus a reference list of function ACLs (revoked-from-PUBLIC ones matter) |
| `07_rls_policies.sql` | RLS enable/force flags + all 98 policies with exact `USING` / `WITH CHECK` expressions |
| `08_cron_realtime_storage.sql` | Realtime publication + replica identity, the hourly viewing-reminder cron job, storage notes |
| `AUTH_MIGRATION.md` | How to move all 7,818 users keeping their UUIDs **and** passwords |
| `export_data.sh` | Helper script: apply schema, dump data, load data, resync sequences |
| `row_counts.csv` | Row count per table, to verify the load |

## Order of operations

```bash
# 0. create your Supabase project, get its connection string
export DST_URL="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres"

# 1. schema
psql "$DST_URL" -v ON_ERROR_STOP=1 -f 01_extensions_types.sql
psql "$DST_URL" -v ON_ERROR_STOP=1 -f 02_tables.sql
psql "$DST_URL" -v ON_ERROR_STOP=1 -f 03_views.sql
psql "$DST_URL" -v ON_ERROR_STOP=1 -f 04_functions.sql
psql "$DST_URL" -v ON_ERROR_STOP=1 -f 05_triggers.sql
psql "$DST_URL" -v ON_ERROR_STOP=1 -f 06_grants.sql
psql "$DST_URL" -v ON_ERROR_STOP=1 -f 07_rls_policies.sql

# 2. auth users (see AUTH_MIGRATION.md) — MUST come before public data
psql "$DST_URL" -v ON_ERROR_STOP=1 -f auth_data.sql

# 3. public data (see "Getting the data dump" below)
psql "$DST_URL" -v ON_ERROR_STOP=1 -f public_data.sql

# 4. cron + realtime (edit the placeholders in the file first)
psql "$DST_URL" -v ON_ERROR_STOP=1 -f 08_cron_realtime_storage.sql
```

## Getting the data dump

The row data itself is not included here. Two ways to get it:

1. **Lovable → Cloud → Advanced settings → Export data.** This produces the
   full database export (schema + data) for download. Use its data portion with
   the schema files above, or use it wholesale.
2. **`pg_dump` from your own machine** using the source connection string from
   that same page:
   ```bash
   SRC_URL=... DST_URL=... ./export_data.sh dump
   SRC_URL=... DST_URL=... ./export_data.sh load
   ```
   `--disable-triggers` is used on the public data load so audit triggers don't
   fire (and duplicate) during import.

Expected volumes: ~15.6k units, ~7.8k profiles, ~6.2k leases, ~15.9k
notifications, ~8.3k contributions, ~4.9k invoices. Full list in
`row_counts.csv`.

## App-side changes after the move

1. **Env vars** — replace with your project's values:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<your anon/publishable key>
   VITE_SUPABASE_PROJECT_ID=<ref>
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_PUBLISHABLE_KEY=<your anon/publishable key>
   SUPABASE_SERVICE_ROLE_KEY=<your service role key>
   ```
2. **Google sign-in** — swap the Lovable broker call for
   `supabase.auth.signInWithOAuth({ provider: 'google' })` and configure the
   provider in your own Auth settings (see `AUTH_MIGRATION.md`).
3. **Cron target** — the hourly job posts to
   `/api/public/hooks/viewing-reminders`; point it at your deployed domain and
   your anon key.
4. **Hosting** — the app is TanStack Start on Cloudflare Workers
   (`wrangler.jsonc`). It also runs on Node (`bun run build` + a Node server) or
   any Workers-compatible host. Nothing in the app depends on Lovable at runtime
   apart from the OAuth broker above.

## Verification checklist

```sql
select count(*) from information_schema.tables where table_schema='public';  -- 47
select count(*) from pg_policies where schemaname='public';                  -- 98
select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public';                                                  -- 80
select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
  where not t.tgisinternal;                                                  -- 57
select count(*) from auth.users;                                             -- 7818
```

Then sign in as `superadmin@makao360.app` and open the admin dashboard, a
landlord portfolio, and a tenant lease to confirm RLS behaves identically.
