import { useEffect, useState } from 'react';
import { Share, AlertTriangle } from 'lucide-react';

// ────────────────────────────────────────────────────────────────────
// iOS install prompt — full-screen, step-by-step, hard to skip.
//
// iOS web push only works for PWAs installed from Safari to the Home Screen,
// and there's no programmatic install API. So we walk them through it:
//   • Safari → 3-step guide to add to Home Screen.
//   • Chrome / other iOS browsers → tell them to switch to Safari first.
// Dismissing requires a confirmation tap ("Skip anyway"). Daily snooze.
// ────────────────────────────────────────────────────────────────────

const DISMISS_KEY = 'pc_ios_install_dismissed_day';

const DISPLAY = "'Bricolage Grotesque', sans-serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

function isIOS() {
  const ua = navigator.userAgent || '';
  const iPhoneIpad = /iphone|ipad|ipod/i.test(ua);
  const iPadDesktopUA = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iPhoneIpad || iPadDesktopUA;
}

function isSafari() {
  const ua = navigator.userAgent || '';
  const notSafari = /CriOS|FxiOS|EdgiOS|OPiOS|Mercury|FBAN|FBAV|Instagram|Line|Twitter|GSA/i.test(ua);
  return /Safari/i.test(ua) && !notSafari;
}

