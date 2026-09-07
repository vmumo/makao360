
-- ============================================================
-- ENUMS
-- ============================================================
create type public.app_role as enum ('tenant', 'landlord', 'caretaker', 'admin');
create type public.kyc_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type public.unit_status as enum ('vacant', 'occupied', 'maintenance', 'reserved');
create type public.lease_status as enum ('pending', 'active', 'ended', 'terminated');
create type public.cycle_status as enum ('open', 'completed', 'partial', 'overdue', 'closed');
create type public.contribution_source as enum ('mpesa_stk', 'mpesa_paybill', 'card', 'bank', 'cash', 'diaspora', 'payroll', 'manual_adjustment');
create type public.contribution_status as enum ('pending', 'success', 'failed', 'reversed');
create type public.payout_status as enum ('pending', 'processing', 'paid', 'failed');
create type public.ledger_type as enum ('contribution', 'payout', 'adjustment', 'fee', 'refund');
create type public.notification_channel as enum ('in_app', 'sms', 'email', 'push');
create type public.property_type as enum ('apartment', 'bedsitter', 'studio', 'maisonette', 'bungalow', 'commercial', 'mixed_use');

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  national_id text,
  avatar_url text,
  kyc_status public.kyc_status not null default 'unverified',
  preferred_role public.app_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ============================================================
-- USER ROLES (separate table — security critical)
-- ============================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

-- Security-definer role check function (prevents recursive RLS)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.current_user_has_role(_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), _role);
$$;

-- ============================================================
-- PROPERTIES
-- ============================================================
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  city text default 'Nairobi',
  county text default 'Nairobi',
  property_type public.property_type not null default 'apartment',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.properties enable row level security;
create index idx_properties_landlord on public.properties(landlord_id);

-- ============================================================
-- UNITS
-- ============================================================
create table public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  label text not null,
  rent_amount integer not null check (rent_amount >= 0),
  deposit_amount integer not null default 0 check (deposit_amount >= 0),
  bedrooms integer default 1,
  status public.unit_status not null default 'vacant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id, label)
);
alter table public.units enable row level security;
create index idx_units_property on public.units(property_id);

