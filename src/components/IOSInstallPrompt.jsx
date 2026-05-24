import { useEffect, useState } from 'react';
import { Share, X } from 'lucide-react';

// ────────────────────────────────────────────────────────────────────
// iOS "Add to Home Screen" nudge.
//
// Android/Chrome fires its own native install prompt (beforeinstallprompt),
// so we leave that alone. iOS has no install API at all, and web push only
// works once a PWA is installed FROM SAFARI — so we nudge iOS users there:
//   • In Safari → "Tap Share, then Add to Home Screen".
//   • In Chrome/in-app/other iOS browsers → "Open in Safari first" (those
//     browsers can't create a real installable PWA on iOS).
// Re-shows once per day until installed; dismissing only hides it for the
// rest of the current calendar day.
// ────────────────────────────────────────────────────────────────────

const DISMISS_KEY = 'pc_ios_install_dismissed_day';

const DISPLAY = "'Bricolage Grotesque', sans-serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

function isIOS() {
  const ua = navigator.userAgent || '';
  const iPhoneIpad = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports a desktop ("MacIntel") UA — detect via touch points.
  const iPadDesktopUA = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iPhoneIpad || iPadDesktopUA;
}

function isSafari() {
  const ua = navigator.userAgent || '';
  // Add-to-Home-Screen (as a real standalone app) only works in Safari, not
  // Chrome/Firefox/Edge on iOS or in-app webviews.
  const notSafari = /CriOS|FxiOS|EdgiOS|OPiOS|Mercury|FBAN|FBAV|Instagram|Line|Twitter|GSA/i.test(ua);
  return /Safari/i.test(ua) && !notSafari;
}

function isStandalone() {
  return window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
}

// Local calendar day, e.g. "2026-4-23" — flips at the user's midnight.
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dismissedToday() {
  try {
    return localStorage.getItem(DISMISS_KEY) === todayKey();
  } catch {
    return false;
  }
}

export default function IOSInstallPrompt() {
  const [eligible, setEligible] = useState(false);
  const [shown, setShown] = useState(false); // drives the slide-up
  const [inSafari, setInSafari] = useState(true);

  useEffect(() => {
    if (isIOS() && !isStandalone() && !dismissedToday()) {
      setInSafari(isSafari());
      setEligible(true);
      // Brief delay so it slides up after the page settles, not on first paint.
      const t = setTimeout(() => setShown(true), 1400);
      return () => clearTimeout(t);
    }
  }, []);

  if (!eligible) return null;

  const dismiss = () => {
    setShown(false);
    try { localStorage.setItem(DISMISS_KEY, todayKey()); } catch { /* ignore */ }
    // Unmount after the slide-down finishes.
    setTimeout(() => setEligible(false), 320);
  };

  return (
    <div
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000,
        display: 'flex', justifyContent: 'center',
        padding: '0 12px calc(12px + env(safe-area-inset-bottom))',
        pointerEvents: 'none',
      }}
    >
      <div
        role="dialog"
        aria-label="Install PickleCheck"
        style={{
          pointerEvents: 'auto',
          width: '100%', maxWidth: '440px',
          background: 'rgba(20,20,26,0.92)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(197,229,0,0.35)',
          borderRadius: '18px',
          boxShadow: '0 18px 48px -12px rgba(0,0,0,0.65), 0 0 20px rgba(197,229,0,0.12)',
          padding: '14px 16px',
          color: '#fafafa', fontFamily: BODY,
          transform: shown ? 'translateY(0)' : 'translateY(140%)',
          opacity: shown ? 1 : 0,
          transition: 'transform 320ms cubic-bezier(0.2,0.9,0.3,1), opacity 320ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {/* Pickle dot mark */}
          <div style={{ flexShrink: 0, marginTop: '2px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '11px',
              background: 'rgba(197,229,0,0.12)', border: '1px solid rgba(197,229,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                width: '12px', height: '12px', borderRadius: '50%',
                background: '#c5e500', boxShadow: '0 0 12px rgba(197,229,0,0.8)',
              }} />
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: DISPLAY, fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em' }}>
              Install PickleCheck
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.45, color: 'rgba(255,255,255,0.72)', marginTop: '3px' }}>
              {inSafari ? (
                <>
                  Tap{' '}
                  <Share size={14} style={{ display: 'inline', verticalAlign: '-2px', color: '#c5e500' }} />
                  {' '}below, then{' '}
                  <span style={{ color: '#fafafa', fontWeight: 700 }}>“Add to Home Screen”</span>
                  {' '}to open it like an app.
                </>
              ) : (
                <>
                  <span style={{ color: '#c5e500', fontWeight: 700 }}>Open in Safari</span>
                  , then tap{' '}
                  <Share size={14} style={{ display: 'inline', verticalAlign: '-2px', color: '#c5e500' }} />
                  {' → '}
                  <span style={{ color: '#fafafa', fontWeight: 700 }}>“Add to Home Screen”</span>
                  {' '}to open it like an app.
                </>
              )}
            </div>
          </div>

          <button
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.45)', padding: '2px', marginTop: '-2px', marginRight: '-4px',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
