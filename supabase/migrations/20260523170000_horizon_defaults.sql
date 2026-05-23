-- ============================================================================
-- PickleCheck — horizon default 5, capped 1..10
-- Run after the previous migrations.
-- ============================================================================

update public.groups set horizon = least(horizon, 10) where horizon > 10;

alter table public.groups alter column horizon set default 5;
alter table public.groups drop constraint if exists groups_horizon_check;
alter table public.groups add constraint groups_horizon_check check (horizon between 1 and 10);

-- New groups default to a horizon of 5.
create or replace function public.create_group(
  p_name        text,
  p_location    text     default null,
  p_is_public   boolean  default false,
  p_allow_adhoc boolean  default false,
  p_horizon     smallint default 5
)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated to create a group';
  end if;

  insert into public.groups (name, location, is_public, allow_adhoc, horizon, created_by)
  values (p_name, p_location, p_is_public, p_allow_adhoc, p_horizon, auth.uid())
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, auth.uid(), 'admin');

  return v_group;
end;
$$;
