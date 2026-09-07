CREATE OR REPLACE FUNCTION public.screen_application(_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app public.rental_applications;
  rent numeric := 0;
  ratio numeric := 0;
  v_score integer := 0;
  v_notes text := '';
  paid_cycles integer := 0;
BEGIN
  SELECT * INTO app FROM public.rental_applications WHERE id = _application_id;
  IF app.id IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF app.landlord_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT COALESCE(u.rent_amount,0) INTO rent FROM public.units u WHERE u.id = app.unit_id;
  IF rent > 0 AND app.monthly_income > 0 THEN
    ratio := rent / app.monthly_income;
    IF ratio <= 0.25 THEN v_score := v_score + 45; v_notes := v_notes || 'Rent under 25% of income. ';
    ELSIF ratio <= 0.33 THEN v_score := v_score + 35; v_notes := v_notes || 'Rent within 33% of income. ';
    ELSIF ratio <= 0.45 THEN v_score := v_score + 20; v_notes := v_notes || 'Rent is a stretch (>33% of income). ';
    ELSE v_score := v_score + 5; v_notes := v_notes || 'Rent exceeds 45% of income - high risk. ';
    END IF;
  ELSE
    v_notes := v_notes || 'Income or rent missing - affordability not scored. ';
  END IF;

  IF app.employment_status IN ('employed','self_employed') THEN
    v_score := v_score + 20; v_notes := v_notes || 'Stable income source. ';
  ELSE v_score := v_score + 5;
  END IF;

  IF app.applicant_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO paid_cycles
    FROM public.rent_cycles c JOIN public.leases l ON l.id = c.lease_id
    WHERE l.tenant_id = app.applicant_user_id AND c.status IN ('completed','closed');
    v_score := v_score + LEAST(25, paid_cycles * 5);
    v_notes := v_notes || paid_cycles::text || ' fully paid rent cycles on Makao360. ';
  ELSE
    v_notes := v_notes || 'No prior Makao360 payment history. ';
  END IF;

  IF app.previous_landlord_phone IS NOT NULL AND length(app.previous_landlord_phone) > 5 THEN
    v_score := v_score + 10; v_notes := v_notes || 'Previous landlord reference supplied. ';
  END IF;

  v_score := LEAST(100, v_score);

  UPDATE public.rental_applications a
  SET screening_score = v_score, screening_notes = v_notes, screened_at = now(),
      status = CASE WHEN a.status = 'submitted' THEN 'screening'::public.application_status ELSE a.status END
  WHERE a.id = _application_id;

  RETURN jsonb_build_object('score', v_score, 'notes', v_notes, 'rent_to_income', ratio);
END;
$$;

REVOKE ALL ON FUNCTION public.screen_application(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.screen_application(uuid) TO authenticated;