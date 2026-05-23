import { useState } from 'react';
import EmailAuthForm from './EmailAuthForm.jsx';
import GoogleButton from './GoogleButton.jsx';

// Matches the prototype's dark backdrop: --bg-app + the three orb radial gradients.
const ORB_BG = `
  radial-gradient(ellipse 80% 50% at 50% -10%, rgba(197, 229, 0, 0.10), transparent 60%),
  radial-gradient(ellipse 60% 40% at 90% 30%, rgba(16, 185, 129, 0.06), transparent 60%),
  radial-gradient(ellipse 60% 40% at 10% 80%, rgba(244, 63, 94, 0.05), transparent 60%)
`;

const DISPLAY = "'Bricolage Grotesque', sans-serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

export default function SignIn() {
  const [googleErr, setGoogleErr] = useState(null);

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

        <div style={{ marginTop: '28px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <GoogleButton onError={setGoogleErr} />
        </div>
        {googleErr && <p style={{ marginTop: '12px', fontSize: '13px', color: '#fb7185', lineHeight: 1.4 }}>{googleErr}</p>}

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
