import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { redeemInvite, previewInvite } from '../lib/data.js';
import EmailAuthForm from './EmailAuthForm.jsx';
import GoogleButton from './GoogleButton.jsx';

const DISPLAY = "'Bricolage Grotesque', sans-serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";
const ORB_BG = `
  radial-gradient(ellipse 80% 50% at 50% -10%, rgba(197, 229, 0, 0.10), transparent 60%),
  radial-gradient(ellipse 60% 40% at 90% 30%, rgba(16, 185, 129, 0.06), transparent 60%),
  radial-gradient(ellipse 60% 40% at 10% 80%, rgba(244, 63, 94, 0.05), transparent 60%)
`;

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
  const { user, loading } = useAuth();
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
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <GoogleButton />
        </div>
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
