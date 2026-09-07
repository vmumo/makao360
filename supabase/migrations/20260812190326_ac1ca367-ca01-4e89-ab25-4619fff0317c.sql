-- 1. Blackouts -------------------------------------------------------------
CREATE TABLE public.unit_blackouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES auth.users(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unit_blackouts_range_ck CHECK (ends_at > starts_at)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_blackouts TO authenticated;
GRANT ALL ON public.unit_blackouts TO service_role;
ALTER TABLE public.unit_blackouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords manage their unit blackouts"
ON public.unit_blackouts FOR ALL TO authenticated
USING (landlord_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (landlord_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX unit_blackouts_unit_idx ON public.unit_blackouts (unit_id, starts_at);

CREATE TRIGGER unit_blackouts_touch
BEFORE UPDATE ON public.unit_blackouts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Capacity + conflict guards --------------------------------------------
ALTER TABLE public.unit_viewing_slots
  ADD CONSTRAINT unit_viewing_slots_capacity_ck CHECK (capacity BETWEEN 1 AND 50),
  ADD CONSTRAINT unit_viewing_slots_booked_ck CHECK (booked_count >= 0 AND booked_count <= capacity),
  ADD CONSTRAINT unit_viewing_slots_range_ck CHECK (ends_at > starts_at);

CREATE OR REPLACE FUNCTION public.check_viewing_slot_conflicts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.unit_viewing_slots s
    WHERE s.unit_id = NEW.unit_id
      AND s.id <> NEW.id
      AND s.status <> 'cancelled'
      AND s.starts_at < NEW.ends_at
      AND s.ends_at > NEW.starts_at
  ) THEN
    RAISE EXCEPTION 'This unit already has a viewing slot overlapping that time';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.unit_blackouts b
    WHERE b.unit_id = NEW.unit_id
      AND b.starts_at < NEW.ends_at
      AND b.ends_at > NEW.starts_at
  ) THEN
    RAISE EXCEPTION 'That time falls inside a blackout period for this unit';
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER unit_viewing_slots_conflict_guard
BEFORE INSERT OR UPDATE OF starts_at, ends_at, unit_id, status ON public.unit_viewing_slots
FOR EACH ROW EXECUTE FUNCTION public.check_viewing_slot_conflicts();

-- Block blackouts that would swallow existing open slots with bookings
CREATE OR REPLACE FUNCTION public.check_blackout_conflicts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.unit_viewing_slots s
    WHERE s.unit_id = NEW.unit_id
      AND s.status <> 'cancelled'
      AND s.booked_count > 0
      AND s.starts_at < NEW.ends_at
      AND s.ends_at > NEW.starts_at
  ) THEN
    RAISE EXCEPTION 'There are booked viewings in that period. Cancel them first.';
  END IF;

  UPDATE public.unit_viewing_slots
     SET status = 'cancelled'
   WHERE unit_id = NEW.unit_id
     AND status <> 'cancelled'
     AND booked_count = 0
     AND starts_at < NEW.ends_at
     AND ends_at > NEW.starts_at;

  RETURN NEW;
END; $$;

CREATE TRIGGER unit_blackouts_conflict_guard
BEFORE INSERT OR UPDATE OF starts_at, ends_at, unit_id ON public.unit_blackouts
FOR EACH ROW EXECUTE FUNCTION public.check_blackout_conflicts();

