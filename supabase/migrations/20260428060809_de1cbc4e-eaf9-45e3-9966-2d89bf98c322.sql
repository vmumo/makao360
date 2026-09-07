
-- Backfill notifications for seeded contributions (notify landlord)
insert into public.notifications (user_id, channel, title, body, payload, created_at, sent_at)
select
  l.landlord_id,
  'in_app'::notification_channel,
  'New rent contribution',
  'KES ' || c.amount || ' received towards rent.',
  jsonb_build_object('lease_id', c.lease_id, 'contribution_id', c.id),
  c.contributed_at,
  c.contributed_at
from public.contributions c
join public.leases l on l.id = c.lease_id
where c.status = 'success'
  and not exists (
    select 1 from public.notifications n
    where n.user_id = l.landlord_id
      and n.payload->>'contribution_id' = c.id::text
  );

-- Backfill notifications for seeded payouts (notify tenant)
insert into public.notifications (user_id, channel, title, body, payload, created_at, sent_at)
select
  l.tenant_id,
  'in_app'::notification_channel,
  'Rent paid out to landlord',
  'KES ' || p.amount || ' was paid out.',
  jsonb_build_object('lease_id', p.lease_id, 'payout_id', p.id),
  coalesce(p.paid_at, p.created_at),
  coalesce(p.paid_at, p.created_at)
from public.payouts p
join public.leases l on l.id = p.lease_id
where not exists (
  select 1 from public.notifications n
  where n.user_id = l.tenant_id
    and n.payload->>'payout_id' = p.id::text
);
