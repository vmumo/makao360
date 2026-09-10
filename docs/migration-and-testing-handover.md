# Makao360 migration and testing handover

Prepared 10 September 2026. Work recorded here took place on 7–8 September 2026. This document consolidates the repository history, migration notes, saved QA results, and checks reported in the working session. It is not a fresh production audit on 10 September.

## Outcome and current status

Makao360 was exported from Lovable, set up locally, migrated to an independently owned hosted Supabase project, pushed to GitHub, and published on Cloudflare Pages. Existing user IDs and password hashes were preserved. Core role-based workflows have been tested; payment-provider integration, scheduled reminder delivery, and production-scale capacity remain unverified.

| Component | Location / status |
| --- | --- |
| Source repository | https://github.com/vmumo/makao360 |
| Production branch | `main` |
| Frontend | https://makao360.pages.dev |
| Hosting | Cloudflare Pages, linked to GitHub for deployment on pushes to `main` |
| Hosted database and Auth | Supabase project `tbwfsadugbvadumgpwxo` |
| Local project | `/Users/vmumo/Code/Playground/makao360` |
| Development address | `http://127.0.0.1:3000` |
| Last committed fix in this work | `8bd9451` |

Local development connects to hosted Supabase. PostgreSQL 18 was installed locally to supply compatible database restore tools; this did not move the production database onto the Mac.

## Migration work

### Source and schema recovery

- Exported the application source from Lovable on 7 September.
- Set up the React, TanStack Start, Vite, and Supabase application locally using Node 22 and npm.
- The source ZIP supplied 44 migration files and omitted the original schema. Two missing migrations were recovered from the source database migration history, bringing the repository to 46 migrations. Ten timestamps differed by one second between history and ZIP; SQL equivalence was checked without adding duplicates.
- Requested a full database export from Lovable Cloud. The disabled export button indicated a request within the preceding 24 hours, rather than proof that the file was ready.
- Downloaded `makao-360-hub_260907.backup` from the project's Cloud Storage export bucket and retained it locally under `migration-package/`.
- The source-generated guide described 47 public tables, 98 policies, 80 functions and 57 triggers. Those figures describe the export inventory; they are not a new live-schema count taken for this document.

### Restore issues and resolution

The first restore attempts encountered several distinct problems:

| Problem | Resolution used |
| --- | --- |
| Direct database hostname could not resolve from the local environment | Used the Supabase session pooler connection on port 5432 |
| Password authentication failures | Replaced placeholder credentials with the actual database password, entered without displaying it |
| `DISABLE TRIGGER ALL` failed on managed Auth tables | Avoided treating managed Auth tables like application-owned tables |
| Identities referenced users not yet loaded | Restored users before identities |
| Public data referenced rows not yet loaded, such as bank transactions referencing contributions | Replaced repeated unfiltered restores with a controlled recovery transaction |
| Live import triggers created bootstrap audit/profile/role rows | Inspected the partial target and explicitly accounted for those records before recovery |

`scripts/prepare-recovery.py` prepared a restore against a captured target backup. The recorded recovery locked the relevant tables, checked the target against its expected state, restored public data with triggers suppressed for the restore session, validated complete public data and foreign keys, then committed. Auth rows were left unchanged by that public-data recovery.

The generated recovery SQL is tied to the captured target state. **Do not rerun the original unfiltered restore commands or generated recovery SQL against the now-active project.** A future recovery needs its own backup, comparison and validation.

### Users and data preserved

The migration record reports verification of all 7,818 Auth users and identities against the archive, including UUIDs, emails and password hashes. Preserving hashes avoids a migration-driven password reset. This is different from successfully logging in to every account: browser authentication tests used four dedicated QA accounts.

| Data at recovery | Verified archive count |
| --- | ---: |
| Auth users | 7,818 |
| Auth identities | 7,818 |
| Profiles | 7,818 |
| Properties | 1,770 |
| Units | 15,622 |
| Leases | 6,176 |
| Contributions | 8,283 |
| Bank transactions | 1,808 |

All 47 public tables were reported as compared row-for-row, with public foreign keys checked before commit. These are recovery-time totals, not expected permanent live counts: QA accounts and subsequent application activity can change them. Actual archive records took precedence over the earlier generated row-count guide.

