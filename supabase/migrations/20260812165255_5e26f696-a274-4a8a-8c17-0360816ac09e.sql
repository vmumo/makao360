-- ============================================================
-- BATCH 1 (part 2): accounting engine
-- ============================================================

-- resolve a system/landlord account id by code
CREATE OR REPLACE FUNCTION public.gl_account_id(_landlord uuid, _code text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.gl_accounts
   WHERE code = _code AND (landlord_id = _landlord OR landlord_id IS NULL)
   ORDER BY landlord_id NULLS LAST LIMIT 1;
$$;

-- generic balanced journal poster
-- _lines: [{"code":"1000","debit":100,"credit":0,"description":"...","property_id":null,"unit_id":null,"lease_id":null}]
CREATE OR REPLACE FUNCTION public.post_journal(
  _landlord uuid, _date date, _memo text, _source public.journal_source,
  _source_table text, _source_id uuid, _property uuid, _lease uuid, _lines jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_entry uuid; v_line jsonb; v_acct uuid;
BEGIN
  IF _landlord IS NULL THEN RAISE EXCEPTION 'Landlord required for journal'; END IF;

  INSERT INTO public.journal_entries(landlord_id, entry_date, memo, source, source_table,
                                     source_id, property_id, lease_id, posted_by)
  VALUES (_landlord, COALESCE(_date, current_date), _memo, _source, _source_table,
          _source_id, _property, _lease, auth.uid())
  RETURNING id INTO v_entry;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    v_acct := public.gl_account_id(_landlord, v_line->>'code');
    IF v_acct IS NULL THEN RAISE EXCEPTION 'Unknown account code %', v_line->>'code'; END IF;
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description,
                                     property_id, unit_id, lease_id)
    VALUES (v_entry, v_acct,
            COALESCE((v_line->>'debit')::numeric, 0),
            COALESCE((v_line->>'credit')::numeric, 0),
            v_line->>'description',
            COALESCE(NULLIF(v_line->>'property_id','')::uuid, _property),
            NULLIF(v_line->>'unit_id','')::uuid,
            COALESCE(NULLIF(v_line->>'lease_id','')::uuid, _lease));
  END LOOP;

  RETURN v_entry;
END; $$;

-- ---------- auto-post contributions ----------
CREATE OR REPLACE FUNCTION public.gl_post_contribution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_lease public.leases%ROWTYPE; v_prop uuid;
BEGIN
  IF NEW.status <> 'success' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'success' THEN RETURN NEW; END IF;

  SELECT * INTO v_lease FROM public.leases WHERE id = NEW.lease_id;
  IF v_lease.id IS NULL THEN RETURN NEW; END IF;
  SELECT property_id INTO v_prop FROM public.units WHERE id = v_lease.unit_id;

  PERFORM public.post_journal(
    v_lease.landlord_id, NEW.contributed_at::date,
    'Rent received ' || COALESCE(NEW.mpesa_receipt, NEW.external_ref, ''),
    'contribution', 'contributions', NEW.id, v_prop, NEW.lease_id,
    jsonb_build_array(
      jsonb_build_object('code','1000','debit',NEW.amount,'credit',0,'description','Cash received','unit_id',v_lease.unit_id),
      jsonb_build_object('code','4000','debit',0,'credit',NEW.amount,'description','Rent income','unit_id',v_lease.unit_id)
    ));
  RETURN NEW;
END; $$;

CREATE TRIGGER contributions_gl_post
  AFTER INSERT OR UPDATE OF status ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.gl_post_contribution();

-- ---------- auto-post payouts ----------
CREATE OR REPLACE FUNCTION public.gl_post_payout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_lease public.leases%ROWTYPE; v_prop uuid;
BEGIN
  IF NEW.status <> 'paid' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' THEN RETURN NEW; END IF;

  SELECT * INTO v_lease FROM public.leases WHERE id = NEW.lease_id;
  SELECT property_id INTO v_prop FROM public.units WHERE id = v_lease.unit_id;

  PERFORM public.post_journal(
    NEW.landlord_id, COALESCE(NEW.paid_at::date, current_date),
    'Payout to owner ' || COALESCE(NEW.mpesa_receipt,''),
    'payout', 'payouts', NEW.id, v_prop, NEW.lease_id,
    jsonb_build_array(
      jsonb_build_object('code','3000','debit',NEW.amount,'credit',0,'description','Owner drawings'),
      jsonb_build_object('code','1000','debit',0,'credit',NEW.amount,'description','Cash paid out')
    ));
  RETURN NEW;
END; $$;

CREATE TRIGGER payouts_gl_post
  AFTER INSERT OR UPDATE OF status ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.gl_post_payout();

-- ---------- auto-post expenses ----------
CREATE OR REPLACE FUNCTION public.gl_post_expense()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_code text; v_entry uuid;
BEGIN
  IF NEW.status NOT IN ('approved','paid') THEN RETURN NEW; END IF;
  IF NEW.journal_entry_id IS NOT NULL THEN RETURN NEW; END IF;

  v_code := CASE NEW.category
    WHEN 'repairs' THEN '5000' WHEN 'utilities' THEN '5100' WHEN 'security' THEN '5200'
    WHEN 'cleaning' THEN '5300' WHEN 'insurance' THEN '5400' WHEN 'levies' THEN '5500'
    WHEN 'legal' THEN '5600' WHEN 'staff' THEN '5700' WHEN 'management' THEN '5800'
    WHEN 'marketing' THEN '5900' ELSE '6000' END;

  v_entry := public.post_journal(
    NEW.landlord_id, NEW.expense_date,
    COALESCE(NEW.vendor_name || ' — ', '') || NEW.description,
    'expense', 'expenses', NEW.id, NEW.property_id, NULL,
    jsonb_build_array(
      jsonb_build_object('code',v_code,'debit',NEW.amount,'credit',0,'description',NEW.description,'unit_id',NEW.unit_id),
      jsonb_build_object('code','1000','debit',0,'credit',NEW.amount,'description','Paid from cash')
    ));

  UPDATE public.expenses SET journal_entry_id = v_entry WHERE id = NEW.id;
  RETURN NEW;
END; $$;

CREATE TRIGGER expenses_gl_post
  AFTER INSERT OR UPDATE OF status ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.gl_post_expense();

-- ---------- late fee run ----------
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
  v_prop uuid;
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

    v_prop := v_row.property_id;
    v_entry := public.post_journal(
      v_target, current_date, 'Late fee on overdue rent', 'late_fee',
      'late_fee_charges', NULL, v_prop, v_row.lease_id,
      jsonb_build_array(
        jsonb_build_object('code','1100','debit',v_amount,'credit',0,'description','Late fee receivable','unit_id',v_row.unit_id),
        jsonb_build_object('code','4100','debit',0,'credit',v_amount,'description','Late fee income','unit_id',v_row.unit_id)
      ));

    INSERT INTO public.late_fee_charges(lease_id, cycle_id, rule_id, landlord_id, tenant_id,
                                        amount, journal_entry_id)
    VALUES (v_row.lease_id, v_row.cycle_id, v_rule.id, v_target, v_row.tenant_id,
            v_amount, v_entry);

    UPDATE public.journal_entries SET source_id = currval(pg_get_serial_sequence('public.late_fee_charges','id'))::uuid
     WHERE false; -- no-op guard (uuid pk has no sequence)

    INSERT INTO public.notifications(user_id, channel, title, body, payload)
    VALUES (v_row.tenant_id, 'in_app', 'Late fee applied',
            'A late fee of KES ' || v_amount || ' was added to your overdue rent.',
            jsonb_build_object('lease_id', v_row.lease_id, 'cycle_id', v_row.cycle_id));

    v_count := v_count + 1;
    v_total := v_total + v_amount;
  END LOOP;

  RETURN jsonb_build_object('charges', v_count, 'total', v_total);
END; $$;

CREATE OR REPLACE FUNCTION public.waive_late_fee(_charge_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid := auth.uid(); v_c public.late_fee_charges%ROWTYPE; v_prop uuid;
BEGIN
  SELECT * INTO v_c FROM public.late_fee_charges WHERE id = _charge_id;
  IF v_c.id IS NULL THEN RAISE EXCEPTION 'Charge not found'; END IF;
  IF v_c.landlord_id <> v_user AND NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_c.waived_at IS NOT NULL THEN RAISE EXCEPTION 'Already waived'; END IF;

  SELECT u.property_id INTO v_prop FROM public.leases l JOIN public.units u ON u.id = l.unit_id
   WHERE l.id = v_c.lease_id;

  PERFORM public.post_journal(
    v_c.landlord_id, current_date, 'Late fee waived: ' || COALESCE(_reason,''),
    'adjustment', 'late_fee_charges', _charge_id, v_prop, v_c.lease_id,
    jsonb_build_array(
      jsonb_build_object('code','4100','debit',v_c.amount,'credit',0,'description','Late fee reversed'),
      jsonb_build_object('code','1100','debit',0,'credit',v_c.amount,'description','Receivable cleared')
    ));

  UPDATE public.late_fee_charges
     SET waived_at = now(), waived_by = v_user, waive_reason = _reason
   WHERE id = _charge_id;
END; $$;

-- ---------- bank matching ----------
CREATE OR REPLACE FUNCTION public.auto_match_bank_transactions(_import_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_imp public.bank_statement_imports%ROWTYPE;
  v_txn record; v_contrib uuid; v_matched int := 0;
BEGIN
  SELECT * INTO v_imp FROM public.bank_statement_imports WHERE id = _import_id;
  IF v_imp.id IS NULL THEN RAISE EXCEPTION 'Import not found'; END IF;
  IF v_imp.landlord_id <> v_user AND NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR v_txn IN SELECT * FROM public.bank_transactions
                WHERE import_id = _import_id AND status = 'unmatched' AND amount > 0
  LOOP
    SELECT c.id INTO v_contrib
      FROM public.contributions c
      JOIN public.leases l ON l.id = c.lease_id
     WHERE l.landlord_id = v_imp.landlord_id
       AND c.amount = ROUND(v_txn.amount)::int
       AND NOT EXISTS (SELECT 1 FROM public.bank_transactions b
                        WHERE b.matched_contribution_id = c.id)
       AND (
         (v_txn.reference IS NOT NULL AND (c.mpesa_receipt = v_txn.reference OR c.external_ref = v_txn.reference))
         OR (v_txn.counterparty_phone IS NOT NULL AND c.payer_phone = v_txn.counterparty_phone)
       )
       AND ABS(c.contributed_at::date - v_txn.txn_date) <= 3
     ORDER BY ABS(c.contributed_at::date - v_txn.txn_date)
     LIMIT 1;

    IF v_contrib IS NOT NULL THEN
      UPDATE public.bank_transactions
         SET status = 'matched', matched_contribution_id = v_contrib,
             matched_lease_id = (SELECT lease_id FROM public.contributions WHERE id = v_contrib),
             matched_by = v_user, matched_at = now()
       WHERE id = v_txn.id;
      v_matched := v_matched + 1;
    END IF;
    v_contrib := NULL;
  END LOOP;

  UPDATE public.bank_statement_imports
     SET matched_count = (SELECT count(*) FROM public.bank_transactions
                           WHERE import_id = _import_id AND status = 'matched')
   WHERE id = _import_id;

  RETURN jsonb_build_object('matched', v_matched);
END; $$;

CREATE OR REPLACE FUNCTION public.match_bank_transaction(_txn_id uuid, _contribution_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid := auth.uid(); v_t public.bank_transactions%ROWTYPE;
BEGIN
  SELECT * INTO v_t FROM public.bank_transactions WHERE id = _txn_id;
  IF v_t.id IS NULL THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF v_t.landlord_id <> v_user AND NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.bank_transactions
     SET status = 'matched', matched_contribution_id = _contribution_id,
         matched_lease_id = (SELECT lease_id FROM public.contributions WHERE id = _contribution_id),
         matched_by = v_user, matched_at = now()
   WHERE id = _txn_id;
END; $$;

-- ---------- owner statement ----------
CREATE OR REPLACE FUNCTION public.generate_owner_statement(
  _landlord_id uuid, _period_start date, _property_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_start date := date_trunc('month', _period_start)::date;
  v_end date := (date_trunc('month', _period_start) + interval '1 month - 1 day')::date;
  v_gross numeric(14,2); v_other numeric(14,2); v_exp numeric(14,2);
  v_mgmt numeric(14,2); v_wht numeric(14,2); v_net numeric(14,2); v_arrears numeric(14,2);
  v_set public.landlord_tax_settings%ROWTYPE;
  v_id uuid; v_breakdown jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _landlord_id <> v_user AND NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_set FROM public.landlord_tax_settings WHERE landlord_id = _landlord_id;

  SELECT COALESCE(SUM(c.amount),0) INTO v_gross
    FROM public.contributions c
    JOIN public.leases l ON l.id = c.lease_id
    JOIN public.units u ON u.id = l.unit_id
   WHERE l.landlord_id = _landlord_id AND c.status = 'success'
     AND c.contributed_at::date BETWEEN v_start AND v_end
     AND (_property_id IS NULL OR u.property_id = _property_id);

  SELECT COALESCE(SUM(f.amount),0) INTO v_other
    FROM public.late_fee_charges f
    JOIN public.leases l ON l.id = f.lease_id
    JOIN public.units u ON u.id = l.unit_id
   WHERE f.landlord_id = _landlord_id AND f.waived_at IS NULL
     AND f.charged_on BETWEEN v_start AND v_end
     AND (_property_id IS NULL OR u.property_id = _property_id);

  SELECT COALESCE(SUM(e.amount),0) INTO v_exp
    FROM public.expenses e
   WHERE e.landlord_id = _landlord_id AND e.status IN ('approved','paid')
     AND e.expense_date BETWEEN v_start AND v_end
     AND (_property_id IS NULL OR e.property_id = _property_id);

  v_mgmt := ROUND(v_gross * COALESCE(v_set.management_fee_rate, 0) / 100, 2);
  v_wht  := ROUND(v_gross * COALESCE(v_set.wht_rate, 7.5) / 100, 2);
  v_net  := v_gross + v_other - v_exp - v_mgmt - v_wht;

  SELECT COALESCE(SUM(GREATEST(0, c.target_amount - c.accumulated_amount)),0) INTO v_arrears
    FROM public.rent_cycles c
    JOIN public.leases l ON l.id = c.lease_id
    JOIN public.units u ON u.id = l.unit_id
   WHERE l.landlord_id = _landlord_id AND c.period_start <= v_end
     AND (_property_id IS NULL OR u.property_id = _property_id);

  SELECT jsonb_build_object(
    'expenses_by_category',
      COALESCE((SELECT jsonb_object_agg(cat, amt) FROM (
        SELECT e.category::text AS cat, SUM(e.amount) AS amt
          FROM public.expenses e
         WHERE e.landlord_id = _landlord_id AND e.status IN ('approved','paid')
           AND e.expense_date BETWEEN v_start AND v_end
           AND (_property_id IS NULL OR e.property_id = _property_id)
         GROUP BY e.category) x), '{}'::jsonb),
    'payments_count',
      (SELECT count(*) FROM public.contributions c
         JOIN public.leases l ON l.id = c.lease_id
        WHERE l.landlord_id = _landlord_id AND c.status = 'success'
          AND c.contributed_at::date BETWEEN v_start AND v_end)
  ) INTO v_breakdown;

  INSERT INTO public.owner_statements(
    landlord_id, property_id, period_start, period_end, gross_rent, other_income,
    expenses_total, management_fee, wht_amount, net_payout, arrears_closing,
    breakdown, generated_by)
  VALUES (_landlord_id, _property_id, v_start, v_end, v_gross, v_other, v_exp,
          v_mgmt, v_wht, v_net, v_arrears, v_breakdown, v_user)
  ON CONFLICT (landlord_id, COALESCE(property_id,'00000000-0000-0000-0000-000000000000'::uuid), period_start)
  DO UPDATE SET gross_rent = EXCLUDED.gross_rent, other_income = EXCLUDED.other_income,
                expenses_total = EXCLUDED.expenses_total, management_fee = EXCLUDED.management_fee,
                wht_amount = EXCLUDED.wht_amount, net_payout = EXCLUDED.net_payout,
                arrears_closing = EXCLUDED.arrears_closing, breakdown = EXCLUDED.breakdown,
                updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END; $$;

-- ---------- reports ----------
CREATE OR REPLACE FUNCTION public.gl_trial_balance(
  _landlord_id uuid DEFAULT NULL, _from date DEFAULT NULL, _to date DEFAULT NULL
) RETURNS TABLE(account_id uuid, code text, name text, type public.account_type,
                debits numeric, credits numeric, balance numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid := auth.uid(); v_target uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_target := COALESCE(_landlord_id, v_user);
  IF v_target <> v_user AND NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT a.id, a.code, a.name, a.type,
         COALESCE(SUM(jl.debit),0)::numeric,
         COALESCE(SUM(jl.credit),0)::numeric,
         CASE WHEN a.type IN ('asset','expense')
              THEN COALESCE(SUM(jl.debit),0) - COALESCE(SUM(jl.credit),0)
              ELSE COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0) END::numeric
    FROM public.gl_accounts a
    LEFT JOIN public.journal_lines jl ON jl.account_id = a.id
    LEFT JOIN public.journal_entries je ON je.id = jl.entry_id
   WHERE (a.landlord_id IS NULL OR a.landlord_id = v_target)
     AND (je.id IS NULL OR (je.landlord_id = v_target
          AND (_from IS NULL OR je.entry_date >= _from)
          AND (_to IS NULL OR je.entry_date <= _to)))
   GROUP BY a.id, a.code, a.name, a.type
  HAVING COALESCE(SUM(jl.debit),0) <> 0 OR COALESCE(SUM(jl.credit),0) <> 0
   ORDER BY a.code;
END; $$;

CREATE OR REPLACE FUNCTION public.gl_profit_and_loss(
  _landlord_id uuid DEFAULT NULL, _from date DEFAULT NULL, _to date DEFAULT NULL,
  _property_id uuid DEFAULT NULL
) RETURNS TABLE(section text, code text, name text, amount numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid := auth.uid(); v_target uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_target := COALESCE(_landlord_id, v_user);
  IF v_target <> v_user AND NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT a.type::text, a.code, a.name,
         CASE WHEN a.type = 'income'
              THEN COALESCE(SUM(jl.credit - jl.debit),0)
              ELSE COALESCE(SUM(jl.debit - jl.credit),0) END::numeric
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.entry_id
    JOIN public.gl_accounts a ON a.id = jl.account_id
   WHERE je.landlord_id = v_target
     AND a.type IN ('income','expense')
     AND (_from IS NULL OR je.entry_date >= _from)
     AND (_to IS NULL OR je.entry_date <= _to)
     AND (_property_id IS NULL OR jl.property_id = _property_id)
   GROUP BY a.type, a.code, a.name
   ORDER BY a.type DESC, a.code;
END; $$;

CREATE OR REPLACE FUNCTION public.gl_account_ledger(
  _account_id uuid, _landlord_id uuid DEFAULT NULL,
  _from date DEFAULT NULL, _to date DEFAULT NULL, _limit integer DEFAULT 200
) RETURNS TABLE(entry_id uuid, entry_date date, memo text, source public.journal_source,
                description text, debit numeric, credit numeric, property_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid := auth.uid(); v_target uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_target := COALESCE(_landlord_id, v_user);
  IF v_target <> v_user AND NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT je.id, je.entry_date, je.memo, je.source, jl.description,
         jl.debit, jl.credit, p.name
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.entry_id
    LEFT JOIN public.properties p ON p.id = jl.property_id
   WHERE jl.account_id = _account_id AND je.landlord_id = v_target
     AND (_from IS NULL OR je.entry_date >= _from)
     AND (_to IS NULL OR je.entry_date <= _to)
   ORDER BY je.entry_date DESC, je.created_at DESC
   LIMIT GREATEST(LEAST(_limit, 1000), 1);
END; $$;

-- lock down anon execution on the new functions
REVOKE EXECUTE ON FUNCTION public.post_journal(uuid,date,text,public.journal_source,text,uuid,uuid,uuid,jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gl_account_id(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_late_fees(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.waive_late_fee(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_match_bank_transactions(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.match_bank_transaction(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_owner_statement(uuid,date,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.gl_trial_balance(uuid,date,date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.gl_profit_and_loss(uuid,date,date,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.gl_account_ledger(uuid,uuid,date,date,integer) FROM anon;
