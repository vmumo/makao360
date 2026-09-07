import { createClient } from '@supabase/supabase-js';

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.auth.signInWithPassword({
  email: process.env.MIGRATION_TEST_EMAIL,
  password: process.env.MIGRATION_TEST_PASSWORD,
});
if (error) throw new Error(`Sign-in failed: ${error.message}`);
console.log('Existing account password sign-in: passed');
const roles = await client.from('user_roles').select('role').eq('user_id', data.user.id);
if (roles.error) throw new Error(`Role lookup failed: ${roles.error.message}`);
console.log('Restored roles:', roles.data.map((r) => r.role).join(', '));
for (const table of ['profiles', 'properties', 'leases', 'bank_transactions']) {
  const result = await client.from(table).select('*', { count: 'exact', head: true });
  if (result.error) throw new Error(`${table}: ${result.error.message}`);
  console.log(`${table}: ${result.count} rows visible under this account's permissions`);
}
await client.auth.signOut({ scope: 'local' });
