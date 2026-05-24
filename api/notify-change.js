// Event alert — called by the client right after an admin acts on a session:
//   • cancel : session called off          → everyone NOT out
//   • watch  : "weather watch" heads-up     → everyone NOT out
//   • change : time/location changed        → committed players (IN + MAYBE)
// The reason text is read from the row server-side. Caller must be a group admin.
import {
  admin, userIdFromRequest, subscriptionsForUsers, sendToSubscriptions, formatWhen, readJsonBody,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const uid = await userIdFromRequest(req);
  if (!uid) return res.status(401).json({ error: 'not signed in' });

  const { sessionId, kind } = readJsonBody(req);
  if (!sessionId || !['cancel', 'change', 'watch'].includes(kind)) {
    return res.status(400).json({ error: 'sessionId and kind (cancel|change|watch) required' });
  }

  const db = admin();
  try {
    const { data: session } = await db
      .from('sessions')
      .select('id, group_id, starts_at, location, cancel_reason, watch_reason')
      .eq('id', sessionId).single();
    if (!session) return res.status(404).json({ error: 'session not found' });

    // Caller must be an admin of the group.
    const { data: mem } = await db
      .from('group_members').select('role')
      .eq('group_id', session.group_id).eq('user_id', uid).maybeSingle();
    if (!mem || mem.role !== 'admin') return res.status(403).json({ error: 'not a group admin' });

    // Respect the group's toggles (default on). A weather watch always sends —
    // it's an explicit, deliberate admin action.
    const { data: cfg } = await db
      .from('group_notification_settings')
      .select('notify_on_cancel, notify_on_change').eq('group_id', session.group_id).maybeSingle();
    if (kind === 'cancel' && cfg && cfg.notify_on_cancel === false) return res.status(200).json({ ok: true, sent: 0, note: 'disabled' });
    if (kind === 'change' && cfg && cfg.notify_on_change === false) return res.status(200).json({ ok: true, sent: 0, note: 'disabled' });

    const { data: grp } = await db.from('groups').select('name').eq('id', session.group_id).single();
    const { data: sched } = await db.from('schedules').select('timezone').eq('group_id', session.group_id).maybeSingle();
    const tz = sched?.timezone;
    const when = formatWhen(session.starts_at, tz);
    const gname = grp?.name || 'PickleCheck';

    // Audience:
    //   change → committed (IN + MAYBE)
    //   cancel/watch → everyone who hasn't opted out (IN + MAYBE + UNDECIDED/no-row)
    let audience;
    if (kind === 'change') {
      const { data: rsvps } = await db
        .from('rsvps').select('user_id, status').eq('session_id', sessionId).in('status', ['in', 'maybe']);
      audience = (rsvps || []).map((r) => r.user_id);
    } else {
      const { data: members } = await db.from('group_members').select('user_id').eq('group_id', session.group_id);
      const { data: rsvps } = await db.from('rsvps').select('user_id, status').eq('session_id', sessionId);
      const outSet = new Set((rsvps || []).filter((r) => r.status === 'out').map((r) => r.user_id));
      audience = (members || []).map((m) => m.user_id).filter((id) => !outSet.has(id));
    }
    audience = audience.filter((id) => id !== uid); // never notify the admin who acted
    if (!audience.length) return res.status(200).json({ ok: true, sent: 0 });

    const cancelReason = session.cancel_reason ? ` — ${session.cancel_reason}` : '';
    const watchReason = session.watch_reason || 'Weather';
    const payload = {
      cancel: { title: `Cancelled — ${gname}`, body: `${when} is cancelled${cancelReason}.`, tag: `cancel-${sessionId}`, url: `/?session=${sessionId}` },
      watch:  { title: `⚠️ ${watchReason} watch — ${gname}`, body: `${when} may be cancelled (${watchReason.toLowerCase()}). Heads up — we'll confirm soon.`, tag: `watch-${sessionId}`, url: `/?session=${sessionId}` },
      change: { title: `Updated — ${gname}`, body: `${when}${session.location ? ' · ' + session.location : ''} — details changed.`, tag: `change-${sessionId}`, url: `/?session=${sessionId}` },
    }[kind];

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
