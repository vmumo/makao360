// Manually invoke the viewing-reminder dispatcher against the hosted Supabase
// project. Run with: node --env-file=.env scripts/dispatch-reminders.mjs
// The scheduled GitHub Actions workflow performs the same call hourly.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase.rpc('dispatch_viewing_reminders', {
  _within_hours: 24,
});
if (error) {
  console.error('dispatch_viewing_reminders failed:', error.message);
  process.exit(1);
}
console.log('dispatch_viewing_reminders:', JSON.stringify(data));
