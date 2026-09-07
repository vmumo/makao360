-- 1. Ledger consistency check
CREATE OR REPLACE FUNCTION public.admin_ledger_consistency()
RETURNS TABLE(
  lease_id uuid,
  tenant_id uuid,
  landlord_id uuid,
  expected_balance bigint,
  ledger_balance bigint,
  drift bigint,
  contributions_total bigint,
  payouts_total bigint,
  last_ledger_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  WITH contrib AS (
    SELECT lease_id, COALESCE(SUM(amount),0)::bigint AS total
      FROM public.contributions WHERE status = 'success' GROUP BY lease_id
  ),
  pay AS (
    SELECT lease_id, COALESCE(SUM(amount),0)::bigint AS total
      FROM public.payouts WHERE status = 'paid' GROUP BY lease_id
  ),
  led AS (
    SELECT DISTINCT ON (lease_id) lease_id, balance_after::bigint AS bal, created_at
      FROM public.ledger_entries
      ORDER BY lease_id, created_at DESC
  )
  SELECT
    l.id,
    l.tenant_id,
    l.landlord_id,
    (COALESCE(c.total,0) - COALESCE(p.total,0))::bigint AS expected_balance,
    COALESCE(led.bal, 0)::bigint AS ledger_balance,
    (COALESCE(led.bal,0) - (COALESCE(c.total,0) - COALESCE(p.total,0)))::bigint AS drift,
    COALESCE(c.total,0)::bigint,
    COALESCE(p.total,0)::bigint,
    led.created_at
  FROM public.leases l
  LEFT JOIN contrib c ON c.lease_id = l.id
  LEFT JOIN pay p ON p.lease_id = l.id
  LEFT JOIN led ON led.lease_id = l.id
  WHERE COALESCE(led.bal,0) <> (COALESCE(c.total,0) - COALESCE(p.total,0))
  ORDER BY ABS(COALESCE(led.bal,0) - (COALESCE(c.total,0) - COALESCE(p.total,0))) DESC
  LIMIT 500;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_ledger_consistency() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ledger_consistency() TO authenticated;

-- 2. Wipe demo data (keeps auth users + profiles + roles + feature flags + audit log)
CREATE OR REPLACE FUNCTION public.admin_wipe_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n int;
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  DELETE FROM public.notifications;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_result := v_result || jsonb_build_object('notifications', v_n);

  DELETE FROM public.ledger_entries;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_result := v_result || jsonb_build_object('ledger_entries', v_n);

  DELETE FROM public.contributions;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_result := v_result || jsonb_build_object('contributions', v_n);

  DELETE FROM public.payouts;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_result := v_result || jsonb_build_object('payouts', v_n);

  DELETE FROM public.rent_cycles;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_result := v_result || jsonb_build_object('rent_cycles', v_n);

  DELETE FROM public.leases;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_result := v_result || jsonb_build_object('leases', v_n);

  DELETE FROM public.tenant_invites;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_result := v_result || jsonb_build_object('tenant_invites', v_n);

  DELETE FROM public.units;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_result := v_result || jsonb_build_object('units', v_n);

  DELETE FROM public.properties;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_result := v_result || jsonb_build_object('properties', v_n);

  INSERT INTO public.audit_log(actor_id, action, entity_table, meta)
  VALUES (auth.uid(), 'admin_wipe_demo_data', NULL, v_result);

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_wipe_demo_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_wipe_demo_data() TO authenticated;

-- 3. Top up: open a fresh cycle for every active lease that doesn't have one
CREATE OR REPLACE FUNCTION public.admin_topup_open_cycles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lease record;
  v_count int := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  FOR v_lease IN
    SELECT l.id FROM public.leases l
    WHERE l.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.rent_cycles c
        WHERE c.lease_id = l.id AND c.status IN ('open','partial')
      )
  LOOP
    PERFORM public.ensure_open_cycle(v_lease.id);
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.audit_log(actor_id, action, entity_table, meta)
  VALUES (auth.uid(), 'admin_topup_open_cycles', 'rent_cycles',
          jsonb_build_object('opened', v_count));

  RETURN jsonb_build_object('opened', v_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_topup_open_cycles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_topup_open_cycles() TO authenticated;

-- 4. Backfill in-app notifications for existing contributions/payouts
CREATE OR REPLACE FUNCTION public.admin_backfill_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrib int := 0;
  v_payout int := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  -- Contributions -> notify landlord (only if no existing notification for this contribution)
  WITH inserted AS (
    INSERT INTO public.notifications(user_id, channel, title, body, payload)
    SELECT l.landlord_id, 'in_app',
           CASE WHEN c.status = 'success' THEN 'New rent contribution'
                WHEN c.status = 'pending' THEN 'Pending bank transfer'
                ELSE 'Contribution update' END,
           'KES ' || c.amount || ' from tenant.',
           jsonb_build_object('lease_id', l.id, 'contribution_id', c.id)
    FROM public.contributions c
    JOIN public.leases l ON l.id = c.lease_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = l.landlord_id
        AND n.payload->>'contribution_id' = c.id::text
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_contrib FROM inserted;

  -- Payouts -> notify tenant
  WITH inserted AS (
    INSERT INTO public.notifications(user_id, channel, title, body, payload)
    SELECT l.tenant_id, 'in_app', 'Rent paid out to landlord',
           'KES ' || p.amount || ' was paid out.',
           jsonb_build_object('lease_id', l.id, 'payout_id', p.id)
    FROM public.payouts p
    JOIN public.leases l ON l.id = p.lease_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = l.tenant_id
        AND n.payload->>'payout_id' = p.id::text
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_payout FROM inserted;

  INSERT INTO public.audit_log(actor_id, action, entity_table, meta)
  VALUES (auth.uid(), 'admin_backfill_notifications', 'notifications',
          jsonb_build_object('contribution_notifs', v_contrib, 'payout_notifs', v_payout));

  RETURN jsonb_build_object('contribution_notifs', v_contrib, 'payout_notifs', v_payout);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_backfill_notifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_backfill_notifications() TO authenticated;

-- 5. Audit trail view for reconciliation: expose existing reconciled rows joined with profiles
CREATE OR REPLACE FUNCTION public.list_reconciliation_audit(_limit int DEFAULT 200)
RETURNS TABLE(
  contribution_id uuid,
  amount integer,
  source contribution_source,
  status contribution_status,
  reconciled_at timestamptz,
  reconciled_by uuid,
  reconciled_by_name text,
  reconciliation_note text,
  tenant_id uuid,
  tenant_name text,
  lease_id uuid,
  unit_label text,
  property_name text,
  external_ref text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  RETURN QUERY
  SELECT
    c.id, c.amount, c.source, c.status,
    c.reconciled_at, c.reconciled_by,
    rp.full_name,
    c.reconciliation_note,
    c.tenant_id, tp.full_name,
    c.lease_id, u.label, p.name,
    c.external_ref
  FROM public.contributions c
  JOIN public.leases l ON l.id = c.lease_id
  LEFT JOIN public.units u ON u.id = l.unit_id
  LEFT JOIN public.properties p ON p.id = u.property_id
  LEFT JOIN public.profiles tp ON tp.user_id = c.tenant_id
  LEFT JOIN public.profiles rp ON rp.user_id = c.reconciled_by
  WHERE c.reconciled_at IS NOT NULL
    AND (l.landlord_id = v_user OR has_role(v_user, 'admin'))
  ORDER BY c.reconciled_at DESC
  LIMIT GREATEST(LEAST(_limit, 1000), 1);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_reconciliation_audit(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_reconciliation_audit(int) TO authenticated;
