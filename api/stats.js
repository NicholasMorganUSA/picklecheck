// Private little ops dashboard — server-rendered HTML at /stats (rewritten to
// /api/stats in vercel.json). Aggregate counts only, no PII. Uses the
// service-role client so it sees everything regardless of RLS.
//
// Optional lock: set STATS_TOKEN in the Vercel env and the page requires
// ?token=<that value>. Leave it unset and the page is open (security by
// obscurity — it's just aggregate numbers and the URL isn't advertised).
import { admin } from './_lib.js';

const DAY = 24 * 3600 * 1000;

export default async function handler(req, res) {
  const gate = process.env.STATS_TOKEN;
  if (gate) {
    const token = (req.query && req.query.token) || '';
    if (token !== gate) {
      res.status(401).setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(page('Locked', '<p style="color:#a1a1aa">Add <code>?token=…</code> to view.</p>'));
    }
  }

  try {
    const db = admin();
    const nowIso = new Date().toISOString();
    const cutoff7 = new Date(Date.now() - 7 * DAY).toISOString();
    const cutoff30 = new Date(Date.now() - 30 * DAY).toISOString();

    const countOf = async (q) => (await q).count || 0;

    const [groups, users, memberships, newUsers7, upcoming] = await Promise.all([
      countOf(db.from('groups').select('*', { count: 'exact', head: true })),
      countOf(db.from('profiles').select('*', { count: 'exact', head: true })),
      countOf(db.from('group_members').select('*', { count: 'exact', head: true })),
      countOf(db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', cutoff7)),
      countOf(db.from('sessions').select('*', { count: 'exact', head: true }).is('cancelled_at', null).gte('starts_at', nowIso)),
    ]);

    // Active = distinct users who set/changed an RSVP in the window.
    const distinctRsvpUsers = async (since) => {
      const { data } = await db.from('rsvps').select('user_id').gte('updated_at', since);
      return new Set((data || []).map((r) => r.user_id)).size;
    };
    const [active7, active30] = await Promise.all([distinctRsvpUsers(cutoff7), distinctRsvpUsers(cutoff30)]);

    const avgGroupSize = groups ? memberships / groups : 0;

    const cards = [
      card('Groups', groups, 'total groups'),
      card('Users', users, `${newUsers7} new this week`),
      card('Active users / week', active7, 'distinct RSVPs · last 7 days'),
      card('Avg group size', avgGroupSize.toFixed(1), `${memberships} memberships`),
      card('Active users / month', active30, 'distinct RSVPs · last 30 days'),
      card('Upcoming sessions', upcoming, 'scheduled, not cancelled'),
    ].join('');

    const updated = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    const body = `
      <div class="grid">${cards}</div>
      <p class="foot">Updated ${updated} · server time</p>`;

    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(page('PickleCheck stats', body));
  } catch (e) {
    console.error('[stats] error', e);
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(page('Stats error', `<p style="color:#fca5a5">${escapeHtml(e.message || String(e))}</p>`));
  }
}

function card(label, value, sub) {
  return `
    <div class="card">
      <div class="value">${value}</div>
      <div class="label">${label}</div>
      <div class="sub">${sub}</div>
    </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function page(title, inner) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${title}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; padding: 32px 20px;
      background: #08080c;
      background-image:
        radial-gradient(ellipse 80% 50% at 50% -10%, rgba(197,229,0,0.10), transparent 60%),
        radial-gradient(ellipse 60% 40% at 90% 30%, rgba(16,185,129,0.06), transparent 60%);
      color: #fafafa;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .wrap { max-width: 760px; margin: 0 auto; }
    h1 {
      font-size: 22px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 4px;
      display: flex; align-items: center; gap: 8px;
    }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #c5e500; box-shadow: 0 0 12px rgba(197,229,0,0.6); }
    .tag { font-size: 12px; color: #71717a; margin: 0 0 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .card {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px; padding: 18px 18px 16px;
    }
    .value { font-size: 34px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; color: #fafafa; }
    .label { font-size: 13px; font-weight: 700; margin-top: 6px; color: rgba(255,255,255,0.85); }
    .sub { font-size: 11px; color: #71717a; margin-top: 2px; }
    .foot { font-size: 11px; color: #52525b; margin-top: 24px; }
    code { background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1><span class="dot"></span>PickleCheck</h1>
    <p class="tag">internal stats · ${title === 'PickleCheck stats' ? 'live' : title}</p>
    ${inner}
  </div>
</body>
</html>`;
}