-- ============================================================
-- LEASES
-- ============================================================
create table public.leases (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete restrict,
  tenant_id uuid not null references auth.users(id) on delete restrict,
  landlord_id uuid not null references auth.users(id) on delete restrict,
  rent_amount integer not null check (rent_amount >= 0),
  deposit_amount integer not null default 0,
  rent_due_day integer not null default 1 check (rent_due_day between 1 and 28),
  start_date date not null,
  end_date date,
  status public.lease_status not null default 'pending',
  auto_payout boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.leases enable row level security;
create index idx_leases_tenant on public.leases(tenant_id);
create index idx_leases_landlord on public.leases(landlord_id);
create index idx_leases_unit on public.leases(unit_id);

-- ============================================================
-- TENANT INVITES (phone-based onboarding)
-- ============================================================
create table public.tenant_invites (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  tenant_phone text not null,
  tenant_name text,
  rent_amount integer not null,
  deposit_amount integer not null default 0,
  rent_due_day integer not null default 1,
  start_date date not null,
  invite_code text not null unique default encode(gen_random_bytes(8), 'hex'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);
alter table public.tenant_invites enable row level security;

-- ============================================================
-- RENT CYCLES
-- ============================================================
create table public.rent_cycles (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  target_amount integer not null,
  accumulated_amount integer not null default 0,
  status public.cycle_status not null default 'open',
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(lease_id, period_start)
);
alter table public.rent_cycles enable row level security;
create index idx_cycles_lease on public.rent_cycles(lease_id);

-- ============================================================
-- CONTRIBUTIONS
-- ============================================================
create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  cycle_id uuid references public.rent_cycles(id) on delete set null,
  tenant_id uuid not null references auth.users(id) on delete restrict,
  amount integer not null check (amount > 0),
  source public.contribution_source not null default 'mpesa_stk',
  status public.contribution_status not null default 'pending',
  external_ref text,
  mpesa_receipt text unique,
  payer_phone text,
  note text,
  contributed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.contributions enable row level security;
create index idx_contrib_lease on public.contributions(lease_id);
create index idx_contrib_cycle on public.contributions(cycle_id);
create index idx_contrib_tenant on public.contributions(tenant_id);

-- ============================================================
-- PAYOUTS
-- ============================================================
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  cycle_id uuid references public.rent_cycles(id) on delete set null,
  landlord_id uuid not null references auth.users(id) on delete restrict,
  amount integer not null check (amount > 0),
  status public.payout_status not null default 'pending',
  external_ref text,
  mpesa_receipt text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.payouts enable row level security;
create index idx_payouts_landlord on public.payouts(landlord_id);
create index idx_payouts_lease on public.payouts(lease_id);

-- ============================================================
-- LEDGER ENTRIES (append-only)
-- ============================================================
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  entry_type public.ledger_type not null,
  amount integer not null,
  balance_after integer not null,
  ref_table text,
  ref_id uuid,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.ledger_entries enable row level security;
create index idx_ledger_lease on public.ledger_entries(lease_id, created_at desc);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel public.notification_channel not null default 'in_app',
  title text not null,
  body text,
  payload jsonb default '{}'::jsonb,
  link_url text,
  read_at timestamptz,
  sent_at timestamptz default now(),
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create index idx_notif_user on public.notifications(user_id, created_at desc);

-- ============================================================
-- AUDIT LOG
-- ============================================================
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_table text,
  entity_id uuid,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create index idx_audit_created on public.audit_log(created_at desc);

-- ============================================================
-- FEATURE FLAGS
-- ============================================================
create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null unique,
  description text,
  enabled_globally boolean not null default false,
  enabled_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.feature_flags enable row level security;

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger touch_properties before update on public.properties for each row execute function public.touch_updated_at();
create trigger touch_units before update on public.units for each row execute function public.touch_updated_at();
create trigger touch_leases before update on public.leases for each row execute function public.touch_updated_at();
create trigger touch_flags before update on public.feature_flags for each row execute function public.touch_updated_at();

-- ============================================================
-- TRIGGER: auto-create profile + default role on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'phone'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'tenant');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- HELPER: re-aggregate cycle totals when a contribution succeeds
-- ============================================================
create or replace function public.recompute_cycle_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_target integer;
begin
  if new.cycle_id is null then return new; end if;

  select coalesce(sum(amount), 0) into v_total
    from public.contributions
    where cycle_id = new.cycle_id and status = 'success';

  select target_amount into v_target from public.rent_cycles where id = new.cycle_id;

  update public.rent_cycles
    set accumulated_amount = v_total,
        status = case
          when v_total >= v_target then 'completed'::public.cycle_status
          when v_total > 0 then 'partial'::public.cycle_status
          else 'open'::public.cycle_status
        end
    where id = new.cycle_id;

  return new;
end;
$$;

create trigger contributions_recompute_cycle
  after insert or update on public.contributions
  for each row execute function public.recompute_cycle_totals();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- PROFILES: each user sees + edits own; admins see all
create policy "profiles_self_select" on public.profiles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "profiles_self_insert" on public.profiles for insert
  with check (auth.uid() = user_id);
create policy "profiles_self_update" on public.profiles for update
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- USER_ROLES: users see own; only admins manage
create policy "roles_self_select" on public.user_roles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "roles_admin_manage" on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- PROPERTIES: landlord owns; admin sees all
create policy "properties_landlord_select" on public.properties for select
  using (auth.uid() = landlord_id or public.has_role(auth.uid(), 'admin'));
create policy "properties_landlord_insert" on public.properties for insert
  with check (auth.uid() = landlord_id and public.has_role(auth.uid(), 'landlord'));
create policy "properties_landlord_update" on public.properties for update
  using (auth.uid() = landlord_id or public.has_role(auth.uid(), 'admin'));
create policy "properties_landlord_delete" on public.properties for delete
  using (auth.uid() = landlord_id or public.has_role(auth.uid(), 'admin'));

-- UNITS: visible to landlord of parent property + tenant of active lease + admin
create policy "units_select" on public.units for select
  using (
    public.has_role(auth.uid(), 'admin')
    or exists (select 1 from public.properties p where p.id = units.property_id and p.landlord_id = auth.uid())
    or exists (select 1 from public.leases l where l.unit_id = units.id and l.tenant_id = auth.uid())
  );
create policy "units_landlord_write" on public.units for insert
  with check (exists (select 1 from public.properties p where p.id = property_id and p.landlord_id = auth.uid()));
create policy "units_landlord_update" on public.units for update
  using (exists (select 1 from public.properties p where p.id = units.property_id and p.landlord_id = auth.uid()) or public.has_role(auth.uid(), 'admin'));
create policy "units_landlord_delete" on public.units for delete
  using (exists (select 1 from public.properties p where p.id = units.property_id and p.landlord_id = auth.uid()) or public.has_role(auth.uid(), 'admin'));

-- LEASES: tenant + landlord + admin
create policy "leases_party_select" on public.leases for select
  using (auth.uid() = tenant_id or auth.uid() = landlord_id or public.has_role(auth.uid(), 'admin'));
create policy "leases_landlord_insert" on public.leases for insert
  with check (auth.uid() = landlord_id);
create policy "leases_party_update" on public.leases for update
  using (auth.uid() = landlord_id or public.has_role(auth.uid(), 'admin'));

-- TENANT INVITES: landlord owns; tenant matches by phone (server function consumes)
create policy "invites_landlord_all" on public.tenant_invites for all
  using (auth.uid() = landlord_id or public.has_role(auth.uid(), 'admin'))
  with check (auth.uid() = landlord_id);
create policy "invites_invitee_select" on public.tenant_invites for select
  using (
    exists (
      select 1 from public.profiles pr
      where pr.user_id = auth.uid() and pr.phone = tenant_invites.tenant_phone
    )
  );

-- RENT CYCLES: parties of lease + admin
create policy "cycles_party_select" on public.rent_cycles for select
  using (
    public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.leases l
      where l.id = rent_cycles.lease_id and (l.tenant_id = auth.uid() or l.landlord_id = auth.uid())
    )
  );

