-- ============================================================================
-- PickleCheck — pause / resume a group (dormant, not deleted)
-- Run after 20260916130000_alert_deliveries.sql
--
-- An admin can pause a group: every upcoming session is cancelled with the
-- reason "Group paused", the nightly generator skips the group, and the app
-- hides its sessions from the feed. Roster, code, schedule and settings all
-- stay. Resume restores the sessions pause cancelled (those still in the
-- future), clears the flag and tops the horizon back up.
-- ============================================================================

alter table public.groups add column if not exists paused_at timestamptz;

-- Nightly generator: skip paused groups (full definition, with the one guard).
create or replace function public.generate_group_sessions(p_group_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sched   public.schedules;
  v_horizon int;
  v_interval int;
  v_count   int;
  v_created int := 0;
  v_cursor  date;
  v_ts      timestamptz;
begin
  -- Paused groups stay dormant: no new sessions until an admin resumes.
  if exists (select 1 from public.groups where id = p_group_id and paused_at is not null) then
    return 0;
  end if;

  select * into v_sched from public.schedules where group_id = p_group_id;
  if v_sched.id is null or coalesce(array_length(v_sched.days_of_week, 1), 0) = 0 then
    return 0;
  end if;
  if v_sched.timezone is null then
    return 0; -- wait until the timezone is captured (client writes it on save)
  end if;

  select coalesce(horizon, 5) into v_horizon from public.groups where id = p_group_id;
  v_interval := case when v_sched.frequency = 'biweekly' then 2 else 1 end;

  -- horizon = number of upcoming, non-cancelled sessions to keep on the books
  select count(*) into v_count
  from public.sessions
  where group_id = p_group_id and starts_at >= now() and cancelled_at is null;

  v_cursor := greatest((now() at time zone v_sched.timezone)::date, v_sched.starts_on);

  for i in 0..740 loop
    exit when v_count >= v_horizon;
    exit when v_sched.ends_on is not null and v_cursor > v_sched.ends_on;

    if extract(dow from v_cursor)::int = any (v_sched.days_of_week)
       and (v_interval = 1 or (((v_cursor - v_sched.starts_on) / 7) % 2) = 0) then
      v_ts := (v_cursor + v_sched.start_time) at time zone v_sched.timezone;
      if v_ts >= now()
         and not exists (select 1 from public.sessions where group_id = p_group_id and starts_at = v_ts) then
        insert into public.sessions (group_id, schedule_id, starts_at, location, court_count, is_adhoc)
        values (p_group_id, v_sched.id, v_ts, v_sched.location, 1, false);
        v_created := v_created + 1;
        v_count := v_count + 1;
      end if;
    end if;

    v_cursor := v_cursor + 1;
  end loop;

  return v_created;
end;
$$;

-- Pause: admin-only. Cancels every upcoming, not-yet-cancelled session.
-- Returns the number of sessions cancelled.
create or replace function public.pause_group(p_group_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if not public.is_group_admin(p_group_id) then
    raise exception 'only a group admin can pause the group';
  end if;
  update public.groups set paused_at = coalesce(paused_at, now()) where id = p_group_id;
  with c as (
    update public.sessions
    set cancelled_at = now(), cancel_reason = 'Group paused', watch_reason = null
    where group_id = p_group_id and starts_at > now() and cancelled_at is null
    returning 1
  )
  select count(*) into v_n from c;
  return v_n;
end;
$$;

-- Resume: admin-only. Restores the future sessions that pause cancelled,
-- clears the flag, and tops the horizon back up from the schedule.
-- Returns the number of sessions restored.
create or replace function public.resume_group(p_group_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if not public.is_group_admin(p_group_id) then
    raise exception 'only a group admin can resume the group';
  end if;
  update public.groups set paused_at = null where id = p_group_id;
  with r as (
    update public.sessions
    set cancelled_at = null, cancel_reason = null
    where group_id = p_group_id and starts_at > now() and cancel_reason = 'Group paused'
    returning 1
  )
  select count(*) into v_n from r;
  perform public.generate_group_sessions(p_group_id);
  return v_n;
end;
$$;

-- Push kinds for the group-level announcements (no session attached).
alter table public.notification_deliveries drop constraint if exists notification_deliveries_kind_check;
alter table public.notification_deliveries
  add constraint notification_deliveries_kind_check
  check (kind in ('reminder', 'cancel', 'change', 'watch', 'new', 'dropout', 'contingent', 'contingent_confirmed', 'pause', 'resume'));
