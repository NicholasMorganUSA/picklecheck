-- ============================================================================
-- PickleCheck — Row Level Security policies
-- Run this SECOND, after 20260522120000_initial_schema.sql
--
-- Model (from ROADMAP):
--   * members can read their own group's data
--   * admins can write group-level data
--   * users can read/write their own RSVPs and personal rows
-- All policies target the `authenticated` role; `anon` gets nothing.
-- ============================================================================

alter table public.profiles           enable row level security;
alter table public.groups             enable row level security;
alter table public.group_members      enable row level security;
alter table public.schedules          enable row level security;
alter table public.sessions           enable row level security;
alter table public.rsvps              enable row level security;
alter table public.user_out_ranges    enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.push_subscriptions enable row level security;

-- ----------------------------------------------------------------------------
-- profiles
-- Users read their own profile + profiles of people they share a group with
-- (so rosters can show names). Users may update only their own non-privileged
-- columns: column-level grants below stop anyone from self-setting is_superadmin.
-- ----------------------------------------------------------------------------
create policy "profiles_select_self_or_shared" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_group(id));

create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Restrict which columns `authenticated` may UPDATE. is_superadmin is omitted,
-- so it can only ever be changed by the postgres/service role (e.g. SQL editor).
revoke update on public.profiles from authenticated;
grant  update (email, full_name, avatar_url) on public.profiles to authenticated;

-- ----------------------------------------------------------------------------
-- groups
-- ----------------------------------------------------------------------------
create policy "groups_select_member_or_public" on public.groups
  for select to authenticated
  using (public.is_group_member(id) or is_public);

create policy "groups_insert_creator" on public.groups
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "groups_update_admin" on public.groups
  for update to authenticated
  using (public.is_group_admin(id))
  with check (public.is_group_admin(id));

create policy "groups_delete_admin" on public.groups
  for delete to authenticated
  using (public.is_group_admin(id));

-- ----------------------------------------------------------------------------
-- group_members
-- Self-insert is limited to joining PUBLIC groups as a plain member (Discover
-- join). Group creation + first-admin is handled by public.create_group().
-- Admins manage everyone; members may remove themselves (leave).
-- ----------------------------------------------------------------------------
create policy "group_members_select_member" on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id));

create policy "group_members_insert_admin_or_public_join" on public.group_members
  for insert to authenticated
  with check (
    public.is_group_admin(group_id)
    or (
      user_id = auth.uid()
      and role = 'member'
      and exists (select 1 from public.groups g where g.id = group_id and g.is_public)
    )
  );

create policy "group_members_update_admin" on public.group_members
  for update to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy "group_members_delete_admin_or_self" on public.group_members
  for delete to authenticated
  using (public.is_group_admin(group_id) or user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- schedules (admin-managed, member-readable)
-- ----------------------------------------------------------------------------
create policy "schedules_select_member" on public.schedules
  for select to authenticated
  using (public.is_group_member(group_id));

create policy "schedules_write_admin" on public.schedules
  for all to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

-- ----------------------------------------------------------------------------
-- sessions
-- Admins create/edit/delete. Members may create ad-hoc sessions only when the
-- group allows it. (Scheduled materialization runs server-side as service_role,
-- which bypasses RLS.)
-- ----------------------------------------------------------------------------
create policy "sessions_select_member" on public.sessions
  for select to authenticated
  using (public.is_group_member(group_id));

create policy "sessions_insert_admin_or_adhoc_member" on public.sessions
  for insert to authenticated
  with check (
    public.is_group_admin(group_id)
    or (
      is_adhoc
      and created_by = auth.uid()
      and public.is_group_member(group_id)
      and exists (select 1 from public.groups g where g.id = group_id and g.allow_adhoc)
    )
  );

create policy "sessions_update_admin" on public.sessions
  for update to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy "sessions_delete_admin" on public.sessions
  for delete to authenticated
  using (public.is_group_admin(group_id));

-- ----------------------------------------------------------------------------
-- rsvps
-- Any member of the session's group can read the roster; users write only their
-- own row. (Eager undecided rows are created server-side as service_role.)
-- ----------------------------------------------------------------------------
create policy "rsvps_select_session_member" on public.rsvps
  for select to authenticated
  using (public.is_session_member(session_id));

create policy "rsvps_insert_self" on public.rsvps
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_session_member(session_id));

create policy "rsvps_update_self" on public.rsvps
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "rsvps_delete_self" on public.rsvps
  for delete to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Personal tables — fully owner-scoped
-- ----------------------------------------------------------------------------
create policy "out_ranges_all_self" on public.user_out_ranges
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notif_prefs_all_self" on public.notification_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "push_subs_all_self" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
