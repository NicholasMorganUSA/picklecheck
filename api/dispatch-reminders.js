// Reminder dispatcher — called on a schedule by Supabase pg_cron (every ~15 min)
// with `Authorization: Bearer <CRON_SECRET>`. For each upcoming session it fires
// the group's reminder ladder (offsets-before-start) to members who haven't
// committed (undecided + maybe). Idempotent via notification_deliveries.
import { admin, sendToSubscriptions, subscriptionsForUsers, formatWhen } from './_lib.js';

const GRACE_MS = 30 * 60 * 1000;          // fire a step up to 30 min late (tolerate cron gaps)
const WINDOW_MS = 8 * 24 * 3600 * 1000;   // only look at sessions starting within 8 days

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers['authorization'] || '') !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const db = admin();
  const now = Date.now();

  try {
    // Groups with a non-empty reminder ladder.
    const { data: settings, error: setErr } = await db
      .from('group_notification_settings')
      .select('group_id, reminder_offsets, quiet_start, quiet_end');
    if (setErr) throw setErr;
    const cfgByGroup = {};
    for (const s of settings || []) {
      if ((s.reminder_offsets || []).length) cfgByGroup[s.group_id] = s;
    }
    const groupIds = Object.keys(cfgByGroup);
    if (!groupIds.length) return res.status(200).json({ ok: true, sent: 0, note: 'no ladders' });

    // Per-group timezone (from the schedule) + display name.
    const tzByGroup = {};
    const nameByGroup = {};
    const { data: scheds } = await db.from('schedules').select('group_id, timezone').in('group_id', groupIds);
    for (const s of scheds || []) tzByGroup[s.group_id] = s.timezone;
    const { data: grps } = await db.from('groups').select('id, name').in('id', groupIds);
    for (const g of grps || []) nameByGroup[g.id] = g.name;

    // Upcoming, non-cancelled sessions for those groups.
    const { data: sessions, error: sErr } = await db
      .from('sessions')
      .select('id, group_id, starts_at, location, cancelled_at, invited_user_ids')
      .in('group_id', groupIds)
      .gte('starts_at', new Date(now).toISOString())
      .lte('starts_at', new Date(now + WINDOW_MS).toISOString())
      .is('cancelled_at', null)
      .order('starts_at', { ascending: true });
    if (sErr) throw sErr;

    let totalSent = 0;
    for (const session of sessions || []) {
      const cfg = cfgByGroup[session.group_id];
      const tz = tzByGroup[session.group_id];
      const startMs = new Date(session.starts_at).getTime();

      for (const offMin of cfg.reminder_offsets) {
        const fireMs = startMs - offMin * 60 * 1000;
        // Due if we're in [fireTime, fireTime+grace) and before start.
        if (!(now >= fireMs && now <= fireMs + GRACE_MS && now < startMs)) continue;
        if (inQuietHours(cfg, tz, now)) continue;
        totalSent += await dispatchStep(db, session, offMin, nameByGroup[session.group_id], tz);
      }
    }

    const cancelled = await runAutoCancel(db, now);
    return res.status(200).json({ ok: true, sent: totalSent, auto_cancelled: cancelled });
  } catch (e) {
    console.error('[dispatch-reminders] error', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}

function inQuietHours(cfg, tz, nowMs) {
  if (cfg.quiet_start == null || cfg.quiet_end == null || !tz) return false;
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date(nowMs)));
  return cfg.quiet_start <= cfg.quiet_end
    ? (hour >= cfg.quiet_start && hour < cfg.quiet_end)
    : (hour >= cfg.quiet_start || hour < cfg.quiet_end); // window wraps midnight
}

