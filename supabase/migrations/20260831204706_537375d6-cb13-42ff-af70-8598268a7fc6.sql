-- 1) Move national_id out of the landlord-readable profiles row
CREATE TABLE IF NOT EXISTS public.profile_identity (
  user_id uuid PRIMARY KEY,
  national_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_identity TO authenticated;
GRANT ALL ON public.profile_identity TO service_role;

ALTER TABLE public.profile_identity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS identity_self_select ON public.profile_identity;
CREATE POLICY identity_self_select ON public.profile_identity
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS identity_self_insert ON public.profile_identity;
CREATE POLICY identity_self_insert ON public.profile_identity
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS identity_self_update ON public.profile_identity;
CREATE POLICY identity_self_update ON public.profile_identity
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_profile_identity_touch ON public.profile_identity;
CREATE TRIGGER trg_profile_identity_touch
  BEFORE UPDATE ON public.profile_identity
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.profile_identity (user_id, national_id)
SELECT p.user_id, p.national_id
FROM public.profiles p
WHERE p.national_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS national_id;

-- 2) rent_advances: explicit write paths
DROP POLICY IF EXISTS advances_landlord_update ON public.rent_advances;
CREATE POLICY advances_landlord_update ON public.rent_advances
  FOR UPDATE TO authenticated
  USING (auth.uid() = landlord_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = landlord_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS advances_admin_delete ON public.rent_advances;
CREATE POLICY advances_admin_delete ON public.rent_advances
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));