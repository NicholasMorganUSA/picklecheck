-- ============================================================================
-- PickleCheck — nightly session auto-generation (cron)
-- Run after the previous migrations.
--
-- Keeps each group's horizon filled automatically. The manual "Finalize" button
-- still does the initial generation; this tops it up nightly. Sessions are
-- placed using the schedule's stored timezone so wall-clock time stays correct.
-- ============================================================================

-- Timezone the schedule's start_time is expressed in (captured from the admin's
-- browser on save). Null = not captured yet → cron skips it until re-saved.
alter table public.schedules add column if not exists timezone text;

-- Generate upcoming sessions for one group, up to its horizon. SECURITY DEFINER
-- so the cron (no auth context) can insert. Skips existing/cancelled-aware count.
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
      -- interpret (date + local time) in the schedule's timezone -> UTC instant
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

-- Run generation across every group that has a schedule with a timezone.
create or replace function public.generate_due_sessions()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  total int := 0;
begin
  for r in select group_id from public.schedules where timezone is not null loop
    total := total + public.generate_group_sessions(r.group_id);
  end loop;
  return total;
end;
$$;

-- ----------------------------------------------------------------------------
-- Schedule it nightly with pg_cron.
-- If the next two statements error with "schema cron does not exist" or a
-- permission error, enable pg_cron first (Dashboard → Database → Extensions →
-- search "pg_cron" → enable), then re-run just these two statements.
-- ----------------------------------------------------------------------------
create extension if not exists pg_cron;

-- 08:00 UTC daily (~early morning US). Re-running is safe; ignore "already exists".
select cron.schedule('picklecheck-nightly-sessions', '0 8 * * *', $job$ select public.generate_due_sessions(); $job$);
