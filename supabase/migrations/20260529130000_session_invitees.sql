-- ============================================================================
-- PickleCheck — per-session invite list (for restricted ad-hoc sessions)
-- Run after 20260529120000_lastminute_default_2h.sql
--
-- sessions.invited_user_ids :
--   NULL   = open to the whole group (existing behavior; default).
--   array  = ONLY these user_ids can see the session and receive notifications.
--
-- RLS is tightened so an uninvited member can't SELECT the row, which makes
-- the session truly invisible. All notification paths read this column and
-- intersect their audience with it.
-- ============================================================================

alter table public.sessions add column if not exists invited_user_ids uuid[];

-- Tighten SELECT: must be a group member AND (open or explicitly invited).
drop policy if exists "sessions_select_member" on public.sessions;
create policy "sessions_select_member" on public.sessions
  for select to authenticated
  using (
    public.is_group_member(group_id)
    and (invited_user_ids is null or auth.uid() = any(invited_user_ids))
  );
