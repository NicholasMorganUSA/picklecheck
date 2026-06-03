-- ============================================================================
-- PickleCheck — group codes (replaces "Discover public groups" flow)
-- Run after 20260529130000_session_invitees.sql
--
-- Every group gets a unique alphanumeric code (uppercase, A–Z + 0–9). Used as:
--   • Join key  : new members type the code to join (no public discovery).
--   • URL       : picklecheck.in/<CODE> joins the group directly.
-- Codes are admin-set with a "generate one for me" client helper. Length is a
-- MINIMUM (8), not a fixed size — admins can pick longer codes.
-- ============================================================================

alter table public.groups add column if not exists code text;

-- Helper for generating codes (used to backfill + offered to admins client-side).
create or replace function public._gen_group_code(p_length int default 8)
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i int;
begin
  for i in 1..p_length loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- Backfill any existing groups (3 in prod; collision math is laughable).
update public.groups set code = public._gen_group_code() where code is null;

alter table public.groups alter column code set not null;
alter table public.groups add constraint groups_code_unique unique (code);
alter table public.groups add constraint groups_code_format
  check (length(code) >= 8 and code ~ '^[A-Z0-9]+$');

-- Update create_group: takes a required code, enforces format + uppercase,
-- surfaces a friendly error on collision.
create or replace function public.create_group(
  p_name        text,
  p_location    text     default null,
  p_is_public   boolean  default false,
  p_allow_adhoc boolean  default true,
  p_horizon     smallint default 5,
  p_code        text     default null
)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups;
  v_code  text;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated to create a group';
  end if;
  v_code := upper(coalesce(p_code, ''));
  if length(v_code) < 8 then
    raise exception 'code must be at least 8 characters';
  end if;
  if v_code !~ '^[A-Z0-9]+$' then
    raise exception 'code must be letters and digits only';
  end if;

  begin
    insert into public.groups (name, location, is_public, allow_adhoc, horizon, created_by, code)
    values (p_name, p_location, p_is_public, p_allow_adhoc, p_horizon, auth.uid(), v_code)
    returning * into v_group;
  exception when unique_violation then
    raise exception 'that group code is already taken — pick a different one';
  end;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, auth.uid(), 'admin');

  return v_group;
end;
$$;

-- Join by code: SECURITY DEFINER so a non-member can look up the group despite
-- RLS hiding private groups. Idempotent (no-op if already a member).
create or replace function public.join_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_code     text;
begin
  if auth.uid() is null then
    raise exception 'must be signed in to join a group';
  end if;
  v_code := upper(coalesce(p_code, ''));
  if v_code = '' then
    raise exception 'no code provided';
  end if;

  select id into v_group_id from public.groups where code = v_code limit 1;
  if v_group_id is null then
    raise exception 'group not found';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;
