import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";
const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.06)', color: '#fafafa',
  border: '1px solid rgba(255,255,255,0.14)', borderRadius: '12px', padding: '12px 14px',
  fontSize: '15px', fontFamily: BODY, outline: 'none',
};

// Email/password sign-up + sign-in, used on both the main sign-in screen and the
// invite page. On success, auth state updates and the parent reacts (AppGate
// shows the app; Join redeems the invite).
export default function EmailAuthForm({ defaultMode = 'signup' }) {
  const { signUpWithEmail, signInWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState(defaultMode); // 'signup' | 'signin' | 'forgot'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (mode === 'forgot') {
      if (!email) return;
      setBusy(true); setErr(null); setInfo(null);
      try {
        const { error } = await resetPassword(email.trim());
        if (error) throw error;
        setInfo(`Reset link sent to ${email.trim()}. Open it on this phone and you\u2019ll be asked for a new password. Check spam if it\u2019s not there in a minute.`);
      } catch (e2) {
        setErr(e2?.message || 'Could not send the reset link.');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!email || !password) return;
    setBusy(true); setErr(null); setInfo(null);
    try {
      if (mode === 'signup') {
        const { data, error } = await signUpWithEmail(email.trim(), password, name.trim());
        if (error) throw error;
        if (!data.session) {
          setInfo('Account created. If nothing happens, email confirmation may be on — check your inbox or sign in.');
          setBusy(false);
        }
      } else {
        const { error } = await signInWithEmail(email.trim(), password);
        if (error) throw error;
      }
    } catch (e2) {
      setErr(e2?.message || 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <form onSubmit={submit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {mode === 'signup' && (
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" style={inputStyle} />
        )}
        {mode === 'forgot' && (
          <p style={{ margin: '0 0 2px', fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.45, textAlign: 'left' }}>
            Enter the email you signed up with and we&rsquo;ll send a link to set a new password.
          </p>
        )}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" required style={inputStyle} />
        {mode !== 'forgot' && (
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required style={inputStyle} />
        )}
        {(() => {
          const disabled = busy || !email || (mode !== 'forgot' && !password);
          return (
            <button type="submit" disabled={disabled}
              style={{
                width: '100%', background: '#c5e500', color: '#1a1f00', border: 'none', borderRadius: '14px',
                padding: '13px 18px', fontSize: '15px', fontWeight: 700, fontFamily: BODY,
                cursor: busy ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
              }}>
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
            </button>
          );
        })()}
      </form>
      {mode === 'signin' && (
        <button onClick={() => { setMode('forgot'); setErr(null); setInfo(null); }}
          style={{ marginTop: '10px', background: 'none', border: 'none', color: '#c5e500', fontSize: '13px', fontWeight: 600, fontFamily: BODY, cursor: 'pointer' }}>
          Forgot password?
        </button>
      )}
      <button onClick={() => { setMode(mode === 'signup' ? 'signin' : mode === 'forgot' ? 'signin' : 'signup'); setErr(null); setInfo(null); }}
        style={{ marginTop: mode === 'signin' ? '4px' : '12px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontFamily: BODY, cursor: 'pointer' }}>
        {mode === 'signup'
          ? <>Already have an account? <span style={{ color: '#c5e500', fontWeight: 600 }}>Sign in</span></>
          : mode === 'forgot'
            ? <>Remembered it? <span style={{ color: '#c5e500', fontWeight: 600 }}>Back to sign in</span></>
            : <>New here? <span style={{ color: '#c5e500', fontWeight: 600 }}>Create an account</span></>}
      </button>
      {err && <p style={{ marginTop: '12px', fontSize: '13px', color: '#fb7185', lineHeight: 1.4 }}>{err}</p>}
      {info && <p style={{ marginTop: '12px', fontSize: '13px', color: '#c5e500', lineHeight: 1.4 }}>{info}</p>}
    </div>
  );
}
