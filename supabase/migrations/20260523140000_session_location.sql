-- ============================================================================
-- PickleCheck — per-session location
-- Run after the previous migrations.
--
-- Ad-hoc and scheduled sessions can carry their own location (defaults to the
-- group's location in the UI). Null = "use the group location."
-- ============================================================================
alter table public.sessions
  add column if not exists location text;
