-- ============================================================================
-- PickleCheck — last-minute drop-out alerts
-- Run after 20260527120000_auto_cancel_and_defaults.sql
--
-- groups.lastminute_window_minutes : if set, any IN player who drops to OUT or
-- TENTATIVE within that many minutes of start triggers a "Last-minute drop"
-- alert to everyone NOT currently IN, so someone can step in. (Off when null.)
-- Allow logging the new 'dropout' delivery kind.
-- ============================================================================

alter table public.groups add column if not exists lastminute_window_minutes smallint;

alter table public.notification_deliveries drop constraint if exists notification_deliveries_kind_check;
alter table public.notification_deliveries
  add constraint notification_deliveries_kind_check
  check (kind in ('reminder', 'cancel', 'change', 'watch', 'new', 'dropout'));
