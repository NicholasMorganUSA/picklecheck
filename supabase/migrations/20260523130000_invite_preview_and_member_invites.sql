-- ============================================================================
-- PickleCheck — Invite preview + member-initiated invites
-- Run after the previous migrations.
-- ============================================================================

-- Group setting: allow non-admin members to create invite links.
alter table public.groups
  add column if not exists allow_member_invites boolean not null default false;

-- ----------------------------------------------------------------------------
-- create_group_invite: now allows admins OR members (when the group permits it)
-- ----------------------------------------------------------------------------
create or replace function public.create_group_invite(p_group_id uuid)
returns public.group_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv   public.group_invites;
  v_allow boolean;
begin
  select allow_member_invites into v_allow from public.groups where id = p_group_id;

  if not (
    public.is_group_admin(p_group_id)
    or (public.is_group_member(p_group_id) and coalesce(v_allow, false))
  ) then
    raise exception 'not allowed to create invites for this group';
  end if;

  insert into public.group_invites (group_id, created_by)
  values (p_group_id, auth.uid())
  returning * into v_inv;

  return v_inv;
end;
$$;

-- ----------------------------------------------------------------------------
-- preview_invite: public (no auth) preview of what a token leads to, so the
-- /join page can show the group + next session before sign-in. Returns null
-- for an invalid/expired token, and only minimal, non-sensitive fields.
-- ----------------------------------------------------------------------------
create or replace function public.preview_invite(p_token text)
returns json
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_group public.groups;
  v_next  timestamptz;
  v_count int;
begin
  select g.* into v_group
  from public.group_invites i
  join public.groups g on g.id = i.group_id
  where i.token = p_token
    and i.is_active
    and (i.expires_at is null or i.expires_at > now());

  if v_group.id is null then
    return null;
  end if;

  select min(starts_at) into v_next
  from public.sessions
  where group_id = v_group.id and starts_at > now();

  select count(*) into v_count
  from public.group_members
  where group_id = v_group.id;

  return json_build_object(
    'group_name',   v_group.name,
    'location',     v_group.location,
    'next_session', v_next,
    'member_count', v_count
  );
end;
$$;

-- Allow both anonymous (pre-sign-in) and authenticated users to read the preview.
grant execute on function public.preview_invite(text) to anon, authenticated;
