# Auth user migration (preserving UUIDs and passwords)

Source project currently has:

| Item | Count |
|---|---|
| `auth.users` | 7,818 |
| `auth.identities` | 7,818 |
| Providers in use | `email` only (no Google/OAuth identities to re-link) |
| Users with a password hash | 7,818 (all) |
| Storage buckets / objects | 0 / 0 |

Every `public` table keys off `auth.users.id`, so **UUIDs must be preserved**.
That rules out the Supabase Auth Admin API (`createUser` mints new UUIDs unless
you pass `id`, and it re-hashes passwords). Copy the auth rows directly instead.

## Method A — direct table copy (recommended, keeps UUID + password)

1. Create the destination Supabase project and let it initialise the `auth`
   schema (do **not** hand-edit that schema).
2. Dump only the two auth tables from the source:

   ```bash
   pg_dump "$SRC_URL" --data-only --no-owner --no-privileges \
     -t auth.users -t auth.identities --column-inserts -f auth_data.sql
   ```

3. Load into the destination **before** loading `public` data:

   ```bash
   psql "$DST_URL" -v ON_ERROR_STOP=1 -f auth_data.sql
   ```

Because `encrypted_password` is a bcrypt hash and is copied verbatim, existing
passwords keep working — including the demo accounts
(`superadmin@makao360.app`, `admin.demo@…`, `landlord.demo@…`, `tenant.demo@…`).

### If your destination Postgres version differs
`auth.users` gains columns between Supabase releases. If the load errors on an
unknown column, restrict the copy to the shared column set:

```sql
-- run against the DESTINATION, with the source attached via postgres_fdw,
-- or generate INSERTs listing only these columns from the source dump:
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
  recovery_token, recovery_sent_at, email_change_token_new, email_change,
  email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
  banned_until, deleted_at, is_anonymous
) values (...);

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) values (...);
```

`auth.identities.provider_id` must equal the user's UUID for the `email`
provider — the dump already contains the correct values.

## Method B — Admin API with explicit ids (fallback)

Only if you cannot get direct DB access to the source. Passwords are lost;
users must reset. UUIDs are preserved by passing `id`:

```ts
await admin.auth.admin.createUser({
  id: sourceUser.id,          // preserve the UUID
  email: sourceUser.email,
  email_confirm: true,
  user_metadata: sourceUser.raw_user_meta_data,
});
```
Then email every user a password-reset link.

## After the auth load

1. Load `public` data (roles live in `public.user_roles`, profiles in
   `public.profiles` — both keyed by the preserved UUIDs, so nothing to re-map).
2. Verify:

   ```sql
   select count(*) from auth.users;                                   -- 7818
   select count(*) from public.profiles p
     join auth.users u on u.id = p.user_id;                           -- 7818
   select role, count(*) from public.user_roles group by 1;
   ```

3. Auth settings to re-apply by hand in your Supabase dashboard
   (they are project config, not database rows):
   - Disable anonymous sign-ups
   - Email confirmations as you want them
   - Leaked-password (HIBP) protection: **on**
   - Site URL + redirect allow-list pointed at your domain
   - Any social provider you want (the source uses email/password only)

## Google / social sign-in note

The app currently calls the Lovable OAuth broker (`lovable.auth.signInWithOAuth`)
for Google. Off-platform you replace that call with
`supabase.auth.signInWithOAuth({ provider: 'google' })` and configure the Google
provider directly in your own Supabase Auth settings.