-- CONTRIBUTIONS: tenant + landlord of lease + admin
create policy "contrib_party_select" on public.contributions for select
  using (
    auth.uid() = tenant_id
    or public.has_role(auth.uid(), 'admin')
    or exists (select 1 from public.leases l where l.id = contributions.lease_id and l.landlord_id = auth.uid())
  );
create policy "contrib_tenant_insert" on public.contributions for insert
  with check (
    auth.uid() = tenant_id
    and exists (select 1 from public.leases l where l.id = lease_id and l.tenant_id = auth.uid())
  );

-- PAYOUTS: landlord + admin
create policy "payouts_party_select" on public.payouts for select
  using (
    auth.uid() = landlord_id
    or public.has_role(auth.uid(), 'admin')
    or exists (select 1 from public.leases l where l.id = payouts.lease_id and l.tenant_id = auth.uid())
  );

-- LEDGER: parties of lease + admin
create policy "ledger_party_select" on public.ledger_entries for select
  using (
    public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.leases l
      where l.id = ledger_entries.lease_id and (l.tenant_id = auth.uid() or l.landlord_id = auth.uid())
    )
  );

-- NOTIFICATIONS: each user own
create policy "notif_self_select" on public.notifications for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "notif_self_update" on public.notifications for update
  using (auth.uid() = user_id);

-- AUDIT LOG: admin only
create policy "audit_admin_select" on public.audit_log for select
  using (public.has_role(auth.uid(), 'admin'));

-- FEATURE FLAGS: anyone signed-in can read; admin manages
create policy "flags_read_all" on public.feature_flags for select
  using (auth.role() = 'authenticated');
create policy "flags_admin_write" on public.feature_flags for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

;
