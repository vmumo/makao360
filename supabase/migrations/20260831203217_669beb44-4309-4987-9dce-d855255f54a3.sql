DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

-- Intentionally public (anonymous) entry points used by vacancy/viewing/invite pages
GRANT EXECUTE ON FUNCTION public.public_vacancies(text, text, integer, integer, integer, integer, property_type, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_vacancy_detail(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_unit_slots(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_viewing(uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_viewing_booking(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_viewing_booking(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_viewing_booking(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_application(uuid, text, text, text, numeric, text, text, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_invite_resend(text) TO anon, authenticated;

-- Internal automation / trigger functions: not callable by end users at all
REVOKE ALL ON FUNCTION public.assert_journal_balanced() FROM authenticated;
REVOKE ALL ON FUNCTION public.gl_post_contribution() FROM authenticated;
REVOKE ALL ON FUNCTION public.gl_post_expense() FROM authenticated;
REVOKE ALL ON FUNCTION public.gl_post_payout() FROM authenticated;
REVOKE ALL ON FUNCTION public.maintenance_fill_landlord() FROM authenticated;
REVOKE ALL ON FUNCTION public.notify_application_status() FROM authenticated;
REVOKE ALL ON FUNCTION public.notify_inspection() FROM authenticated;
REVOKE ALL ON FUNCTION public.notify_lease_document() FROM authenticated;
REVOKE ALL ON FUNCTION public.notify_new_message() FROM authenticated;
REVOKE ALL ON FUNCTION public.notify_renewal_offer() FROM authenticated;
REVOKE ALL ON FUNCTION public.notify_viewing_slot_change() FROM authenticated;
REVOKE ALL ON FUNCTION public.post_journal(uuid, date, text, journal_source, text, uuid, uuid, uuid, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.record_fuliza_contribution(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.dispatch_viewing_reminders(integer) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_wipe_demo_data() FROM authenticated;

-- Stop anonymous scraping of viewing slot contact phone numbers
DROP POLICY IF EXISTS "Anyone can view open slots for listed units" ON public.unit_viewing_slots;
REVOKE ALL ON TABLE public.unit_viewing_slots FROM anon;
