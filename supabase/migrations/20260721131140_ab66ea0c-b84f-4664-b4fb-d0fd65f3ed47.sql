
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ BEGIN CREATE TYPE public.kyc_status AS ENUM ('pending','approved','rejected','more_info'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.maintenance_status AS ENUM ('open','acknowledged','in_progress','resolved','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.maintenance_priority AS ENUM ('low','normal','high','urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL, id_type TEXT NOT NULL, id_number TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'KE',
  document_url TEXT, selfie_url TEXT,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  reviewer_notes TEXT, reviewed_by UUID REFERENCES auth.users(id), reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.kyc_submissions TO authenticated;
GRANT ALL ON public.kyc_submissions TO service_role;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kyc_self_select" ON public.kyc_submissions;
DROP POLICY IF EXISTS "kyc_self_insert" ON public.kyc_submissions;
DROP POLICY IF EXISTS "kyc_admin_update" ON public.kyc_submissions;
CREATE POLICY "kyc_self_select" ON public.kyc_submissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "kyc_self_insert" ON public.kyc_submissions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "kyc_admin_update" ON public.kyc_submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  landlord_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  priority public.maintenance_priority NOT NULL DEFAULT 'normal',
  title TEXT NOT NULL, description TEXT NOT NULL, photo_url TEXT,
  status public.maintenance_status NOT NULL DEFAULT 'open',
  landlord_note TEXT, resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.maintenance_requests TO authenticated;
GRANT ALL ON public.maintenance_requests TO service_role;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "maint_select" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maint_insert" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maint_update" ON public.maintenance_requests;
CREATE POLICY "maint_select" ON public.maintenance_requests FOR SELECT TO authenticated USING (tenant_id = auth.uid() OR landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "maint_insert" ON public.maintenance_requests FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "maint_update" ON public.maintenance_requests FOR UPDATE TO authenticated USING (tenant_id = auth.uid() OR landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (tenant_id = auth.uid() OR landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL, path TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.analytics_events TO anon, authenticated;
GRANT SELECT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytics_insert_any" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_admin_select" ON public.analytics_events;
CREATE POLICY "analytics_insert_any" ON public.analytics_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "analytics_admin_select" ON public.analytics_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_name_idx ON public.analytics_events (event_name);

CREATE TABLE IF NOT EXISTS public.cookie_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  necessary BOOLEAN NOT NULL DEFAULT true,
  analytics BOOLEAN NOT NULL DEFAULT false,
  marketing BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.cookie_consents TO anon, authenticated;
GRANT SELECT ON public.cookie_consents TO authenticated;
GRANT ALL ON public.cookie_consents TO service_role;
ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "consent_insert_any" ON public.cookie_consents;
DROP POLICY IF EXISTS "consent_admin_select" ON public.cookie_consents;
CREATE POLICY "consent_insert_any" ON public.cookie_consents FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "consent_admin_select" ON public.cookie_consents FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS kyc_touch_updated ON public.kyc_submissions;
CREATE TRIGGER kyc_touch_updated BEFORE UPDATE ON public.kyc_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS maint_touch_updated ON public.maintenance_requests;
CREATE TRIGGER maint_touch_updated BEFORE UPDATE ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.maintenance_fill_landlord()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.unit_id IS NOT NULL AND (NEW.property_id IS NULL OR NEW.landlord_id IS NULL) THEN
    SELECT u.property_id, p.landlord_id INTO NEW.property_id, NEW.landlord_id
    FROM public.units u JOIN public.properties p ON p.id = u.property_id
    WHERE u.id = NEW.unit_id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS maint_fill_landlord ON public.maintenance_requests;
CREATE TRIGGER maint_fill_landlord BEFORE INSERT ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.maintenance_fill_landlord();
