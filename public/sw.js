/* ============================================================================
 * PickleCheck service worker — Web Push receiver.
 *
 * No fetch handler: this SW only receives push + handles notification taps, so
 * it can't cache stale assets or break the app.
 *
 * Payload shape (from the Vercel sender):
 *   { title, body, tag?, url?, sticky? }
 *
 * sticky: the "must answer" kinds (contingent, confirmed, drop, cancel). Sets
 * requireInteraction so the notification stays until dismissed where the
 * platform honours it (desktop Chrome/Edge; Android keeps it in the tray),
 * plus a vibration pattern on Android. iOS ignores both — the closest thing
 * there is the user's own Banner Style → Persistent setting, which the app
 * tells them about. A phone can't be forced to show a modal; the app shows
 * its own full-screen alert once opened.
 *
 * Tapping a notification opens the app straight to the session, where the user
 * taps In/Out. (We deliberately don't use inline action buttons: on some
 * Android builds the OS hands the service worker the WRONG action for a button,
 * which would set the opposite RSVP — opening the app is always correct.)
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
    requireInteraction: data.sticky === true,
    vibrate: data.sticky === true ? [200, 100, 200] : undefined,
    data: { url: data.url || '/' },
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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(openApp(url));
});
