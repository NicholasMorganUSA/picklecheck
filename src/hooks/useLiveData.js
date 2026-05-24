import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { supabase } from '../lib/supabase.js';
import * as data from '../lib/data.js';
import { notifySessionChange } from '../lib/notify.js';

const MS_HOUR = 3600 * 1000;

// Turn one DB session + its rsvps/members into the shape the prototype UI wants:
// { id, groupId, groupName, dateObj, courtCount, in, maybe, out, undecided,
//   myStatus, myPartySize, past, roster:{in,maybe,out,undecided} }
function adaptSession(s, group, members, rsvps, myId, now, schedule) {
  const buckets = { in: [], maybe: [], out: [] };
  let myStatus = 'undecided';
  let myPartySize = 1;

  for (const r of rsvps) {
    const uid = r.user?.id;
    const name = r.user?.full_name || 'Member';
    if (uid === myId) {
      myStatus = r.status;
      myPartySize = r.party_size || 1;
    }
    if (r.status === 'in' || r.status === 'maybe' || r.status === 'out') {
      buckets[r.status].push({ id: uid, name, party: r.party_size || 1 });
    }
  }

  const decided = new Set([...buckets.in, ...buckets.maybe, ...buckets.out].map((x) => x.id));
  const undecidedMembers = members.filter((m) => !decided.has(m.id));

  const sumParty = (list) => list.reduce((n, x) => n + (x.party || 1), 0);
  const label = (x) => (x.party > 1 ? `${x.name} +${x.party - 1}` : x.name);
  const dateObj = new Date(s.starts_at);

  // True when this session's day-of-week or time is off the group's recurring cadence.
  let timeDiffers = false;
  if (schedule && schedule.days_of_week?.length && schedule.start_time) {
    const pad = (n) => String(n).padStart(2, '0');
    const hhmm = `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
    const dayMatch = schedule.days_of_week.map(Number).includes(dateObj.getDay());
    timeDiffers = !dayMatch || hhmm !== String(schedule.start_time).slice(0, 5);
  }

  return {
    id: s.id,
    groupId: s.group_id,
    groupName: group?.name || 'Group',
    location: s.location || group?.location || null,
    // True when this session's location overrides the group's standing location.
    locationDiffers: !!s.location && s.location !== (group?.location || ''),
    timeDiffers,
    createdBy: s.created_by,
    cancelled: !!s.cancelled_at,
    cancelReason: s.cancel_reason || null,
    watchReason: s.watch_reason || null,
    dateObj,
    courtCount: s.court_count,
    in: sumParty(buckets.in),
    maybe: sumParty(buckets.maybe),
    out: buckets.out.length,
    undecided: undecidedMembers.length,
    myStatus,
    myPartySize,
    past: dateObj.getTime() + MS_HOUR < now, // drops off 1h after start
    roster: {
      in: buckets.in.map(label),
      maybe: buckets.maybe.map(label),
      out: buckets.out.map((x) => x.name),
      undecided: undecidedMembers.map((m) => m.full_name || 'Member'),
    },
  };
}

// Loads + live-syncs the signed-in user's real groups, sessions, and RSVPs.
// `enabled` is false in the public /demo so it never touches the network.
export function useLiveData(enabled) {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [membersByGroup, setMembersByGroup] = useState({});
  const [schedulesByGroup, setSchedulesByGroup] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!enabled || !user) { setLoading(false); return; }
    try {
      setError(null);
      const grps = await data.listMyGroups();
      const groupIds = grps.map((g) => g.id);

      const membersByGroup = {};
      await Promise.all(groupIds.map(async (gid) => {
        membersByGroup[gid] = await data.listMembers(gid);
      }));
      // member count for the groups list UI
      const grpsWithCounts = grps.map((g) => ({ ...g, members: (membersByGroup[g.id] || []).length }));

      const schedulesByGroupNext = {};
      if (groupIds.length) {
        const { data: scheds, error: schErr } = await supabase
          .from('schedules')
          .select('*')
          .in('group_id', groupIds);
        if (schErr) throw schErr;
        for (const s of scheds || []) schedulesByGroupNext[s.group_id] = s;
      }

      const sess = await data.listSessions(groupIds);
      const sessionIds = sess.map((s) => s.id);

      const rsvpsBySession = {};
      if (sessionIds.length) {
        const { data: rows, error: rErr } = await supabase
          .from('rsvps')
          .select('session_id, status, party_size, user:profiles(id, full_name)')
          .in('session_id', sessionIds);
        if (rErr) throw rErr;
        for (const r of rows || []) {
          (rsvpsBySession[r.session_id] ||= []).push(r);
        }
      }

      const now = Date.now();
      const adapted = sess.map((s) =>
        adaptSession(s, grps.find((g) => g.id === s.group_id), membersByGroup[s.group_id] || [], rsvpsBySession[s.id] || [], user.id, now, schedulesByGroupNext[s.group_id]),
      );

      // Auto-out: for upcoming sessions the user hasn't answered (undecided) that
      // fall inside one of their out-ranges, set them OUT. Persists so reminders
      // skip them; reflected optimistically here. Only touches undecided sessions,
      // so an explicit IN/MAYBE/OUT is never overridden, and it self-terminates.
      const ranges = await data.listOutRanges().catch(() => []);
      if (ranges.length) {
        const inRange = (d) => ranges.some((r) => {
          const day = new Date(d); day.setHours(12, 0, 0, 0);
          return day >= new Date(`${r.start_date}T00:00:00`) && day <= new Date(`${r.end_date}T23:59:59`);
        });
        const autoOut = adapted.filter((s) => !s.past && !s.cancelled && s.myStatus === 'undecided' && inRange(s.dateObj));
        if (autoOut.length) {
          for (const s of autoOut) { s.myStatus = 'out'; s.undecided = Math.max(0, s.undecided - 1); s.out += 1; }
          Promise.all(autoOut.map((s) => data.setMyRsvp({ sessionId: s.id, status: 'out', partySize: 1 }))).catch(() => {});
        }
      }

      setGroups(grpsWithCounts);
      setSessions(adapted);
      setMembersByGroup(membersByGroup);
      setSchedulesByGroup(schedulesByGroupNext);
      setLoading(false);
    } catch (e) {
      console.error('[liveData] load error:', e);
      setError(e.message || String(e));
      setLoading(false);
    }
  }, [enabled, user]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Live refresh on any relevant change (simple + correct; refetches on event).
  useEffect(() => {
    if (!enabled || !user) return;
    const ch = supabase
      .channel('picklecheck-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rsvps' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [enabled, user, load]);

  const setRsvp = useCallback(async (sessionId, status, partySize = 1) => {
    await data.setMyRsvp({ sessionId, status, partySize });
    await load();
  }, [load]);

  const createGroup = useCallback(async (args) => {
    const g = await data.createGroup(args);
    await load();
    return g;
  }, [load]);

  const createSession = useCallback(async (args) => {
    const s = await data.createSession(args);
    // Tell the whole group a new session exists (best-effort; never blocks UI).
    try { if (s?.id) await notifySessionChange(s.id, 'new'); }
    catch (e) { console.warn('[notify] new-session alert failed:', e); }
    await load();
    return s;
  }, [load]);

  const updateSession = useCallback(async (id, patch) => {
    await data.updateSession(id, patch);
    // Fire a push (best-effort; never blocks the UI). The reason text is read
    // server-side from the row we just wrote, so we only send the kind here.
    try {
      if (patch.cancelled_at) await notifySessionChange(id, 'cancel');
      else if (patch.watch_reason) await notifySessionChange(id, 'watch');
      else if ('location' in patch || 'starts_at' in patch) await notifySessionChange(id, 'change');
    } catch (e) {
      console.warn('[notify] alert failed:', e);
    }
    await load();
  }, [load]);

  const deleteSession = useCallback(async (id) => {
    await data.deleteSession(id);
    await load();
  }, [load]);

  const createInvite = useCallback((groupId) => data.createInvite(groupId), []);

  const joinGroup = useCallback(async (groupId) => {
    await data.joinPublicGroup(groupId);
    await load();
  }, [load]);

  const saveSchedule = useCallback(async (gid, rule) => {
    const s = await data.saveSchedule(gid, rule);
    await load();
    return s;
  }, [load]);

  const generateSessions = useCallback(async (gid, schedule, horizon) => {
    const n = await data.generateSessions(gid, schedule, horizon);
    await load();
    return n;
  }, [load]);

  const deleteGroup = useCallback(async (gid) => {
    await data.deleteGroup(gid);
    await load();
  }, [load]);

  const saveGroup = useCallback(async (gid, patch) => {
    // Optimistic: reflect the change in the UI immediately (group fields are DB columns).
    setGroups((prev) => prev.map((g) => (g.id === gid ? { ...g, ...patch } : g)));
    try {
      await data.updateGroup(gid, patch); // background write, no full reload
    } catch (e) {
      console.error('[liveData] saveGroup error:', e);
      await load(); // reconcile only if the write failed
    }
  }, [load]);

  return { groups, sessions, membersByGroup, schedulesByGroup, loading, error, reload: load, setRsvp, createGroup, createSession, updateSession, deleteSession, createInvite, joinGroup, saveGroup, deleteGroup, saveSchedule, generateSessions };
}
