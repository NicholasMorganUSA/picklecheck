import { supabase } from './supabase.js';

// ============================================================================
// Client callers for the push sender (Vercel /api functions). Each request
// carries the user's Supabase access token so the function can authorize them.
// ============================================================================

async function authedPost(path, body) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Not signed in');
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

// Send a test notification to the current user's own devices.
export function sendTestPush() {
  return authedPost('/api/notify-test', {});
}

// Notify IN + MAYBE players that a session was cancelled or changed.
// kind: 'cancel' | 'change' | 'new' | 'watch'. Best-effort — callers should not block UI on it.
export function notifySessionChange(sessionId, kind) {
  return authedPost('/api/notify-change', { sessionId, kind });
}

// "Last-minute drop" alert: an IN player dropped close to start. Pushes everyone
// NOT currently IN so someone can fill in.
export function notifyDropout(sessionId) {
  return authedPost('/api/notify-change', { sessionId, kind: 'dropout' });
}

// After the user's own RSVP write:
//   'contingent' → they just went "in if we hit N": heads-up to MAYBE/UNDECIDED,
//                  plus "you're confirmed" to anyone the trigger resolved.
//   'resolve'    → they went IN: only the "you're confirmed" check.
// Best-effort — never block the UI on it.
export function notifyRsvp(sessionId, kind) {
  return authedPost('/api/notify-change', { sessionId, kind });
}
