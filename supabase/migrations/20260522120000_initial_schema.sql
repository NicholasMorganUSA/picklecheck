-- ============================================================================
-- PickleCheck — Initial schema
-- Run this FIRST, then 20260522120100_rls_policies.sql
--
-- Creates the 9 core tables, helper functions used by RLS, the profiles
-- auto-create trigger, and updated_at triggers. RLS is enabled in the
-- second migration so all policy logic lives in one place.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

-- profiles: one row per auth user. Auto-created on first sign-in (trigger below).
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  full_name     text,
  avatar_url    text,
  -- Single-operator "dev/demo mode" flag. Set true on exactly one row, by hand,
  -- via the SQL editor. Protected from user escalation by column-level grants
  -- in the RLS migration. Safe to drop if you don't want the demo-mode hook.
  is_superadmin boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- groups: a recurring play group (e.g. "EES Thursdays").
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  location    text,
  is_public   boolean     not null default false,  -- searchable in Discover
  allow_adhoc boolean     not null default false,  -- members can create one-off sessions
  lock_in     boolean     not null default true,   -- freeze RSVPs at session start
  -- Horizon is an INSTANCE COUNT, not a number of days (DESIGN_NOTES #7).
  horizon     smallint    not null default 4 check (horizon between 1 and 12),
  created_by  uuid        references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- group_members: membership + role.
create table public.group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid        not null references public.groups (id)   on delete cascade,
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  role       text        not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index group_members_group_id_idx on public.group_members (group_id);
create index group_members_user_id_idx  on public.group_members (user_id);

-- schedules: recurring slots that materialize into sessions.
create table public.schedules (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid        not null references public.groups (id) on delete cascade,
  day_of_week smallint    not null check (day_of_week between 0 and 6),  -- 0 = Sunday
  start_time  time        not null,
  court_count smallint    not null default 1 check (court_count between 1 and 12),
  created_at  timestamptz not null default now()
);
create index schedules_group_id_idx on public.schedules (group_id);

-- sessions: a concrete dated instance (scheduled or ad-hoc).
create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid        not null references public.groups (id)    on delete cascade,
  schedule_id uuid        references public.schedules (id)          on delete set null, -- null = ad-hoc
  starts_at   timestamptz not null,
  court_count smallint    not null default 1 check (court_count between 1 and 12),
  is_adhoc    boolean     not null default false,
  locked      boolean     not null default false,  -- set true once lock-in passes
  created_by  uuid        references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index sessions_group_starts_idx on public.sessions (group_id, starts_at);

-- rsvps: one row per (session, member). Eager-created undecided when a session
-- is materialized (DESIGN_NOTES #8) — done server-side by the materialization job.
create table public.rsvps (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid        not null references public.sessions (id)  on delete cascade,
  user_id    uuid        not null references public.profiles (id)  on delete cascade,
  status     text        not null default 'undecided'
                          check (status in ('in', 'maybe', 'out', 'undecided')),
  party_size smallint    not null default 1 check (party_size >= 1),
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);
create index rsvps_session_id_idx on public.rsvps (session_id);
create index rsvps_user_id_idx    on public.rsvps (user_id);

-- user_out_ranges: date ranges a user is auto-OUT for.
create table public.user_out_ranges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  start_date date        not null,
  end_date   date        not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index user_out_ranges_user_id_idx on public.user_out_ranges (user_id);

-- notification_prefs: one row per user. Auto-created alongside the profile.
create table public.notification_prefs (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  remind_24h         boolean     not null default true,
  remind_3h          boolean     not null default true,
  notify_new_session boolean     not null default true,
  daily_summary      boolean     not null default false,
  updated_at         timestamptz not null default now()
);

-- push_subscriptions: Web Push endpoints per user/device.
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  endpoint   text        not null unique,
  p256dh     text        not null,
  auth       text        not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- ----------------------------------------------------------------------------
-- FUNCTIONS
-- All SECURITY DEFINER functions pin search_path to '' and fully schema-qualify
-- their references (Supabase linter best practice + avoids RLS recursion).
-- ----------------------------------------------------------------------------

-- Generic updated_at stamper.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Auto-create a profile (+ default notification prefs) on first sign-in.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.notification_prefs (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Membership / role checks. SECURITY DEFINER so policies can call them without
-- recursively triggering RLS on group_members.
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(gid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'admin'
  );
$$;

-- True if the caller shares at least one group with target user (for roster reads).
create or replace function public.shares_group(target uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members them on me.group_id = them.group_id
    where me.user_id = auth.uid() and them.user_id = target
  );
$$;

-- True if the caller is a member of the group that owns the given session.
create or replace function public.is_session_member(sid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.sessions s
    where s.id = sid and public.is_group_member(s.group_id)
  );
$$;

-- Create a group and add the caller as its first admin, atomically.
-- Call from the client with: supabase.rpc('create_group', { p_name: '...' })
create or replace function public.create_group(
  p_name        text,
  p_location    text     default null,
  p_is_public   boolean  default false,
  p_allow_adhoc boolean  default false,
  p_horizon     smallint default 4
)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated to create a group';
  end if;

  insert into public.groups (name, location, is_public, allow_adhoc, horizon, created_by)
  values (p_name, p_location, p_is_public, p_allow_adhoc, p_horizon, auth.uid())
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, auth.uid(), 'admin');

  return v_group;
end;
$$;

-- ----------------------------------------------------------------------------
-- TRIGGERS
-- ----------------------------------------------------------------------------

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

create trigger rsvps_set_updated_at
  before update on public.rsvps
  for each row execute function public.set_updated_at();

create trigger notification_prefs_set_updated_at
  before update on public.notification_prefs
  for each row execute function public.set_updated_at();
