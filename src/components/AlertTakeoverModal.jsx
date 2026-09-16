import { useEffect } from 'react';

// ────────────────────────────────────────────────────────────────────
// Full-screen, must-answer alert — the in-app stand-in for the modal-style
// phone notifications iOS no longer allows. Fed by the user's own unseen
// notification_deliveries rows (same audience as the push), shown on open or
// live while the app is up. One at a time.
//
// item: {
//   kind: 'contingent' | 'confirmed',
//   session: adapted session (see useLiveData.adaptSession),
//   need: { need, thr } | null       (contingent only)
//   names: [{ name, note }]          (contingent only — who's waiting)
// }
// ────────────────────────────────────────────────────────────────────

const DISPLAY = "'Bricolage Grotesque', sans-serif";
const BODY = "'Plus Jakarta Sans', system-ui, sans-serif";
const LIME = '#c5e500';

function when(dateObj) {
  const now = new Date();
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const day = sameDay(dateObj, now) ? 'Today'
    : sameDay(dateObj, tomorrow) ? 'Tomorrow'
      : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

export default function AlertTakeoverModal({ item, onRsvp, onDismiss, onView }) {
  useEffect(() => {
    if (!item) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [item]);

  if (!item) return null;
  const { kind, session: s, need, names = [] } = item;
  const confirmed = kind === 'confirmed';
  const thr = confirmed ? (s.myResolvedMin || need?.thr) : need?.thr;
  const waiting = names.map((n) => n.name);
  const who = waiting.length === 0 ? 'Someone'
    : waiting.length === 1 ? waiting[0]
      : waiting.length === 2 ? `${waiting[0]} and ${waiting[1]}`
        : `${waiting[0]}, ${waiting[1]} and ${waiting.length - 2} more`;

  const btn = (label, style, onClick) => (
    <button onClick={onClick} style={{
      flex: 1, padding: '16px 8px', borderRadius: '14px', border: 'none',
      fontFamily: BODY, fontWeight: 800, fontSize: '15px', letterSpacing: '0.02em', ...style,
    }}>{label}</button>
  );

  return (
    <div role="alertdialog" aria-label={confirmed ? "You're in" : 'Check in'} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(8,8,12,0.97)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      backgroundImage: `
        radial-gradient(ellipse 80% 50% at 50% -10%, rgba(197, 229, 0, 0.14), transparent 60%),
        radial-gradient(ellipse 60% 40% at 90% 30%, rgba(16, 185, 129, 0.06), transparent 60%),
        radial-gradient(ellipse 60% 40% at 10% 80%, rgba(244, 63, 94, 0.05), transparent 60%)
      `,
      color: '#fafafa', fontFamily: BODY,
      display: 'flex', flexDirection: 'column',
      padding: '32px 20px calc(20px + env(safe-area-inset-bottom))',
      overflowY: 'auto',
    }}>
      <div style={{ maxWidth: '440px', width: '100%', margin: 'auto', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '18px' }}>{confirmed ? '✅' : '🤞'}</div>

        <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
          {s.groupName}
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '2px' }}>
          {when(s.dateObj)}
        </div>
        {s.location && (
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginBottom: '22px' }}>{s.location}</div>
        )}

        <div style={{ fontFamily: DISPLAY, fontSize: '30px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: '12px' }}>
          {confirmed ? (
            <>You&rsquo;re <span style={{ color: LIME }}>IN</span>{thr ? <> — we hit {thr}</> : null}</>
          ) : (
            <>{who} {waiting.length > 1 ? 'are' : 'is'} in <span style={{ color: LIME }}>if we hit {thr}</span></>
          )}
        </div>

        <div style={{
          display: 'inline-block', padding: '10px 16px', borderRadius: '999px', marginBottom: '28px',
          background: 'rgba(197,229,0,0.12)', border: '1px solid rgba(197,229,0,0.4)',
          color: LIME, fontSize: '14px', fontWeight: 700,
        }}>
          {confirmed
            ? `${s.in} confirmed · see you out there`
            : need && need.need > 0
              ? `${s.in} confirmed now · ${need.need} more IN makes ${need.thr}`
              : `${s.in} confirmed now`}
        </div>

        {confirmed ? (
          <div style={{ display: 'flex', gap: '10px' }}>
            {btn('Got it', { background: LIME, color: '#1a1f00', boxShadow: '0 0 24px rgba(197,229,0,0.35)' }, onDismiss)}
          </div>
        ) : (
          <>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
              You haven&rsquo;t answered yet. Are you playing?
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {btn("I'M IN", { background: LIME, color: '#0a0a0c', boxShadow: '0 0 24px rgba(197,229,0,0.45)' }, () => onRsvp('in'))}
              {btn('MAYBE', { background: '#fcd34d', color: '#1a1500' }, () => onRsvp('maybe'))}
              {btn('OUT', { background: '#52525b', color: '#fff' }, () => onRsvp('out'))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '18px', marginTop: '18px' }}>
          <button onClick={onView} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: '13px', fontFamily: BODY, fontWeight: 600, padding: '8px' }}>
            View session
          </button>
          {!confirmed && (
            <button onClick={onDismiss} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontFamily: BODY, fontWeight: 600, padding: '8px' }}>
              Not now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
