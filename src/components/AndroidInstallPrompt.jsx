import { useEffect, useState } from 'react';
import { AlertTriangle, Download } from 'lucide-react';

// ────────────────────────────────────────────────────────────────────
// Android install nag — full-screen, same obnoxious treatment as iOS.
//
// Chrome (and other Chromium browsers) fire a `beforeinstallprompt` event when
// the PWA is installable. We capture it ASAP at module load so a fast-firing
// event isn't missed before the component mounts, then the modal's primary
// button calls .prompt() to show the real native install dialog. If the event
// isn't available (e.g. some browsers, or it's already been used), we fall back
// to manual "open the ⋮ menu and tap Install app" steps.
//
// Auto-dismisses when 'appinstalled' fires.
// ────────────────────────────────────────────────────────────────────

const DISMISS_KEY = 'pc_android_install_dismissed_day';
const DISPLAY = "'Bricolage Grotesque', sans-serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

// Module-level capture so we don't miss the event if it fires before mount.
let deferredPrompt = null;
const listeners = new Set();
function notify() { listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } }); }

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

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
function isStandalone() {
  return window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
}

export default function AndroidInstallPrompt() {
  const [eligible, setEligible] = useState(false);
  const [shown, setShown] = useState(false);
  const [hasPrompt, setHasPrompt] = useState(!!deferredPrompt);
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (!isAndroid() || isStandalone() || dismissedToday()) return;
    setEligible(true);
    const t = setTimeout(() => setShown(true), 500);
    return () => clearTimeout(t);
  }, []);

  // Subscribe to deferred-prompt changes (event may fire after mount, or
  // 'appinstalled' may zero it out — both cases need a re-render).
  useEffect(() => {
    if (!eligible) return;
    const fn = () => {
      if (!deferredPrompt && hasPrompt) {
        // Installed — close the modal.
        setShown(false);
        setTimeout(() => setEligible(false), 250);
      }
      setHasPrompt(!!deferredPrompt);
    };
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, [eligible, hasPrompt]);

  // Lock body scroll while the modal is up.
  useEffect(() => {
    if (!eligible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [eligible]);

  if (!eligible) return null;

  const install = async () => {
    if (!deferredPrompt) return;
    setBusy(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      setHasPrompt(false);
      if (choice.outcome === 'accepted') {
        // 'appinstalled' will fire next and the listener closes us. As a
        // safety, also close here.
        setShown(false);
        setTimeout(() => setEligible(false), 250);
      }
    } catch { /* swallow — user can try the manual steps */ }
    finally { setBusy(false); }
  };

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

        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div style={{
            display: 'inline-flex', width: '52px', height: '52px', borderRadius: '50%',
            background: 'rgba(197,229,0,0.15)', border: '1px solid rgba(197,229,0,0.4)',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(197,229,0,0.25)',
          }}>
            <Download size={26} style={{ color: '#c5e500' }} />
          </div>
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

        {hasPrompt ? <NativeSteps /> : <ManualSteps />}

        {/* Primary CTA — fires the real native install dialog when available */}
        {hasPrompt && (
          <button onClick={install} disabled={busy} style={{
            width: '100%', marginTop: '20px', padding: '16px',
            background: '#c5e500', color: '#1a1f00',
            border: 'none', borderRadius: '14px',
            fontSize: '15px', fontFamily: BODY, fontWeight: 800,
            boxShadow: '0 0 24px rgba(197,229,0,0.35)',
            opacity: busy ? 0.6 : 1,
          }}>
            {busy ? 'Installing…' : 'Install PickleCheck'}
          </button>
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

function NativeSteps() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Step n={1}>
        Tap the big <strong style={{ color: '#c5e500' }}>Install PickleCheck</strong> button below.
      </Step>
      <Step n={2}>
        Chrome will pop up a confirmation — tap <strong style={{ color: '#fafafa' }}>Install</strong>.
      </Step>
      <Step n={3}>
        PickleCheck will appear on your Home Screen — <strong style={{ color: '#fafafa' }}>open it from there</strong>, not Chrome.
      </Step>
    </div>
  );
}

function ManualSteps() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{
        padding: '12px 14px', borderRadius: '14px',
        background: 'rgba(252,211,77,0.10)', border: '1px solid rgba(252,211,77,0.4)',
        color: '#fcd34d', fontSize: '13px', lineHeight: 1.5, marginBottom: '4px',
      }}>
        Chrome didn&rsquo;t offer to install. You can still do it manually from the menu:
      </div>
      <Step n={1}>
        Tap the <strong style={{ color: '#fafafa' }}>⋮</strong> (three dots) at the <strong style={{ color: '#fafafa' }}>top-right</strong> of Chrome.
      </Step>
      <Step n={2}>
        Tap <strong style={{ color: '#fafafa' }}>&ldquo;Install app&rdquo;</strong> (or <strong style={{ color: '#fafafa' }}>&ldquo;Add to Home Screen&rdquo;</strong> on older Chrome).
      </Step>
      <Step n={3}>
        Confirm by tapping <strong style={{ color: '#fafafa' }}>Install</strong>.
      </Step>
      <Step n={4}>
        Open it from your Home Screen — not Chrome.
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
