-- ============================================================================
-- PickleCheck — auto-cancel + flip default group permissions
-- Run after 20260524140000_reach_roles_outranges.sql
--
-- 1. Auto-cancel: a group admin can set
--      auto_cancel_minutes_before  (null = off; e.g. 30 = 30 min before start)
--      auto_cancel_min_players      (e.g. 4)
--    and the reminder dispatcher will cancel sessions in that window if the IN
--    count is below the minimum. (No client UI needed for the cancel itself —
--    the dispatcher just sets cancelled_at + cancel_reason and pushes.)
--
-- 2. Default permissions flipped to TRUE so new groups are open by default:
--      allow_adhoc           — members can create one-off sessions
--      allow_member_invites  — any member can share a join link
--    Backfills every EXISTING group too (user wants this set across the board).
-- ============================================================================

alter table public.groups add column if not exists auto_cancel_minutes_before smallint;
alter table public.groups add column if not exists auto_cancel_min_players    smallint;

alter table public.groups alter column allow_adhoc          set default true;
alter table public.groups alter column allow_member_invites set default true;

update public.groups set allow_adhoc          = true where allow_adhoc          = false;
update public.groups set allow_member_invites = true where allow_member_invites = false;

-- New groups created via the RPC pick up the new defaults (allow_adhoc default,
-- and allow_member_invites via the column default since it isn't in the insert).
create or replace function public.create_group(
  p_name        text,
  p_location    text     default null,
  p_is_public   boolean  default false,
  p_allow_adhoc boolean  default true,
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
