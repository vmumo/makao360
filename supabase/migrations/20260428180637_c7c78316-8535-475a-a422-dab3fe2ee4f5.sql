-- Reconciliation metadata
ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS reconciliation_note text,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciled_by uuid;

-- Landlord-side reconcile function
CREATE OR REPLACE FUNCTION public.reconcile_contribution(
  _contribution_id uuid,
  _decision text,        -- 'success' or 'failed'
  _note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_contrib public.contributions%ROWTYPE;
  v_lease public.leases%ROWTYPE;
  v_balance int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _decision NOT IN ('success','failed') THEN
    RAISE EXCEPTION 'Decision must be success or failed';
  END IF;

  SELECT * INTO v_contrib FROM public.contributions WHERE id = _contribution_id;
  IF v_contrib.id IS NULL THEN RAISE EXCEPTION 'Contribution not found'; END IF;
  IF v_contrib.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending contributions can be reconciled';
  END IF;

  SELECT * INTO v_lease FROM public.leases WHERE id = v_contrib.lease_id;
  IF v_lease.landlord_id <> v_user AND NOT has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.contributions
     SET status = _decision::public.contribution_status,
         reconciliation_note = _note,
         reconciled_at = now(),
         reconciled_by = v_user
   WHERE id = _contribution_id;

  IF _decision = 'success' THEN
    SELECT COALESCE((SELECT balance_after FROM public.ledger_entries
                     WHERE lease_id = v_contrib.lease_id
                     ORDER BY created_at DESC LIMIT 1), 0)
      INTO v_balance;
    INSERT INTO public.ledger_entries(lease_id, entry_type, amount, balance_after,
                                      ref_table, ref_id, description, created_by)
    VALUES (v_contrib.lease_id, 'contribution', v_contrib.amount,
            v_balance + v_contrib.amount, 'contributions', v_contrib.id,
            'Bank transfer reconciled ' || COALESCE(v_contrib.external_ref, ''), v_user);

    INSERT INTO public.notifications(user_id, channel, title, body, payload)
    VALUES (v_contrib.tenant_id, 'in_app', 'Bank transfer confirmed',
            'Your transfer of KES ' || v_contrib.amount || ' was received.',
            jsonb_build_object('lease_id', v_contrib.lease_id,
                               'contribution_id', v_contrib.id));
  ELSE
    INSERT INTO public.notifications(user_id, channel, title, body, payload)
    VALUES (v_contrib.tenant_id, 'in_app', 'Bank transfer not matched',
            COALESCE(_note, 'Your landlord could not match this transfer. Please follow up.'),
            jsonb_build_object('lease_id', v_contrib.lease_id,
                               'contribution_id', v_contrib.id));
  END IF;

  RETURN _contribution_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_contribution(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_contribution(uuid, text, text) TO authenticated;
