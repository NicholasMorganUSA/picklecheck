import { useEffect, useState } from 'react';
import { Bell, AlertTriangle } from 'lucide-react';
import { getPushState, enablePush } from '../lib/push.js';

// ────────────────────────────────────────────────────────────────────
// Full-screen nag to turn notifications ON. Same obnoxious treatment as the
// iOS install prompt: locks scroll, no plain X, "I don't want notifications"
// closes via a confirm modal. Daily snooze.
//
// Only shows when signed in AND push is supported AND state is 'off' (never
// granted yet) or 'denied'. iOS-not-installed is left to the install banner
// (you can't grant notifications until installed anyway).
// ────────────────────────────────────────────────────────────────────

const DISMISS_KEY = 'pc_notif_prompt_dismissed_day';
const DISPLAY = "'Bricolage Grotesque', sans-serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dismissedToday() {
  try { return localStorage.getItem(DISMISS_KEY) === todayKey(); }
  catch { return false; }
}
function isAndroid() {
  return /android/i.test(navigator.userAgent || '');
}
function isIOS() {
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function isStandalone() {
  return window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
}

export default function NotificationsPromptModal({ active }) {
  const [eligible, setEligible] = useState(false);
  const [shown, setShown] = useState(false);
  const [state, setState] = useState('off'); // 'off' | 'denied'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (!active) return;
    if (dismissedToday()) return;
    // Mobile + installed (standalone) only. Desktop never sees this; mobile
    // users see the install banner first, and we wait until they're inside
    // the installed PWA to nag about notifications.
    if (!isIOS() && !isAndroid()) return;
    if (!isStandalone()) return;
    let alive = true;
    (async () => {
      const s = await getPushState().catch(() => 'off');
      if (!alive) return;
      // 'on' / 'needs-install' / 'unsupported' → not our problem.
      if (s !== 'off' && s !== 'denied') return;
      setState(s);
      setEligible(true);
      const t = setTimeout(() => setShown(true), 500);
      return () => clearTimeout(t);
    })();
    return () => { alive = false; };
  }, [active]);

  // Lock body scroll while the modal is up.
  useEffect(() => {
    if (!eligible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [eligible]);

  if (!eligible) return null;

  const enable = async () => {
    setBusy(true); setErr('');
    try {
      const next = await enablePush();
      if (next === 'on') {
        setShown(false);
        setTimeout(() => setEligible(false), 250);
        return;
      }
      setState('denied');
    } catch (e) {
      // Most common: user picked "Don't Allow" — surface the recovery path.
      const msg = e?.message || '';
      if (/not allowed|permission/i.test(msg)) setState('denied');
      else setErr(msg || 'Could not enable.');
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    setShown(false);
    try { localStorage.setItem(DISMISS_KEY, todayKey()); } catch { /* ignore */ }
    setTimeout(() => setEligible(false), 250);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 990,
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

        {/* Bell mark */}
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div style={{
            display: 'inline-flex', width: '52px', height: '52px', borderRadius: '50%',
            background: 'rgba(197,229,0,0.15)', border: '1px solid rgba(197,229,0,0.4)',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(197,229,0,0.25)',
          }}>
            <Bell size={26} style={{ color: '#c5e500' }} />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{ fontFamily: DISPLAY, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '8px' }}>
            {state === 'denied' ? 'Notifications are blocked' : 'Turn on notifications'}
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, padding: '0 12px' }}>
            {state === 'denied' ? (
              <>
                Without them you&rsquo;ll miss{' '}
                <span style={{ color: '#fafafa', fontWeight: 600 }}>check-in reminders, last-minute drops, cancellations</span>, and weather watches. PickleCheck needs these to be useful.
              </>
            ) : (
              <>
                PickleCheck runs on{' '}
                <span style={{ color: '#c5e500', fontWeight: 700 }}>push notifications</span>
                {' '}— check-in nudges before each game, last-minute drops, cancellations, weather watches. It doesn&rsquo;t really work without them.
              </>
            )}
          </div>
        </div>

        {state === 'denied' ? <DeniedSteps /> : <OffSteps />}

        {/* Primary CTA — only meaningful when state is 'off' */}
        {state === 'off' && (
          <button onClick={enable} disabled={busy} style={{
            width: '100%', marginTop: '20px', padding: '16px',
            background: '#c5e500', color: '#1a1f00',
            border: 'none', borderRadius: '14px',
            fontSize: '15px', fontFamily: BODY, fontWeight: 800,
            boxShadow: '0 0 24px rgba(197,229,0,0.35)',
            opacity: busy ? 0.6 : 1,
          }}>
            {busy ? 'Asking your phone…' : 'Enable notifications'}
          </button>
        )}

        {err && (
          <div style={{ marginTop: '12px', fontSize: '12px', textAlign: 'center', color: '#fb7185' }}>{err}</div>
        )}

        {/* Negative-framed close */}
        <button onClick={() => setConfirmClose(true)} style={{
          width: '100%', marginTop: '16px', padding: '14px 16px',
          background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '14px', color: 'rgba(255,255,255,0.45)',
          fontSize: '13px', fontFamily: BODY, fontWeight: 600,
        }}>
          I don&rsquo;t want notifications
        </button>
      </div>

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
              Without notifications you&rsquo;ll miss reminders, last-minute drops, cancellation alerts, and weather watches. PickleCheck needs them to work properly.
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

function OffSteps() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Step n={1}>
        Tap the big <strong style={{ color: '#c5e500' }}>Enable notifications</strong> button below.
      </Step>
      <Step n={2}>
        Your phone will ask permission. Tap <strong style={{ color: '#fafafa' }}>Allow</strong>.
      </Step>
      <Step n={3}>
        That&rsquo;s it — you&rsquo;ll start getting reminders, drop alerts, and cancellations as they happen.
      </Step>
    </div>
  );
}

