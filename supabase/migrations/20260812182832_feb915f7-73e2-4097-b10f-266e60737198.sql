
-- =============== VIEWING SLOTS ===============
create type public.viewing_mode as enum ('self_guided','guided');
create type public.viewing_slot_status as enum ('open','closed','cancelled');
create type public.viewing_booking_status as enum ('booked','confirmed','cancelled','attended','no_show');

create table public.unit_viewing_slots (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  landlord_id uuid not null references auth.users(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode public.viewing_mode not null default 'guided',
  capacity integer not null default 1,
  booked_count integer not null default 0,
  instructions text,
  contact_phone text,
  status public.viewing_slot_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint viewing_slot_time_valid check (ends_at > starts_at),
  constraint viewing_slot_capacity_valid check (capacity > 0)
);
create index idx_viewing_slots_unit on public.unit_viewing_slots(unit_id, starts_at);
create index idx_viewing_slots_landlord on public.unit_viewing_slots(landlord_id, starts_at);

grant select on public.unit_viewing_slots to anon;
grant select, insert, update, delete on public.unit_viewing_slots to authenticated;
grant all on public.unit_viewing_slots to service_role;

alter table public.unit_viewing_slots enable row level security;

create policy "Anyone can view open slots for listed units"
on public.unit_viewing_slots for select
using (
  status = 'open'
  and exists (
    select 1 from public.units u
    where u.id = unit_id and u.listed = true and u.status = 'vacant'
  )
);

create policy "Landlords manage their own viewing slots"
on public.unit_viewing_slots for all
to authenticated
using (landlord_id = auth.uid() or public.has_role(auth.uid(),'admin'))
with check (landlord_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create trigger trg_viewing_slots_updated
before update on public.unit_viewing_slots
for each row execute function public.touch_updated_at();

-- =============== VIEWING BOOKINGS ===============
create table public.viewing_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.unit_viewing_slots(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  landlord_id uuid not null references auth.users(id),
  applicant_user_id uuid references auth.users(id),
  applicant_name text not null,
  applicant_phone text not null,
  applicant_email text,
  note text,
  status public.viewing_booking_status not null default 'booked',
  confirmation_code text not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slot_id, applicant_phone)
);
create index idx_viewing_bookings_slot on public.viewing_bookings(slot_id);
create index idx_viewing_bookings_landlord on public.viewing_bookings(landlord_id, created_at desc);

grant select, insert, update on public.viewing_bookings to authenticated;
grant all on public.viewing_bookings to service_role;

alter table public.viewing_bookings enable row level security;

create policy "Landlords and admins see bookings"
on public.viewing_bookings for select
to authenticated
using (landlord_id = auth.uid() or applicant_user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create policy "Landlords and admins update bookings"
on public.viewing_bookings for update
to authenticated
using (landlord_id = auth.uid() or applicant_user_id = auth.uid() or public.has_role(auth.uid(),'admin'))
with check (landlord_id = auth.uid() or applicant_user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create trigger trg_viewing_bookings_updated
before update on public.viewing_bookings
for each row execute function public.touch_updated_at();

-- =============== PUBLIC RPCs ===============
create or replace function public.public_unit_slots(_unit_id uuid)
returns table (
  slot_id uuid, starts_at timestamptz, ends_at timestamptz,
  mode public.viewing_mode, capacity integer, booked_count integer,
  seats_left integer, instructions text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.starts_at, s.ends_at, s.mode, s.capacity, s.booked_count,
         greatest(s.capacity - s.booked_count, 0), s.instructions
  from public.unit_viewing_slots s
  join public.units u on u.id = s.unit_id
  where s.unit_id = _unit_id
    and s.status = 'open'
    and s.starts_at > now()
    and u.listed = true
  order by s.starts_at
  limit 50;
$$;

grant execute on function public.public_unit_slots(uuid) to anon, authenticated;

create or replace function public.book_viewing(
  _slot_id uuid, _name text, _phone text, _email text default null, _note text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s record; v_code text; v_id uuid; v_unit record;
begin
  select * into s from public.unit_viewing_slots where id = _slot_id for update;
  if s is null then raise exception 'Viewing slot not found'; end if;
  if s.status <> 'open' then raise exception 'This viewing slot is no longer open'; end if;
  if s.starts_at <= now() then raise exception 'This viewing slot has already passed'; end if;
  if s.booked_count >= s.capacity then raise exception 'This viewing slot is fully booked'; end if;
  if coalesce(trim(_name),'') = '' or coalesce(trim(_phone),'') = '' then
    raise exception 'Name and phone are required';
  end if;
  if exists (select 1 from public.viewing_bookings b where b.slot_id = _slot_id and b.applicant_phone = _phone and b.status <> 'cancelled') then
    raise exception 'You already booked this slot';
  end if;

  v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.viewing_bookings (slot_id, unit_id, landlord_id, applicant_user_id, applicant_name, applicant_phone, applicant_email, note, confirmation_code)
  values (_slot_id, s.unit_id, s.landlord_id, auth.uid(), trim(_name), trim(_phone), nullif(trim(coalesce(_email,'')),''), nullif(trim(coalesce(_note,'')),''), v_code)
  returning id into v_id;

  update public.unit_viewing_slots
     set booked_count = booked_count + 1,
         status = case when booked_count + 1 >= capacity then 'closed'::public.viewing_slot_status else status end
   where id = _slot_id;

  select u.label as label, p.name as property_name into v_unit
  from public.units u join public.properties p on p.id = u.property_id
  where u.id = s.unit_id;

  insert into public.notifications (user_id, channel, title, body, link_url, payload)
  values (
    s.landlord_id, 'in_app',
    'New viewing booked',
    trim(_name) || ' booked a viewing for ' || coalesce(v_unit.property_name,'your property') || ' · ' || coalesce(v_unit.label,'unit') ||
      ' on ' || to_char(s.starts_at at time zone 'Africa/Nairobi', 'DD Mon YYYY HH24:MI'),
    '/app/landlord/leasing',
    jsonb_build_object('booking_id', v_id, 'slot_id', _slot_id, 'unit_id', s.unit_id)
  );

  return jsonb_build_object(
    'booking_id', v_id,
    'confirmation_code', v_code,
    'starts_at', s.starts_at,
    'ends_at', s.ends_at,
    'mode', s.mode,
    'instructions', s.instructions,
    'contact_phone', s.contact_phone
  );
end;
$$;

grant execute on function public.book_viewing(uuid, text, text, text, text) to anon, authenticated;

-- =============== EXTENDED VACANCY SEARCH ===============
create or replace function public.public_vacancies(
  _search text default null,
  _city text default null,
  _min_rent integer default null,
  _max_rent integer default null,
  _limit integer default 60,
  _bedrooms integer default null,
  _property_type public.property_type default null,
  _county text default null
)
returns table (
  unit_id uuid, label text, rent_amount integer, deposit_amount integer, bedrooms integer,
  listing_title text, listing_photos text[], listing_amenities text[], available_from date,
  property_name text, city text, county text, address text, property_type public.property_type,
  latitude double precision, longitude double precision, viewing_slots bigint
)
language sql stable security definer set search_path = public as $$
  select u.id, u.label, u.rent_amount, u.deposit_amount, u.bedrooms,
         u.listing_title, u.listing_photos, u.listing_amenities, u.available_from,
         p.name, p.city, p.county, p.address, p.property_type, p.latitude, p.longitude,
         (select count(*) from public.unit_viewing_slots s
           where s.unit_id = u.id and s.status = 'open' and s.starts_at > now())
  from public.units u
  join public.properties p on p.id = u.property_id
  where u.listed = true and u.status = 'vacant'
    and (_search is null or _search = '' or
         p.name ilike '%'||_search||'%' or p.city ilike '%'||_search||'%' or
         p.address ilike '%'||_search||'%' or u.listing_title ilike '%'||_search||'%')
    and (_city is null or _city = '' or p.city ilike '%'||_city||'%')
    and (_county is null or _county = '' or p.county ilike '%'||_county||'%')
    and (_min_rent is null or u.rent_amount >= _min_rent)
    and (_max_rent is null or u.rent_amount <= _max_rent)
    and (_bedrooms is null or u.bedrooms = _bedrooms)
    and (_property_type is null or p.property_type = _property_type)
  order by u.available_from nulls last, u.rent_amount asc
  limit coalesce(_limit, 60);
$$;

grant execute on function public.public_vacancies(text, text, integer, integer, integer, integer, public.property_type, text) to anon, authenticated;
