-- Intercontinental Nomad: database schema for Supabase (Phase 4).
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- It is safe to run again: every statement checks before creating.
--
-- What it sets up:
--   trips          one row per trip; the whole itinerary is stored as JSON in `data`
--   trip_members   people who can edit a trip with you ("Shared trips")
--   trip_invites   invitations by email, accepted when that person signs in
--   share_links    view-only links anyone can open without an account
-- Row Level Security (RLS) makes sure people only ever see their own and shared trips.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default 'Untitled trip',
  data        jsonb not null,
  revision    integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists trips_owner_idx on public.trips (owner_id, updated_at desc);

create table if not exists public.trip_members (
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'editor' check (role in ('editor', 'viewer')),
  created_at  timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index if not exists trip_members_user_idx on public.trip_members (user_id);

create table if not exists public.trip_invites (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  email       text not null,
  role        text not null default 'editor' check (role in ('editor', 'viewer')),
  invited_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique (trip_id, email)
);

create table if not exists public.share_links (
  token       text primary key default encode(gen_random_bytes(16), 'hex'),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  created_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  revoked     boolean not null default false
);
create index if not exists share_links_trip_idx on public.share_links (trip_id);

-- Keep updated_at and revision current on every edit.
create or replace function public.touch_trip() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.revision := old.revision + 1;
  return new;
end $$;

drop trigger if exists trips_touch on public.trips;
create trigger trips_touch before update on public.trips
for each row execute function public.touch_trip();

-- ---------------------------------------------------------------- helpers
-- "security definer" helpers avoid policies on trips and trip_members referring to each other in a loop.

create or replace function public.is_trip_owner(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips where id = t and owner_id = auth.uid());
$$;

create or replace function public.trip_role(t uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from trips where id = t and owner_id = auth.uid()) then 'owner'
    else (select role from trip_members where trip_id = t and user_id = auth.uid())
  end;
$$;

-- ---------------------------------------------------------------- row level security

alter table public.trips        enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;
alter table public.share_links  enable row level security;

drop policy if exists "trips: read own or shared" on public.trips;
create policy "trips: read own or shared" on public.trips
  for select to authenticated using (public.trip_role(id) is not null);

drop policy if exists "trips: create own" on public.trips;
create policy "trips: create own" on public.trips
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "trips: edit own or as editor" on public.trips;
create policy "trips: edit own or as editor" on public.trips
  for update to authenticated
  using (public.trip_role(id) in ('owner', 'editor'))
  with check (public.trip_role(id) in ('owner', 'editor'));

drop policy if exists "trips: delete own" on public.trips;
create policy "trips: delete own" on public.trips
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "members: see people on my trips" on public.trip_members;
create policy "members: see people on my trips" on public.trip_members
  for select to authenticated using (public.trip_role(trip_id) is not null);

drop policy if exists "members: owner manages" on public.trip_members;
create policy "members: owner manages" on public.trip_members
  for all to authenticated using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

drop policy if exists "members: leave a trip" on public.trip_members;
create policy "members: leave a trip" on public.trip_members
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "invites: owner manages" on public.trip_invites;
create policy "invites: owner manages" on public.trip_invites
  for all to authenticated using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

drop policy if exists "invites: see mine" on public.trip_invites;
create policy "invites: see mine" on public.trip_invites
  for select to authenticated using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "share links: owner manages" on public.share_links;
create policy "share links: owner manages" on public.share_links
  for all to authenticated using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

-- ---------------------------------------------------------------- functions the app calls

-- Open a view-only link. Works without signing in; returns nothing if the link was revoked.
create or replace function public.get_shared_trip(share_token text)
returns table (title text, data jsonb, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.title, t.data, t.updated_at
  from share_links s join trips t on t.id = s.trip_id
  where s.token = share_token and not s.revoked;
$$;
revoke all on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;

-- After signing in, turn any invitations sent to this email into memberships.
create or replace function public.accept_my_invites()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  me_email text := lower(auth.jwt() ->> 'email');
  n integer := 0;
begin
  if auth.uid() is null or me_email is null then return 0; end if;
  insert into trip_members (trip_id, user_id, role)
    select trip_id, auth.uid(), role from trip_invites
    where lower(email) = me_email and accepted_at is null
  on conflict (trip_id, user_id) do nothing;
  get diagnostics n = row_count;
  update trip_invites set accepted_at = now() where lower(email) = me_email and accepted_at is null;
  return n;
end $$;
revoke all on function public.accept_my_invites() from public;
grant execute on function public.accept_my_invites() to authenticated;

-- Owner removes someone: deletes their invitation and, if they already joined, their access.
create or replace function public.remove_trip_person(t uuid, person_email text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from trips where id = t and owner_id = auth.uid()) then
    raise exception 'Only the trip owner can remove people';
  end if;
  delete from trip_members m
    using auth.users u
    where m.trip_id = t and m.user_id = u.id and lower(u.email) = lower(person_email);
  delete from trip_invites where trip_id = t and lower(email) = lower(person_email);
end $$;
revoke all on function public.remove_trip_person(uuid, text) from public;
grant execute on function public.remove_trip_person(uuid, text) to authenticated;

-- ---------------------------------------------------------------- live editing together
-- Lets everyone on a shared trip see edits as they happen.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trips'
  ) then
    alter publication supabase_realtime add table public.trips;
  end if;
end $$;
