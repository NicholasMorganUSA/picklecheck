import { useEffect, useState } from 'react';

// ────────────────────────────────────────────────────────────────────
// First-run / replay-anytime walkthrough of what PickleCheck does.
// Shown once per device (localStorage key) on first visit to /demo or
// the real app; can be reopened from Settings.
// ────────────────────────────────────────────────────────────────────

const DISPLAY = "'Bricolage Grotesque', sans-serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";

const STEPS = [
  {
    icon: '🎾',
    title: 'No more group-chat chaos',
    body: "PickleCheck replaces the endless “who's in?” texts. Real-time check-ins so you know exactly who's playing before you head to the courts.",
  },
  {
    icon: '👇',
    title: 'One tap to commit',
    body: "Every upcoming game is a card. Tap I'M IN, TENTATIVE, or OUT — everyone sees it instantly. Bringing guests? Adjust your party size right on the card. Heading on vacation? Set an auto-out range in Settings and you'll auto-OUT for those dates across every group you're in.",
  },
  {
    icon: '👈👉',
    title: 'Swipe through dates',
    body: 'Swipe left or right between upcoming sessions. Tap the calendar icon in the top bar to switch to a list view of everything coming up.',
  },
  {
    icon: '🔔',
    title: 'Notifications that matter',
    body: 'Get pinged only when it counts: check-in reminders before each game, last-minute drop alerts, cancellations, and weather watches. Never the spam.',
  },
  {
    icon: '🛡️',
    title: 'For admins: run your group',
    body: "Open Manage to set the recurring schedule, invite members via share link, auto-cancel sessions when you're short on players, and flag a weather watch when one might get scrapped. Tune the reminder ladder per group so check-in nudges land at the right times.",
  },
  {
    icon: '🚀',
    title: "You're set",
    body: 'Create a group or join one via invite link. Goodbye group texts — hello pickleball. You can replay this tour anytime from Settings → Tutorial.',
  },
];

export default function TutorialModal({ open, onClose }) {
  const [step, setStep] = useState(0);
  useEffect(() => { if (open) setStep(0); }, [open]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;
  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div role="dialog" aria-label="PickleCheck tutorial" style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(8,8,12,0.97)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      backgroundImage: `
        radial-gradient(ellipse 80% 50% at 50% -10%, rgba(197, 229, 0, 0.10), transparent 60%),
        radial-gradient(ellipse 60% 40% at 90% 30%, rgba(16, 185, 129, 0.06), transparent 60%),
        radial-gradient(ellipse 60% 40% at 10% 80%, rgba(244, 63, 94, 0.05), transparent 60%)
      `,
      color: '#fafafa', fontFamily: BODY,
      display: 'flex', flexDirection: 'column',
      padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
    }}>

      {/* Top bar — Skip */}
      <div style={{ maxWidth: '440px', width: '100%', margin: '0 auto', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.45)', fontSize: '13px', fontFamily: BODY, fontWeight: 600,
          padding: '8px 12px',
        }}>Skip</button>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, maxWidth: '440px', width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '0 8px' }}>
          <div style={{ fontSize: '76px', marginBottom: '20px', lineHeight: 1 }}>{cur.icon}</div>
          <div style={{ fontFamily: DISPLAY, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fafafa', marginBottom: '14px', lineHeight: 1.15 }}>
            {cur.title}
          </div>
          <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
            {cur.body}
          </div>
        </div>
      </div>

      {/* Dots + nav */}
      <div style={{ maxWidth: '440px', width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '18px' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? '22px' : '6px', height: '6px', borderRadius: '3px',
              background: i === step ? '#c5e500' : 'rgba(255,255,255,0.22)',
              transition: 'width 220ms ease, background 220ms',
              boxShadow: i === step ? '0 0 10px rgba(197,229,0,0.5)' : 'none',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} style={{
              padding: '14px 22px', borderRadius: '14px',
              background: 'transparent', color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.15)',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}>Back</button>
          )}
          <button onClick={() => (isLast ? onClose() : setStep(step + 1))} style={{
            flex: 1, padding: '14px 22px', borderRadius: '14px',
            background: '#c5e500', color: '#1a1f00',
            border: 'none', fontSize: '14px', fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 0 20px rgba(197,229,0,0.3)',
          }}>{isLast ? "Let's play 🎾" : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
