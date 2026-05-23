-- ============================================================================
-- PickleCheck — Invite links + realtime
-- Run AFTER the initial schema + RLS migrations.
--
-- Adds shareable group invite links (one token, reusable until revoked/expired)
-- and turns on realtime for the tables the live UI subscribes to.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- group_invites: a shareable join token per group
-- ----------------------------------------------------------------------------
create table public.group_invites (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid        not null references public.groups (id) on delete cascade,
  -- URL-safe token (32 hex chars), unique. gen_random_uuid avoids a pgcrypto dep.
  token      text        not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid        references public.profiles (id) on delete set null,
  is_active  boolean     not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index group_invites_group_id_idx on public.group_invites (group_id);
create index group_invites_token_idx     on public.group_invites (token);

alter table public.group_invites enable row level security;

-- Admins manage their group's invites; redemption is via the RPC below
-- (SECURITY DEFINER), so non-members never need direct table access.
create policy "group_invites_admin_all" on public.group_invites
  for all to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

-- ----------------------------------------------------------------------------
-- create_group_invite: admin generates a link token for a group
-- ----------------------------------------------------------------------------
create or replace function public.create_group_invite(p_group_id uuid)
returns public.group_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.group_invites;
begin
  if not public.is_group_admin(p_group_id) then
    raise exception 'only group admins can create invites';
  end if;

  insert into public.group_invites (group_id, created_by)
  values (p_group_id, auth.uid())
  returning * into v_inv;

  return v_inv;
end;
$$;

-- ----------------------------------------------------------------------------
-- redeem_invite: any signed-in user joins a group via a valid token
-- ----------------------------------------------------------------------------
create or replace function public.redeem_invite(p_token text)
returns uuid  -- the group_id that was joined
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.group_invites;
begin
  if auth.uid() is null then
    raise exception 'must be signed in to join';
  end if;

  select * into v_inv
  from public.group_invites
  where token = p_token
    and is_active
    and (expires_at is null or expires_at > now());

  if v_inv.id is null then
    raise exception 'invalid or expired invite';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_inv.group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return v_inv.group_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Realtime: let the client subscribe to live changes on these tables
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.rsvps;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.group_members;
