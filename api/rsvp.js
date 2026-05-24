// Set an RSVP straight from a notification action button — called by the service
// worker, no app open required. The caller is identified by their push
// subscription endpoint (long + unguessable, and must match a stored device).
import { admin, readJsonBody } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const { endpoint, sessionId, status } = readJsonBody(req);
  if (!endpoint || !sessionId || !['in', 'out', 'maybe'].includes(status)) {
    return res.status(400).json({ error: 'endpoint, sessionId, and status (in|out|maybe) required' });
  }

  const db = admin();
  try {
    // Identify the user from the device's subscription endpoint.
    const { data: sub } = await db
      .from('push_subscriptions').select('user_id').eq('endpoint', endpoint).maybeSingle();
    if (!sub) return res.status(403).json({ error: 'unknown device' });
    const userId = sub.user_id;

    // Session must exist and the user must be a member of its group.
    const { data: session } = await db
      .from('sessions').select('id, group_id').eq('id', sessionId).maybeSingle();
    if (!session) return res.status(404).json({ error: 'session not found' });
    const { data: mem } = await db
      .from('group_members').select('user_id')
      .eq('group_id', session.group_id).eq('user_id', userId).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'not a group member' });

    // Touch the device (keeps it fresh) and set the RSVP. Omit party_size so an
    // existing guest count isn't clobbered; new rows default to 1.
    await db.from('push_subscriptions').update({ last_seen_at: new Date().toISOString() }).eq('endpoint', endpoint);
    const { error } = await db
      .from('rsvps')
      .upsert({ session_id: sessionId, user_id: userId, status }, { onConflict: 'session_id,user_id' });
    if (error) throw error;

    return res.status(200).json({ ok: true, status });
  } catch (e) {
    console.error('[rsvp] error', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
