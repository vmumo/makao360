-- Leasing lifecycle: applications, e-sign documents, inspections, renewals

CREATE TYPE public.application_status AS ENUM ('submitted','screening','approved','rejected','withdrawn','converted');
CREATE TYPE public.lease_doc_status AS ENUM ('draft','sent','signed','void');
CREATE TYPE public.inspection_kind AS ENUM ('move_in','move_out','routine');
CREATE TYPE public.inspection_status AS ENUM ('scheduled','in_progress','completed','cancelled');
CREATE TYPE public.renewal_status AS ENUM ('offered','accepted','declined','expired');

CREATE TABLE public.rental_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  applicant_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  applicant_name text NOT NULL,
  applicant_phone text NOT NULL,
  applicant_email text,
  employment_status text,
  employer text,
  monthly_income numeric NOT NULL DEFAULT 0,
  dependents integer NOT NULL DEFAULT 0,
  previous_landlord_phone text,
  notes text,
  status public.application_status NOT NULL DEFAULT 'submitted',
  screening_score integer,
  screening_notes text,
  screened_at timestamptz,
  decided_at timestamptz,
  lease_id uuid REFERENCES public.leases(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_applications TO authenticated;
GRANT ALL ON public.rental_applications TO service_role;
ALTER TABLE public.rental_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY applications_landlord_all ON public.rental_applications FOR ALL TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY applications_applicant_select ON public.rental_applications FOR SELECT TO authenticated
  USING (applicant_user_id = auth.uid());
CREATE POLICY applications_applicant_insert ON public.rental_applications FOR INSERT TO authenticated
  WITH CHECK (applicant_user_id = auth.uid());

CREATE TABLE public.lease_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid REFERENCES public.leases(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  status public.lease_doc_status NOT NULL DEFAULT 'draft',
  landlord_signature text,
  landlord_signed_at timestamptz,
  tenant_signature text,
  tenant_signed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lease_documents TO authenticated;
GRANT ALL ON public.lease_documents TO service_role;
ALTER TABLE public.lease_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY lease_docs_landlord_all ON public.lease_documents FOR ALL TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY lease_docs_tenant_select ON public.lease_documents FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());
CREATE POLICY lease_docs_tenant_sign ON public.lease_documents FOR UPDATE TO authenticated
  USING (tenant_id = auth.uid() AND status = 'sent')
  WITH CHECK (tenant_id = auth.uid());

CREATE TABLE public.inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  lease_id uuid REFERENCES public.leases(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind public.inspection_kind NOT NULL DEFAULT 'routine',
  status public.inspection_status NOT NULL DEFAULT 'scheduled',
  scheduled_for date NOT NULL DEFAULT CURRENT_DATE,
  completed_at timestamptz,
  inspector_name text,
  summary text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  deductions numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspections TO authenticated;
GRANT ALL ON public.inspections TO service_role;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY inspections_landlord_all ON public.inspections FOR ALL TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY inspections_tenant_select ON public.inspections FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());

CREATE TABLE public.lease_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_rent integer NOT NULL,
  new_rent integer NOT NULL,
  new_end_date date,
  message text,
  status public.renewal_status NOT NULL DEFAULT 'offered',
  responded_at timestamptz,
  response_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lease_renewals TO authenticated;
GRANT ALL ON public.lease_renewals TO service_role;
ALTER TABLE public.lease_renewals ENABLE ROW LEVEL SECURITY;
CREATE POLICY renewals_landlord_all ON public.lease_renewals FOR ALL TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY renewals_tenant_select ON public.lease_renewals FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());
CREATE POLICY renewals_tenant_respond ON public.lease_renewals FOR UPDATE TO authenticated
  USING (tenant_id = auth.uid() AND status = 'offered')
  WITH CHECK (tenant_id = auth.uid());

CREATE TRIGGER trg_applications_touch BEFORE UPDATE ON public.rental_applications FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_lease_docs_touch BEFORE UPDATE ON public.lease_documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_inspections_touch BEFORE UPDATE ON public.inspections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_renewals_touch BEFORE UPDATE ON public.lease_renewals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Screening score: simple affordability + history heuristic
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
  score integer := 0;
  notes text := '';
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
    IF ratio <= 0.25 THEN score := score + 45; notes := notes || 'Rent under 25% of income. ';
    ELSIF ratio <= 0.33 THEN score := score + 35; notes := notes || 'Rent within 33% of income. ';
    ELSIF ratio <= 0.45 THEN score := score + 20; notes := notes || 'Rent is a stretch (>33% of income). ';
    ELSE score := score + 5; notes := notes || 'Rent exceeds 45% of income - high risk. ';
    END IF;
  ELSE
    notes := notes || 'Income or rent missing - affordability not scored. ';
  END IF;

  IF app.employment_status IN ('employed','self_employed') THEN score := score + 20; notes := notes || 'Stable income source. ';
  ELSE score := score + 5; END IF;

  IF app.applicant_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO paid_cycles
    FROM public.rent_cycles c JOIN public.leases l ON l.id = c.lease_id
    WHERE l.tenant_id = app.applicant_user_id AND c.status IN ('completed','closed');
    score := score + LEAST(25, paid_cycles * 5);
    notes := notes || paid_cycles::text || ' fully paid rent cycles on Makao360. ';
  ELSE
    notes := notes || 'No prior Makao360 payment history. ';
  END IF;

  IF app.previous_landlord_phone IS NOT NULL AND length(app.previous_landlord_phone) > 5 THEN
    score := score + 10; notes := notes || 'Previous landlord reference supplied. ';
  END IF;

  score := LEAST(100, score);

  UPDATE public.rental_applications
  SET screening_score = score, screening_notes = notes, screened_at = now(),
      status = CASE WHEN status = 'submitted' THEN 'screening' ELSE status END
  WHERE id = _application_id;

  RETURN jsonb_build_object('score', score, 'notes', notes, 'rent_to_income', ratio);
END;
$$;

REVOKE ALL ON FUNCTION public.screen_application(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.screen_application(uuid) TO authenticated;