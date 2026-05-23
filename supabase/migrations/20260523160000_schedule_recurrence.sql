-- ============================================================================
-- PickleCheck — recurring schedule model (weekly / biweekly)
-- Run after the previous migrations. The schedules table was empty/unused, so
-- we reshape it: one rule per group, multiple days of week, a cadence, optional
-- end date, and an optional location override.
-- ============================================================================

alter table public.schedules drop column if exists day_of_week;

alter table public.schedules
  add column if not exists days_of_week smallint[] not null default '{}';        -- 0=Sun .. 6=Sat
alter table public.schedules
  add column if not exists frequency text not null default 'weekly'
    check (frequency in ('weekly', 'biweekly'));
alter table public.schedules
  add column if not exists starts_on date not null default current_date;          -- anchor (biweekly parity + generation start)
alter table public.schedules
  add column if not exists ends_on date;                                          -- null = runs forever
alter table public.schedules
  add column if not exists location text;                                         -- null = use the group's location

-- One schedule rule per group (v1); also the upsert target.
create unique index if not exists schedules_group_unique on public.schedules (group_id);
