-- ============================================================================
-- PickleCheck — contingent RSVPs ("I'm in if we reach N")
-- Run after 20260603120000_group_codes.sql
--
-- A player can commit conditionally: status = 'contingent' with contingent_min
-- = the total IN count (including their own party) they need to see before
-- they'll play. Solves the "6 confirmed, nobody wants to be the 7th" stall.
--
-- Resolution happens HERE, in a trigger, because RLS only lets a user write
-- their own rsvp row — the person whose IN pushes the count over the line
-- can't flip anyone else's row from the client. Every rsvp insert/update/
-- delete re-runs resolve_contingents(session) which converts contingents to
-- IN as a group: sorted by threshold, the largest prefix whose combined count
-- (confirmed + their own parties) meets the last threshold in the prefix all
-- flip together. So 6 IN + two people "if 8" → both become IN.
--
-- Once flipped they are a normal IN (contingent_resolved_at is stamped for
-- the "you're confirmed" push + UI copy). They are never auto-reverted if a
-- confirmed player later drops — the existing last-minute-drop flow covers
-- that. Additive + safe on a live DB: old clients never write 'contingent',
-- so the trigger is a no-op until the new UI ships.
-- ============================================================================

alter table public.rsvps drop constraint if exists rsvps_status_check;
alter table public.rsvps add constraint rsvps_status_check
  check (status in ('in', 'maybe', 'out', 'undecided', 'contingent'));

alter table public.rsvps add column if not exists contingent_min smallint
  check (contingent_min is null or contingent_min between 2 and 64);
alter table public.rsvps add column if not exists contingent_resolved_at timestamptz;

alter table public.rsvps drop constraint if exists rsvps_contingent_needs_min;
alter table public.rsvps add constraint rsvps_contingent_needs_min
  check (status <> 'contingent' or contingent_min is not null);

-- Convert every contingent rsvp on a session whose threshold is now met.
-- Returns the number of rows flipped to IN.
create or replace function public.resolve_contingents(p_session_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_running int;
  v_best    int := 0;
  v_k       int := 0;
  v_ids     uuid[] := '{}';
  r         record;
begin
  select coalesce(sum(party_size), 0) into v_running
  from public.rsvps
  where session_id = p_session_id and status = 'in';

  for r in
    select id, party_size, contingent_min
    from public.rsvps
    where session_id = p_session_id and status = 'contingent'
    order by contingent_min asc, updated_at asc, id asc
  loop
    v_k := v_k + 1;
    v_running := v_running + coalesce(r.party_size, 1);
    v_ids := v_ids || r.id;
    if v_running >= r.contingent_min then
      v_best := v_k;
    end if;
  end loop;

  if v_best = 0 then
    return 0;
  end if;

  update public.rsvps
  set status = 'in', contingent_resolved_at = now()
  where id = any (v_ids[1:v_best]);

  return v_best;
end;
$$;

create or replace function public.rsvps_resolve_contingents_trg()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.resolve_contingents(old.session_id);
  else
    perform public.resolve_contingents(new.session_id);
  end if;
  return null;
end;
$$;

-- pg_trigger_depth() guard: the resolve UPDATE fires this trigger again; the
-- nested run is skipped (the outer resolve already settled the session).
drop trigger if exists rsvps_resolve_contingents on public.rsvps;
create trigger rsvps_resolve_contingents
  after insert or update of status, party_size, contingent_min or delete on public.rsvps
  for each row
  when (pg_trigger_depth() < 1)
  execute function public.rsvps_resolve_contingents_trg();

-- Push kinds: 'contingent' = someone went contingent (to maybes/undecided);
-- 'contingent_confirmed' = your threshold was hit (to the contingent player).
alter table public.notification_deliveries drop constraint if exists notification_deliveries_kind_check;
alter table public.notification_deliveries
  add constraint notification_deliveries_kind_check
  check (kind in ('reminder', 'cancel', 'change', 'watch', 'new', 'dropout', 'contingent', 'contingent_confirmed'));

-- One "you're confirmed" push per (session, player). Insert-claim pattern,
-- same as reminders: a duplicate insert fails → already sent → skip.
create unique index if not exists notif_deliveries_contingent_confirmed_uq
  on public.notification_deliveries (session_id, user_id)
  where kind = 'contingent_confirmed';
