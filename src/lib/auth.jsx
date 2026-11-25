import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const AuthContext = createContext({ user: null, session: null, loading: true, recovery: false });

// ────────────────────────────────────────────────────────────────────
// Password recovery detection. Supabase's reset link signs the user in and
// redirects back here; we then show "Set a new password" before the app.
// Three signals, any one is enough (belt and braces across PKCE / implicit
// flows and a link opened in a different browser than the one that asked):
//   1. type=recovery in the URL (query or hash) on load
//   2. the PASSWORD_RECOVERY auth event
//   3. we landed via an auth callback (?code=) and the user had a reset
//      email sent within the last hour (user.recovery_sent_at)
// ────────────────────────────────────────────────────────────────────
const RECOVERY_WINDOW_MS = 60 * 60 * 1000;

function urlLooksLikeRecovery() {
  try {
    const q = new URLSearchParams(window.location.search);
    const h = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    return q.get('type') === 'recovery' || h.get('type') === 'recovery';
  } catch { return false; }
}
function urlIsAuthCallback() {
  try {
    const q = new URLSearchParams(window.location.search);
    const h = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    return q.has('code') || h.has('access_token');
  } catch { return false; }
}
function recentlySentRecovery(user) {
  const t = user?.recovery_sent_at ? new Date(user.recovery_sent_at).getTime() : 0;
  return t > 0 && Date.now() - t < RECOVERY_WINDOW_MS;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(() => urlLooksLikeRecovery());
  const [cameViaCallback] = useState(() => urlIsAuthCallback());

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s ?? null);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_IN') {
        if (cameViaCallback && recentlySentRecovery(s?.user)) setRecovery(true);
        // A normal password sign-in (no auth callback in the URL) is never a
        // recovery, even if an old ?type=recovery flag was set from an expired link.
        else if (!cameViaCallback) setRecovery(false);
      }
      if (event === 'SIGNED_OUT') setRecovery(false);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [cameViaCallback]);

  const value = {
    user: session?.user ?? null,
    session,
    loading,
    // True while the user should be setting a new password (reset link flow).
    recovery,
    clearRecovery: () => setRecovery(false),
    signInWithGoogle: (redirectTo) => supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo || (window.location.origin + '/') },
    }),
    signUpWithEmail: (email, password, fullName) => supabase.auth.signUp({
      email,
      password,
      options: { data: fullName ? { full_name: fullName } : {} },
    }),
    signInWithEmail: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    // Emails a one-time reset link. Lands back on the app root, where the
    // recovery detection above takes over.
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/',
    }),
    updatePassword: (password) => supabase.auth.updateUser({ password }),
    signOut: () => supabase.auth.signOut(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
