-- ============================================================================
-- PickleCheck — session editing, cancellation, and creator permissions
-- Run after the previous migrations.
--
-- - Adds cancelled_at (null = active; set = cancelled, kept visible as CANCELLED).
-- - Lets the session's CREATOR edit/delete it too (not just group admins).
-- ============================================================================

alter table public.sessions
  add column if not exists cancelled_at timestamptz;

-- Update: admins of the group OR the person who created the session.
drop policy if exists "sessions_update_admin" on public.sessions;
create policy "sessions_update_admin_or_creator" on public.sessions
  for update to authenticated
  using (public.is_group_admin(group_id) or created_by = auth.uid())
  with check (public.is_group_admin(group_id) or created_by = auth.uid());

-- Delete: same — admins or the creator.
drop policy if exists "sessions_delete_admin" on public.sessions;
create policy "sessions_delete_admin_or_creator" on public.sessions
  for delete to authenticated
  using (public.is_group_admin(group_id) or created_by = auth.uid());
