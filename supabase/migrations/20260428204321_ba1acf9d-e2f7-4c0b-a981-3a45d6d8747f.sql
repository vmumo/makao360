
-- 1. Add caretaker role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'caretaker';

-- 2. Property portfolios (one-to-many)
CREATE TABLE IF NOT EXISTS public.property_portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  color text DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (landlord_id, name)
);

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS portfolio_id uuid REFERENCES public.property_portfolios(id) ON DELETE SET NULL;

ALTER TABLE public.property_portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portfolios_landlord_all" ON public.property_portfolios
  FOR ALL USING (auth.uid() = landlord_id OR has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = landlord_id);

CREATE TRIGGER trg_portfolios_updated BEFORE UPDATE ON public.property_portfolios
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Property tags (many-to-many)
CREATE TABLE IF NOT EXISTS public.property_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  label text NOT NULL,
  color text DEFAULT 'secondary',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (landlord_id, label)
);

ALTER TABLE public.property_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_landlord_all" ON public.property_tags
  FOR ALL USING (auth.uid() = landlord_id OR has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = landlord_id);

CREATE TABLE IF NOT EXISTS public.property_tag_assignments (
  property_id uuid NOT NULL,
  tag_id uuid NOT NULL REFERENCES public.property_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (property_id, tag_id)
);

ALTER TABLE public.property_tag_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tag_assign_landlord_all" ON public.property_tag_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.properties p
      WHERE p.id = property_tag_assignments.property_id
        AND (p.landlord_id = auth.uid() OR has_role(auth.uid(), 'admin')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.properties p
      WHERE p.id = property_tag_assignments.property_id AND p.landlord_id = auth.uid())
  );

-- 4. Landlord team members (caretakers / managers)
CREATE TYPE public.team_member_role AS ENUM ('caretaker', 'manager');
CREATE TYPE public.team_member_status AS ENUM ('invited', 'active', 'revoked');

CREATE TABLE IF NOT EXISTS public.landlord_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  member_user_id uuid,
  member_phone text NOT NULL,
  member_name text,
  role public.team_member_role NOT NULL DEFAULT 'caretaker',
  status public.team_member_status NOT NULL DEFAULT 'invited',
  property_ids uuid[] NOT NULL DEFAULT '{}',
  invite_code text NOT NULL DEFAULT encode(extensions.gen_random_bytes(8), 'hex'),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (landlord_id, member_phone)
);

ALTER TABLE public.landlord_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_landlord_all" ON public.landlord_team_members
  FOR ALL USING (auth.uid() = landlord_id OR has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = landlord_id);

CREATE POLICY "team_member_self_select" ON public.landlord_team_members
  FOR SELECT USING (auth.uid() = member_user_id);

CREATE TRIGGER trg_team_updated BEFORE UPDATE ON public.landlord_team_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Fuliza applications
CREATE TYPE public.fuliza_app_status AS ENUM ('pending', 'approved', 'rejected', 'disbursed');

CREATE TABLE IF NOT EXISTS public.fuliza_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lease_id uuid NOT NULL,
  requested_amount integer NOT NULL,
  approved_amount integer,
  eligibility_limit integer NOT NULL,
  status public.fuliza_app_status NOT NULL DEFAULT 'pending',
  reason text,
  rejection_reason text,
  advance_id uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fuliza_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fuliza_apps_tenant_select" ON public.fuliza_applications
  FOR SELECT USING (auth.uid() = tenant_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "fuliza_apps_tenant_insert" ON public.fuliza_applications
  FOR INSERT WITH CHECK (auth.uid() = tenant_id);

CREATE TRIGGER trg_fuliza_app_updated BEFORE UPDATE ON public.fuliza_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Eligibility calculator
CREATE OR REPLACE FUNCTION public.tenant_fuliza_eligibility(_lease_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_lease public.leases%ROWTYPE;
  v_repaid int;
  v_defaults int;
  v_active_outstanding int;
  v_base_limit int;
  v_trust_multiplier numeric;
  v_eligible int;
  v_fee int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_lease FROM public.leases WHERE id = _lease_id;
  IF v_lease.id IS NULL THEN RAISE EXCEPTION 'Lease not found'; END IF;
  IF v_lease.tenant_id <> v_user AND NOT has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'Not your lease';
  END IF;

  SELECT count(*) INTO v_repaid FROM public.rent_advances
   WHERE tenant_id = v_lease.tenant_id AND status = 'repaid';
  SELECT count(*) INTO v_defaults FROM public.rent_advances
   WHERE tenant_id = v_lease.tenant_id AND status = 'written_off';
  SELECT COALESCE(SUM(outstanding),0) INTO v_active_outstanding
    FROM public.rent_advances
   WHERE tenant_id = v_lease.tenant_id AND status = 'active';

  -- Base: 50% of monthly rent, scaled by trust
  v_base_limit := v_lease.rent_amount / 2;
  v_trust_multiplier := LEAST(1.0, 0.5 + (v_repaid * 0.1) - (v_defaults * 0.3));
  IF v_trust_multiplier < 0.2 THEN v_trust_multiplier := 0.2; END IF;
  v_eligible := GREATEST(0, FLOOR(v_base_limit * v_trust_multiplier)::int - v_active_outstanding);
  v_fee := GREATEST(50, (v_eligible * 5) / 100);

  RETURN jsonb_build_object(
    'eligible_amount', v_eligible,
    'base_limit', v_base_limit,
    'trust_score', v_trust_multiplier,
    'repaid_count', v_repaid,
    'default_count', v_defaults,
    'active_outstanding', v_active_outstanding,
    'fee_estimate', v_fee,
    'rent_amount', v_lease.rent_amount,
    'has_active_advance', v_active_outstanding > 0
  );
END;
$$;

-- 7. List landlords / tenants for admin (uses existing profiles + user_roles)
CREATE OR REPLACE FUNCTION public.admin_list_users(_role app_role DEFAULT NULL)
RETURNS TABLE(
  user_id uuid, full_name text, phone text, kyc_status kyc_status,
  roles text[], created_at timestamptz,
  property_count bigint, lease_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  RETURN QUERY
  SELECT
    p.user_id, p.full_name, p.phone, p.kyc_status,
    ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.user_id),
    p.created_at,
    (SELECT count(*) FROM public.properties pr WHERE pr.landlord_id = p.user_id),
    (SELECT count(*) FROM public.leases l
       WHERE l.tenant_id = p.user_id OR l.landlord_id = p.user_id)
  FROM public.profiles p
  WHERE _role IS NULL OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.user_id AND ur.role = _role
  )
  ORDER BY p.created_at DESC
  LIMIT 500;
END;
$$;

-- 8. Admin assign role
CREATE OR REPLACE FUNCTION public.admin_assign_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, _role)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.audit_log(actor_id, action, entity_table, entity_id, meta)
  VALUES (auth.uid(), 'admin_assign_role', 'user_roles', _user_id,
          jsonb_build_object('role', _role));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  INSERT INTO public.audit_log(actor_id, action, entity_table, entity_id, meta)
  VALUES (auth.uid(), 'admin_revoke_role', 'user_roles', _user_id,
          jsonb_build_object('role', _role));
END;
$$;
