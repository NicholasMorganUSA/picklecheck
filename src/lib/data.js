import { supabase } from './supabase.js';

// ============================================================================
// PickleCheck data layer — all Supabase reads/writes the real app uses.
// Functions throw on error so callers can try/catch and surface a message.
// ============================================================================

// ---- Groups ---------------------------------------------------------------

// Groups the current user belongs to, with THEIR role, oldest first.
// Must filter by user_id: RLS lets a member read every member row of their
// groups, so without this we'd get one row per member and pick the wrong role.
export async function listMyGroups() {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('group_members')
    .select('role, created_at, group:groups(*)')
    .eq('user_id', uid)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || [])
    .filter((r) => r.group)
    .map((r) => ({ ...r.group, role: r.role }));
}

export async function createGroup({ name, location = null, isPublic = false, allowAdhoc = false, horizon = 4 }) {
  const { data, error } = await supabase.rpc('create_group', {
    p_name: name,
    p_location: location,
    p_is_public: isPublic,
    p_allow_adhoc: allowAdhoc,
    p_horizon: horizon,
  });
  if (error) throw error;
  return data;
}

export async function updateGroup(groupId, patch) {
  const { data, error } = await supabase
    .from('groups')
    .update(patch)
    .eq('id', groupId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Members --------------------------------------------------------------

export async function listMembers(groupId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('role, user:profiles(id, full_name, avatar_url, email)')
    .eq('group_id', groupId);
  if (error) throw error;
  return (data || [])
    .filter((r) => r.user)
    .map((r) => ({ ...r.user, role: r.role }));
}

// ---- Invites --------------------------------------------------------------

export async function createInvite(groupId) {
  const { data, error } = await supabase.rpc('create_group_invite', { p_group_id: groupId });
  if (error) throw error;
  return data; // { token, group_id, ... }
}

export async function redeemInvite(token) {
  const { data, error } = await supabase.rpc('redeem_invite', { p_token: token });
  if (error) throw error;
  return data; // group_id joined
}

// Public preview (no auth) of what a token leads to: { group_name, location, next_session, member_count } or null.
export async function previewInvite(token) {
  const { data, error } = await supabase.rpc('preview_invite', { p_token: token });
  if (error) throw error;
  return data;
}

export function inviteUrl(token) {
  return `${window.location.origin}/join/${token}`;
}

// ---- Sessions -------------------------------------------------------------

// Upcoming + recent sessions across the given groups, soonest first.
export async function listSessions(groupIds) {
  if (!groupIds || groupIds.length === 0) return [];
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .in('group_id', groupIds)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createSession({ groupId, startsAt, location = null, courtCount = 1, isAdhoc = true }) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      group_id: groupId,
      starts_at: startsAt,
      location,
      court_count: courtCount,
      is_adhoc: isAdhoc,
      created_by: auth?.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSession(id, patch) {
  const { data, error } = await supabase
    .from('sessions')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSession(id) {
  const { error } = await supabase.from('sessions').delete().eq('id', id);
  if (error) throw error;
}

// ---- RSVPs ----------------------------------------------------------------

// All RSVP rows for a session, with the responder's name.
export async function listRsvps(sessionId) {
  const { data, error } = await supabase
    .from('rsvps')
    .select('status, party_size, user:profiles(id, full_name)')
    .eq('session_id', sessionId);
  if (error) throw error;
  return data || [];
}

// Set (insert or update) the current user's RSVP for a session.
export async function setMyRsvp({ sessionId, status, partySize = 1 }) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('rsvps')
    .upsert(
      { session_id: sessionId, user_id: userId, status, party_size: partySize },
      { onConflict: 'session_id,user_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Subscribe to live RSVP changes for a session. Returns an unsubscribe fn.
export function subscribeRsvps(sessionId, onChange) {
  const channel = supabase
    .channel(`rsvps:${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rsvps', filter: `session_id=eq.${sessionId}` },
      onChange,
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