async function dispatchStep(db, session, offMin, groupName, tz) {
  const { data: members } = await db.from('group_members').select('user_id').eq('group_id', session.group_id);
  let memberIds = (members || []).map((m) => m.user_id);
  if (!memberIds.length) return 0;
  // Restricted ad-hoc: only invited users are even eligible.
  if (Array.isArray(session.invited_user_ids) && session.invited_user_ids.length) {
    const invited = new Set(session.invited_user_ids);
    memberIds = memberIds.filter((uid) => invited.has(uid));
    if (!memberIds.length) return 0;
  }

  const { data: rsvps } = await db.from('rsvps').select('user_id, status').eq('session_id', session.id);
  const statusByUser = {};
  for (const r of rsvps || []) statusByUser[r.user_id] = r.status;

  // Not-yet-committed: undecided, maybe, or no RSVP row at all.
  let audience = memberIds.filter((uid) => {
    const st = statusByUser[uid];
    return !st || st === 'undecided' || st === 'maybe';
  });
  if (!audience.length) return 0;

  // Respect personal auto-out ranges (vacation): skip anyone whose range covers
  // this session's date — even if they never opened the app to apply it.
  const sessionDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(session.starts_at));
  const { data: oor } = await db
    .from('user_out_ranges').select('user_id')
    .in('user_id', audience).lte('start_date', sessionDate).gte('end_date', sessionDate);
  const onLeave = new Set((oor || []).map((r) => r.user_id));
  audience = audience.filter((uid) => !onLeave.has(uid));
  if (!audience.length) return 0;

  const subsByUser = await subscriptionsForUsers(db, audience);
  const payload = {
    title: `Check in — ${groupName || 'PickleCheck'}`,
    body: `${formatWhen(session.starts_at, tz)} · Are you in? Tap to RSVP.`,
    tag: `reminder-${session.id}`,
    url: `/?session=${session.id}`,
    sessionId: session.id,
  };

  let sent = 0;
  for (const uid of audience) {
    // Claim this (session,user,step). The partial unique index rejects repeats,
    // so a row already present means "already sent" → skip without re-sending.
    const { error } = await db
      .from('notification_deliveries')
      .insert({ kind: 'reminder', session_id: session.id, user_id: uid, offset_min: offMin });
    if (error) continue;
    sent += await sendToSubscriptions(db, subsByUser[uid] || [], payload);
  }
  return sent;
}

// Auto-cancel: for groups with auto_cancel_minutes_before set, cancel any
// upcoming session inside that window if its IN count is below the group's
// minimum. Cancelled rows are skipped on subsequent ticks, so this fires once.
async function runAutoCancel(db, now) {
  const { data: groups } = await db
    .from('groups')
    .select('id, name, auto_cancel_minutes_before, auto_cancel_min_players')
    .not('auto_cancel_minutes_before', 'is', null);
  if (!groups || !groups.length) return 0;
  const cfgByGroup = {};
  for (const g of groups) cfgByGroup[g.id] = g;

  const { data: sessions } = await db
    .from('sessions')
    .select('id, group_id, starts_at, location, invited_user_ids')
    .in('group_id', Object.keys(cfgByGroup))
    .is('cancelled_at', null)
    .gt('starts_at', new Date(now).toISOString());
  if (!sessions || !sessions.length) return 0;

  let cancelledCount = 0;
  for (const s of sessions) {
    const g = cfgByGroup[s.group_id];
    const minsToStart = Math.floor((new Date(s.starts_at).getTime() - now) / 60000);
    if (minsToStart <= 0 || minsToStart > g.auto_cancel_minutes_before) continue;

    const minP = g.auto_cancel_min_players ?? 4;
    const { data: ins } = await db
      .from('rsvps').select('party_size').eq('session_id', s.id).eq('status', 'in');
    const inCount = (ins || []).reduce((n, r) => n + (r.party_size || 1), 0);
    if (inCount >= minP) continue;

    const reason = `Not enough players (${inCount} of ${minP})`;
    const { error: cancelErr } = await db
      .from('sessions')
      .update({ cancelled_at: new Date(now).toISOString(), cancel_reason: reason })
      .eq('id', s.id);
    if (cancelErr) { console.error('[auto-cancel] update failed', cancelErr); continue; }
    cancelledCount += 1;

    // Push: notify everyone in the group except those explicitly OUT.
    const { data: members } = await db.from('group_members').select('user_id').eq('group_id', s.group_id);
    const { data: rsvps } = await db.from('rsvps').select('user_id, status').eq('session_id', s.id);
    const outSet = new Set((rsvps || []).filter((r) => r.status === 'out').map((r) => r.user_id));
    let audience = (members || []).map((m) => m.user_id).filter((uid) => !outSet.has(uid));
    // Restricted ad-hoc: only invited users get notified.
    if (Array.isArray(s.invited_user_ids) && s.invited_user_ids.length) {
      const invited = new Set(s.invited_user_ids);
      audience = audience.filter((uid) => invited.has(uid));
    }

    const { data: sched } = await db.from('schedules').select('timezone').eq('group_id', s.group_id).maybeSingle();
    const when = formatWhen(s.starts_at, sched?.timezone);
    const payload = {
      title: `Cancelled — ${g.name || 'PickleCheck'}`,
      body: `${when} is cancelled — ${reason}.`,
      tag: `cancel-${s.id}`,
      url: `/?session=${s.id}`,
    };
    const subsByUser = await subscriptionsForUsers(db, audience);
    for (const uid of audience) {
      await sendToSubscriptions(db, subsByUser[uid] || [], payload);
      await db.from('notification_deliveries').insert({ kind: 'cancel', session_id: s.id, user_id: uid });
    }
  }
  return cancelledCount;
}
