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
// kind: 'cancel' | 'change'. Best-effort — callers should not block UI on it.
export function notifySessionChange(sessionId, kind) {
  return authedPost('/api/notify-change', { sessionId, kind });
}
