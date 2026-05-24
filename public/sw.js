/* ============================================================================
 * PickleCheck service worker — Web Push receiver.
 *
 * Deliberately has NO fetch handler: this SW only receives push + handles
 * notification taps. It does not cache or intercept network requests, so it
 * can't break the app or serve stale assets.
 *
 * Payload shape (sent by the Vercel sender):
 *   { title, body, tag?, url?, actions?: [{action,title}] }
 * Inline action taps (and body taps) open the app deep-linked to the session
 * with ?rsvp=in|out|maybe — the app applies the RSVP on load. This is uniform
 * across platforms (iOS notification action buttons are unreliable).
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
    tag: data.tag || undefined,         // collapse repeats for the same session/step
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' },
    actions: Array.isArray(data.actions) ? data.actions : [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action; // 'in' | 'out' | 'maybe' | '' (body tap)
  let url = (event.notification.data && event.notification.data.url) || '/';

  if (action === 'in' || action === 'out' || action === 'maybe') {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}rsvp=${action}`;
  }

  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      // Reuse an existing tab/PWA window if we have one.
      if ('focus' in w) {
        if ('navigate' in w) { try { await w.navigate(url); } catch { /* cross-origin/no-op */ } }
        return w.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
