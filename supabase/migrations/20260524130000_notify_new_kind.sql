-- ============================================================================
-- PickleCheck — allow 'new' notification deliveries (new-session alert)
-- Run after 20260524120000_session_watch_reason.sql
-- ============================================================================

alter table public.notification_deliveries drop constraint if exists notification_deliveries_kind_check;
alter table public.notification_deliveries
  add constraint notification_deliveries_kind_check
  check (kind in ('reminder', 'cancel', 'change', 'watch', 'new'));
