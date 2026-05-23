import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { redeemInvite, previewInvite } from '../lib/data.js';
import EmailAuthForm from './EmailAuthForm.jsx';

const DISPLAY = "'Bricolage Grotesque', sans-serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";
const ORB_BG = `
  radial-gradient(ellipse 80% 50% at 50% -10%, rgba(197, 229, 0, 0.10), transparent 60%),
  radial-gradient(ellipse 60% 40% at 90% 30%, rgba(16, 185, 129, 0.06), transparent 60%),
  radial-gradient(ellipse 60% 40% at 10% 80%, rgba(244, 63, 94, 0.05), transparent 60%)
`;

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

function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#08080c', backgroundImage: ORB_BG, color: '#fafafa',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: BODY, textAlign: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', letterSpacing: '-0.02em', marginBottom: '18px' }}>
          <span style={{ fontFamily: DISPLAY, fontSize: '30px', fontWeight: 800, color: '#c5e500' }}>Pickle</span>
          <span style={{ fontFamily: DISPLAY, fontSize: '30px', fontWeight: 800, color: '#fafafa' }}>Check</span>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#c5e500', borderRadius: '50%', margin: '0 2px', transform: 'translateY(1px)', boxShadow: '0 0 10px rgba(197,229,0,0.7)' }} />
          <span style={{ fontFamily: DISPLAY, fontSize: '30px', fontWeight: 800, color: 'rgba(255,255,255,0.55)' }}>in</span>
        </div>
        {children}
      </div>
    </div>
  );
}

// /join/:token — invitee lands here. Signed out: prompt Google sign-in that returns
// to this URL. Signed in: redeem the token (join the group) then go to the app.
export default function Join() {
  const { token } = useParams();
  const { user, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState('init'); // init | redeeming | error
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState(null);

  // Public preview (works before sign-in) so the invitee knows what they're joining.
  useEffect(() => {
    if (!token) return;
    let active = true;
    previewInvite(token).then((p) => { if (active) setPreview(p); }).catch(() => {});
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (loading || !user || !token) return;
    let active = true;
    setPhase('redeeming');
    redeemInvite(token)
      .then(() => { if (active) navigate('/', { replace: true }); })
      .catch((e) => { if (active) { setErr(e.message || 'This invite is invalid or expired.'); setPhase('error'); } });
    return () => { active = false; };
  }, [user, loading, token, navigate]);

  const groupName = preview?.group_name;
  const nextPlay = preview?.next_session
    ? new Date(preview.next_session).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;
  const subline = [preview?.location, nextPlay ? `Next play: ${nextPlay}` : null].filter(Boolean).join(' · ');

  if (loading) {
    return <Shell><div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>Loading…</div></Shell>;
  }

  if (!user) {
    return (
      <Shell>
        <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.9)', marginBottom: '6px', lineHeight: 1.4 }}>
          You&rsquo;ve been invited to join
        </p>
        <div style={{ fontFamily: DISPLAY, fontSize: '22px', fontWeight: 800, color: '#c5e500', marginBottom: subline ? '6px' : '24px' }}>
          {groupName || 'a pickleball group'}
        </div>
        {subline && (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '24px', lineHeight: 1.5 }}>{subline}</p>
        )}
        <button
          onClick={() => signInWithGoogle(`${window.location.origin}/join/${token}`)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            background: '#fff', color: '#1a1a1a', border: 'none', borderRadius: '14px', padding: '14px 18px',
            fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: BODY,
          }}
        >
          <GoogleG />
          Continue with Google
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', margin: '18px 0 4px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.12)' }} />
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.12)' }} />
        </div>
        <div style={{ marginTop: '8px', width: '100%' }}>
          <EmailAuthForm />
        </div>
      </Shell>
    );
  }

  if (phase === 'error') {
    return (
      <Shell>
        <p style={{ fontSize: '15px', color: '#fb7185', marginBottom: '20px' }}>{err}</p>
        <Link to="/" style={{ color: '#c5e500', textDecoration: 'none', fontWeight: 600 }}>Go to the app &rarr;</Link>
      </Shell>
    );
  }

  return <Shell><div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>Joining{groupName ? ` ${groupName}` : ' the group'}&hellip;</div></Shell>;
}
