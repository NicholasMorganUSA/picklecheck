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

    const [groups, users, memberships, newUsers7, upcoming, signupDates] = await Promise.all([
      countOf(db.from('groups').select('*', { count: 'exact', head: true })),
      countOf(db.from('profiles').select('*', { count: 'exact', head: true })),
      countOf(db.from('group_members').select('*', { count: 'exact', head: true })),
      countOf(db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', cutoff7)),
      countOf(db.from('sessions').select('*', { count: 'exact', head: true }).is('cancelled_at', null).gte('starts_at', nowIso)),
      db.from('profiles').select('created_at').order('created_at', { ascending: true }).then(({ data }) => (data || []).map((r) => r.created_at)),
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
      ${growthChart(signupDates)}
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

// Cumulative user-growth line chart, rendered as inline SVG. Buckets signups
// by day from the first signup to today so the x-axis is time-proportional.
function growthChart(signupDates) {
  const dates = (signupDates || []).map((d) => new Date(d)).filter((d) => !isNaN(d)).sort((a, b) => a - b);
  if (dates.length < 2) {
    return `<div class="chart"><div class="chart-head">User growth</div>
      <p class="sub" style="margin-top:8px">Not enough signups yet to chart.</p></div>`;
  }

  const startDay = Math.floor(dates[0].getTime() / DAY);
  const endDay = Math.floor(Date.now() / DAY);
  const days = Math.max(1, endDay - startDay);

  // Cumulative total at the end of each day.
  const cumulative = new Array(days + 1).fill(0);
  for (const d of dates) {
    const idx = Math.min(days, Math.max(0, Math.floor(d.getTime() / DAY) - startDay));
    cumulative[idx] += 1;
  }
  for (let i = 1; i < cumulative.length; i++) cumulative[i] += cumulative[i - 1];

  const W = 700, H = 220, padL = 40, padR = 16, padT = 16, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxY = cumulative[cumulative.length - 1] || 1;
  const x = (i) => padL + (days === 0 ? 0 : (i / days) * plotW);
  const y = (v) => padT + plotH - (maxY === 0 ? 0 : (v / maxY) * plotH);

  const pts = cumulative.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = `M${pts.join(' L')}`;
  const area = `M${x(0).toFixed(1)},${y(0).toFixed(1)} L${pts.join(' L')} L${x(days).toFixed(1)},${y(0).toFixed(1)} Z`;

  // Horizontal gridlines + y labels (4 steps).
  const steps = 4;
  let grid = '';
  for (let s = 0; s <= steps; s++) {
    const v = Math.round((maxY / steps) * s);
    const gy = y(v).toFixed(1);
    grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="rgba(255,255,255,0.06)" />`;
    grid += `<text x="${padL - 8}" y="${(+gy + 3).toFixed(1)}" text-anchor="end" class="axis">${v}</text>`;
  }

  // X labels: first date, midpoint, today.
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const midDate = new Date((dates[0].getTime() + Date.now()) / 2);
  const xlabels = [
    `<text x="${padL}" y="${H - 8}" text-anchor="start" class="axis">${fmt(dates[0])}</text>`,
    `<text x="${(padL + W - padR) / 2}" y="${H - 8}" text-anchor="middle" class="axis">${fmt(midDate)}</text>`,
    `<text x="${W - padR}" y="${H - 8}" text-anchor="end" class="axis">${fmt(new Date())}</text>`,
  ].join('');

  const lastX = x(days).toFixed(1), lastY = y(maxY).toFixed(1);

  return `
    <div class="chart">
      <div class="chart-head">User growth <span class="chart-sub">${maxY} total · cumulative signups</span></div>
      <svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Cumulative user growth over time">
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(197,229,0,0.28)" />
            <stop offset="100%" stop-color="rgba(197,229,0,0)" />
          </linearGradient>
        </defs>
        ${grid}
        <path d="${area}" fill="url(#fill)" />
        <path d="${line}" fill="none" stroke="#c5e500" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <circle cx="${lastX}" cy="${lastY}" r="3.5" fill="#c5e500" />
        ${xlabels}
      </svg>
    </div>`;
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
    .chart {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px; padding: 18px; margin-top: 12px;
    }
    .chart-head { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.85); margin-bottom: 12px; }
    .chart-sub { font-size: 11px; font-weight: 500; color: #71717a; margin-left: 6px; }
    .chart-svg { display: block; width: 100%; height: auto; }
    .axis { fill: #71717a; font-size: 11px; font-family: inherit; }
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
