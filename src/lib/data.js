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

// Public groups for the Discover flow (RLS allows anyone to read is_public groups).
export async function searchPublicGroups(query) {
  let q = supabase.from('groups').select('id, name, location').eq('is_public', true);
  if (query && query.trim()) q = q.ilike('name', `%${query.trim()}%`);
  const { data, error } = await q.order('name').limit(25);
  if (error) throw error;
  return data || [];
}

// Join a public group directly (RLS permits self-insert as member for public groups).
export async function joinPublicGroup(groupId) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) throw new Error('Not signed in');
  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId, role: 'member' });
  if (error) throw error;
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

// ---- Schedules ------------------------------------------------------------

export async function getSchedule(groupId) {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('group_id', groupId)
    .maybeSingle();
  if (error) throw error;
  return data; // row or null
}

export async function saveSchedule(groupId, { days_of_week, frequency, start_time, ends_on, location }) {
  // Capture the admin's timezone so the nightly cron places sessions at the right wall-clock time.
  const timezone = (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
  const { data, error } = await supabase
    .from('schedules')
    .upsert(
      { group_id: groupId, days_of_week, frequency, start_time, ends_on: ends_on || null, location: location || null, timezone },
      { onConflict: 'group_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Next `count` session datetimes (local) for a schedule rule, respecting cadence + end date.
export function computeUpcomingDates(schedule, count, fromDate = new Date()) {
  const days = new Set((schedule.days_of_week || []).map(Number));
  if (days.size === 0 || count <= 0) return [];
  const interval = schedule.frequency === 'biweekly' ? 2 : 1;
  const startsOn = new Date(`${schedule.starts_on || new Date().toISOString().slice(0, 10)}T00:00:00`);
  const endsOn = schedule.ends_on ? new Date(`${schedule.ends_on}T23:59:59`) : null;
  const [hh, mm] = String(schedule.start_time || '00:00').split(':').map(Number);
  const out = [];
  const cursor = new Date(fromDate); cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 740 && out.length < count; i++) {
    if (endsOn && cursor > endsOn) break;
    if (days.has(cursor.getDay())) {
      const weeks = Math.floor((cursor - startsOn) / (7 * 24 * 3600 * 1000));
      if (interval === 1 || (((weeks % 2) + 2) % 2) === 0) {
        const dt = new Date(cursor); dt.setHours(hh, mm, 0, 0);
        if (dt >= fromDate) out.push(dt);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

// Finalize: create upcoming sessions up to `horizon` from the schedule (skips ones that already exist).
export async function generateSessions(groupId, schedule, horizon) {
  const { data: existing, error: exErr } = await supabase
    .from('sessions')
    .select('starts_at')
    .eq('group_id', groupId)
    .gte('starts_at', new Date().toISOString());
  if (exErr) throw exErr;
  const existingTimes = new Set((existing || []).map((r) => new Date(r.starts_at).getTime()));
  const toInsert = computeUpcomingDates(schedule, Math.max(1, horizon))
    .filter((d) => !existingTimes.has(d.getTime()))
    .map((d) => ({
      group_id: groupId,
      schedule_id: schedule.id,
      starts_at: d.toISOString(),
      location: schedule.location || null,
      court_count: 1,
      is_adhoc: false,
    }));
  if (toInsert.length === 0) return 0;
  const { error } = await supabase.from('sessions').insert(toInsert);
  if (error) throw error;
  return toInsert.length;
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

// ---- Notification settings (per group) ------------------------------------

// The group's reminder ladder + change-alert toggles (admin-managed). Null = unset.
export async function getNotificationSettings(groupId) {
  const { data, error } = await supabase
    .from('group_notification_settings')
    .select('*')
    .eq('group_id', groupId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveNotificationSettings(groupId, patch) {
  const { data, error } = await supabase
    .from('group_notification_settings')
    .upsert({ group_id: groupId, ...patch }, { onConflict: 'group_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Admin-only: each member + whether they have push enabled (device count).
export async function getGroupPushStatus(groupId) {
  const { data, error } = await supabase.rpc('group_push_status', { p_group_id: groupId });
  if (error) throw error;
  return data || [];
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
