import { supabase } from './supabase.js';

// ============================================================================
// Web Push client helpers — register the SW, request permission, and store the
// device's subscription in `push_subscriptions` (one row per endpoint/device).
//
// iOS note: push only works once the PWA is installed to the Home Screen FROM
// SAFARI, and Notification.requestPermission() must be called from a user
// gesture (a tap) — so enablePush() is wired to a button, never auto-run.
// ============================================================================

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function pushSupported() {
  return typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

// iOS only exposes Push to installed (standalone) PWAs.
export function isStandalone() {
  return window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
}

function isIOS() {
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Register the SW as early as possible (idempotent). Safe to call on every load.
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

// Coarse state for the UI: what should the toggle show / explain?
//   'unsupported'   — browser has no push at all
//   'needs-install' — iOS Safari, not yet added to Home Screen (push blocked)
//   'denied'        — user blocked notifications in the OS/browser
//   'on'            — subscribed and stored
//   'off'           — supported + allowed, not subscribed yet
export async function getPushState() {
  if (!pushSupported()) {
    if (isIOS() && !isStandalone()) return 'needs-install';
    return 'unsupported';
  }
  if (isIOS() && !isStandalone()) return 'needs-install';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function saveSubscription(sub) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error('Not signed in');
  const json = sub.toJSON();
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: uid,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );
  if (error) throw error;
}

// Request permission (if needed), subscribe, and persist. Returns the new state.
export async function enablePush() {
  if (isIOS() && !isStandalone()) {
    throw new Error('On iPhone, first add PickleCheck to your Home Screen (Share → Add to Home Screen), then open it from there.');
  }
  if (!pushSupported()) throw new Error('This browser doesn’t support notifications.');
  if (!VAPID_PUBLIC_KEY) throw new Error('Notifications aren’t configured yet (missing VAPID key).');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications were not allowed. You can enable them in your browser settings.');
  }

  await registerServiceWorker();
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  await saveSubscription(sub);
  return 'on';
}

// Unsubscribe this device and remove its stored row.
export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {
    /* best-effort */
  }
  return 'off';
}

// Keep last_seen_at fresh + heal a subscription that the browser silently
// rotated (so a device that's still "on" keeps receiving). Call on app load
// when signed in; no-op if not subscribed.
export async function refreshSubscription() {
  if (!pushSupported() || (isIOS() && !isStandalone())) return;
  if (Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await saveSubscription(sub);
  } catch {
    /* ignore */
  }
}
