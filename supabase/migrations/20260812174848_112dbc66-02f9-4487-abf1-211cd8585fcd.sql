-- 1) Notification preference events
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS event_application_status boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS event_lease_signature boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS event_renewals boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS event_inspections boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS event_deposit_changes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS event_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS event_maintenance boolean NOT NULL DEFAULT true;

-- 2) Unit listing fields for public vacancy pages
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS listed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listing_title text,
  ADD COLUMN IF NOT EXISTS listing_description text,
  ADD COLUMN IF NOT EXISTS listing_photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS listing_amenities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS available_from date;

-- 3) Messaging threads
CREATE TABLE IF NOT EXISTS public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  lease_id uuid REFERENCES public.leases(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  subject text NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  attachment_url text,
  attachment_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_reads (
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.message_threads TO authenticated;
GRANT ALL ON public.message_threads TO service_role;
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.message_reads TO authenticated;
GRANT ALL ON public.message_reads TO service_role;

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_thread(_thread_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE t.id = _thread_id
      AND (
        t.landlord_id = auth.uid()
        OR t.tenant_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR EXISTS (
          SELECT 1 FROM public.landlord_team_members m
          WHERE m.landlord_id = t.landlord_id
            AND m.member_user_id = auth.uid()
            AND m.status = 'active'
            AND (cardinality(m.property_ids) = 0 OR t.property_id = ANY (m.property_ids))
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_access_thread(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_access_thread(uuid) TO authenticated;

DROP POLICY IF EXISTS threads_participants_select ON public.message_threads;
CREATE POLICY threads_participants_select ON public.message_threads FOR SELECT TO authenticated
  USING (public.can_access_thread(id));
DROP POLICY IF EXISTS threads_participants_insert ON public.message_threads;
CREATE POLICY threads_participants_insert ON public.message_threads FOR INSERT TO authenticated
  WITH CHECK (landlord_id = auth.uid() OR tenant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS threads_participants_update ON public.message_threads;
CREATE POLICY threads_participants_update ON public.message_threads FOR UPDATE TO authenticated
  USING (public.can_access_thread(id)) WITH CHECK (public.can_access_thread(id));

DROP POLICY IF EXISTS messages_participants_select ON public.messages;
CREATE POLICY messages_participants_select ON public.messages FOR SELECT TO authenticated
  USING (public.can_access_thread(thread_id));
DROP POLICY IF EXISTS messages_participants_insert ON public.messages;
CREATE POLICY messages_participants_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_access_thread(thread_id));

DROP POLICY IF EXISTS reads_own ON public.message_reads;
CREATE POLICY reads_own ON public.message_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_threads_landlord ON public.message_threads(landlord_id);
CREATE INDEX IF NOT EXISTS idx_threads_tenant ON public.message_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages(thread_id, created_at);

DROP TRIGGER IF EXISTS trg_threads_touch ON public.message_threads;
CREATE TRIGGER trg_threads_touch BEFORE UPDATE ON public.message_threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- notify other participants on new message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.message_threads; recipient uuid; sender_name text;
BEGIN
  SELECT * INTO t FROM public.message_threads WHERE id = NEW.thread_id;
  UPDATE public.message_threads SET last_message_at = NEW.created_at WHERE id = NEW.thread_id;
  SELECT full_name INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
  FOR recipient IN SELECT unnest(ARRAY[t.landlord_id, t.tenant_id]) LOOP
    IF recipient IS NOT NULL AND recipient <> NEW.sender_id THEN
      IF COALESCE((SELECT event_messages FROM public.notification_preferences WHERE user_id = recipient), true) THEN
        INSERT INTO public.notifications (user_id, channel, title, body, link_url, payload)
        VALUES (recipient, 'in_app', 'New message: ' || t.subject,
                COALESCE(sender_name, 'Someone') || ': ' || left(NEW.body, 140),
                '/app/messages', jsonb_build_object('thread_id', t.id));
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
CREATE TRIGGER trg_notify_new_message AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- 4) Application / lease-document / renewal / inspection notifications
CREATE OR REPLACE FUNCTION public.notify_application_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE title text; body text;
BEGIN
  IF NEW.applicant_user_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    title := 'Application submitted';
    body := 'We received your application. The landlord will review it shortly.';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'screening' THEN title := 'Application screened';
                            body := 'Your affordability score is ' || COALESCE(NEW.screening_score::text, 'pending') || '/100.';
      WHEN 'approved' THEN title := 'Application approved';
                           body := 'Great news - your application was approved. A lease agreement will follow.';
      WHEN 'rejected' THEN title := 'Application not successful';
                           body := COALESCE(NEW.notes, 'The landlord did not proceed with this application.');
      WHEN 'converted' THEN title := 'Lease created';
                            body := 'Your tenancy has been created from this application.';
      ELSE RETURN NEW;
    END CASE;
  ELSE
    RETURN NEW;
  END IF;
  IF COALESCE((SELECT event_application_status FROM public.notification_preferences WHERE user_id = NEW.applicant_user_id), true) THEN
    INSERT INTO public.notifications (user_id, channel, title, body, link_url, payload)
    VALUES (NEW.applicant_user_id, 'in_app', title, body, '/app/tenant/leasing',
            jsonb_build_object('application_id', NEW.id, 'status', NEW.status));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_application_status ON public.rental_applications;
CREATE TRIGGER trg_notify_application_status AFTER INSERT OR UPDATE ON public.rental_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_application_status();

CREATE OR REPLACE FUNCTION public.notify_lease_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'sent' AND COALESCE((SELECT event_lease_signature FROM public.notification_preferences WHERE user_id = NEW.tenant_id), true) THEN
    INSERT INTO public.notifications (user_id, channel, title, body, link_url, payload)
    VALUES (NEW.tenant_id, 'in_app', 'Lease ready to sign', NEW.title || ' is waiting for your signature.',
            '/app/tenant/leasing', jsonb_build_object('document_id', NEW.id));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_lease_document ON public.lease_documents;
CREATE TRIGGER trg_notify_lease_document AFTER UPDATE ON public.lease_documents
  FOR EACH ROW EXECUTE FUNCTION public.notify_lease_document();

CREATE OR REPLACE FUNCTION public.notify_renewal_offer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t uuid;
BEGIN
  SELECT tenant_id INTO t FROM public.leases WHERE id = NEW.lease_id;
  IF t IS NULL THEN RETURN NEW; END IF;
  IF COALESCE((SELECT event_renewals FROM public.notification_preferences WHERE user_id = t), true) THEN
    INSERT INTO public.notifications (user_id, channel, title, body, link_url, payload)
    VALUES (t, 'in_app', 'Lease renewal offer',
            'Your landlord has offered a renewal. Review the new terms.',
            '/app/tenant/leasing', jsonb_build_object('renewal_id', NEW.id));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_renewal_offer ON public.lease_renewals;
CREATE TRIGGER trg_notify_renewal_offer AFTER INSERT ON public.lease_renewals
  FOR EACH ROW EXECUTE FUNCTION public.notify_renewal_offer();

CREATE OR REPLACE FUNCTION public.notify_inspection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t uuid; wants_insp boolean; wants_dep boolean;
BEGIN
  SELECT tenant_id INTO t FROM public.leases WHERE id = NEW.lease_id;
  IF t IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(event_inspections, true), COALESCE(event_deposit_changes, true)
    INTO wants_insp, wants_dep FROM public.notification_preferences WHERE user_id = t;
  wants_insp := COALESCE(wants_insp, true); wants_dep := COALESCE(wants_dep, true);
  IF TG_OP = 'INSERT' AND wants_insp THEN
    INSERT INTO public.notifications (user_id, channel, title, body, link_url, payload)
    VALUES (t, 'in_app', 'Inspection scheduled',
            'An inspection has been scheduled for your unit.', '/app/tenant/leasing',
            jsonb_build_object('inspection_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND wants_insp THEN
      INSERT INTO public.notifications (user_id, channel, title, body, link_url, payload)
      VALUES (t, 'in_app', 'Inspection ' || NEW.status,
              'Your unit inspection is now ' || NEW.status || '.', '/app/tenant/leasing',
              jsonb_build_object('inspection_id', NEW.id));
    END IF;
    IF COALESCE(NEW.deposit_deduction, 0) IS DISTINCT FROM COALESCE(OLD.deposit_deduction, 0) AND wants_dep THEN
      INSERT INTO public.notifications (user_id, channel, title, body, link_url, payload)
      VALUES (t, 'in_app', 'Deposit adjustment',
              'A deposit deduction of KES ' || COALESCE(NEW.deposit_deduction, 0)::text || ' was recorded.',
              '/app/tenant/leasing', jsonb_build_object('inspection_id', NEW.id));
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_inspection ON public.inspections;
CREATE TRIGGER trg_notify_inspection AFTER INSERT OR UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.notify_inspection();

-- 5) Public vacancy listings
CREATE OR REPLACE FUNCTION public.public_vacancies(_search text DEFAULT NULL, _city text DEFAULT NULL,
  _min_rent integer DEFAULT NULL, _max_rent integer DEFAULT NULL, _limit integer DEFAULT 60)
RETURNS TABLE(unit_id uuid, label text, rent_amount integer, deposit_amount integer, bedrooms integer,
  listing_title text, listing_photos text[], listing_amenities text[], available_from date,
  property_name text, city text, county text, address text, property_type property_type,
  latitude double precision, longitude double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.label, u.rent_amount, u.deposit_amount, u.bedrooms,
         COALESCE(u.listing_title, p.name || ' - ' || u.label), u.listing_photos, u.listing_amenities,
         u.available_from, p.name, p.city, p.county, p.address, p.property_type, p.latitude, p.longitude
  FROM public.units u JOIN public.properties p ON p.id = u.property_id
  WHERE u.listed = true AND u.status = 'vacant'
    AND (_city IS NULL OR p.city ILIKE _city)
    AND (_min_rent IS NULL OR u.rent_amount >= _min_rent)
    AND (_max_rent IS NULL OR u.rent_amount <= _max_rent)
    AND (_search IS NULL OR p.name ILIKE '%' || _search || '%' OR p.city ILIKE '%' || _search || '%'
         OR COALESCE(p.address,'') ILIKE '%' || _search || '%' OR COALESCE(u.listing_title,'') ILIKE '%' || _search || '%')
  ORDER BY u.rent_amount ASC
  LIMIT LEAST(COALESCE(_limit, 60), 200);
$$;
REVOKE ALL ON FUNCTION public.public_vacancies(text, text, integer, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.public_vacancies(text, text, integer, integer, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_vacancy_detail(_unit_id uuid)
RETURNS TABLE(unit_id uuid, label text, rent_amount integer, deposit_amount integer, bedrooms integer,
  listing_title text, listing_description text, listing_photos text[], listing_amenities text[],
  available_from date, property_name text, city text, county text, address text,
  property_type property_type, latitude double precision, longitude double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.label, u.rent_amount, u.deposit_amount, u.bedrooms,
         COALESCE(u.listing_title, p.name || ' - ' || u.label), u.listing_description, u.listing_photos,
         u.listing_amenities, u.available_from, p.name, p.city, p.county, p.address, p.property_type,
         p.latitude, p.longitude
  FROM public.units u JOIN public.properties p ON p.id = u.property_id
  WHERE u.id = _unit_id AND u.listed = true AND u.status = 'vacant';
$$;
REVOKE ALL ON FUNCTION public.public_vacancy_detail(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.public_vacancy_detail(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_public_application(_unit_id uuid, _name text, _phone text,
  _email text DEFAULT NULL, _monthly_income numeric DEFAULT 0, _employment_status text DEFAULT NULL,
  _employer text DEFAULT NULL, _dependents integer DEFAULT 0, _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u record; new_id uuid;
BEGIN
  SELECT un.id, un.property_id, p.landlord_id INTO u
  FROM public.units un JOIN public.properties p ON p.id = un.property_id
  WHERE un.id = _unit_id AND un.listed = true AND un.status = 'vacant';
  IF u.id IS NULL THEN RAISE EXCEPTION 'This unit is no longer available'; END IF;
  IF length(COALESCE(_name,'')) < 2 OR length(COALESCE(_phone,'')) < 7 THEN
    RAISE EXCEPTION 'Name and phone are required';
  END IF;
  INSERT INTO public.rental_applications (landlord_id, unit_id, property_id, applicant_user_id,
    applicant_name, applicant_phone, applicant_email, monthly_income, employment_status, employer,
    dependents, notes, status)
  VALUES (u.landlord_id, u.id, u.property_id, auth.uid(), _name, _phone, _email,
    COALESCE(_monthly_income, 0), _employment_status, _employer, COALESCE(_dependents, 0), _notes, 'submitted')
  RETURNING id INTO new_id;

  INSERT INTO public.notifications (user_id, channel, title, body, link_url, payload)
  VALUES (u.landlord_id, 'in_app', 'New rental application',
          _name || ' applied for a vacant unit.', '/app/landlord/leasing',
          jsonb_build_object('application_id', new_id));
  RETURN new_id;
END; $$;
REVOKE ALL ON FUNCTION public.submit_public_application(uuid, text, text, text, numeric, text, text, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_public_application(uuid, text, text, text, numeric, text, text, integer, text) TO anon, authenticated;

-- seed some listings from existing vacant units so the page is not empty
UPDATE public.units SET listed = true, available_from = CURRENT_DATE
WHERE status = 'vacant' AND id IN (SELECT id FROM public.units WHERE status = 'vacant' ORDER BY updated_at DESC LIMIT 120);