-- Resend metadata on invites
alter table public.tenant_invites
  add column if not exists resent_count integer not null default 0,
  add column if not exists last_sent_at timestamptz not null default now();

-- Notification preferences per user
create table if not exists public.notification_preferences (
  user_id uuid primary key,
  rent_reminder_days_before integer[] not null default array[7,3,1],
  rent_reminder_on_due_day boolean not null default true,
  rent_reminder_overdue boolean not null default true,
  payout_updates boolean not null default true,
  channel_in_app boolean not null default true,
  channel_sms boolean not null default false,
  channel_email boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "users manage their own preferences"
on public.notification_preferences
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create trigger notif_prefs_touch
before update on public.notification_preferences
for each row execute function public.touch_updated_at();

-- Resend an existing tenant invite (extends expiry, bumps counter)
create or replace function public.resend_invite(_invite_id uuid, _extend_days integer default 14)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invite public.tenant_invites%rowtype;
  v_new_expiry timestamptz;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select * into v_invite from public.tenant_invites where id = _invite_id;
  if v_invite.id is null then raise exception 'Invite not found'; end if;
  if v_invite.landlord_id <> v_user and not has_role(v_user, 'admin') then
    raise exception 'Not authorized';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'Invite already accepted';
  end if;
  v_new_expiry := greatest(now(), v_invite.expires_at) + make_interval(days => greatest(_extend_days, 1));
  update public.tenant_invites
     set expires_at = v_new_expiry,
         resent_count = resent_count + 1,
         last_sent_at = now()
   where id = _invite_id;
  return v_new_expiry;
end;
$$;