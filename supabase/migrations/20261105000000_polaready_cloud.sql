-- PolaReady cloud: events, booths, guest visits, photos, prints, QR scans.
--
-- Who can touch what:
--   * The admin dashboard signs in with Supabase Auth. Only users listed in
--     public.admins can read or write anything (row level security below).
--   * The booth iPad never signs in. It calls the `booth` edge function with
--     its own booth key; the function checks the key and uses the service role.
--   * Guests never touch tables. The `gallery` edge function looks up one
--     visit by its QR code and hands back short-lived links to its photos.

create extension if not exists pgcrypto;

-- Admins ---------------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Events -----------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text,
  client_phone text,
  venue text,
  host_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'design'
    check (status in ('design','ready','live','done')),
  price numeric not null default 250,
  deposit numeric not null default 0,
  paid boolean not null default false,
  notes text,
  -- The system file: everything the booth needs to dress itself for the event.
  config jsonb not null default '{}'::jsonb,
  config_version int not null default 1,
  paper_start int,
  checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Booths ------------------------------------------------------------------------

create table public.booths (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Only the SHA-256 of the booth key is kept; the key itself is shown once.
  token_hash text not null unique,
  active_event_id uuid references public.events(id) on delete set null,
  last_seen timestamptz,
  app_version text,
  created_at timestamptz not null default now()
);

-- What the booth reports -----------------------------------------------------------

-- One guest visit (one tap on Start). Its id is the iPad's session id, so a
-- retried upload lands on the same row instead of counting the guest twice.
create table public.visits (
  id uuid primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  booth_id uuid references public.booths(id) on delete set null,
  code text not null unique,
  started_at timestamptz not null,
  photo_count int not null default 0,
  secs numeric,
  layout text,
  paper text,
  filter text,
  photos_uploaded int not null default 0,
  has_strip boolean not null default false,
  created_at timestamptz not null default now()
);
create index visits_event on public.visits(event_id, started_at desc);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null check (kind in ('photo','strip')),
  idx int not null default 0,
  path text not null unique,
  bytes int,
  created_at timestamptz not null default now()
);
create index photos_visit on public.photos(visit_id);

create table public.prints (
  id uuid primary key,                         -- the iPad's log event id
  event_id uuid not null references public.events(id) on delete cascade,
  visit_id uuid,
  at timestamptz not null,
  copies int not null default 1,
  ok boolean,
  mode text
);
create index prints_event on public.prints(event_id, at);

create table public.problems (
  id uuid primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  visit_id uuid,
  at timestamptz not null,
  kind text not null,
  detail text
);

create table public.scans (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  kind text not null check (kind in ('open','download')),
  at timestamptz not null default now()
);
create index scans_event on public.scans(event_id);

-- Counters ------------------------------------------------------------------------

-- Every number the dashboard shows for an event, worked out in one place so
-- the list and the event page can never disagree.
create or replace view public.event_stats with (security_invoker = true) as
select
  e.id as event_id,
  (select count(*) from public.visits v where v.event_id = e.id)                       as guests,
  (select coalesce(sum(photo_count),0) from public.visits v where v.event_id = e.id)   as photos,
  (select coalesce(sum(copies),0) from public.prints p where p.event_id = e.id and p.ok is not false) as papers,
  (select count(*) from public.prints p where p.event_id = e.id and p.ok = false)      as failed_prints,
  (select greatest(count(*) - count(distinct visit_id),0) from public.prints p
     where p.event_id = e.id and p.ok is not false and p.visit_id is not null)          as reprints,
  (select count(distinct visit_id) from public.scans s where s.event_id = e.id and s.kind='open') as qr_scans,
  (select count(*) from public.scans s where s.event_id = e.id and s.kind='download')  as downloads,
  (select count(*) from public.problems x where x.event_id = e.id)                      as problems,
  (select round(avg(secs)) from public.visits v where v.event_id = e.id and secs is not null) as avg_secs,
  (select max(started_at) from public.visits v where v.event_id = e.id)                 as last_visit,
  case when e.paper_start is null then null
       else e.paper_start - (select coalesce(sum(copies),0) from public.prints p
                              where p.event_id = e.id and p.ok is not false) end        as paper_left
from public.events e;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

-- Row level security: admins only --------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['admins','events','templates','booths','visits','photos','prints','problems','scans']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "admins all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Storage --------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values
  ('photos', 'photos', false),
  ('event-files', 'event-files', false)
on conflict (id) do nothing;

create policy "admins read photos" on storage.objects for select to authenticated
  using (bucket_id in ('photos','event-files') and public.is_admin());
create policy "admins write event files" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-files' and public.is_admin());
create policy "admins update event files" on storage.objects for update to authenticated
  using (bucket_id = 'event-files' and public.is_admin());
create policy "admins delete files" on storage.objects for delete to authenticated
  using (bucket_id in ('photos','event-files') and public.is_admin());

-- Live updates for the dashboard ----------------------------------------------------

alter publication supabase_realtime add table public.visits, public.prints, public.scans, public.problems, public.booths;