function isStandalone() {
  return window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dismissedToday() {
  try { return localStorage.getItem(DISMISS_KEY) === todayKey(); }
  catch { return false; }
}

export default function IOSInstallPrompt() {
  const [eligible, setEligible] = useState(false);
  const [shown, setShown] = useState(false);
  const [inSafari, setInSafari] = useState(true);
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (isIOS() && !isStandalone() && !dismissedToday()) {
      setInSafari(isSafari());
      setEligible(true);
      const t = setTimeout(() => setShown(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  // Lock body scroll while the modal is up, so the page behind can't be tugged.
  useEffect(() => {
    if (!eligible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [eligible]);

  if (!eligible) return null;

  const skip = () => {
    setShown(false);
    try { localStorage.setItem(DISMISS_KEY, todayKey()); } catch { /* ignore */ }
    setTimeout(() => setEligible(false), 250);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(8,8,12,0.96)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      backgroundImage: `
        radial-gradient(ellipse 80% 50% at 50% -10%, rgba(197, 229, 0, 0.10), transparent 60%),
        radial-gradient(ellipse 60% 40% at 90% 30%, rgba(16, 185, 129, 0.06), transparent 60%),
        radial-gradient(ellipse 60% 40% at 10% 80%, rgba(244, 63, 94, 0.05), transparent 60%)
      `,
      color: '#fafafa', fontFamily: BODY,
      opacity: shown ? 1 : 0, transition: 'opacity 250ms ease',
      display: 'flex', flexDirection: 'column',
      padding: '32px 20px calc(20px + env(safe-area-inset-bottom))',
      overflowY: 'auto',
    }}>
      <div style={{ maxWidth: '440px', width: '100%', margin: '0 auto', flex: 1 }}>

        {/* Pickle dot mark */}
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <span style={{
            display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%',
            background: '#c5e500', boxShadow: '0 0 18px rgba(197,229,0,0.7)',
          }} />
        </div>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontFamily: DISPLAY, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '8px' }}>
            Install PickleCheck
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, padding: '0 12px' }}>
            Add it to your Home Screen for{' '}
            <span style={{ color: '#c5e500', fontWeight: 700 }}>push notifications</span>
            {' '}— check-in reminders, cancellations, weather watches, and last-minute drops. The app needs this to work properly.
          </div>
        </div>

        {/* Steps */}
        {inSafari ? <SafariSteps /> : <SwitchToSafariSteps />}

        {/* Negative-framed close */}
        <button onClick={() => setConfirmClose(true)} style={{
          width: '100%', marginTop: '24px', padding: '14px 16px',
          background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '14px', color: 'rgba(255,255,255,0.45)',
          fontSize: '13px', fontFamily: BODY, fontWeight: 600,
        }}>
          I don&rsquo;t want notifications
        </button>
      </div>

      {/* Close confirmation overlay */}
      {confirmClose && (
        <div role="dialog" aria-label="Confirm skip" style={{
          position: 'fixed', inset: 0, zIndex: 10,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div style={{
            background: '#14141a', borderRadius: '20px', padding: '24px',
            maxWidth: '380px', width: '100%',
            border: '1px solid rgba(244,63,94,0.4)',
            boxShadow: '0 24px 64px -16px rgba(0,0,0,0.7)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <AlertTriangle size={22} style={{ color: '#fb7185', flexShrink: 0 }} />
              <div style={{ fontFamily: DISPLAY, fontSize: '17px', fontWeight: 800, color: '#fafafa' }}>
                Are you sure?
              </div>
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.55, marginBottom: '20px' }}>
              Without installing you&rsquo;ll miss reminders, cancellation alerts, weather watches, and last-minute drops. PickleCheck needs to be installed to work properly.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => setConfirmClose(false)} style={{
                padding: '14px', borderRadius: '14px',
                background: '#c5e500', color: '#1a1f00',
                border: 'none', fontWeight: 800, fontSize: '14px',
                boxShadow: '0 0 20px rgba(197,229,0,0.25)',
              }}>
                Take me back
              </button>
              <button onClick={skip} style={{
                padding: '12px', borderRadius: '12px',
                background: 'transparent', color: 'rgba(255,255,255,0.4)',
                border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px',
              }}>
                Skip anyway · I don&rsquo;t want notifications
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SafariSteps() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Step n={1}>
        Tap the{' '}
        <Share size={15} style={{ display: 'inline', verticalAlign: '-3px', color: '#c5e500' }} />
        {' '}<strong style={{ color: '#fafafa' }}>Share</strong> button — a square with an arrow pointing up, at the <strong style={{ color: '#fafafa' }}>bottom of Safari</strong> (top-right on iPad).
      </Step>
      <Step n={2}>
        Scroll down in the menu that appears and tap{' '}
        <strong style={{ color: '#fafafa' }}>&ldquo;Add to Home Screen&rdquo;</strong>.
      </Step>
      <Step n={3}>
        Tap <strong style={{ color: '#fafafa' }}>&ldquo;Add&rdquo;</strong> in the top-right corner. PickleCheck will appear on your Home Screen — <strong style={{ color: '#fafafa' }}>open it from there</strong>, not Safari.
      </Step>
    </div>
  );
}

function SwitchToSafariSteps() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{
        padding: '14px 14px', borderRadius: '14px',
        background: 'rgba(252,211,77,0.10)', border: '1px solid rgba(252,211,77,0.4)',
        color: '#fcd34d', fontSize: '13px', lineHeight: 1.5, marginBottom: '4px',
      }}>
        You&rsquo;re in <strong>Chrome</strong> (or another browser). Notifications on iPhone only work from <strong>Safari</strong>.
      </div>
      <Step n={1}>
        Open the <strong style={{ color: '#fafafa' }}>Safari</strong> app on your phone.
      </Step>
      <Step n={2}>
        Go to <strong style={{ color: '#c5e500' }}>picklecheck.in</strong>, then come back to this screen and follow the install steps.
      </Step>
    </div>
  );
}

function Step({ n, children }) {
  return (
    <div style={{
      display: 'flex', gap: '12px', padding: '14px',
      background: 'rgba(255,255,255,0.04)', borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{
        flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%',
        background: 'rgba(197,229,0,0.18)', color: '#c5e500',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: DISPLAY, fontWeight: 800, fontSize: '14px',
      }}>{n}</div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.55, paddingTop: '4px', flex: 1 }}>
        {children}
      </div>
    </div>
  );
}
