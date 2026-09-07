create or replace function public.request_invite_resend(_invite_code text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.tenant_invites%rowtype;
  v_new_expiry timestamptz;
begin
  select * into v_invite from public.tenant_invites where invite_code = _invite_code;
  if v_invite.id is null then raise exception 'Invite not found'; end if;
  if v_invite.accepted_at is not null then raise exception 'Invite already accepted'; end if;

  v_new_expiry := greatest(now(), v_invite.expires_at) + interval '14 days';

  update public.tenant_invites
     set expires_at = v_new_expiry,
         resent_count = resent_count + 1,
         last_sent_at = now()
   where id = v_invite.id;

  insert into public.notifications(user_id, channel, title, body, payload)
  values (v_invite.landlord_id, 'in_app', 'Invite resend requested',
          'Your tenant requested a fresh invite for ' || v_invite.tenant_phone || '.',
          jsonb_build_object('invite_id', v_invite.id, 'invite_code', _invite_code));

  return v_new_expiry;
end;
$$;