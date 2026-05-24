-- ============================================================================
-- PickleCheck — session "weather watch" + cancellation reason
-- Run after 20260523190000_push_notifications.sql
--
-- watch_reason : non-null = an active heads-up that the session MIGHT be
--                cancelled (e.g. 'Weather'). Shown as a banner on the card.
-- cancel_reason: why a cancelled session was called off (e.g. 'Weather',
--                'Not enough players', or a custom note). Shown under the
--                big "CANCELLED" stamp. (cancelled_at already exists.)
-- Both are admin-set via updateSession; no policy changes needed (sessions
-- already have admin update RLS).
-- ============================================================================

alter table public.sessions add column if not exists watch_reason  text;
alter table public.sessions add column if not exists cancel_reason text;

-- Allow logging 'watch' deliveries (kind previously only reminder/cancel/change).
alter table public.notification_deliveries drop constraint if exists notification_deliveries_kind_check;
alter table public.notification_deliveries
  add constraint notification_deliveries_kind_check check (kind in ('reminder', 'cancel', 'change', 'watch'));
