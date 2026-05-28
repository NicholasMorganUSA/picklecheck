// Event alert — called by the client right after a session action:
//   • new     : session just created         → EVERYONE in the group (member auth)
//   • change  : time/location changed         → EVERYONE (an OUT player may flip)
//   • cancel  : session called off           → everyone NOT out (admin auth)
//   • watch   : "weather watch" heads-up      → everyone NOT out (admin auth)
//   • dropout : IN player dropped near start  → everyone NOT in (member auth)
// The reason text is read from the row server-side.
import {
  admin, userIdFromRequest, subscriptionsForUsers, sendToSubscriptions, formatWhen, readJsonBody,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const uid = await userIdFromRequest(req);
  if (!uid) return res.status(401).json({ error: 'not signed in' });

  const { sessionId, kind } = readJsonBody(req);
  if (!sessionId || !['new', 'cancel', 'change', 'watch', 'dropout'].includes(kind)) {
    return res.status(400).json({ error: 'sessionId and kind (new|cancel|change|watch|dropout) required' });
  }

  const db = admin();
  try {
    const { data: session } = await db
      .from('sessions')
      .select('id, group_id, starts_at, location, cancel_reason, watch_reason')
      .eq('id', sessionId).single();
    if (!session) return res.status(404).json({ error: 'session not found' });

    // Auth: 'new' only needs group membership (members may create ad-hoc
    // sessions); the rest are admin-only actions.
    const { data: mem } = await db
      .from('group_members').select('role')
      .eq('group_id', session.group_id).eq('user_id', uid).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'not a group member' });
    if (kind !== 'new' && kind !== 'dropout' && mem.role !== 'admin') return res.status(403).json({ error: 'not a group admin' });

    // Respect the group's toggles (default on). 'new' and 'watch' always send —
    // they're explicit, deliberate actions.
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

    // Pre-load rsvps once — used by multiple audience rules below.
    const { data: allRsvps } = await db.from('rsvps').select('user_id, status, party_size').eq('session_id', sessionId);

    // Audience:
    //   new / change   → everyone in the group (a change can win back an OUT player)
    //   cancel / watch → everyone who hasn't opted out (IN + MAYBE + UNDECIDED/no-row)
    //   dropout        → everyone NOT currently IN (so someone can step in)
    let audience;
    if (kind === 'new' || kind === 'change') {
      const { data: members } = await db.from('group_members').select('user_id').eq('group_id', session.group_id);
      audience = (members || []).map((m) => m.user_id);
    } else if (kind === 'dropout') {
      const { data: members } = await db.from('group_members').select('user_id').eq('group_id', session.group_id);
      const inSet = new Set((allRsvps || []).filter((r) => r.status === 'in').map((r) => r.user_id));
      audience = (members || []).map((m) => m.user_id).filter((id) => !inSet.has(id));
    } else {
      const { data: members } = await db.from('group_members').select('user_id').eq('group_id', session.group_id);
      const outSet = new Set((allRsvps || []).filter((r) => r.status === 'out').map((r) => r.user_id));
      audience = (members || []).map((m) => m.user_id).filter((id) => !outSet.has(id));
    }
    audience = audience.filter((id) => id !== uid); // never notify the person who acted
    if (!audience.length) return res.status(200).json({ ok: true, sent: 0 });

    const cancelReason = session.cancel_reason ? ` — ${session.cancel_reason}` : '';
    const watchReason = session.watch_reason || 'Weather';
    const loc = session.location ? ` · ${session.location}` : '';

    // For dropout: name the caller + show the post-drop IN count (and the group's
    // minimum if set), so recipients see both who dropped and why it matters.
    let dropoutBody = '';
    if (kind === 'dropout') {
      const { data: caller } = await db.from('profiles').select('full_name').eq('id', uid).single();
      const callerName = caller?.full_name || 'A player';
      const inCount = (allRsvps || []).filter((r) => r.status === 'in').reduce((n, r) => n + (r.party_size || 1), 0);
      const { data: g2 } = await db.from('groups').select('auto_cancel_min_players').eq('id', session.group_id).single();
      const minP = g2?.auto_cancel_min_players;
      const ofMin = minP ? ` of ${minP}` : '';
      dropoutBody = `${callerName} can't make it · ${inCount}${ofMin} in. Can you jump in?`;
    }

    const payload = {
      new:     { title: `New session — ${gname}`, body: `${when}${loc} · New session — tap to RSVP.`, tag: `new-${sessionId}`, url: `/?session=${sessionId}` },
      cancel:  { title: `Cancelled — ${gname}`, body: `${when} is cancelled${cancelReason}.`, tag: `cancel-${sessionId}`, url: `/?session=${sessionId}` },
      watch:   { title: `⚠️ ${watchReason} watch — ${gname}`, body: `${when} may be cancelled (${watchReason.toLowerCase()}). Heads up — we'll confirm soon.`, tag: `watch-${sessionId}`, url: `/?session=${sessionId}` },
      change:  { title: `Updated — ${gname}`, body: `${when}${loc} — time/place changed. Tap to update your RSVP.`, tag: `change-${sessionId}`, url: `/?session=${sessionId}` },
      // Unique tag per drop so multiple drops don't collapse on the device.
      dropout: { title: `Last-minute drop — ${gname}`, body: dropoutBody, tag: `dropout-${sessionId}-${Date.now()}`, url: `/?session=${sessionId}` },
    }[kind];
    payload.sessionId = sessionId;

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
