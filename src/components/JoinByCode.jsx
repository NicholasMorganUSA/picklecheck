import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { joinByCode } from '../lib/data.js';
import GoogleButton from './GoogleButton.jsx';
import EmailAuthForm from './EmailAuthForm.jsx';

// ────────────────────────────────────────────────────────────────────
// picklecheck.in/<CODE> — uppercase-normalize the code, sign in if needed,
// then call the join_by_code RPC. Looks like a slim version of /join/:token.
// ────────────────────────────────────────────────────────────────────

const ORB_BG = `
  radial-gradient(ellipse 80% 50% at 50% -10%, rgba(197, 229, 0, 0.10), transparent 60%),
  radial-gradient(ellipse 60% 40% at 90% 30%, rgba(16, 185, 129, 0.06), transparent 60%),
  radial-gradient(ellipse 60% 40% at 10% 80%, rgba(244, 63, 94, 0.05), transparent 60%)
`;
const DISPLAY = "'Bricolage Grotesque', sans-serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

// Routes that must NOT be treated as group codes. Anything shorter than 8
// characters is also bounced — group codes have an 8-char minimum.
const RESERVED = new Set(['demo', 'app', 'join']);

export default function JoinByCode() {
  const { code: rawCode = '' } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState('checking'); // checking | joining | success | error | bad-format
  const [error, setError] = useState('');

  const code = rawCode.toUpperCase();
  const looksLikeCode = /^[A-Z0-9]{8,}$/.test(code);
  const isReserved = RESERVED.has(rawCode.toLowerCase());

  // Bounce non-codes (typos, future static routes, etc.) straight to the app.
  useEffect(() => {
    if (!looksLikeCode || isReserved) {
      navigate('/', { replace: true });
    }
  }, [looksLikeCode, isReserved, navigate]);

  useEffect(() => {
    if (!looksLikeCode || isReserved) return;
    if (authLoading) return;
    if (!user) { setState('signin'); return; }
    setState('joining');
    joinByCode(code)
      .then(() => { setState('success'); setTimeout(() => navigate('/', { replace: true }), 800); })
      .catch((e) => {
        const msg = (e?.message || '').toLowerCase();
        setError(msg.includes('not found') ? `No group with the code ${code}.` : (e?.message || 'Could not join.'));
        setState('error');
      });
  }, [authLoading, user, code, looksLikeCode, isReserved, navigate]);

  if (!looksLikeCode || isReserved) return null;

  return (
    <div style={{
      minHeight: '100vh', background: '#08080c', backgroundImage: ORB_BG, color: '#fafafa',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: BODY, textAlign: 'center',
    }}>
      <div style={{ maxWidth: '380px', width: '100%' }}>
        <div style={{ fontFamily: DISPLAY, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '10px' }}>
          Join group
        </div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginBottom: '24px' }}>
          Code: <span style={{ fontFamily: 'monospace', letterSpacing: '0.1em', color: '#c5e500', fontWeight: 700 }}>{code}</span>
        </div>

        {state === 'checking' && <Status>Looking up group…</Status>}
        {state === 'joining' && <Status>Joining…</Status>}
        {state === 'success' && <Status ok>You&rsquo;re in. Taking you to the app…</Status>}

        {state === 'signin' && (
          <div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '14px' }}>
              Sign in to join.
            </div>
            <GoogleButton />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '14px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.12)' }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.12)' }} />
            </div>
            <EmailAuthForm />
          </div>
        )}

        {state === 'error' && (
          <div>
            <Status bad>{error}</Status>
            <button onClick={() => navigate('/', { replace: true })}
              style={{ marginTop: '16px', padding: '12px 20px', borderRadius: '12px', background: '#c5e500', color: '#1a1f00', border: 'none', fontWeight: 800, fontSize: '14px' }}>
              Back to PickleCheck
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Status({ children, ok, bad }) {
  return (
    <div style={{
      padding: '14px 18px', borderRadius: '14px',
      background: ok ? 'rgba(197,229,0,0.12)' : bad ? 'rgba(244,63,94,0.12)' : 'rgba(255,255,255,0.04)',
      border: ok ? '1px solid rgba(197,229,0,0.35)' : bad ? '1px solid rgba(244,63,94,0.35)' : '1px solid rgba(255,255,255,0.08)',
      color: ok ? '#c5e500' : bad ? '#fb7185' : 'rgba(255,255,255,0.8)',
      fontSize: '14px', fontWeight: 600,
    }}>{children}</div>
  );
}
