// Shared helpers for the PickleCheck push sender (Vercel serverless functions).
// Files prefixed with "_" are not routed — this is an importable module only.
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

let _vapidReady = false;
function configureWebPush() {
  if (_vapidReady) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@picklecheck.in',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  _vapidReady = true;
}

// Service-role client — bypasses RLS. Server-only.
export function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

// Resolve the caller from their Supabase access token (Authorization: Bearer …).
// Returns the user id, or null if the token is missing/invalid.
export async function userIdFromRequest(req) {
  const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data } = await client.auth.getUser();
  return data?.user?.id || null;
}

// Subscriptions grouped by user_id for the given user ids.
export async function subscriptionsForUsers(db, userIds) {
  if (!userIds.length) return {};
  const { data, error } = await db.from('push_subscriptions').select('*').in('user_id', userIds);
  if (error) throw error;
  const byUser = {};
  for (const s of data || []) (byUser[s.user_id] ||= []).push(s);
  return byUser;
}

// Send one payload to every device in `subs`. Prunes dead endpoints (404/410).
// Returns the count of successful sends.
export async function sendToSubscriptions(db, subs, payload) {
  configureWebPush();
  const body = JSON.stringify(payload);
  let ok = 0;
  await Promise.all((subs || []).map(async (s) => {
    const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
    try {
      await webpush.sendNotification(subscription, body);
      ok += 1;
    } catch (err) {
      const code = err?.statusCode;
      if (code === 404 || code === 410) {
        await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      } else {
        console.error('[push] send failed', code, err?.body || err?.message);
      }
    }
  }));
  return ok;
}

// Human-readable session time in the group's timezone, e.g. "Sat, May 24, 5:00 AM".
export function formatWhen(startsAt, timeZone) {
  const opts = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  if (timeZone) opts.timeZone = timeZone;
  try {
    return new Intl.DateTimeFormat('en-US', opts).format(new Date(startsAt));
  } catch {
    return new Date(startsAt).toUTCString();
  }
}

export function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}
