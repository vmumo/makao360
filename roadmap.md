# Roadmap

## Next
- [ ] Supabase compute upgrade before real traffic: authed API throughput is ~3–6 req/s on the free instance and degrades uniformly across tables (even trivial `profiles` reads hit 2.4s median @c5); indexes are already in place — the tier is the ceiling. Upgrade also unlocks pg_cron, daily backups, no idle-pausing
- [ ] Custom SMTP (Resend) for auth emails — Supabase default sender is rate-limited
- [ ] DNS cutover: www + apex → Pages project (on hold per Victor, 10 Sep 2026); until then password-reset default redirect points at the old Lovable site
- [ ] M-Pesa Daraja integration (sandbox → certification); callbacks via a Supabase Edge Function
- [ ] Commit the migration/testing handover doc + README update (currently uncommitted)

## Done (10 Sep 2026)
- [x] Hourly viewing-reminders dispatch via GitHub Actions (`e5f4d70`); repo secret set; live run verified green (`{"reminded": 30}`)
- [x] Caretaker RLS fix applied to production and verified: `properties_team_select` + `units_team_select` policies (migration `20260910113000`); scoped caretaker sees scoped property/units, unscoped and foreign properties stay hidden
- [x] Supabase Auth: Site URL → https://www.makao360.co.ke; redirect allowlist + www, apex, pages.dev (localhost kept)
- [x] Browser journey QA on pages.dev (all fixtures cleaned): lease-creation form PASS (active lease + auto rent cycle); message composer PASS (POST 201, persisted); admin KYC row buttons PASS (Needs info/Reject/Verify; Reject persisted); caretaker scoping = RLS finding above
- [x] Staged load baseline: Pages frontend p95 648ms @c25 zero failures; public_vacancies RPC p95 723ms @c20 zero failures; authed reads = bottleneck (see Next)

## Done
- [x] Preview blank screen — stale bundle after dep upgrades; dev server restarted, verified rendering
- [x] Real bank ledger balance (matched credits − paid payouts) on Banking screen + landlord profile
- [x] Real portfolio for demo landlord: 4 new properties, 12 units, 9 leases, 9 Sept invoices, 8 payments, 8 matched bank lines
- [x] Tenant portal verified: demo tenant sees leases, invoices/arrears, contributions; pay flow live
- [x] Bank reconciliation screen verified: import, auto-match, manual match, balance updates automatically