function DeniedSteps() {
  // Re-asking after a 'Don't Allow' isn't possible — the OS won't re-prompt
  // until they flip it manually in system settings.
  const onIOS = isIOS();
  const onAndroid = isAndroid();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{
        padding: '12px 14px', borderRadius: '14px',
        background: 'rgba(252,211,77,0.10)', border: '1px solid rgba(252,211,77,0.4)',
        color: '#fcd34d', fontSize: '13px', lineHeight: 1.5, marginBottom: '4px',
      }}>
        Your phone is blocking us from re-asking. Flip it back on in your device settings:
      </div>
      {onIOS ? (
        <>
          <Step n={1}>Open the <strong style={{ color: '#fafafa' }}>Settings</strong> app on your iPhone.</Step>
          <Step n={2}>Scroll to find <strong style={{ color: '#fafafa' }}>PickleCheck</strong>, tap it.</Step>
          <Step n={3}>Tap <strong style={{ color: '#fafafa' }}>Notifications</strong> → toggle <strong style={{ color: '#fafafa' }}>Allow Notifications</strong> on.</Step>
          <Step n={4}>Come back to PickleCheck and reopen it.</Step>
        </>
      ) : onAndroid ? (
        <>
          <Step n={1}>Open your <strong style={{ color: '#fafafa' }}>phone&rsquo;s Settings</strong> app.</Step>
          <Step n={2}>Go to <strong style={{ color: '#fafafa' }}>Apps → PickleCheck → Notifications</strong>.</Step>
          <Step n={3}>Turn <strong style={{ color: '#fafafa' }}>All PickleCheck notifications</strong> on.</Step>
          <Step n={4}>Come back to PickleCheck and reopen it.</Step>
        </>
      ) : (
        <>
          <Step n={1}>In your browser&rsquo;s address bar, tap the <strong style={{ color: '#fafafa' }}>lock icon</strong> next to the URL.</Step>
          <Step n={2}>Find <strong style={{ color: '#fafafa' }}>Notifications</strong> and switch it to <strong style={{ color: '#fafafa' }}>Allow</strong>.</Step>
          <Step n={3}>Reload the page.</Step>
        </>
      )}
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
