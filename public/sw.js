/* ============================================================================
 * PickleCheck service worker — Web Push receiver.
 *
 * No fetch handler: this SW only receives push + handles notification taps, so
 * it can't cache stale assets or break the app.
 *
 * Payload shape (from the Vercel sender):
 *   { title, body, tag?, url?, sessionId?, actions?: [{action,title}] }
 *
 * Tapping an "I'm in / Out" action button sets the RSVP DIRECTLY via /api/rsvp
 * (identified by this device's push subscription) — the app does NOT need to be
 * open. A body tap opens the app to the session. On platforms where action
 * buttons don't show (iOS), the body tap falls back to ?rsvp= deep-link.
 * ========================================================================== */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'PickleCheck';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || '/', sessionId: data.sessionId || null },
    actions: Array.isArray(data.actions) ? data.actions : [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

async function openApp(url) {
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const w of wins) {
    if ('focus' in w) {
      if ('navigate' in w) { try { await w.navigate(url); } catch { /* uncontrolled */ } }
      return w.focus();
    }
  }
  return self.clients.openWindow(url);
}

// Set the RSVP directly from the SW using this device's subscription as identity.
async function setRsvpDirect(sessionId, status) {
  const sub = await self.registration.pushManager.getSubscription();
  if (!sub) return false;
  try {
    const r = await fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint, sessionId, status }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action; // 'in' | 'out' | 'maybe' | '' (body tap)
  const data = event.notification.data || {};
  const url = data.url || '/';
  const sessionId = data.sessionId;

  // Action button → set the RSVP without opening the app, then confirm.
  if ((action === 'in' || action === 'out' || action === 'maybe') && sessionId) {
    event.waitUntil((async () => {
      const ok = await setRsvpDirect(sessionId, action);
      if (ok) {
        const label = action === 'in' ? "You're IN ✅" : action === 'out' ? "You're OUT" : "You're a MAYBE";
        await self.registration.showNotification('PickleCheck', {
          body: label, icon: '/icon-192.png', badge: '/icon-192.png', tag: `ack-${sessionId}`,
        });
      } else {
        // Couldn't set it directly — open the app with the intent as a fallback.
        const sep = url.includes('?') ? '&' : '?';
        await openApp(`${url}${sep}rsvp=${action}`);
      }
    })());
    return;
  }

  // Body tap → just open the app to the session.
  event.waitUntil(openApp(url));
});
