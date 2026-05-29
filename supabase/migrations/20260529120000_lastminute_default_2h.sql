-- ============================================================================
-- PickleCheck — default the drop-out alert window to 2 hours (every group)
-- Run after 20260528120000_lastminute_dropout.sql
--
-- New groups get 120 minutes (2 hr) by default; existing groups whose admin
-- hasn't set the window yet are backfilled to 120. Admins can still pick any
-- value in the Group Settings dropdown (or Off).
-- ============================================================================

alter table public.groups alter column lastminute_window_minutes set default 120;
update public.groups set lastminute_window_minutes = 120 where lastminute_window_minutes is null;
