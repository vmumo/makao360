CREATE OR REPLACE FUNCTION public.apply_late_fees(_landlord_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_target uuid;
  v_row record;
  v_rule public.late_fee_rules%ROWTYPE;
  v_amount numeric(12,2);
  v_outstanding numeric(12,2);
  v_count int := 0;
  v_total numeric(14,2) := 0;
  v_entry uuid;
  v_charge uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_target := COALESCE(_landlord_id, v_user);
  IF v_target <> v_user AND NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR v_row IN
    SELECT c.id AS cycle_id, c.lease_id, c.due_date, c.target_amount, c.accumulated_amount,
           l.landlord_id, l.tenant_id, l.unit_id, u.property_id
      FROM public.rent_cycles c
      JOIN public.leases l ON l.id = c.lease_id
      JOIN public.units u ON u.id = l.unit_id
     WHERE l.landlord_id = v_target
       AND l.status = 'active'
       AND c.accumulated_amount < c.target_amount
       AND c.due_date < current_date
  LOOP
    SELECT * INTO v_rule FROM public.late_fee_rules
     WHERE landlord_id = v_target AND enabled
       AND (property_id = v_row.property_id OR property_id IS NULL)
     ORDER BY property_id NULLS LAST LIMIT 1;

    CONTINUE WHEN v_rule.id IS NULL;
    CONTINUE WHEN current_date <= v_row.due_date + v_rule.grace_days;
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.late_fee_charges f
                           WHERE f.cycle_id = v_row.cycle_id AND f.waived_at IS NULL
                             AND (v_rule.recurring_monthly = false
                                  OR f.charged_on > current_date - 30));

    v_outstanding := v_row.target_amount - v_row.accumulated_amount;
    v_amount := CASE WHEN v_rule.kind = 'fixed' THEN v_rule.amount
                     ELSE ROUND(v_outstanding * v_rule.amount / 100, 2) END;
    IF v_rule.max_cap IS NOT NULL THEN v_amount := LEAST(v_amount, v_rule.max_cap); END IF;
    CONTINUE WHEN v_amount <= 0;

    INSERT INTO public.late_fee_charges(lease_id, cycle_id, rule_id, landlord_id, tenant_id, amount)
    VALUES (v_row.lease_id, v_row.cycle_id, v_rule.id, v_target, v_row.tenant_id, v_amount)
    RETURNING id INTO v_charge;

    v_entry := public.post_journal(
      v_target, current_date, 'Late fee on overdue rent', 'late_fee',
      'late_fee_charges', v_charge, v_row.property_id, v_row.lease_id,
      jsonb_build_array(
        jsonb_build_object('code','1100','debit',v_amount,'credit',0,'description','Late fee receivable','unit_id',v_row.unit_id),
        jsonb_build_object('code','4100','debit',0,'credit',v_amount,'description','Late fee income','unit_id',v_row.unit_id)
      ));

    UPDATE public.late_fee_charges SET journal_entry_id = v_entry WHERE id = v_charge;

    INSERT INTO public.notifications(user_id, channel, title, body, payload)
    VALUES (v_row.tenant_id, 'in_app', 'Late fee applied',
            'A late fee of KES ' || v_amount || ' was added to your overdue rent.',
            jsonb_build_object('lease_id', v_row.lease_id, 'cycle_id', v_row.cycle_id));

    v_count := v_count + 1;
    v_total := v_total + v_amount;
  END LOOP;

  RETURN jsonb_build_object('charges', v_count, 'total', v_total);
END; $$;

REVOKE EXECUTE ON FUNCTION public.apply_late_fees(uuid) FROM anon;