-- 3. Hide blacked-out slots from the public listing -------------------------
CREATE OR REPLACE FUNCTION public.public_unit_slots(_unit_id uuid)
RETURNS TABLE(slot_id uuid, starts_at timestamptz, ends_at timestamptz, mode viewing_mode, capacity integer, booked_count integer, seats_left integer, instructions text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select s.id, s.starts_at, s.ends_at, s.mode, s.capacity, s.booked_count,
         greatest(s.capacity - s.booked_count, 0), s.instructions
  from public.unit_viewing_slots s
  join public.units u on u.id = s.unit_id
  where s.unit_id = _unit_id
    and s.status = 'open'
    and s.starts_at > now()
    and u.listed = true
    and not exists (
      select 1 from public.unit_blackouts b
      where b.unit_id = s.unit_id
        and b.starts_at < s.ends_at
        and b.ends_at > s.starts_at
    )
  order by s.starts_at
  limit 50;
$$;

-- 4. Self-serve booking management -----------------------------------------
CREATE OR REPLACE FUNCTION public.get_viewing_booking(_code text, _phone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE b record;
BEGIN
  SELECT vb.*, s.starts_at, s.ends_at, s.mode, s.instructions, s.contact_phone,
         u.label AS unit_label, p.name AS property_name,
         concat_ws(', ', p.address, p.city, p.county) AS location
    INTO b
  FROM public.viewing_bookings vb
  JOIN public.unit_viewing_slots s ON s.id = vb.slot_id
  JOIN public.units u ON u.id = vb.unit_id
  JOIN public.properties p ON p.id = u.property_id
  WHERE upper(vb.confirmation_code) = upper(trim(_code))
    AND regexp_replace(vb.applicant_phone, '\D', '', 'g') = regexp_replace(coalesce(_phone,''), '\D', '', 'g');

  IF b IS NULL THEN RAISE EXCEPTION 'No booking found for that code and phone number'; END IF;

  RETURN jsonb_build_object(
    'booking_id', b.id, 'slot_id', b.slot_id, 'unit_id', b.unit_id,
    'confirmation_code', b.confirmation_code, 'status', b.status,
    'applicant_name', b.applicant_name, 'applicant_phone', b.applicant_phone,
    'starts_at', b.starts_at, 'ends_at', b.ends_at, 'mode', b.mode,
    'instructions', b.instructions, 'contact_phone', b.contact_phone,
    'unit_label', b.unit_label, 'property_name', b.property_name, 'location', b.location
  );
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_viewing_booking(_code text, _phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM public.viewing_bookings vb
  WHERE upper(vb.confirmation_code) = upper(trim(_code))
    AND regexp_replace(vb.applicant_phone, '\D', '', 'g') = regexp_replace(coalesce(_phone,''), '\D', '', 'g')
  FOR UPDATE;

  IF b IS NULL THEN RAISE EXCEPTION 'No booking found for that code and phone number'; END IF;
  IF b.status = 'cancelled' THEN RAISE EXCEPTION 'This booking is already cancelled'; END IF;

  UPDATE public.viewing_bookings SET status = 'cancelled', cancelled_at = now() WHERE id = b.id;
  UPDATE public.unit_viewing_slots
     SET booked_count = greatest(booked_count - 1, 0),
         status = CASE WHEN status = 'closed' THEN 'open'::public.viewing_slot_status ELSE status END
   WHERE id = b.slot_id;

  INSERT INTO public.notifications (user_id, channel, title, body, link_url, payload)
  VALUES (b.landlord_id, 'in_app', 'Viewing cancelled',
          b.applicant_name || ' cancelled their viewing (code ' || b.confirmation_code || ')',
          '/app/landlord/leasing', jsonb_build_object('booking_id', b.id, 'slot_id', b.slot_id));

  RETURN jsonb_build_object('booking_id', b.id, 'status', 'cancelled');
END; $$;

CREATE OR REPLACE FUNCTION public.reschedule_viewing_booking(_code text, _phone text, _new_slot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE b record; s record;
BEGIN
  SELECT * INTO b FROM public.viewing_bookings vb
  WHERE upper(vb.confirmation_code) = upper(trim(_code))
    AND regexp_replace(vb.applicant_phone, '\D', '', 'g') = regexp_replace(coalesce(_phone,''), '\D', '', 'g')
  FOR UPDATE;

  IF b IS NULL THEN RAISE EXCEPTION 'No booking found for that code and phone number'; END IF;
  IF b.status = 'cancelled' THEN RAISE EXCEPTION 'This booking was cancelled. Book a new time instead.'; END IF;
  IF b.slot_id = _new_slot_id THEN RAISE EXCEPTION 'That is already your viewing time'; END IF;

  SELECT * INTO s FROM public.unit_viewing_slots WHERE id = _new_slot_id FOR UPDATE;
  IF s IS NULL THEN RAISE EXCEPTION 'Viewing slot not found'; END IF;
  IF s.unit_id <> b.unit_id THEN RAISE EXCEPTION 'You can only move to a time for the same unit'; END IF;
  IF s.status <> 'open' THEN RAISE EXCEPTION 'This viewing slot is no longer open'; END IF;
  IF s.starts_at <= now() THEN RAISE EXCEPTION 'This viewing slot has already passed'; END IF;
  IF s.booked_count >= s.capacity THEN RAISE EXCEPTION 'This viewing slot is fully booked'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.unit_blackouts bl
    WHERE bl.unit_id = s.unit_id AND bl.starts_at < s.ends_at AND bl.ends_at > s.starts_at
  ) THEN RAISE EXCEPTION 'That time is unavailable'; END IF;

  UPDATE public.unit_viewing_slots
     SET booked_count = greatest(booked_count - 1, 0),
         status = CASE WHEN status = 'closed' THEN 'open'::public.viewing_slot_status ELSE status END
   WHERE id = b.slot_id;

  UPDATE public.unit_viewing_slots
     SET booked_count = booked_count + 1,
         status = CASE WHEN booked_count + 1 >= capacity THEN 'closed'::public.viewing_slot_status ELSE status END
   WHERE id = _new_slot_id;

  UPDATE public.viewing_bookings
     SET slot_id = _new_slot_id, status = 'booked', reminder_sent_at = NULL
   WHERE id = b.id;

  INSERT INTO public.notifications (user_id, channel, title, body, link_url, payload)
  VALUES (b.landlord_id, 'in_app', 'Viewing rescheduled',
          b.applicant_name || ' moved their viewing to ' ||
          to_char(s.starts_at AT TIME ZONE 'Africa/Nairobi', 'DD Mon YYYY HH24:MI'),
          '/app/landlord/leasing', jsonb_build_object('booking_id', b.id, 'slot_id', _new_slot_id));

  RETURN jsonb_build_object('booking_id', b.id, 'slot_id', _new_slot_id,
    'starts_at', s.starts_at, 'ends_at', s.ends_at, 'mode', s.mode,
    'instructions', s.instructions, 'contact_phone', s.contact_phone,
    'confirmation_code', b.confirmation_code);
END; $$;

REVOKE ALL ON FUNCTION public.get_viewing_booking(text, text) FROM public;
REVOKE ALL ON FUNCTION public.cancel_viewing_booking(text, text) FROM public;
REVOKE ALL ON FUNCTION public.reschedule_viewing_booking(text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_viewing_booking(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_viewing_booking(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_viewing_booking(text, text, uuid) TO anon, authenticated;

-- 5. Availability-change notifications for booked applicants ----------------
ALTER TABLE public.viewing_bookings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.notify_viewing_slot_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; v_title text; v_body text; v_when text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at
     AND NEW.ends_at IS NOT DISTINCT FROM OLD.ends_at THEN
    RETURN NEW;
  END IF;

  v_when := to_char(NEW.starts_at AT TIME ZONE 'Africa/Nairobi', 'DD Mon YYYY HH24:MI');

  IF NEW.status = 'cancelled' THEN
    v_title := 'Viewing cancelled by the landlord';
    v_body := 'Your viewing on ' || v_when || ' was cancelled. Pick another time on the listing.';
  ELSIF NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at THEN
    v_title := 'Viewing time changed';
    v_body := 'Your viewing has moved to ' || v_when || '.';
  ELSE
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT * FROM public.viewing_bookings
    WHERE slot_id = NEW.id AND status <> 'cancelled' AND applicant_user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, channel, title, body, link_url, payload)
    VALUES (r.applicant_user_id, 'in_app', v_title, v_body,
            '/vacancies/' || NEW.unit_id::text,
            jsonb_build_object('booking_id', r.id, 'slot_id', NEW.id, 'code', r.confirmation_code));
  END LOOP;

  RETURN NEW;
END; $$;

CREATE TRIGGER unit_viewing_slots_change_notify
AFTER UPDATE ON public.unit_viewing_slots
FOR EACH ROW EXECUTE FUNCTION public.notify_viewing_slot_change();

-- 6. Reminder dispatcher -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_viewing_reminders(_within_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; v_count integer := 0; v_when text; v_chan public.notification_channel; prefs record;
BEGIN
  FOR r IN
    SELECT vb.id, vb.applicant_user_id, vb.applicant_name, vb.confirmation_code, vb.landlord_id,
           s.starts_at, s.mode, s.instructions, s.contact_phone, u.label AS unit_label, p.name AS property_name,
           vb.unit_id
    FROM public.viewing_bookings vb
    JOIN public.unit_viewing_slots s ON s.id = vb.slot_id
    JOIN public.units u ON u.id = vb.unit_id
    JOIN public.properties p ON p.id = u.property_id
    WHERE vb.status IN ('booked','confirmed')
      AND s.status <> 'cancelled'
      AND s.starts_at > now()
      AND s.starts_at <= now() + make_interval(hours => greatest(_within_hours, 1))
      AND vb.reminder_sent_at IS NULL
  LOOP
    v_when := to_char(r.starts_at AT TIME ZONE 'Africa/Nairobi', 'DD Mon YYYY HH24:MI');

    IF r.applicant_user_id IS NOT NULL THEN
      SELECT channel_sms, channel_email INTO prefs
      FROM public.notification_preferences WHERE user_id = r.applicant_user_id;

      FOREACH v_chan IN ARRAY (
        ARRAY['in_app']::public.notification_channel[]
        || CASE WHEN coalesce(prefs.channel_sms, true) THEN ARRAY['sms']::public.notification_channel[] ELSE '{}'::public.notification_channel[] END
        || CASE WHEN coalesce(prefs.channel_email, false) THEN ARRAY['email']::public.notification_channel[] ELSE '{}'::public.notification_channel[] END
      ) LOOP
        INSERT INTO public.notifications (user_id, channel, title, body, link_url, payload)
        VALUES (r.applicant_user_id, v_chan, 'Viewing reminder',
                'Your viewing at ' || r.property_name || ' · ' || r.unit_label || ' is on ' || v_when ||
                '. Code ' || r.confirmation_code || '.' ||
                coalesce(' ' || r.instructions, ''),
                '/vacancies/' || r.unit_id::text,
                jsonb_build_object('booking_id', r.id, 'code', r.confirmation_code));
      END LOOP;
    END IF;

    INSERT INTO public.notifications (user_id, channel, title, body, link_url, payload)
    VALUES (r.landlord_id, 'in_app', 'Upcoming viewing',
            r.applicant_name || ' is viewing ' || r.property_name || ' · ' || r.unit_label || ' on ' || v_when,
            '/app/landlord/leasing', jsonb_build_object('booking_id', r.id));

    UPDATE public.viewing_bookings SET reminder_sent_at = now() WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('reminded', v_count);
END; $$;

REVOKE ALL ON FUNCTION public.dispatch_viewing_reminders(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.dispatch_viewing_reminders(integer) TO service_role, authenticated;