The source inventory reported no application storage buckets or objects to migrate. The export bucket subsequently held the database backup. Realtime was recorded as enabled for two tables. Scheduled-job migration remained incomplete because `pg_cron` was not available in the target configuration at the time.

## Application and deployment changes

Supabase environment values were changed to the new project. Browser-safe values use `VITE_` variables; the service-role key remains server-only. The login code uses Supabase OAuth directly; configuring and proving a working Google provider remains separate from the email/password checks.

The build initially targeted Node, then was configured for Cloudflare's runtime. Public routes were subsequently prerendered for Cloudflare Pages. A Workers-oriented build configuration in the repository does not itself prove that all server endpoints are deployed and functioning on Pages.

| Commit | Change |
| --- | --- |
| `ba172ad` | Initial migration off Lovable Cloud |
| `2821ba9` | Configured TanStack Start for Cloudflare Workers |
| `b48be63` | Prerendered public routes for Cloudflare Pages |
| `41ba0ac` | Fixed authenticated `/app/` routing when a trailing slash is present |
| `76e8a54` | Made the mobile preview's demo join date deterministic |
| `8bd9451` | Started mobile preview on a consistent server/client tab and applied the deep-link tab after hydration |

The final mobile-preview verification opened `home`, `pay`, `passport`, and `me` on production and reported no browser console/page errors. Earlier hydration failures were therefore superseded by the later passing run. The final check also looked for KES formatting on the Pay tab; it was a smoke test, not exhaustive preview interaction coverage.

## Testing performed

Four dedicated QA accounts were used: admin, landlord, caretaker, and tenant. Credentials are held in the ignored local QA directory and are not included in this document.

| Area | Evidence and result | Scope limitation |
| --- | --- | --- |
| Email/password login | All four test roles signed in | Not all 7,818 existing accounts |
| Role landing routes | Admin → admin; landlord → landlord; tenant and caretaker → tenant | Caretaker has no separately verified dashboard |
| Logout and protected routes | All four roles signed out and were redirected to login on protected-route access | Dedicated regression run supersedes an earlier logout-selector timeout |
| Navigation | Admin, landlord and tenant route smoke checks loaded application content | Loading a screen does not prove every action on it |
| Mobile layout | Tested dashboards showed no horizontal overflow at the sampled mobile viewport | Not a complete device/accessibility audit |
| Property creation | Landlord created a disposable property through the browser and opened its detail | Fixture subsequently deleted |
| Data isolation | Selected non-admin reads of another test user's roles and another user's property returned no rows | Sampled RLS checks, not a full policy/security audit |
| Lease and rent cycle | Tenant and landlord authenticated API clients each read the linked fixture | Unit/lease setup used API calls rather than browser form completion |
| Messaging | Tenant and landlord created messages through authenticated API clients; both browser views showed the conversation and reply | Browser composer submission was not exercised in the linked run |
| Conversation isolation | Unrelated caretaker could not read the test thread | No property-scoped team-member scenario tested |
| KYC | Tenant submitted through the browser; admin rejected via authenticated API; tenant browser showed the review notes | Admin review button workflow and real document uploads not tested |
| Mobile preview | Four production deep links passed with no browser errors after the fix | No real payment was initiated |
| Static validation | TypeScript and landing CTA checks passed | Does not establish runtime integration readiness |

The broader workflow script originally timed out looking for a sign-out menu selector after checking routes. Its entire run should not be described as a clean pass. A later dedicated production logout test passed for all four accounts.

One local production build generated bundles but failed when starting the Vite preview server for prerendering in the restricted environment. The recorded Cloudflare build successfully prerendered 52 pages. Local build reproducibility under the intended unrestricted environment remains a separate check.

### Cleanup

The linked run deleted its KYC submission, two messages, message thread, rent cycle, lease, unit and property. A separate cleanup removed the two generated in-app message notifications. The earlier property-creation fixture was also removed. Dedicated QA accounts remain available for retesting. Audit trails may retain records of test activity; they were not erased as part of fixture cleanup.

### Load measurements

