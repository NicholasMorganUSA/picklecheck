import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

// ────────────────────────────────────────────────────────────────────
// Shown instead of the app when the user arrives via a password-reset link.
// They're already signed in (the link did that); this just sets the new
// password and then lets them through.
// ────────────────────────────────────────────────────────────────────

const ORB_BG = `
  radial-gradient(ellipse 80% 50% at 50% -10%, rgba(197, 229, 0, 0.10), transparent 60%),
  radial-gradient(ellipse 60% 40% at 90% 30%, rgba(16, 185, 129, 0.06), transparent 60%),
  radial-gradient(ellipse 60% 40% at 10% 80%, rgba(244, 63, 94, 0.05), transparent 60%)
`;
const DISPLAY = "'Bricolage Grotesque', sans-serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";
const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.06)', color: '#fafafa',
  border: '1px solid rgba(255,255,255,0.14)', borderRadius: '12px', padding: '12px 14px',
  fontSize: '16px', fontFamily: BODY, outline: 'none',
};

export default function SetPasswordScreen() {
  const { user, updatePassword, clearRecovery, signOut } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('Those don’t match.'); return; }
    setBusy(true);
    try {
      const { error } = await updatePassword(pw);
      if (error) throw error;
      setDone(true);
      // Clean the auth params off the URL so a refresh doesn't re-trigger.
      try { window.history.replaceState({}, '', window.location.pathname); } catch { /* ignore */ }
      setTimeout(() => clearRecovery(), 900);
    } catch (e2) {
      setErr(e2?.message || 'Could not set the password.');
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#08080c', backgroundImage: ORB_BG, color: '#fafafa',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: BODY,
    }}>
      <div style={{ width: '100%', maxWidth: '360px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', lineHeight: 1, marginBottom: '14px' }}>🔑</div>
        <div style={{ fontFamily: DISPLAY, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>
          {done ? 'Password updated' : 'Set a new password'}
        </div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: '22px' }}>
          {done ? 'You’re signed in. Taking you to the app…' : (
            <>Signed in as <span style={{ color: '#fafafa', fontWeight: 600 }}>{user?.email}</span>. Pick a new password to use from now on.</>
          )}
        </div>
        {!done && (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" autoComplete="new-password" required style={inputStyle} />
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="New password again" autoComplete="new-password" required style={inputStyle} />
            <button type="submit" disabled={busy || !pw || !pw2} style={{
              width: '100%', background: '#c5e500', color: '#1a1f00', border: 'none', borderRadius: '14px',
              padding: '13px 18px', fontSize: '15px', fontWeight: 700, fontFamily: BODY,
              opacity: (busy || !pw || !pw2) ? 0.5 : 1,
            }}>
              {busy ? 'Saving…' : 'Save password'}
            </button>
            {err && <p style={{ fontSize: '13px', color: '#fb7185', lineHeight: 1.4, margin: 0 }}>{err}</p>}
          </form>
        )}
        {!done && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '18px', marginTop: '16px' }}>
            <button onClick={clearRecovery} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: '13px', fontFamily: BODY, fontWeight: 600 }}>
              Keep my current password
            </button>
            <button onClick={() => signOut()} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontFamily: BODY, fontWeight: 600 }}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
