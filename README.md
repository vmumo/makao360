# Makao360 local app

Exported from Lovable on 2026-09-07. Uses React, TanStack Start, Vite and Supabase. The build configuration now targets a standard Node server.

## Run

Use Node 22 (`nvm use`, or on this Mac `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`).

```sh
npm install
# For a new setup, copy .env.example to .env and supply your Supabase values.
npm run dev
```

Open http://127.0.0.1:3000. The local `.env` points to the new hosted project, `tbwfsadugbvadumgpwxo` and contains the server-only service-role key. Never put that key in a `VITE_` variable or commit `.env`.

## Production server on your machine

```sh
npm run build
npm start
```

## New hosted Supabase project

1. Create a project in your Supabase organization.
2. The source ZIP contained 44 migrations and omitted the original schema. Two missing migrations were recovered through a read-only query against the source database migration history; `supabase/migrations` now contains 46 files. Ten history timestamps differ from the ZIP by one second; their SQL was confirmed equivalent, and no duplicates were added.
3. The schema was restored to the new hosted project. Check Storage configuration, scheduled jobs, and Realtime settings before cutover.
4. The full Lovable Cloud archive `makao-360-hub_260907.backup` was subsequently downloaded. On 2026-09-07, all 47 public tables were recovered in one transaction and compared row-for-row with the archive. Every public foreign key was checked before commit. All 7,818 Auth users and identities were verified against the archive, including user UUIDs, emails and password hashes. Existing passwords were preserved; a password reset is not required by this migration.
5. Set the new project URL and publishable key in both the browser (`VITE_`) and server variables in `.env`. Set the server-only service-role key as well.
6. Configure Supabase Auth site URL and redirect allowlist for your local origin, including reset-password and invitation flows. This migration has the site URL set to `http://127.0.0.1:3000` and allows both local origins. Configure Google OAuth in the new project if needed. Keep the original project available until users have successfully signed in or reset their passwords in the new project.
7. Validate signup/login, role routing, properties, leases and server functions before switching away from the original backend.

The original source archive remains in Downloads. `bun.lock` is retained as an export reference and contains Lovable registry URLs; use npm and `package-lock.json` for the local setup.

## Validation so far

Production build, TypeScript checks, and landing CTA checks pass on Node 22. Database recovery committed successfully with 7,818 profiles, 1,770 properties, 15,622 units, 6,176 leases, 8,283 contributions and 1,808 bank transactions. Counts and complete public rows match the actual archive, which takes precedence over the earlier Lovable-generated row-count guide. Auth site and redirect URLs are configured for local development, and Realtime is enabled for two tables.

The hosted project does not expose `pg_cron` on its current tier, so the hourly reminder job must be configured after the Cloudflare deployment (or when `pg_cron` is enabled). A live sign-in smoke test still requires a test user's credentials; the build and database checks are complete.

## Data migration helper

Do not rerun the earlier unfiltered `pg_restore` or `scripts/migrate-supabase.sh` commands against the restored target. Data-only archive order does not account for existing foreign keys, and live triggers can generate duplicate audit/profile/role records.

`scripts/prepare-recovery.py` prepared this recovery from the source archive and `migration-package/target-before-recovery.backup`. It checked that target rows were partial source records or known initial seed/Auth-trigger records, then generated a transaction-scoped SQL restore. The SQL locks tables, checks the target still matches its backup, restores public records with triggers suppressed only for this session, validates complete data and foreign keys, and commits. It leaves Auth rows unchanged and rejects a rerun once the target has changed.

The pre-recovery target backup is retained for recovery. Archives and generated SQL contain private data, are excluded from Git, and must not be published. The generated SQL is specific to the captured target state.
