// Change alert — called by the client right after an admin cancels a session or
// changes its time/location. Notifies everyone who is IN or MAYBE. The caller's
// Supabase token is verified and must be a group admin.
import {
  admin, userIdFromRequest, subscriptionsForUsers, sendToSubscriptions, formatWhen, readJsonBody,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const uid = await userIdFromRequest(req);
  if (!uid) return res.status(401).json({ error: 'not signed in' });

  const { sessionId, kind } = readJsonBody(req);
  if (!sessionId || !['cancel', 'change'].includes(kind)) {
    return res.status(400).json({ error: 'sessionId and kind (cancel|change) required' });
  }

  const db = admin();
  try {
    const { data: session } = await db
      .from('sessions').select('id, group_id, starts_at, location').eq('id', sessionId).single();
    if (!session) return res.status(404).json({ error: 'session not found' });

    // Caller must be an admin of the group.
    const { data: mem } = await db
      .from('group_members').select('role')
      .eq('group_id', session.group_id).eq('user_id', uid).maybeSingle();
    if (!mem || mem.role !== 'admin') return res.status(403).json({ error: 'not a group admin' });

    // Respect the group's toggle (default on if no row yet).
    const { data: cfg } = await db
      .from('group_notification_settings')
      .select('notify_on_cancel, notify_on_change').eq('group_id', session.group_id).maybeSingle();
    const allowed = kind === 'cancel'
      ? (cfg ? cfg.notify_on_cancel : true)
      : (cfg ? cfg.notify_on_change : true);
    if (!allowed) return res.status(200).json({ ok: true, sent: 0, note: 'disabled' });

    const { data: grp } = await db.from('groups').select('name').eq('id', session.group_id).single();
    const { data: sched } = await db.from('schedules').select('timezone').eq('group_id', session.group_id).maybeSingle();
    const tz = sched?.timezone;
    const when = formatWhen(session.starts_at, tz);

    // Audience = committed players (IN + MAYBE), minus the admin who made the change.
    const { data: rsvps } = await db
      .from('rsvps').select('user_id, status').eq('session_id', sessionId).in('status', ['in', 'maybe']);
    const audience = (rsvps || []).map((r) => r.user_id).filter((id) => id !== uid);
    if (!audience.length) return res.status(200).json({ ok: true, sent: 0 });

    const payload = kind === 'cancel'
      ? { title: `Cancelled — ${grp?.name || 'PickleCheck'}`, body: `${when} is cancelled.`, tag: `cancel-${sessionId}`, url: `/?session=${sessionId}` }
      : { title: `Updated — ${grp?.name || 'PickleCheck'}`, body: `${when}${session.location ? ' · ' + session.location : ''} — details changed.`, tag: `change-${sessionId}`, url: `/?session=${sessionId}` };

    const subsByUser = await subscriptionsForUsers(db, audience);
    let sent = 0;
    for (const auId of audience) {
      sent += await sendToSubscriptions(db, subsByUser[auId] || [], payload);
      await db.from('notification_deliveries').insert({ kind, session_id: sessionId, user_id: auId });
    }
    return res.status(200).json({ ok: true, sent });
  } catch (e) {
    console.error('[notify-change] error', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
