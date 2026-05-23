import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import EmailAuthForm from './EmailAuthForm.jsx';

// Matches the prototype's dark backdrop: --bg-app + the three orb radial gradients.
const ORB_BG = `
  radial-gradient(ellipse 80% 50% at 50% -10%, rgba(197, 229, 0, 0.10), transparent 60%),
  radial-gradient(ellipse 60% 40% at 90% 30%, rgba(16, 185, 129, 0.06), transparent 60%),
  radial-gradient(ellipse 60% 40% at 10% 80%, rgba(244, 63, 94, 0.05), transparent 60%)
`;

const DISPLAY = "'Bricolage Grotesque', sans-serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export default function SignIn() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const handleGoogle = async () => {
    setBusy(true); setErr(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) { setErr(error.message || 'Sign-in failed. Please try again.'); setBusy(false); }
    } catch (e) {
      setErr(e?.message || 'Sign-in failed. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#08080c', backgroundImage: ORB_BG, color: '#fafafa',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: BODY,
    }}>
      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', letterSpacing: '-0.02em' }}>
          <span style={{ fontFamily: DISPLAY, fontSize: '40px', fontWeight: 800, lineHeight: 1, color: '#c5e500' }}>Pickle</span>
          <span style={{ fontFamily: DISPLAY, fontSize: '40px', fontWeight: 800, lineHeight: 1, color: '#fafafa' }}>Check</span>
          <span style={{
            display: 'inline-block', width: '10px', height: '10px', background: '#c5e500', borderRadius: '50%',
            margin: '0 3px', transform: 'translateY(2px)', flexShrink: 0, boxShadow: '0 0 12px rgba(197,229,0,0.7)',
          }} />
          <span style={{ fontFamily: DISPLAY, fontSize: '40px', fontWeight: 800, lineHeight: 1, color: 'rgba(255,255,255,0.55)' }}>in</span>
        </div>

        <p style={{ marginTop: '14px', fontSize: '15px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.45 }}>
          Pickleball group check-ins.<br />Know who&rsquo;s playing before you go.
        </p>

        <button
          onClick={handleGoogle}
          disabled={busy}
          style={{
            marginTop: '28px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            background: '#fff', color: '#1a1a1a', border: 'none', borderRadius: '14px', padding: '14px 18px',
            fontSize: '15px', fontWeight: 700, fontFamily: BODY, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
          }}
        >
          <GoogleG />
          Continue with Google
        </button>
        {err && <p style={{ marginTop: '12px', fontSize: '13px', color: '#fb7185', lineHeight: 1.4 }}>{err}</p>}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', margin: '18px 0 4px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.12)' }} />
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.12)' }} />
        </div>

        <div style={{ marginTop: '8px', width: '100%' }}>
          <EmailAuthForm />
        </div>

        <a
          href="/demo"
          style={{
            marginTop: '18px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: '14px', padding: '12px 18px', fontSize: '14px', fontWeight: 600, fontFamily: BODY,
            textDecoration: 'none',
          }}
        >
          I just want to see the app &rarr;
        </a>
      </div>
    </div>
  );
}
