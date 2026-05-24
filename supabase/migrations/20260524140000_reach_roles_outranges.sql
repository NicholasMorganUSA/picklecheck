-- ============================================================================
-- PickleCheck — admin reach detail + auto-out reason
-- Run after 20260524130000_notify_new_kind.sql
--
--  • push_subscriptions.standalone : was the device in installed (standalone PWA)
--    mode when it subscribed? Lets admins see who has the APP installed vs just
--    browser notifications. Self-heals on next subscribe/refresh.
--  • user_out_ranges.reason : the UI always collected a reason; the table lacked it.
--  • group_push_status() now also returns role + installed (standalone) count.
-- ============================================================================

alter table public.push_subscriptions add column if not exists standalone boolean not null default false;
alter table public.user_out_ranges   add column if not exists reason text;

drop function if exists public.group_push_status(uuid);
create function public.group_push_status(p_group_id uuid)
returns table (user_id uuid, full_name text, role text, devices int, installed int, last_seen_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select
    gm.user_id,
    p.full_name,
    gm.role,
    count(ps.id)::int                              as devices,
    count(ps.id) filter (where ps.standalone)::int as installed,
    max(ps.last_seen_at)                           as last_seen_at
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  left join public.push_subscriptions ps on ps.user_id = gm.user_id
  where gm.group_id = p_group_id
    and public.is_group_admin(p_group_id)   -- caller must be an admin of this group
  group by gm.user_id, p.full_name, gm.role
  order by p.full_name;
$$;
