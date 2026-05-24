-- ============================================================================
-- PickleCheck — Push notifications (phases 1–3)
-- Run after 20260523180000_session_cron.sql
--
-- The scaffold already created `push_subscriptions` (owner-scoped RLS) and
-- `notification_prefs`. This migration adds the per-group reminder ladder,
-- change-alert toggles, a delivery log (so the reminder dispatcher is
-- idempotent), and an admin-only view of who has push enabled.
--
-- The push *sender* runs off-DB (Vercel function using the service role key),
-- which bypasses RLS — so nothing here needs to grant it access.
-- ============================================================================

-- Freshness for the admin reach panel + pruning dead endpoints.
alter table public.push_subscriptions
  add column if not exists last_seen_at timestamptz not null default now();

-- ----------------------------------------------------------------------------
-- group_notification_settings: one row per group (admin-managed).
--   reminder_offsets = minutes-before-start that the check-in nudge fires, e.g.
--     {720,600,480,360} = 12h,10h,8h,6h before. Empty {} = no scheduled reminders.
--   Audience for reminders is fixed in app logic (undecided + maybe); only the
--   timing is configurable per group (deliberate — see DESIGN/push memo).
-- ----------------------------------------------------------------------------
create table if not exists public.group_notification_settings (
  group_id         uuid primary key references public.groups (id) on delete cascade,
  reminder_offsets int[]       not null default '{}',
  notify_on_cancel boolean     not null default true,
  notify_on_change boolean     not null default true,   -- time / location change
  quiet_start      smallint    check (quiet_start between 0 and 23),  -- local hour, optional
  quiet_end        smallint    check (quiet_end   between 0 and 23),
  updated_at       timestamptz not null default now()
);

alter table public.group_notification_settings enable row level security;

drop policy if exists "gns_select_member" on public.group_notification_settings;
create policy "gns_select_member" on public.group_notification_settings
  for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "gns_write_admin" on public.group_notification_settings;
create policy "gns_write_admin" on public.group_notification_settings
  for all to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

drop trigger if exists gns_set_updated_at on public.group_notification_settings;
create trigger gns_set_updated_at
  before update on public.group_notification_settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- notification_deliveries: log of what we've sent. The partial unique index
-- makes the reminder dispatcher idempotent (each ladder step → at most one row
-- per user per session, even if the poll overlaps). Change/cancel alerts are
-- event-driven, so they're just logged for audit (no uniqueness).
-- ----------------------------------------------------------------------------
create table if not exists public.notification_deliveries (
  id         uuid primary key default gen_random_uuid(),
  kind       text        not null check (kind in ('reminder','cancel','change')),
  session_id uuid        references public.sessions (id) on delete cascade,
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  offset_min int,                       -- which ladder step (reminders only)
  sent_at    timestamptz not null default now()
);
create index if not exists notif_deliveries_session_idx
  on public.notification_deliveries (session_id);
create unique index if not exists notif_deliveries_reminder_uq
  on public.notification_deliveries (session_id, user_id, offset_min)
  where kind = 'reminder';

alter table public.notification_deliveries enable row level security;
-- Intentionally no authenticated policies: only the service_role sender touches this.

-- ----------------------------------------------------------------------------
-- Admin reach panel: who in the group has push enabled — WITHOUT exposing any
-- endpoints. SECURITY DEFINER so an admin can see members' subscription state
-- despite the owner-only RLS on push_subscriptions. auth.uid() still reflects
-- the caller, so the embedded admin check gates access (non-admins get 0 rows).
-- ----------------------------------------------------------------------------
create or replace function public.group_push_status(p_group_id uuid)
returns table (user_id uuid, full_name text, devices int, last_seen_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select
    gm.user_id,
    p.full_name,
    count(ps.id)::int    as devices,
    max(ps.last_seen_at) as last_seen_at
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  left join public.push_subscriptions ps on ps.user_id = gm.user_id
  where gm.group_id = p_group_id
    and public.is_group_admin(p_group_id)   -- caller must be an admin of this group
  group by gm.user_id, p.full_name
  order by p.full_name;
$$;
