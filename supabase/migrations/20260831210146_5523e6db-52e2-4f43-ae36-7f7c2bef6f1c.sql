CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  cycle_id uuid UNIQUE REFERENCES public.rent_cycles(id) ON DELETE SET NULL,
  tenant_id uuid NOT NULL,
  landlord_id uuid NOT NULL,
  invoice_number text NOT NULL UNIQUE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  due_date date NOT NULL,
  amount_due integer NOT NULL,
  amount_paid integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','partial','paid','void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_lease_idx ON public.invoices(lease_id, due_date);
CREATE INDEX IF NOT EXISTS invoices_tenant_idx ON public.invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS invoices_landlord_idx ON public.invoices(landlord_id, status);

GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoices_read ON public.invoices;
CREATE POLICY invoices_read ON public.invoices
  FOR SELECT TO authenticated
  USING (
    tenant_id = auth.uid()
    OR landlord_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE FUNCTION public.tg_invoice_for_cycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lease public.leases%ROWTYPE;
BEGIN
  SELECT * INTO v_lease FROM public.leases WHERE id = NEW.lease_id;
  IF v_lease.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.invoices(lease_id, cycle_id, tenant_id, landlord_id, invoice_number,
                              period_start, period_end, due_date, amount_due, amount_paid, status)
  VALUES (NEW.lease_id, NEW.id, v_lease.tenant_id, v_lease.landlord_id,
          'INV-' || to_char(NEW.period_start, 'YYYYMM') || '-' || upper(substr(replace(NEW.id::text,'-',''), 1, 8)),
          NEW.period_start, NEW.period_end, NEW.due_date,
          NEW.target_amount, LEAST(NEW.accumulated_amount, NEW.target_amount),
          CASE WHEN NEW.accumulated_amount >= NEW.target_amount THEN 'paid'
               WHEN NEW.accumulated_amount > 0 THEN 'partial' ELSE 'open' END)
  ON CONFLICT (cycle_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_for_cycle ON public.rent_cycles;
CREATE TRIGGER invoice_for_cycle
AFTER INSERT ON public.rent_cycles
FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_for_cycle();

INSERT INTO public.invoices(lease_id, cycle_id, tenant_id, landlord_id, invoice_number,
                            period_start, period_end, due_date, amount_due, amount_paid, status)
SELECT c.lease_id, c.id, l.tenant_id, l.landlord_id,
       'INV-' || to_char(c.period_start, 'YYYYMM') || '-' || upper(substr(replace(c.id::text,'-',''), 1, 8)),
       c.period_start, c.period_end, c.due_date, c.target_amount,
       LEAST(c.accumulated_amount, c.target_amount),
       CASE WHEN c.accumulated_amount >= c.target_amount THEN 'paid'
            WHEN c.accumulated_amount > 0 THEN 'partial' ELSE 'open' END
  FROM public.rent_cycles c
  JOIN public.leases l ON l.id = c.lease_id
 WHERE c.period_start >= (current_date - interval '18 months')
ON CONFLICT (cycle_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.apply_payment_to_invoices(_lease_id uuid, _amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_left integer := _amount;
  v_inv record;
  v_apply integer;
BEGIN
  FOR v_inv IN
    SELECT * FROM public.invoices
     WHERE lease_id = _lease_id AND status IN ('open','partial')
     ORDER BY due_date ASC
  LOOP
    EXIT WHEN v_left <= 0;
    v_apply := LEAST(v_left, v_inv.amount_due - v_inv.amount_paid);
    IF v_apply <= 0 THEN CONTINUE; END IF;
    UPDATE public.invoices
       SET amount_paid = amount_paid + v_apply,
           status = CASE WHEN amount_paid + v_apply >= amount_due THEN 'paid' ELSE 'partial' END,
           updated_at = now()
     WHERE id = v_inv.id;
    v_left := v_left - v_apply;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_contribution_apply_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'success' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'success') THEN
    PERFORM public.apply_payment_to_invoices(NEW.lease_id, NEW.amount);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contribution_apply_invoice ON public.contributions;
CREATE TRIGGER contribution_apply_invoice
AFTER INSERT OR UPDATE OF status ON public.contributions
FOR EACH ROW EXECUTE FUNCTION public.tg_contribution_apply_invoice();

CREATE OR REPLACE FUNCTION public.lease_arrears(_lease_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(amount_due - amount_paid), 0)::int
    FROM public.invoices
   WHERE lease_id = _lease_id
     AND status IN ('open','partial')
     AND due_date <= current_date;
$$;

CREATE OR REPLACE FUNCTION public.landlord_create_lease(
  _unit_id uuid,
  _tenant_phone text,
  _rent_amount integer,
  _deposit_amount integer DEFAULT 0,
  _rent_due_day integer DEFAULT 5,
  _start_date date DEFAULT current_date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_landlord uuid;
  v_tenant uuid;
  v_lease uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _rent_amount < 1 THEN RAISE EXCEPTION 'Rent amount must be greater than zero'; END IF;

  SELECT p.landlord_id INTO v_landlord
    FROM public.units u JOIN public.properties p ON p.id = u.property_id
   WHERE u.id = _unit_id;
  IF v_landlord IS NULL THEN RAISE EXCEPTION 'Unit not found'; END IF;
  IF v_landlord <> v_user AND NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'You do not manage this unit';
  END IF;

  IF EXISTS (SELECT 1 FROM public.leases WHERE unit_id = _unit_id AND status IN ('active','pending')) THEN
    RAISE EXCEPTION 'This unit already has an active lease';
  END IF;

  SELECT user_id INTO v_tenant FROM public.profiles
   WHERE regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g') = regexp_replace(_tenant_phone, '[^0-9]', '', 'g')
   LIMIT 1;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No Makao360 account uses %. Send them an invite instead.', _tenant_phone;
  END IF;

  INSERT INTO public.leases(unit_id, tenant_id, landlord_id, rent_amount, deposit_amount,
                            rent_due_day, start_date, status)
  VALUES (_unit_id, v_tenant, v_landlord, _rent_amount, COALESCE(_deposit_amount,0),
          COALESCE(_rent_due_day,5), COALESCE(_start_date, current_date), 'active')
  RETURNING id INTO v_lease;

  UPDATE public.units SET status = 'occupied', updated_at = now() WHERE id = _unit_id;

  INSERT INTO public.user_roles(user_id, role) VALUES (v_tenant, 'tenant')
  ON CONFLICT DO NOTHING;

  PERFORM public.ensure_open_cycle(v_lease);

  INSERT INTO public.notifications(user_id, channel, title, body, payload)
  VALUES (v_tenant, 'in_app', 'Your lease is active',
          'A lease was created for you. Open Makao360 to see your rent schedule.',
          jsonb_build_object('lease_id', v_lease));

  INSERT INTO public.audit_log(actor_id, action, entity_table, entity_id, meta)
  VALUES (v_user, 'lease.create', 'leases', v_lease,
          jsonb_build_object('unit_id', _unit_id, 'tenant_id', v_tenant, 'rent', _rent_amount));

  RETURN v_lease;
END;
$$;

CREATE OR REPLACE FUNCTION public.landlord_record_payment(
  _lease_id uuid,
  _amount integer,
  _source text DEFAULT 'cash',
  _reference text DEFAULT NULL,
  _paid_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_lease public.leases%ROWTYPE;
  v_cycle uuid;
  v_contrib uuid;
  v_balance integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount < 1 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;

  SELECT * INTO v_lease FROM public.leases WHERE id = _lease_id;
  IF v_lease.id IS NULL THEN RAISE EXCEPTION 'Lease not found'; END IF;
  IF v_lease.landlord_id <> v_user AND NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'Not authorized for this lease';
  END IF;

  v_cycle := public.ensure_open_cycle(_lease_id);

  INSERT INTO public.contributions(lease_id, cycle_id, tenant_id, amount, source, status,
                                   external_ref, contributed_at, reconciled_at, reconciled_by,
                                   reconciliation_note)
  VALUES (_lease_id, v_cycle, v_lease.tenant_id, _amount, _source::public.contribution_source,
          'success', _reference, COALESCE(_paid_at, now()), now(), v_user,
          'Recorded by landlord')
  RETURNING id INTO v_contrib;

  UPDATE public.rent_cycles
     SET accumulated_amount = accumulated_amount + _amount,
         status = CASE WHEN accumulated_amount + _amount >= target_amount THEN 'completed'::public.cycle_status
                       ELSE 'partial'::public.cycle_status END,
         closed_at = CASE WHEN accumulated_amount + _amount >= target_amount THEN now() ELSE closed_at END
   WHERE id = v_cycle;

  SELECT COALESCE((SELECT balance_after FROM public.ledger_entries
                   WHERE lease_id = _lease_id ORDER BY created_at DESC LIMIT 1), 0)
    INTO v_balance;
  INSERT INTO public.ledger_entries(lease_id, entry_type, amount, balance_after,
                                    ref_table, ref_id, description, created_by)
  VALUES (_lease_id, 'contribution', _amount, v_balance + _amount, 'contributions', v_contrib,
          'Payment recorded by landlord (' || _source || ')', v_user);

  INSERT INTO public.notifications(user_id, channel, title, body, payload)
  VALUES (v_lease.tenant_id, 'in_app', 'Payment recorded',
          'Your landlord recorded a payment of KES ' || _amount || '.',
          jsonb_build_object('lease_id', _lease_id, 'contribution_id', v_contrib));

  INSERT INTO public.audit_log(actor_id, action, entity_table, entity_id, meta)
  VALUES (v_user, 'payment.record', 'contributions', v_contrib,
          jsonb_build_object('lease_id', _lease_id, 'amount', _amount, 'source', _source));

  RETURN v_contrib;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_data_access(
  _entity_table text,
  _entity_id uuid DEFAULT NULL,
  _action text DEFAULT 'view',
  _meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;
  INSERT INTO public.audit_log(actor_id, action, entity_table, entity_id, meta)
  VALUES (v_user, _action, _entity_table, _entity_id, COALESCE(_meta, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_access_log(
  _limit integer DEFAULT 300,
  _search text DEFAULT NULL,
  _entity text DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL
)
RETURNS TABLE(
  id uuid, created_at timestamptz, action text, entity_table text, entity_id uuid,
  actor_id uuid, actor_name text, actor_phone text, meta jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  RETURN QUERY
  SELECT a.id, a.created_at, a.action, a.entity_table, a.entity_id,
         a.actor_id, p.full_name, p.phone, a.meta
    FROM public.audit_log a
    LEFT JOIN public.profiles p ON p.user_id = a.actor_id
   WHERE (_entity IS NULL OR a.entity_table = _entity)
     AND (_from IS NULL OR a.created_at >= _from)
     AND (_to IS NULL OR a.created_at <= _to)
     AND (_search IS NULL OR _search = '' OR
          a.action ILIKE '%'||_search||'%' OR
          COALESCE(p.full_name,'') ILIKE '%'||_search||'%' OR
          COALESCE(p.phone,'') ILIKE '%'||_search||'%' OR
          COALESCE(a.entity_table,'') ILIKE '%'||_search||'%')
   ORDER BY a.created_at DESC
   LIMIT GREATEST(1, LEAST(_limit, 1000));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_property_activity(_property_id uuid, _limit integer DEFAULT 100)
RETURNS TABLE(occurred_at timestamptz, kind text, title text, detail text, actor_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  RETURN QUERY
  WITH unit_ids AS (SELECT id, label FROM public.units WHERE property_id = _property_id),
  lease_ids AS (
    SELECT l.id, l.tenant_id, u.label FROM public.leases l JOIN unit_ids u ON u.id = l.unit_id
  ),
  events AS (
    SELECT l2.created_at AS occurred_at, 'lease'::text AS kind,
           'Lease started · Unit ' || li.label AS title,
           'Rent KES ' || l2.rent_amount AS detail,
           (SELECT full_name FROM public.profiles WHERE user_id = l2.tenant_id) AS actor_name
      FROM public.leases l2 JOIN lease_ids li ON li.id = l2.id
    UNION ALL
    SELECT c.contributed_at, 'payment',
           'Payment ' || c.status::text || ' · Unit ' || li.label,
           'KES ' || c.amount || ' via ' || c.source::text,
           (SELECT full_name FROM public.profiles WHERE user_id = c.tenant_id)
      FROM public.contributions c JOIN lease_ids li ON li.id = c.lease_id
    UNION ALL
    SELECT a.created_at, 'access', a.action,
           COALESCE(a.entity_table,'') || ' ' || COALESCE(a.entity_id::text,''),
           (SELECT full_name FROM public.profiles WHERE user_id = a.actor_id)
      FROM public.audit_log a
     WHERE a.entity_id = _property_id
        OR a.entity_id IN (SELECT id FROM unit_ids)
        OR a.entity_id IN (SELECT id FROM lease_ids)
  )
  SELECT * FROM events ORDER BY occurred_at DESC LIMIT GREATEST(1, LEAST(_limit, 500));
END;
$$;

REVOKE ALL ON FUNCTION public.apply_payment_to_invoices(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_invoice_for_cycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_contribution_apply_invoice() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.lease_arrears(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.landlord_create_lease(uuid, text, integer, integer, integer, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.landlord_record_payment(uuid, integer, text, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_data_access(text, uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_access_log(integer, text, text, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_property_activity(uuid, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.lease_arrears(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.landlord_create_lease(uuid, text, integer, integer, integer, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.landlord_record_payment(uuid, integer, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_data_access(text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_access_log(integer, text, text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_property_activity(uuid, integer) TO authenticated;