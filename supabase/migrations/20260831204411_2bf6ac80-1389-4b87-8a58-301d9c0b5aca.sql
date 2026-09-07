-- 1) Mock M-Pesa contributions must not self-confirm
CREATE OR REPLACE FUNCTION public.record_mock_contribution(_lease_id uuid, _amount integer, _phone text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_lease public.leases%rowtype;
  v_user uuid := auth.uid();
  v_cycle uuid;
  v_contrib uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select * into v_lease from public.leases where id = _lease_id;
  if v_lease.tenant_id <> v_user then raise exception 'Not your lease'; end if;
  if _amount < 1 then raise exception 'Amount must be > 0'; end if;

  v_cycle := public.ensure_open_cycle(_lease_id);

  -- Payments are only claims until a trusted provider callback / landlord
  -- reconciliation confirms them. No ledger posting here.
  insert into public.contributions(tenant_id, lease_id, cycle_id, amount, source, status,
                                   payer_phone, note)
  values (v_user, _lease_id, v_cycle, _amount, 'mpesa_stk', 'pending', _phone,
          'Awaiting payment confirmation')
  returning id into v_contrib;

  insert into public.notifications(user_id, channel, title, body, payload)
  values (v_lease.landlord_id, 'in_app', 'Rent payment awaiting confirmation',
          'KES ' || _amount || ' reported. Confirm it in reconciliation.',
          jsonb_build_object('lease_id', _lease_id, 'contribution_id', v_contrib));

  return v_contrib;
end;
$function$;

-- 2) bank_transactions: split read from write, protect reconciliation fields
DROP POLICY IF EXISTS bank_txn_all ON public.bank_transactions;

CREATE POLICY bank_txn_select ON public.bank_transactions
  FOR SELECT TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY bank_txn_insert ON public.bank_transactions
  FOR INSERT TO authenticated
  WITH CHECK (landlord_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY bank_txn_update ON public.bank_transactions
  FOR UPDATE TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (landlord_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY bank_txn_delete ON public.bank_transactions
  FOR DELETE TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Prevent direct tampering with reconciliation/match fields; only the
-- SECURITY DEFINER matching routines may set them.
CREATE OR REPLACE FUNCTION public.guard_bank_txn_match_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if current_setting('role', true) is distinct from 'authenticated'
     and auth.uid() is null then
    return new;
  end if;
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  new.matched_contribution_id := old.matched_contribution_id;
  new.matched_lease_id := old.matched_lease_id;
  new.matched_by := old.matched_by;
  new.matched_at := old.matched_at;
  if old.status = 'matched' then
    new.status := old.status;
  end if;
  return new;
end;
$$;

-- 3) feature_flags: admin-only reads
DROP POLICY IF EXISTS flags_read_all ON public.feature_flags;
CREATE POLICY flags_admin_read ON public.feature_flags
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) message_threads: align INSERT with SELECT team-membership logic
DROP POLICY IF EXISTS threads_participants_insert ON public.message_threads;
CREATE POLICY threads_participants_insert ON public.message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    landlord_id = auth.uid()
    OR tenant_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.landlord_team_members m
      WHERE m.landlord_id = message_threads.landlord_id
        AND m.member_user_id = auth.uid()
        AND m.status = 'active'
        AND (cardinality(m.property_ids) = 0 OR message_threads.property_id = ANY (m.property_ids))
    )
  );

-- 5) tenant_invites: no realtime broadcast of invite codes; signed-in reads only
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tenant_invites'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.tenant_invites';
  END IF;
END $$;

DROP POLICY IF EXISTS invites_invitee_select ON public.tenant_invites;
CREATE POLICY invites_invitee_select ON public.tenant_invites
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = auth.uid() AND pr.phone = tenant_invites.tenant_phone
  ));

REVOKE ALL ON public.tenant_invites FROM anon;

-- 6) Internal SECURITY DEFINER helper should not be client-callable
REVOKE EXECUTE ON FUNCTION public.gl_account_id(uuid, text) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.guard_bank_txn_match_fields() FROM authenticated, anon, public;