| Target | Requests | Concurrency | Failures | Median | 95th percentile |
| --- | ---: | ---: | ---: | ---: | ---: |
| Supabase profile reads | 15 | 1 | 0 | 222 ms | 302 ms |
| Supabase profile reads | 15 | 3 | 0 | 338 ms | 1,033 ms |
| Supabase profile reads | 15 | 5 | 0 | 315 ms | 1,616 ms |
| Frontend public HTML routes | 50 | 5 | 0 | 215 ms | 667 ms |

Frontend paths were `/`, `/login/`, `/product/`, `/landlords/`, and `/mobile-preview/`; maximum observed latency was 708 ms. These small, paced checks establish a baseline only. They do not measure thousands of concurrent users, sustained traffic, full-page asset loading, or financial transactions under load.

## Outstanding work and acceptance criteria

1. **Payments and payouts:** confirm provider configuration and sandbox access; exercise initiation, successful and failed callbacks, duplicate callback handling, reconciliation and landlord payout outcomes. No end-to-end provider certification has been completed.
2. **Scheduled reminders:** verify a scheduler is configured, its deployed endpoint is reachable and correctly protected, duplicate execution is safe, and delivery reaches designated test recipients. The repository contains `/api/public/hooks/viewing-reminders`, but its presence is not evidence that a production scheduler or delivery integration works. Its current code checks a publishable/anon key; review authentication before enabling privileged scheduled operations.
3. **Capacity:** agree on expected concurrent users and service targets, then run staged load tests with monitoring and stop thresholds. The completed baseline is insufficient to claim production-scale capacity.
4. **Auth configuration and coverage:** confirm production Site URL and redirect allowlist, invitation and password-reset flows, and Google sign-in if enabled. Local Auth URLs were recorded as configured during migration; do not assume every production Auth setting is proven by a password-login test.
5. **Remaining browser coverage:** complete lease creation forms, message-composer submission, admin KYC actions, and property-scoped caretaker/team-member workflows if those are required. Existing API/read-path checks cover only part of these journeys.

No passwords of existing users were reset for testing, and no attempt was made to impersonate every production user. No real M-Pesa payment, payout, SMS or reminder delivery was included in the recorded verification.

## Development and operational handover

Use Node 22 and npm. From the project root:

```sh
npm install
# On a new checkout, copy .env.example to .env and supply project values.
npm run dev
npm run typecheck
npm run check:landing-ctas
```

The development server runs on port 3000. For the recorded production workflow, push reviewed changes to `main` and verify the resulting Cloudflare Pages build and live site. `npm run deploy` currently invokes `wrangler deploy`; it should not be assumed equivalent to the Git-connected Pages workflow. The old `npm start` Node-output assumption should also be revalidated against the current Cloudflare build before use.

Keep `.env`, `.dev.vars`, database archives, generated recovery SQL, and `.qa.local/credentials.json` private. The service-role key must never be placed in browser `VITE_` variables. Use `.env.example` for variable names only.

Before any further migration, take a fresh target backup. Retain the source archive and pre-recovery target backup securely. Restoring the old pre-recovery backup would discard later activity and is not a routine rollback.

## Evidence index

Paths below are relative to the repository root. Sensitive local artifacts intentionally remain outside Git.

| Evidence | Purpose |
| --- | --- |
| Git commits listed above | Versioned changes and fixes |
| `scripts/prepare-recovery.py` | Recovery preparation logic |
| `migration-package/public-recovery-report.json` | Source counts and pre-recovery target comparison |
| `migration-package/makao-360-hub_260907.backup` | Original private archive |
| `migration-package/target-before-recovery.backup` | Private pre-recovery target snapshot |
| `.qa.local/production-logout-results.json` | Four-role logout/protected-route results |
| `.qa.local/workflow-results.json` | Route, property and mobile checks, including the earlier selector failure |
| `.qa.local/isolation-results.json` | Sampled isolation results |
| `.qa.local/linked-results.json` | Lease/cycle, conversation, KYC and primary fixture cleanup results |
| `.qa.local/load-results.json` | Supabase load baseline |
| `.qa.local/frontend-load-results.json` | Public route load baseline |
| `.qa.local/mobile.mjs` | Production mobile-preview smoke test; passing output was recorded in the session |

At documentation time, unrelated local edits existed in `wrangler.jsonc`, plus untracked `.claude/` and `migration/` directories. They were left untouched and are not represented here as tested or deployed work. The source-generated migration documents are historical reference, not instructions to rerun a restore on the active system.
