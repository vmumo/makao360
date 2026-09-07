
-- Rent Fuliza: short-term tenant rent advance
CREATE TYPE public.fuliza_status AS ENUM ('active', 'repaid', 'written_off', 'cancelled');

CREATE TABLE public.rent_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  landlord_id uuid NOT NULL,
  cycle_id uuid,
  principal integer NOT NULL CHECK (principal > 0),
  fee integer NOT NULL DEFAULT 0,
  outstanding integer NOT NULL,
  status public.fuliza_status NOT NULL DEFAULT 'active',
  due_date date NOT NULL,
  reason text,
  approved_by uuid,
  approved_at timestamptz,
  repaid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rent_advances_tenant ON public.rent_advances(tenant_id);
CREATE INDEX idx_rent_advances_lease ON public.rent_advances(lease_id);
CREATE INDEX idx_rent_advances_status ON public.rent_advances(status);

ALTER TABLE public.rent_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advances_party_select" ON public.rent_advances
FOR SELECT USING (
  auth.uid() = tenant_id OR auth.uid() = landlord_id OR has_role(auth.uid(), 'admin')
);

CREATE TRIGGER trg_rent_advances_touch
BEFORE UPDATE ON public.rent_advances
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Allow ledger entry_type 'advance' & 'advance_repayment' if enum exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_entry_type') THEN
    BEGIN
      ALTER TYPE public.ledger_entry_type ADD VALUE IF NOT EXISTS 'advance';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      ALTER TYPE public.ledger_entry_type ADD VALUE IF NOT EXISTS 'advance_repayment';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- Request fuliza: tenant borrows against open cycle
CREATE OR REPLACE FUNCTION public.request_rent_fuliza(
  _lease_id uuid,
  _amount integer,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_lease public.leases%ROWTYPE;
  v_cycle uuid;
  v_due date;
  v_fee int;
  v_active int;
  v_max int;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount < 1 THEN RAISE EXCEPTION 'Amount must be > 0'; END IF;

  SELECT * INTO v_lease FROM public.leases WHERE id = _lease_id;
  IF v_lease.id IS NULL THEN RAISE EXCEPTION 'Lease not found'; END IF;
  IF v_lease.tenant_id <> v_user THEN RAISE EXCEPTION 'Not your lease'; END IF;

  -- Cap = 50% of monthly rent
  v_max := (v_lease.rent_amount / 2);
  IF _amount > v_max THEN
    RAISE EXCEPTION 'Advance limit is KES %', v_max;
  END IF;

  -- Disallow concurrent active advances on same lease
  SELECT count(*) INTO v_active FROM public.rent_advances
   WHERE lease_id = _lease_id AND status = 'active';
  IF v_active > 0 THEN
    RAISE EXCEPTION 'You already have an active advance on this lease';
  END IF;

  v_cycle := public.ensure_open_cycle(_lease_id);
  v_due := (current_date + interval '14 days')::date;
  v_fee := GREATEST(50, (_amount * 5) / 100); -- 5% fee, min KES 50

  INSERT INTO public.rent_advances(
    lease_id, tenant_id, landlord_id, cycle_id,
    principal, fee, outstanding, due_date, reason,
    approved_by, approved_at, status
  ) VALUES (
    _lease_id, v_user, v_lease.landlord_id, v_cycle,
    _amount, v_fee, _amount + v_fee, v_due, _reason,
    v_user, now(), 'active'
  ) RETURNING id INTO v_id;

  -- Auto-credit cycle as success contribution from "fuliza"
  PERFORM public.record_fuliza_contribution(v_id);

  -- Notify landlord
  INSERT INTO public.notifications(user_id, channel, title, body, payload)
  VALUES (v_lease.landlord_id, 'in_app', 'Tenant took a rent advance',
          'KES ' || _amount || ' fronted via Rent Fuliza. Due ' || to_char(v_due, 'DD Mon'),
          jsonb_build_object('lease_id', _lease_id, 'advance_id', v_id));

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_rent_fuliza(uuid, integer, text) FROM anon;

-- Internal helper: credit cycle from advance
CREATE OR REPLACE FUNCTION public.record_fuliza_contribution(_advance_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adv public.rent_advances%ROWTYPE;
  v_contrib uuid;
  v_balance int;
  v_receipt text;
BEGIN
  SELECT * INTO v_adv FROM public.rent_advances WHERE id = _advance_id;
  IF v_adv.id IS NULL THEN RAISE EXCEPTION 'Advance not found'; END IF;

  v_receipt := 'FULIZA-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  INSERT INTO public.contributions(
    tenant_id, lease_id, cycle_id, amount, source, status,
    payer_phone, mpesa_receipt, note
  ) VALUES (
    v_adv.tenant_id, v_adv.lease_id, v_adv.cycle_id, v_adv.principal,
    'mpesa_stk', 'success', NULL, v_receipt,
    'Rent Fuliza advance #' || left(v_adv.id::text, 8)
  ) RETURNING id INTO v_contrib;

  SELECT COALESCE((SELECT balance_after FROM public.ledger_entries
                   WHERE lease_id = v_adv.lease_id ORDER BY created_at DESC LIMIT 1), 0)
    INTO v_balance;
  INSERT INTO public.ledger_entries(lease_id, entry_type, amount, balance_after,
                                    ref_table, ref_id, description, created_by)
  VALUES (v_adv.lease_id, 'contribution', v_adv.principal,
          v_balance + v_adv.principal, 'rent_advances', v_adv.id,
          'Rent Fuliza advance ' || v_receipt, v_adv.tenant_id);

  RETURN v_contrib;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_fuliza_contribution(uuid) FROM anon, authenticated;

-- Repay fuliza: deducts principal+fee from outstanding balance
CREATE OR REPLACE FUNCTION public.repay_rent_fuliza(_advance_id uuid, _amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_adv public.rent_advances%ROWTYPE;
  v_pay int;
  v_new_outstanding int;
  v_status public.fuliza_status;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount < 1 THEN RAISE EXCEPTION 'Amount must be > 0'; END IF;

  SELECT * INTO v_adv FROM public.rent_advances WHERE id = _advance_id;
  IF v_adv.id IS NULL THEN RAISE EXCEPTION 'Advance not found'; END IF;
  IF v_adv.tenant_id <> v_user THEN RAISE EXCEPTION 'Not your advance'; END IF;
  IF v_adv.status <> 'active' THEN RAISE EXCEPTION 'Advance is not active'; END IF;

  v_pay := LEAST(_amount, v_adv.outstanding);
  v_new_outstanding := v_adv.outstanding - v_pay;
  v_status := CASE WHEN v_new_outstanding <= 0 THEN 'repaid'::public.fuliza_status
                   ELSE 'active'::public.fuliza_status END;

  UPDATE public.rent_advances
     SET outstanding = v_new_outstanding,
         status = v_status,
         repaid_at = CASE WHEN v_status = 'repaid' THEN now() ELSE repaid_at END
   WHERE id = _advance_id;

  IF v_status = 'repaid' THEN
    INSERT INTO public.notifications(user_id, channel, title, body, payload)
    VALUES (v_adv.landlord_id, 'in_app', 'Rent advance repaid',
            'Tenant cleared their KES ' || v_adv.principal || ' Rent Fuliza.',
            jsonb_build_object('lease_id', v_adv.lease_id, 'advance_id', _advance_id));
  END IF;

  RETURN jsonb_build_object(
    'paid', v_pay,
    'remaining', v_new_outstanding,
    'status', v_status
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.repay_rent_fuliza(uuid, integer) FROM anon;
