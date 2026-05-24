// Test push — sends a one-off notification to the caller's own devices, so a
// user can confirm end-to-end delivery right after enabling notifications.
import { admin, userIdFromRequest, subscriptionsForUsers, sendToSubscriptions } from './_lib.js';

export default async function handler(req, res) {
  const uid = await userIdFromRequest(req);
  if (!uid) return res.status(401).json({ error: 'not signed in' });

  const db = admin();
  try {
    const subsByUser = await subscriptionsForUsers(db, [uid]);
    const subs = subsByUser[uid] || [];
    if (!subs.length) return res.status(200).json({ ok: true, sent: 0, note: 'no devices' });

    const sent = await sendToSubscriptions(db, subs, {
      title: 'PickleCheck',
      body: "🎾 Notifications are on — you're all set!",
      tag: 'test',
      url: '/',
    });
    return res.status(200).json({ ok: true, sent });
  } catch (e) {
    console.error('[notify-test] error', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
