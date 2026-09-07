revoke all on function public.has_role(uuid, app_role) from public, anon;
grant execute on function public.has_role(uuid, app_role) to authenticated;

revoke all on function public.current_user_has_role(app_role) from public, anon;
grant execute on function public.current_user_has_role(app_role) to authenticated;

revoke all on function public.ensure_open_cycle(uuid) from public, anon;
grant execute on function public.ensure_open_cycle(uuid) to authenticated;

revoke all on function public.accept_tenant_invite(text) from public, anon;
grant execute on function public.accept_tenant_invite(text) to authenticated;

revoke all on function public.record_mock_contribution(uuid, integer, text) from public, anon;
grant execute on function public.record_mock_contribution(uuid, integer, text) to authenticated;

revoke all on function public.record_payout(uuid, uuid, integer) from public, anon;
grant execute on function public.record_payout(uuid, uuid, integer) to authenticated;

revoke all on function public.resend_invite(uuid, integer) from public, anon;
grant execute on function public.resend_invite(uuid, integer) to authenticated;

revoke all on function public.request_invite_resend(text) from public;
grant execute on function public.request_invite_resend(text) to anon, authenticated;

drop function if exists public.get_invite_by_code(text);

create function public.get_invite_by_code(_invite_code text)
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
  landlord_name text,
  resent_count integer,
  last_sent_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.tenant_phone, i.tenant_name, i.rent_amount, i.deposit_amount,
         i.rent_due_day, i.start_date, i.expires_at, i.accepted_at,
         u.label, p.name,
         (select full_name from public.profiles where user_id = i.landlord_id),
         i.resent_count, i.last_sent_at
    from public.tenant_invites i
    join public.units u on u.id = i.unit_id
    join public.properties p on p.id = u.property_id
   where i.invite_code = _invite_code;
$$;

revoke all on function public.get_invite_by_code(text) from public;
grant execute on function public.get_invite_by_code(text) to anon, authenticated;
