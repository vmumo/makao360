
-- Accept invite: creates lease, first cycle, occupies unit, marks invite accepted
create or replace function public.accept_tenant_invite(_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.tenant_invites%rowtype;
  v_user uuid := auth.uid();
  v_phone text;
  v_lease_id uuid;
  v_period_start date;
  v_period_end date;
  v_due_date date;
  v_landlord_phone text;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select phone into v_phone from public.profiles where user_id = v_user;

  select * into v_invite from public.tenant_invites where invite_code = _invite_code;
  if v_invite.id is null then raise exception 'Invite not found'; end if;
  if v_invite.accepted_at is not null then raise exception 'Invite already used'; end if;
  if v_invite.expires_at < now() then raise exception 'Invite has expired'; end if;
  if v_phone is null or v_phone <> v_invite.tenant_phone then
    raise exception 'This invite is for phone %, your account uses %', v_invite.tenant_phone, coalesce(v_phone,'(none)');
  end if;

  -- Ensure tenant role
  insert into public.user_roles(user_id, role) values (v_user, 'tenant')
  on conflict do nothing;

  -- Compute first cycle period from start_date
  v_period_start := date_trunc('month', v_invite.start_date)::date;
  v_period_end := (v_period_start + interval '1 month - 1 day')::date;
  v_due_date := (v_period_start + (least(greatest(v_invite.rent_due_day,1),28) - 1) * interval '1 day')::date;

  insert into public.leases(unit_id, tenant_id, landlord_id, rent_amount, rent_due_day,
                            deposit_amount, start_date, status)
  values (v_invite.unit_id, v_user, v_invite.landlord_id, v_invite.rent_amount,
          v_invite.rent_due_day, v_invite.deposit_amount, v_invite.start_date, 'active')
  returning id into v_lease_id;

  insert into public.rent_cycles(lease_id, period_start, period_end, due_date, target_amount)
  values (v_lease_id, v_period_start, v_period_end, v_due_date, v_invite.rent_amount);

  update public.units set status = 'occupied' where id = v_invite.unit_id;

  update public.tenant_invites
    set accepted_at = now(), accepted_by = v_user
    where id = v_invite.id;

  -- Notify landlord
  insert into public.notifications(user_id, channel, title, body, payload)
  values (v_invite.landlord_id, 'in_app', 'Tenant accepted invite',
          coalesce((select full_name from public.profiles where user_id = v_user), v_phone) || ' joined your unit.',
          jsonb_build_object('lease_id', v_lease_id));

  return v_lease_id;
end;
$$;

grant execute on function public.accept_tenant_invite(text) to authenticated;

-- Lookup invite by code (bypasses RLS phone match for the invitee preview screen)
create or replace function public.get_invite_by_code(_invite_code text)
returns table(
  id uuid,
  tenant_phone text,
  tenant_name text,
  rent_amount integer,
  deposit_amount integer,
  rent_due_day integer,
  start_date date,
  expires_at timestamptz,
  accepted_at timestamptz,
  unit_label text,
  property_name text,
  landlord_name text
)
language sql
security definer
stable
set search_path = public
as $$
  select i.id, i.tenant_phone, i.tenant_name, i.rent_amount, i.deposit_amount,
         i.rent_due_day, i.start_date, i.expires_at, i.accepted_at,
         u.label, p.name,
         (select full_name from public.profiles where user_id = i.landlord_id)
    from public.tenant_invites i
    join public.units u on u.id = i.unit_id
    join public.properties p on p.id = u.property_id
   where i.invite_code = _invite_code;
$$;
grant execute on function public.get_invite_by_code(text) to authenticated, anon;

-- Open next cycle for a lease (idempotent — only opens if none open/partial exists for the upcoming month)
create or replace function public.ensure_open_cycle(_lease_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease public.leases%rowtype;
  v_existing uuid;
  v_period_start date;
  v_period_end date;
  v_due_date date;
  v_id uuid;
begin
  select * into v_lease from public.leases where id = _lease_id;
  if v_lease.id is null then raise exception 'Lease not found'; end if;
  if auth.uid() <> v_lease.tenant_id and auth.uid() <> v_lease.landlord_id
     and not has_role(auth.uid(),'admin') then
    raise exception 'Not authorized';
  end if;

  select id into v_existing from public.rent_cycles
    where lease_id = _lease_id and status in ('open','partial')
    order by period_start desc limit 1;
  if v_existing is not null then return v_existing; end if;

  -- Find latest cycle to compute next month
  select coalesce(max(period_end), (date_trunc('month', v_lease.start_date) - interval '1 day')::date)
    into v_period_end from public.rent_cycles where lease_id = _lease_id;
  v_period_start := (v_period_end + interval '1 day')::date;
  v_period_end := (v_period_start + interval '1 month - 1 day')::date;
  v_due_date := (v_period_start + (least(greatest(v_lease.rent_due_day,1),28) - 1) * interval '1 day')::date;

  insert into public.rent_cycles(lease_id, period_start, period_end, due_date, target_amount)
  values (_lease_id, v_period_start, v_period_end, v_due_date, v_lease.rent_amount)
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.ensure_open_cycle(uuid) to authenticated;

-- Record a (mock) M-Pesa contribution end-to-end + ledger + notify landlord
create or replace function public.record_mock_contribution(_lease_id uuid, _amount integer, _phone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease public.leases%rowtype;
  v_user uuid := auth.uid();
  v_cycle uuid;
  v_contrib uuid;
  v_balance int;
  v_receipt text;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select * into v_lease from public.leases where id = _lease_id;
  if v_lease.tenant_id <> v_user then raise exception 'Not your lease'; end if;
  if _amount < 1 then raise exception 'Amount must be > 0'; end if;

  v_cycle := public.ensure_open_cycle(_lease_id);
  v_receipt := 'MPESA-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));

  insert into public.contributions(tenant_id, lease_id, cycle_id, amount, source, status,
                                   payer_phone, mpesa_receipt)
  values (v_user, _lease_id, v_cycle, _amount, 'mpesa_stk', 'success', _phone, v_receipt)
  returning id into v_contrib;

  -- Ledger
  select coalesce((select balance_after from public.ledger_entries
                   where lease_id = _lease_id order by created_at desc limit 1), 0)
    into v_balance;
  insert into public.ledger_entries(lease_id, entry_type, amount, balance_after,
                                    ref_table, ref_id, description, created_by)
  values (_lease_id, 'contribution', _amount, v_balance + _amount,
          'contributions', v_contrib, 'M-Pesa contribution ' || v_receipt, v_user);

  -- Notify landlord
  insert into public.notifications(user_id, channel, title, body, payload)
  values (v_lease.landlord_id, 'in_app', 'New rent contribution',
          'KES ' || _amount || ' received towards rent.',
          jsonb_build_object('lease_id', _lease_id, 'contribution_id', v_contrib));

  return v_contrib;
end;
$$;
grant execute on function public.record_mock_contribution(uuid, integer, text) to authenticated;

-- Landlord initiates payout (mock) for a completed cycle
create or replace function public.record_payout(_lease_id uuid, _cycle_id uuid, _amount integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease public.leases%rowtype;
  v_user uuid := auth.uid();
  v_payout uuid;
  v_balance int;
  v_receipt text;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select * into v_lease from public.leases where id = _lease_id;
  if v_lease.landlord_id <> v_user and not has_role(v_user,'admin') then
    raise exception 'Not authorized'; end if;
  v_receipt := 'PAYOUT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));

  insert into public.payouts(lease_id, landlord_id, cycle_id, amount, status, mpesa_receipt, paid_at)
  values (_lease_id, v_lease.landlord_id, _cycle_id, _amount, 'paid', v_receipt, now())
  returning id into v_payout;

  select coalesce((select balance_after from public.ledger_entries
                   where lease_id = _lease_id order by created_at desc limit 1), 0)
    into v_balance;
  insert into public.ledger_entries(lease_id, entry_type, amount, balance_after,
                                    ref_table, ref_id, description, created_by)
  values (_lease_id, 'payout', -_amount, v_balance - _amount,
          'payouts', v_payout, 'Landlord payout ' || v_receipt, v_user);

  -- Notify tenant
  insert into public.notifications(user_id, channel, title, body, payload)
  values (v_lease.tenant_id, 'in_app', 'Rent paid out to landlord',
          'KES ' || _amount || ' was paid out.',
          jsonb_build_object('lease_id', _lease_id, 'payout_id', v_payout));

  return v_payout;
end;
$$;
grant execute on function public.record_payout(uuid, uuid, integer) to authenticated;
