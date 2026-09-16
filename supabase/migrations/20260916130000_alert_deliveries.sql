-- ============================================================================
-- PickleCheck — in-app alert takeovers
-- Run after 20260916120000_contingent_rsvps.sql
--
-- A push can't force a modal on the phone, so the app shows one itself: on
-- open (or live, while open) it reads its own unseen notification_deliveries
-- rows for the "must answer" kinds and puts up a full-screen alert. Rows are
-- written server-side (service role) for exactly the push audience, so the
-- in-app alert and the push always agree on who should see what.
--
-- Users may READ their own delivery rows and UPDATE only seen_at on them.
-- ============================================================================

alter table public.notification_deliveries add column if not exists seen_at timestamptz;

create index if not exists notif_deliveries_user_unseen_idx
  on public.notification_deliveries (user_id, sent_at)
  where seen_at is null;

-- RLS is already enabled (no policies = nobody but service role, until now).
drop policy if exists "notif_deliveries_select_self" on public.notification_deliveries;
create policy "notif_deliveries_select_self" on public.notification_deliveries
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notif_deliveries_update_self" on public.notification_deliveries;
create policy "notif_deliveries_update_self" on public.notification_deliveries
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Only seen_at is writable from the client (kind/session/user stay server-owned).
revoke update on public.notification_deliveries from authenticated;
grant  update (seen_at) on public.notification_deliveries to authenticated;

-- Live delivery: the app subscribes to inserts on its own rows so an alert
-- can pop while the app is already open. RLS applies to realtime too.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notification_deliveries'
  ) then
    alter publication supabase_realtime add table public.notification_deliveries;
  end if;
end $$;
