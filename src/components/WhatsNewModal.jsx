import { useEffect } from 'react';

// ────────────────────────────────────────────────────────────────────
// One-time "What's New" announcement.
//
// HOW TO ANNOUNCE A NEW UPDATE:
//   1. Bump `id` to a new unique string (date-ish slug is handy).
//   2. Replace `title` / `items` with the new note(s).
// Every device that hasn't seen this exact `id` shows it once, then records
// it (localStorage: pc_whatsnew_seen). Existing users get it on their next
// load; brand-new users skip it (App marks it seen when the tutorial runs,
// so they don't get the tour AND the announcement at once).
// ────────────────────────────────────────────────────────────────────

export const WHATS_NEW = {
  id: 'textsize-2026-06',
  title: "What's new",
  items: [
    {
      emoji: '🔠',
      heading: 'Adjustable text size',
      body: 'Hard to read the small text? Open Settings → App → Text size and bump it up — names, labels and details get bigger across the whole app.',
    },
  ],
  cta: 'Got it',
};

export default function WhatsNewModal({ open, onClose, content = WHATS_NEW }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return (
    <div role="dialog" aria-label="What's new" className="fixed inset-0 z-[1200] flex items-center justify-center p-5"
      onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'var(--bg-overlay)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
      <div className="relative w-full max-w-sm rounded-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-modal)', border: '1px solid var(--border-medium)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div className="px-5 pt-5 pb-1 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-1 rounded-full"
            style={{ background: 'rgba(197,229,0,0.15)', color: '#c5e500' }}>New</span>
          <span className="text-base font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: 'var(--text-strong)' }}>{content.title}</span>
        </div>
        <div className="px-5 pb-4 pt-3 space-y-4">
          {content.items.map((it, i) => (
            <div key={i} className="flex gap-3">
              <div className="text-2xl leading-none flex-shrink-0" style={{ width: 30 }}>{it.emoji}</div>
              <div className="min-w-0">
                {it.heading && <div className="text-sm font-bold mb-0.5" style={{ color: 'var(--text-strong)' }}>{it.heading}</div>}
                <div className="text-[13px] leading-snug" style={{ color: 'var(--text-secondary)' }}>{it.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-3 rounded-2xl text-sm font-bold"
            style={{ background: '#c5e500', color: '#1a1f00' }}>{content.cta || 'Got it'}</button>
        </div>
      </div>
    </div>
  );
}
