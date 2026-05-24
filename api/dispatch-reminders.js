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
      .select('id, group_id, starts_at, location, cancelled_at')
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
    return res.status(200).json({ ok: true, sent: totalSent });
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
  const memberIds = (members || []).map((m) => m.user_id);
  if (!memberIds.length) return 0;

  const { data: rsvps } = await db.from('rsvps').select('user_id, status').eq('session_id', session.id);
  const statusByUser = {};
  for (const r of rsvps || []) statusByUser[r.user_id] = r.status;

  // Not-yet-committed: undecided, maybe, or no RSVP row at all.
  const audience = memberIds.filter((uid) => {
    const st = statusByUser[uid];
    return !st || st === 'undecided' || st === 'maybe';
  });
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
