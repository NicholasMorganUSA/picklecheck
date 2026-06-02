import { useState, useId, useMemo, useEffect, useRef } from "react";
import { Menu, Settings, ArrowLeft, Plus, X, ChevronRight as ChevR, ChevronLeft, Shield, ChevronDown, Undo2, Users, Pencil, Trash2, MapPin, Bell, AlertTriangle } from "lucide-react";
import { useLiveData } from "./hooks/useLiveData.js";
import { inviteUrl, createInvite, searchPublicGroups, getNotificationSettings, saveNotificationSettings, getGroupPushStatus, updateMemberRole, listOutRanges, addOutRange, deleteOutRange } from "./lib/data.js";
import { getPushState, enablePush, refreshSubscription } from "./lib/push.js";
import { sendTestPush, notifyDropout } from "./lib/notify.js";
import TutorialModal from "./components/TutorialModal.jsx";
import NotificationsPromptModal from "./components/NotificationsPromptModal.jsx";

// ────────────────────────────────────────────────────────────────────
// PALETTE
// ────────────────────────────────────────────────────────────────────
const COLOR = {
  red:    { from: '#fb7185', mid: '#bd4751', to: '#7f1d1d', label: 'NOT ENOUGH', sub: 'Need 4+ to play',     text: 'text-rose-200',   dot: '#f43f5e', glow: 'rgba(244, 63, 94, 0.45)' },
  orange: { from: '#fb923c', mid: '#bc6027', to: '#7c2d12', label: 'TIGHT ROTATION', sub: '7 = awkward bench', text: 'text-orange-200', dot: '#f97316', glow: 'rgba(249, 115, 22, 0.45)' },
  yellow: { from: '#fde047', mid: '#b7902d', to: '#713f12', label: 'ROOM FOR BENCH', sub: 'Manageable rotation', text: 'text-amber-100',  dot: '#eab308', glow: 'rgba(234, 179, 8, 0.40)' },
  green:  { from: '#86efac', mid: '#4da16d', to: '#14532d', label: 'READY TO PLAY', sub: 'Full courts locked',   text: 'text-emerald-200', dot: '#10b981', glow: 'rgba(16, 185, 129, 0.50)' },
  gray:   { from: '#a1a1aa', mid: '#64646a', to: '#27272a', label: 'AWAITING', sub: '', text: 'text-zinc-400', dot: '#52525b', glow: 'rgba(82, 82, 91, 0.25)' },
};

// Theme tokens — set on the App root via inline `style` as CSS custom properties,
// then referenced throughout via `var(--token-name)`. Switching theme just swaps
// the values; no per-component logic needed.
const THEME = {
  dark: {
    '--bg-app':           '#08080c',
    '--bg-card':          'rgba(20, 20, 28, 0.55)',
    '--bg-card-solid':    '#0c0c12',
    '--bg-surface':       'rgba(20, 20, 28, 0.55)',
    '--bg-subtle':        'rgba(255, 255, 255, 0.03)',
    '--bg-faint':         'rgba(255, 255, 255, 0.025)',
    '--bg-glass':         'rgba(255, 255, 255, 0.05)',
    '--bg-input':         'rgba(255, 255, 255, 0.06)',
    '--bg-input-hover':   'rgba(255, 255, 255, 0.08)',
    '--bg-overlay':       'rgba(0, 0, 0, 0.6)',
    '--bg-modal':         '#0f0f17',
    '--bg-select-option': '#0f0f17',
    '--text-strong':      '#fafafa',
    '--text-primary':     'rgba(255, 255, 255, 0.9)',
    '--text-secondary':   'rgba(255, 255, 255, 0.7)',
    '--text-muted':       'rgba(255, 255, 255, 0.55)',
    '--text-tertiary':    'rgba(255, 255, 255, 0.4)',
    '--text-faint':       'rgba(255, 255, 255, 0.25)',
    '--text-disabled':    'rgba(255, 255, 255, 0.15)',
    '--border-subtle':    'rgba(255, 255, 255, 0.05)',
    '--border-medium':    'rgba(255, 255, 255, 0.08)',
    '--border-strong':    'rgba(255, 255, 255, 0.1)',
    '--orb-green':        'rgba(197, 229, 0, 0.10)',
    '--orb-emerald':      'rgba(16, 185, 129, 0.06)',
    '--orb-rose':         'rgba(244, 63, 94, 0.05)',
  },
  // Medium: dark theme lightened a touch. Sandbox for color tweaks — leave
  // dark/light alone while iterating here.
  medium: {
    '--bg-app':           '#16161d',
    '--bg-card':          'rgba(34, 34, 44, 0.62)',
    '--bg-card-solid':    '#1c1c26',
    '--bg-surface':       'rgba(34, 34, 44, 0.55)',
    '--bg-subtle':        'rgba(255, 255, 255, 0.045)',
    '--bg-faint':         'rgba(255, 255, 255, 0.035)',
    '--bg-glass':         'rgba(255, 255, 255, 0.065)',
    '--bg-input':         'rgba(255, 255, 255, 0.075)',
    '--bg-input-hover':   'rgba(255, 255, 255, 0.095)',
    '--bg-overlay':       'rgba(0, 0, 0, 0.55)',
    '--bg-modal':         '#1d1d27',
    '--bg-select-option': '#1d1d27',
    '--text-strong':      '#fafafa',
    '--text-primary':     'rgba(255, 255, 255, 0.92)',
    '--text-secondary':   'rgba(255, 255, 255, 0.72)',
    '--text-muted':       'rgba(255, 255, 255, 0.58)',
    '--text-tertiary':    'rgba(255, 255, 255, 0.42)',
    '--text-faint':       'rgba(255, 255, 255, 0.28)',
    '--text-disabled':    'rgba(255, 255, 255, 0.18)',
    '--border-subtle':    'rgba(255, 255, 255, 0.065)',
    '--border-medium':    'rgba(255, 255, 255, 0.10)',
    '--border-strong':    'rgba(255, 255, 255, 0.13)',
    '--orb-green':        'rgba(197, 229, 0, 0.12)',
    '--orb-emerald':      'rgba(16, 185, 129, 0.07)',
    '--orb-rose':         'rgba(244, 63, 94, 0.06)',
  },
  light: {
    '--bg-app':           '#f4f4f5',
    '--bg-card':          'rgba(255, 255, 255, 0.92)',
    '--bg-card-solid':    '#ffffff',
    '--bg-surface':       'rgba(255, 255, 255, 0.85)',
    '--bg-subtle':        'rgba(0, 0, 0, 0.025)',
    '--bg-faint':         'rgba(0, 0, 0, 0.02)',
    '--bg-glass':         'rgba(0, 0, 0, 0.04)',
    '--bg-input':         'rgba(0, 0, 0, 0.05)',
    '--bg-input-hover':   'rgba(0, 0, 0, 0.08)',
    '--bg-overlay':       'rgba(0, 0, 0, 0.35)',
    '--bg-modal':         '#ffffff',
    '--bg-select-option': '#ffffff',
    '--text-strong':      '#09090b',
    '--text-primary':     'rgba(0, 0, 0, 0.88)',
    '--text-secondary':   'rgba(0, 0, 0, 0.68)',
    '--text-muted':       'rgba(0, 0, 0, 0.55)',
    '--text-tertiary':    'rgba(0, 0, 0, 0.45)',
    '--text-faint':       'rgba(0, 0, 0, 0.3)',
    '--text-disabled':    'rgba(0, 0, 0, 0.2)',
    '--border-subtle':    'rgba(0, 0, 0, 0.07)',
    '--border-medium':    'rgba(0, 0, 0, 0.1)',
    '--border-strong':    'rgba(0, 0, 0, 0.15)',
    '--orb-green':        'rgba(197, 229, 0, 0.22)',
    '--orb-emerald':      'rgba(16, 185, 129, 0.12)',
    '--orb-rose':         'rgba(244, 63, 94, 0.10)',
  },
};

const STATUS_PILL = {
  in:        { label: 'IN',    color: '#c5e500',                       text: '#1a1f00' },
  maybe:     { label: 'MAYBE', color: '#fcd34d',                       text: '#1a1500' },
  out:       { label: 'OUT',   color: '#52525b',                       text: '#fafafa' },
  undecided: { label: '?',     color: 'var(--bg-input-hover)',        text: 'var(--text-muted)' },
};

// ────────────────────────────────────────────────────────────────────
// MOCK DATA
// ────────────────────────────────────────────────────────────────────
const GROUP_INFO = {
  dink:  { id: 'dink',  name: 'Dink Dynasty',     location: 'Lifetime Fitness, Mason', role: 'member', schedule: 'Mon–Fri · 6:00 AM',   members: 14 },
  smash: { id: 'smash', name: 'Smash Bros',       location: 'Riverside Courts',        role: 'admin',  schedule: 'Tue & Thu · 5:00 PM', members: 38 },
  slam:  { id: 'slam',  name: 'Saturday Slammers', location: 'Community Park',          role: 'member', schedule: 'Sat · 9:00 AM',       members: 16 },
};

// Demo runs on the real current time, so its dates are never stale.
const MOCK_NOW = new Date();
const MOCK_USER = { name: 'Pickleballer', email: 'demo@picklecheck.in', initials: 'PB' };

const NAMES = [
  'Pickleballer', 'Devin Smith', 'Aaron Tucker', 'Sara Klein', 'Jay Pickett',
  'Marcus Lee', 'Brad Tower', 'Mike Reed', 'Tom Brennan', 'Lisa Park',
  'Chris Day', 'Dan Hill', 'Pat Cole', 'Bren Adams', 'Megan Ross',
  'Will Foster', 'Jen Kim', 'Ben Walsh', 'Kyle James', 'Tara Quinn',
  'Cole Banks', 'Nina Vasquez', 'Owen Pratt', 'Rae Donovan', 'Sam Okafor',
  'Tess Lowe', 'Victor Hsu', 'Wendy Cho', 'Xavier Reyes', 'Yara Said',
  'Zach Mercer', 'Ella Frost', 'Gabe Stern', 'Hana Ito', 'Ian Boyd',
  'Jade Romero', 'Kurt Vogel', 'Lena Ortiz', 'Max Feld', 'Priya Nair',
];

// Cadence per demo group: days (0=Sun..6=Sat), time, and IN-count range.
const DEMO_CADENCE = {
  dink:  { days: [1, 2, 3, 4, 5], hour: 6,  min: 0, inMin: 3,  inMax: 12, maybeMax: 2 },
  smash: { days: [2, 4],          hour: 17, min: 0, inMin: 24, inMax: 32, maybeMax: 4 },
  slam:  { days: [6],             hour: 9,  min: 0, inMin: 6,  inMax: 14, maybeMax: 3 },
};

const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function buildDemoSessions() {
  // Opener: today, ~3h out, deliberately 3 IN / 0 MAYBE so the user can tap
  // "I'm in" and watch it flip red → green (4 = a full court).
  const opener = new Date(MOCK_NOW.getTime() + 3 * 3600 * 1000);
  opener.setMinutes(0, 0, 0);
  const sessions = [{ id: 'demo-opener', groupId: 'dink', dateObj: opener, in: 3, maybe: 0, out: 0, undecided: 6, myStatus: 'undecided', past: false }];

  // Each group's recurring sessions for the next few weeks, with varied counts.
  const cadence = [];
  const day0 = new Date(MOCK_NOW); day0.setHours(0, 0, 0, 0);
  for (let d = 0; d < 25; d++) {
    const day = new Date(day0); day.setDate(day.getDate() + d);
    const dow = day.getDay();
    for (const gid of Object.keys(DEMO_CADENCE)) {
      const c = DEMO_CADENCE[gid];
      if (!c.days.includes(dow)) continue;
      const dt = new Date(day); dt.setHours(c.hour, c.min, 0, 0);
      if (dt <= opener) continue; // keep the opener as the soonest session
      cadence.push({
        id: `demo-${gid}-${d}`, groupId: gid, dateObj: dt,
        in: randInt(c.inMin, c.inMax), maybe: randInt(0, c.maybeMax),
        out: randInt(0, 2), undecided: randInt(1, 6), myStatus: 'undecided', past: false,
      });
    }
  }
  cadence.sort((a, b) => a.dateObj - b.dateObj);
  return sessions.concat(cadence).slice(0, 16);
}

const MOCK_SESSIONS = buildDemoSessions();
const DEFAULT_IDX = 0;

// Deterministic roster by session
function generateRoster(session) {
  const seed = parseInt(session.id.replace('s', '')) || 0;
  // Always include "you" in IN, MAYBE, OUT, or UNDECIDED based on myStatus
  const others = NAMES.slice(1); // exclude the demo "you" (NAMES[0]) from the pool
  const shuffled = [...others].sort((a, b) => {
    const ha = (a.charCodeAt(0) * 7 + a.charCodeAt(1) * 3 + seed * 13) % 1000;
    const hb = (b.charCodeAt(0) * 7 + b.charCodeAt(1) * 3 + seed * 13) % 1000;
    return ha - hb;
  });

  const lists = { in: [], maybe: [], out: [], undecided: [] };
  let idx = 0;
  const fill = (key, count) => {
    for (let i = 0; i < count; i++) {
      if (idx < shuffled.length) lists[key].push(shuffled[idx++]);
    }
  };
  // Put "you" in the right bucket first; reduce that bucket count by the user's
  // party size (only counts > 1 for IN/MAYBE — see handleMyStatus).
  const counts = { in: session.in, maybe: session.maybe, out: session.out, undecided: session.undecided };
  const myCount = (session.myStatus === 'in' || session.myStatus === 'maybe') ? (session.myPartySize || 1) : 1;
  if (counts[session.myStatus] > 0) {
    const youLabel = myCount > 1 ? `${MOCK_USER.name} +${myCount - 1}` : MOCK_USER.name;
    lists[session.myStatus].push(youLabel);
    counts[session.myStatus] = Math.max(0, counts[session.myStatus] - myCount);
  }
  fill('in', counts.in);
  fill('maybe', counts.maybe);
  fill('out', counts.out);
  fill('undecided', counts.undecided);
  return lists;
}

// ────────────────────────────────────────────────────────────────────
// LOGIC
// ────────────────────────────────────────────────────────────────────
// Per-court color WITHOUT the global "totalConfirmed < 4 = red" rule.
// Reflects the court's true state based on its own fill.
function perCourtColor(confirmedHere, tentativeHere, totalConfirmed, totalCourts) {
  if (confirmedHere === 4) return 'green';
  if (confirmedHere === 3) {
    if (totalConfirmed === 7 && totalCourts === 2) return 'orange';
    return 'yellow';
  }
  if (confirmedHere >= 1) return 'yellow';
  if (tentativeHere >= 1) return 'yellow';
  return 'gray';
}
// Applies the global "no court can be playable if totalConfirmed < 4" rule
// on top of the per-court color.
function getCourtColor(confirmedHere, tentativeHere, totalConfirmed, totalCourts) {
  if (totalConfirmed < 4) return 'red';
  return perCourtColor(confirmedHere, tentativeHere, totalConfirmed, totalCourts);
}
function getOverallStatus(confirmed) {
  if (confirmed < 4) return 'red';
  if (confirmed % 4 === 0) return 'green';
  if (confirmed === 7) return 'orange';
  return 'yellow';
}
// Returns [currentColor, potentialColor] for one court. Gradient renders when
// this court's tentatives, if confirmed, would shift its color. Exception: when
// the court is currently red ONLY because totalConfirmed < 4 and the potential
// isn't green, we skip the misleading "red→yellow" transition and paint solid
// at the per-court potential. e.g. court with 0 IN + 2 MAYBE in a 3+3 session
// settles to solid yellow — confirming the maybes doesn't unlock playability,
// it just reveals what was always a yellow-class court.
function getCourtGradient(confirmedHere, tentativeHere, totalConfirmed, totalCourts) {
  const currentActual = getCourtColor(confirmedHere, tentativeHere, totalConfirmed, totalCourts);
  if (tentativeHere === 0) return [currentActual, currentActual];
  const newTotal = totalConfirmed + tentativeHere;
  const potentialActual = newTotal < 4
    ? 'red'
    : perCourtColor(confirmedHere + tentativeHere, 0, newTotal, totalCourts);
  if (currentActual === potentialActual) return [currentActual, currentActual];
  // Special: red→non-green means red was a global artifact. Show solid potential.
  if (currentActual === 'red' && potentialActual !== 'green') {
    return [potentialActual, potentialActual];
  }
  return [currentActual, potentialActual];
}
function distribute(confirmed, tentative) {
  const total = confirmed + tentative;
  const numCourts = Math.max(1, Math.ceil(total / 4));
  const courts = [];
  let cRem = confirmed, tRem = tentative;
  for (let i = 0; i < numCourts; i++) {
    const cHere = Math.min(4, cRem);
    const tHere = Math.min(4 - cHere, tRem);
    courts.push({ confirmed: cHere, tentative: tHere });
    cRem -= cHere; tRem -= tHere;
  }
  return courts;
}

// ────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────
const DAYS_LONG  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtTime(d) {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dayDiff(a, b) {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((da - db) / 86400000);
}
function dayContext(date) {
  const diff = dayDiff(date, MOCK_NOW);
  if (diff === 0) return 'TODAY';
  if (diff === 1) return 'TOMORROW';
  if (diff > 1 && diff < 7) return `IN ${diff} DAYS`;
  if (diff < 0) return `${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'DAY' : 'DAYS'} AGO`;
  return DAYS_SHORT[date.getDay()].toUpperCase();
}
function initials(name) {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

// ────────────────────────────────────────────────────────────────────
// SVG: Ball, Court, MiniCourt
// ────────────────────────────────────────────────────────────────────
const Ball = ({ cx, cy, state }) => {
  if (state === 'confirmed') {
    return (
      <g style={{ filter: 'drop-shadow(0 0 3.5px rgba(197, 229, 0, 0.85))' }}>
        <circle cx={cx} cy={cy} r="10" fill="#c5e500" />
        <ellipse cx={cx - 2.5} cy={cy - 3} rx="3.2" ry="1.9" fill="#f7ffb8" opacity="0.55" />
        <circle cx={cx - 3.5} cy={cy + 1} r="0.9" fill="rgba(30,40,0,0.5)" />
        <circle cx={cx + 3} cy={cy - 1} r="0.9" fill="rgba(30,40,0,0.5)" />
        <circle cx={cx + 2} cy={cy + 4} r="0.9" fill="rgba(30,40,0,0.5)" />
        <circle cx={cx - 4} cy={cy + 4} r="0.9" fill="rgba(30,40,0,0.5)" />
      </g>
    );
  }
  if (state === 'tentative') {
    return <circle cx={cx} cy={cy} r="10" fill="rgba(197,229,0,0.14)" stroke="#c5e500" strokeWidth="1.2" strokeDasharray="2,1.5" />;
  }
  return <circle cx={cx} cy={cy} r="10" fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.28)" strokeWidth="0.8" />;
};

const Court = ({ confirmed, tentative, colors, number }) => {
  const [currentColorName, potentialColorName] = colors;
  const cur = COLOR[currentColorName];
  const pot = COLOR[potentialColorName];
  const isUpgrade = currentColorName !== potentialColorName;
  const id = useId().replace(/:/g, '_');
  const ballStates = [];
  for (let i = 0; i < 4; i++) {
    if (i < confirmed) ballStates.push('confirmed');
    else if (i < confirmed + tentative) ballStates.push('tentative');
    else ballStates.push('empty');
  }
  const positions = [
    { x: 25, y: 37 }, { x: 25, y: 183 },
    { x: 75, y: 37 }, { x: 75, y: 183 },
  ];
  return (
    <svg viewBox="0 0 100 220" className="w-full h-auto block" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`g-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          {isUpgrade ? (
            <>
              <stop offset="0%" stopColor={cur.mid} />
              <stop offset="45%" stopColor={cur.mid} />
              <stop offset="100%" stopColor={pot.mid} />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor={cur.from} />
              <stop offset="100%" stopColor={cur.to} />
            </>
          )}
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="94" height="214" fill={`url(#g-${id})`} stroke="rgba(255,255,255,0.7)" strokeWidth="1.1" rx="6" style={{ transition: 'all 400ms ease' }} />
      <line x1="3" y1="75"  x2="97" y2="75"  stroke="rgba(255,255,255,0.75)" strokeWidth="0.7" />
      <line x1="3" y1="145" x2="97" y2="145" stroke="rgba(255,255,255,0.75)" strokeWidth="0.7" />
      <line x1="50" y1="3"   x2="50" y2="75"  stroke="rgba(255,255,255,0.75)" strokeWidth="0.7" />
      <line x1="50" y1="145" x2="50" y2="217" stroke="rgba(255,255,255,0.75)" strokeWidth="0.7" />
      <rect x="3" y="108" width="94" height="4" fill="rgba(0,0,0,0.45)" rx="0.5" />
      <line x1="3" y1="110" x2="97" y2="110" stroke="rgba(255,255,255,0.9)" strokeWidth="0.5" strokeDasharray="2,1.5" />
      <text x="50" y="110" fontSize="44" fill="white" fontFamily="'Bricolage Grotesque', sans-serif" fontWeight="800" textAnchor="middle" dominantBaseline="central">{number}</text>
      {positions.map((p, i) => <Ball key={i} cx={p.x} cy={p.y} state={ballStates[i]} />)}
    </svg>
  );
};

const MiniCourt = ({ color, number }) => {
  const c = COLOR[color];
  const id = useId().replace(/:/g, '_');
  return (
    <svg viewBox="0 0 100 220" className="block" style={{ width: '34px', height: 'auto', transition: 'all 400ms ease' }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`mg-${id}`} x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={c.from} />
          <stop offset="100%" stopColor={c.to} />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="94" height="214" fill={`url(#mg-${id})`} stroke="rgba(255,255,255,0.75)" strokeWidth="2.2" rx="10" />
      <line x1="3" y1="75"  x2="97" y2="75"  stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" />
      <line x1="3" y1="145" x2="97" y2="145" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" />
      <rect x="3" y="108" width="94" height="4" fill="rgba(0,0,0,0.55)" />
      <text x="50" y="110" fontSize="68" fill="white" fontFamily="'Bricolage Grotesque', sans-serif" fontWeight="800" textAnchor="middle" dominantBaseline="central">{number}</text>
    </svg>
  );
};

const CourtGrid = ({ confirmed, tentative }) => {
  const courts = distribute(confirmed, tentative);
  const n = courts.length;
  const gradientOf = (c) => getCourtGradient(c.confirmed, c.tentative, confirmed, n);
  if (n <= 4) {
    const cols = n === 1 ? 'grid-cols-1' : n === 2 ? 'grid-cols-2' : n === 3 ? 'grid-cols-3' : 'grid-cols-4';
    const maxWidth = n === 1 ? '95px' : n === 2 ? '220px' : n === 3 ? '270px' : undefined;
    return (
      <div className={`grid ${cols} gap-3 mx-auto`} style={{ maxWidth }}>
        {courts.map((c, i) => <Court key={i} confirmed={c.confirmed} tentative={c.tentative} colors={gradientOf(c)} number={i + 1} />)}
      </div>
    );
  }
  const bigCount = Math.min(3, n - 3);
  const miniCount = n - bigCount;
  const minis = courts.slice(0, miniCount);
  const bigs  = courts.slice(miniCount);
  const bigsCols = bigCount === 2 ? 'grid-cols-2' : 'grid-cols-3';
  const bigsMaxWidth = bigCount === 2 ? '240px' : undefined;
  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap gap-1.5 justify-center items-start">
        {minis.map((c, i) => <MiniCourt key={`m${i}`} color={gradientOf(c)[0]} number={i + 1} />)}
      </div>
      <div className={`grid ${bigsCols} gap-3 mx-auto`} style={{ maxWidth: bigsMaxWidth }}>
        {bigs.map((c, i) => <Court key={`b${i}`} confirmed={c.confirmed} tentative={c.tentative} colors={gradientOf(c)} number={miniCount + i + 1} />)}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────
// SMALL UI
// ────────────────────────────────────────────────────────────────────
const StatusPill = ({ status, small = false }) => {
  const s = STATUS_PILL[status] || STATUS_PILL.undecided;
  return (
    <span className="inline-flex items-center justify-center rounded-full font-bold"
      style={{ background: s.color, color: s.text, fontFamily: "'Bricolage Grotesque', sans-serif",
        fontSize: small ? '10px' : '11px', padding: small ? '2px 8px' : '3px 10px', letterSpacing: '0.04em', lineHeight: 1 }}>
      {s.label}
    </span>
  );
};

const Avatar = ({ name, size = 28, isYou = false }) => (
  <div
    className="rounded-full flex items-center justify-center flex-shrink-0"
    style={{
      width: size, height: size,
      background: isYou ? 'rgba(197,229,0,0.15)' : 'var(--bg-input)',
      color: isYou ? '#c5e500' : 'var(--text-secondary)',
      fontFamily: "'Bricolage Grotesque', sans-serif",
      fontWeight: 700,
      fontSize: size * 0.4,
      border: isYou ? '1px solid rgba(197,229,0,0.3)' : '1px solid var(--border-subtle)',
    }}
  >{initials(name)}</div>
);

// Leave the SPA via a history REPLACE (not push) so the page we're leaving —
// e.g. /demo — can never be reached again with the back/forward button. This is
// what guarantees a logged-in user has no pathway back into the demo (the only
// way in is typing /demo fresh). Honor modifier clicks so "open in new tab" works.
function hardReplace(e, to) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  e.preventDefault();
  window.location.replace(to);
}

// Clickable wordmark → "/". In the demo this lands on the real app's login;
// in the real app it's a "home" link. Uses replace so the demo isn't left behind.
const BrandHeader = () => (
  <a href="/" onClick={(e) => hardReplace(e, '/')} aria-label="PickleCheck home" className="flex items-baseline justify-center" style={{ letterSpacing: '-0.02em', textDecoration: 'none', cursor: 'pointer' }}>
    <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '18px', fontWeight: 800, lineHeight: 1, color: '#c5e500' }}>Pickle</span>
    <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '18px', fontWeight: 800, lineHeight: 1, color: 'var(--text-strong)' }}>Check</span>
    <span style={{ display: 'inline-block', width: '5px', height: '5px', background: '#c5e500', borderRadius: '50%', margin: '0 1.5px', transform: 'translateY(1px)', flexShrink: 0 }} />
    <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '18px', fontWeight: 800, lineHeight: 1, color: 'var(--text-muted)' }}>in</span>
  </a>
);

const IconButton = ({ children, onClick, label }) => (
  <button onClick={onClick} aria-label={label} className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
    style={{ background: 'var(--bg-glass)', color: 'var(--text-strong)' }}>
    {children}
  </button>
);

// ────────────────────────────────────────────────────────────────────
// TOP BAR
// ────────────────────────────────────────────────────────────────────
const TopBar = ({ onMenuClick, onSettingsClick, view, onViewChange, isFiltered, onClearFilter, showBackButton, onBackToDefault }) => {
  const showToggle = view === 'today' || view === 'week';
  return (
    <div className="space-y-2 pt-1 pb-1">
      <div className="flex items-center justify-between">
        <IconButton onClick={onMenuClick} label="Open groups menu"><Menu size={18} /></IconButton>
        <BrandHeader />
        <IconButton onClick={onSettingsClick} label="Open settings"><Settings size={18} /></IconButton>
      </div>
      {showToggle && (
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full p-0.5" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)' }}>
            <button onClick={() => onViewChange('today')} className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide transition-all"
              style={view === 'today' ? { background: '#c5e500', color: '#1a1f00', boxShadow: '0 0 12px rgba(197,229,0,0.35)' } : { color: 'var(--text-muted)' }}>NEXT UP</button>
            <button onClick={() => onViewChange('week')} className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide transition-all"
              style={view === 'week' ? { background: '#c5e500', color: '#1a1f00', boxShadow: '0 0 12px rgba(197,229,0,0.35)' } : { color: 'var(--text-muted)' }}>LIST</button>
          </div>
          {showBackButton && (
            <button onClick={onBackToDefault} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide transition-all"
              style={{ background: 'rgba(197,229,0,0.12)', color: '#c5e500', border: '1px solid rgba(197,229,0,0.3)' }}>
              <Undo2 size={11} />NEXT UP
            </button>
          )}
          {isFiltered && (
            <button onClick={onClearFilter} className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide"
              style={{ background: 'rgba(197,229,0,0.15)', color: '#c5e500', border: '1px solid rgba(197,229,0,0.4)', boxShadow: '0 0 10px rgba(197,229,0,0.2)' }}>
              FILTERED<X size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────
// SESSION ADMIN PANEL — expandable controls below the card (admins only).
// Replaces the old pencil. Weather watch, cancel-with-reason, edit, delete.
// ────────────────────────────────────────────────────────────────────
const CANCEL_REASONS = ['Weather', 'Not enough players', 'Court unavailable'];

const SessionAdminPanel = ({ session, open, onToggle, interactive, onSetWatch, onClearWatch, onCancel, onUncancel, onEdit, onDelete }) => {
  const [reason, setReason] = useState('Weather');
  const [custom, setCustom] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelReasonValue = reason === 'Other' ? (custom.trim() || null) : reason;
  const act = async (fn) => { setBusy(true); try { await fn?.(); } finally { setBusy(false); } };

  return (
    <>
      <button onClick={onToggle}
        className="w-full px-5 py-3 flex items-center justify-between text-left border-t transition-all"
        style={{ borderColor: 'var(--border-medium)', background: open ? 'rgba(244,63,94,0.06)' : 'var(--bg-faint)' }}>
        <span className="flex items-center gap-2.5">
          <Shield size={15} style={{ color: 'var(--text-secondary)' }} />
          <span className="text-[13px] font-bold tracking-wide" style={{ color: 'var(--text-strong)' }}>Admin controls</span>
        </span>
        <ChevronDown size={18} style={{ color: 'var(--text-secondary)', transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms' }} />
      </button>
      {open && interactive && (
        <div className="border-t px-5 py-4 space-y-4" style={{ borderColor: 'var(--border-subtle)' }}>
          {/* Weather watch */}
          <div>
            <div className="text-[10px] tracking-wider font-bold uppercase mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Weather watch</div>
            {session.watchReason ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px]" style={{ color: '#fcd34d' }}>Active — &ldquo;{session.watchReason}&rdquo;. Players notified.</span>
                <button disabled={busy} onClick={() => act(onClearWatch)} className="px-3 py-1.5 rounded-lg text-[12px] font-bold flex-shrink-0" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Clear</button>
              </div>
            ) : (
              <button disabled={busy || session.cancelled} onClick={() => act(() => onSetWatch('Weather'))}
                className="w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: 'rgba(252,211,77,0.14)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.4)' }}>
                <AlertTriangle size={14} /> Set weather watch &amp; notify
              </button>
            )}
          </div>

          {/* Cancel / un-cancel */}
          <div className="pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="text-[10px] tracking-wider font-bold uppercase mb-1.5" style={{ color: 'var(--text-tertiary)' }}>{session.cancelled ? 'Cancelled' : 'Cancel session'}</div>
            {session.cancelled ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px]" style={{ color: '#fb7185' }}>Off{session.cancelReason ? ` — ${session.cancelReason}` : ''}.</span>
                <button disabled={busy} onClick={() => act(onUncancel)} className="px-3 py-1.5 rounded-lg text-[12px] font-bold flex-shrink-0" style={{ background: 'var(--bg-input)', color: '#86efac' }}>Un-cancel</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {[...CANCEL_REASONS, 'Other'].map((r) => (
                    <button key={r} onClick={() => { setReason(r); setConfirmCancel(false); }}
                      className="px-2.5 py-1.5 rounded-full text-[11px] font-semibold"
                      style={reason === r
                        ? { background: 'rgba(244,63,94,0.18)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.4)' }
                        : { background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-medium)' }}>
                      {r}
                    </button>
                  ))}
                </div>
                {reason === 'Other' && (
                  <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Reason (optional)"
                    className="w-full bg-transparent py-1.5 px-2 rounded-lg text-sm"
                    style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
                )}
                <button disabled={busy}
                  onClick={() => { if (!confirmCancel) { setConfirmCancel(true); return; } act(() => onCancel(cancelReasonValue)); }}
                  className="w-full py-2.5 rounded-xl text-[12px] font-bold"
                  style={confirmCancel
                    ? { background: '#fb3b5e', color: '#fff' }
                    : { background: 'rgba(244,63,94,0.12)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.3)' }}>
                  {confirmCancel ? `Tap again to cancel${cancelReasonValue ? ` · ${cancelReasonValue}` : ''}` : 'Cancel session & notify'}
                </button>
              </div>
            )}
          </div>

          {/* Edit / Delete */}
          <div className="pt-3 border-t flex gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
            <button disabled={busy} onClick={() => onEdit?.()} className="flex-1 py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5" style={{ background: 'var(--bg-input)', color: 'var(--text-strong)' }}>
              <Pencil size={13} /> Edit time/place
            </button>
            <button disabled={busy} onClick={() => { if (!confirmDel) { setConfirmDel(true); return; } act(onDelete); }} className="flex-1 py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5" style={{ background: 'rgba(244,63,94,0.12)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.25)' }}>
              <Trash2 size={13} /> {confirmDel ? 'Tap to confirm' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// ────────────────────────────────────────────────────────────────────
// SESSION CARD
// (interactive=false for peek cards on either side)
// ────────────────────────────────────────────────────────────────────
const SessionCard = ({ session, confirmed, tentative, out, undecided, myStatus, myPartySize = 1, displayPartySize = 1, onMyStatus, onAdjustParty, interactive = true, meName = MOCK_USER.name, onPrev, onNext, canPrev = false, canNext = false, canEdit = false, onEdit, onSetWatch, onClearWatch, onCancel, onUncancel, onDelete }) => {
  // Real sessions carry groupName + roster + location; the mock prototype falls back to GROUP_INFO/generateRoster.
  const groupName = session.groupName || GROUP_INFO[session.groupId]?.name || 'Group';
  const location = session.location || GROUP_INFO[session.groupId]?.location || null;
  // Off-cadence sessions glow neon so they stand out (different day/time than usual).
  const strongCol = session.timeDiffers ? '#c5e500' : 'var(--text-strong)';
  const overall = getOverallStatus(confirmed);
  const o = COLOR[overall];
  const [rosterOpen, setRosterOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const computedRoster = useMemo(() => generateRoster({ ...session, in: confirmed, maybe: tentative, out, undecided, myStatus, myPartySize }),
    [session.id, confirmed, tentative, out, undecided, myStatus, myPartySize]);
  const roster = session.roster || computedRoster;
  const context = dayContext(session.dateObj);
  const isContextLabel = ['TODAY', 'TOMORROW'].includes(context) || context.startsWith('IN ');

  return (
    <div className="rounded-3xl overflow-hidden backdrop-blur-xl relative"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)',
        boxShadow: '0 24px 64px -16px rgba(0,0,0,0.45), 0 1px 0 var(--border-medium) inset',
        opacity: session.cancelled ? 0.72 : 1 }}>
      {/* Header — group name above, date+time centered with nav arrows, location below */}
      <div className="px-5 pt-4 pb-3 text-center">
        <div className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
          {groupName}
          {session.invitedUserIds && (
            <span className="ml-1.5" style={{ color: '#fcd34d' }}>· 🔒 {session.invitedCount} invited</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          <button onClick={() => interactive && onPrev?.()} disabled={!canPrev} aria-label="Previous session"
            className="p-1 flex-shrink-0 disabled:opacity-20" style={{ color: 'var(--text-tertiary)' }}>
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 text-center" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.05, fontVariationSettings: "'wdth' 95", textShadow: session.timeDiffers ? '0 0 12px rgba(197,229,0,0.55)' : 'none' }}>
            {(context === 'TODAY' || context === 'TOMORROW') ? (
              <>
                <span style={{ color: '#c5e500' }}>{context}</span>
                <span style={{ color: strongCol }}> · {fmtTime(session.dateObj)}</span>
              </>
            ) : (
              <span style={{ color: strongCol }}>
                {DAYS_SHORT[session.dateObj.getDay()].toUpperCase()} · {MONTHS[session.dateObj.getMonth()].toUpperCase()} {session.dateObj.getDate()} · {fmtTime(session.dateObj)}
              </span>
            )}
          </div>
          <button onClick={() => interactive && onNext?.()} disabled={!canNext} aria-label="Next session"
            className="p-1 flex-shrink-0 disabled:opacity-20" style={{ color: 'var(--text-tertiary)' }}>
            <ChevR size={22} />
          </button>
        </div>
        {location && (
          <div className="text-[12px] mt-1 flex items-center justify-center gap-1"
            style={session.locationDiffers
              ? { color: '#c5e500', fontWeight: 700, textShadow: '0 0 10px rgba(197,229,0,0.55)' }
              : { color: 'var(--text-tertiary)' }}>
            {session.locationDiffers && <MapPin size={12} />}
            {location}
          </div>
        )}
      </div>

      {/* Weather watch banner — heads-up that the session might be called off */}
      {!session.cancelled && session.watchReason && (
        <div className="mx-5 mb-2 px-3 py-2 rounded-xl flex items-center gap-2"
          style={{ background: 'rgba(252,211,77,0.14)', border: '1px solid rgba(252,211,77,0.45)', color: '#fcd34d' }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <div className="text-[11px] font-bold tracking-wide leading-tight">
            {String(session.watchReason).toUpperCase()} WATCH · may cancel — TBD
          </div>
        </div>
      )}

      {/* Courts (with a big diagonal CANCELLED stamp when called off) */}
      <div className="px-5 pt-1 pb-3 relative">
        <CourtGrid confirmed={confirmed} tentative={tentative} />
        {session.cancelled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div style={{
              transform: 'rotate(-13deg)', textTransform: 'uppercase',
              fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
              fontSize: '34px', letterSpacing: '0.06em', color: '#fb3b5e',
              border: '4px solid #fb3b5e', borderRadius: '10px', padding: '2px 18px',
              background: 'rgba(244,59,94,0.10)',
              boxShadow: '0 0 0 2px rgba(244,59,94,0.2), 0 8px 26px rgba(0,0,0,0.35)',
              textShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}>
              Cancelled
            </div>
          </div>
        )}
      </div>

      {/* Status badge — replaced by a red "off" badge when cancelled */}
      <div className="px-6 pb-4">
        {session.cancelled ? (
          <div className="flex items-center gap-3 p-3 rounded-2xl"
            style={{ background: 'linear-gradient(90deg, rgba(244,63,94,0.15) 0%, transparent 100%)', border: '1px solid rgba(244,63,94,0.3)' }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#fb3b5e', boxShadow: '0 0 12px #fb3b5e' }} />
            <div>
              <div className="text-sm font-bold tracking-wide" style={{ color: '#fb7185' }}>Cancelled</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{session.cancelReason || 'This session is off'}</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-2xl"
            style={{ background: `linear-gradient(90deg, ${o.glow} 0%, transparent 100%)`,
              border: `1px solid ${o.glow}` }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: o.dot, boxShadow: `0 0 12px ${o.dot}` }} />
            <div>
              <div className={`text-sm font-bold tracking-wide ${o.text}`}>{o.label}</div>
              {o.sub && <div className="text-[11px] text-zinc-400 mt-0.5">{o.sub}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Party size chip (persistent, lets user set guests before or after opting in) */}
      <div className="px-5 pb-3">
        <button onClick={() => interactive && onAdjustParty?.()}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-full text-[12px] font-semibold transition-all"
          style={displayPartySize > 1
            ? { background: 'rgba(197,229,0,0.12)', color: '#c5e500', border: '1px solid rgba(197,229,0,0.35)' }
            : { background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-medium)' }
          }>
          <Users size={13} />
          {displayPartySize === 1
            ? 'Just you · tap to bring guests'
            : `Going as ${displayPartySize} (you + ${displayPartySize - 1}) · tap to adjust`}
        </button>
      </div>

      {/* Status buttons */}
      <div className="grid grid-cols-3 gap-2 px-5 pb-4">
        <ActionButton label="I'M IN" active={myStatus === 'in'} disabled={!interactive}
          activeStyle={{ background: '#c5e500', color: '#0a0a0c', boxShadow: '0 0 24px rgba(197,229,0,0.5), 0 1px 0 rgba(255,255,255,0.18) inset' }}
          onClick={() => interactive && onMyStatus('in')} />
        <ActionButton label="MAYBE" active={myStatus === 'maybe'} disabled={!interactive}
          activeStyle={{ background: '#fcd34d', color: '#1a1500', boxShadow: '0 0 24px rgba(252,211,77,0.4), 0 1px 0 rgba(255,255,255,0.18) inset' }}
          onClick={() => interactive && onMyStatus('maybe')} />
        <ActionButton label="OUT" active={myStatus === 'out'} disabled={!interactive}
          activeStyle={{ background: '#52525b', color: '#fff', boxShadow: '0 0 18px rgba(82,82,91,0.4), 0 1px 0 rgba(255,255,255,0.18) inset' }}
          onClick={() => interactive && onMyStatus('out')} />
      </div>

      {/* Roster toggle */}
      <button
        onClick={() => interactive && setRosterOpen(v => !v)}
        className="w-full px-5 py-3 flex items-center justify-between text-left border-t transition-all"
        style={{
          borderColor: 'var(--border-medium)',
          background: rosterOpen ? 'rgba(197,229,0,0.08)' : 'var(--bg-faint)',
        }}
      >
        <span className="flex items-center gap-2.5">
          <Users size={15} style={{ color: 'var(--text-secondary)' }} />
          <span className="text-[13px] font-bold tracking-wide" style={{ color: 'var(--text-strong)' }}>
            {rosterOpen ? 'Hide roster' : 'Show roster'}
          </span>
          <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(197,229,0,0.15)', color: '#c5e500' }}>
            {confirmed} IN
          </span>
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
            of {confirmed + tentative + out + undecided}
          </span>
        </span>
        <ChevronDown size={18} style={{ color: 'var(--text-secondary)', transform: rosterOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms' }} />
      </button>

      {/* Roster expanded */}
      {rosterOpen && (
        <div className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <RosterSection title="IN"        names={roster.in}        color="#c5e500" lighter meName={meName} />
          <RosterSection title="MAYBE"     names={roster.maybe}     color="#fcd34d" meName={meName} />
          <RosterSection title="OUT"       names={roster.out}       color="#a1a1aa" meName={meName} />
          <RosterSection title="UNDECIDED" names={roster.undecided} color="#71717a" meName={meName} />
        </div>
      )}

      {/* Admin controls (collapsed row always renders for admins; expands only
          on the interactive card so peek cards don't pop chrome during swipe) */}
      {canEdit && (
        <SessionAdminPanel
          session={session} open={adminOpen} interactive={interactive}
          onToggle={() => interactive && setAdminOpen((v) => !v)}
          onSetWatch={onSetWatch} onClearWatch={onClearWatch}
          onCancel={onCancel} onUncancel={onUncancel}
          onEdit={onEdit} onDelete={onDelete}
        />
      )}
    </div>
  );
};

const ActionButton = ({ label, active, activeStyle, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled}
    className="py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all"
    style={active ? activeStyle : { background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
    {label}
  </button>
);

const RosterSection = ({ title, names, color, lighter, meName = MOCK_USER.name }) => {
  if (!names || names.length === 0) {
    return (
      <div className="px-5 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
          <div className="text-[10px] font-bold tracking-[0.2em]" style={{ color }}>{title} · 0</div>
        </div>
        <div className="text-[12px] text-zinc-600 italic ml-3.5">No one yet</div>
      </div>
    );
  }
  return (
    <div className="px-5 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        <div className="text-[10px] font-bold tracking-[0.2em]" style={{ color }}>{title} · {names.length}</div>
      </div>
      <div className="space-y-1.5 ml-3.5">
        {names.map((name, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Avatar name={name} size={24} isYou={name === meName} />
            <span className="text-[13px]" style={{ color: name === meName ? '#c5e500' : 'var(--text-strong)' }}>
              {name === meName ? `${name} (you)` : name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────
// SESSION CAROUSEL — peeks prev/next during swipe
// ────────────────────────────────────────────────────────────────────
const SessionCarousel = ({ filteredSessions, currentIdx, confirmed, tentative, out, undecided, myStatus, myPartySize, displayPartySize, onMyStatus, onAdjustParty, onPrev, onNext, meName = MOCK_USER.name, canEdit = false, onEdit, canEditOf = () => false, onSetWatch, onClearWatch, onCancel, onUncancel, onDelete }) => {
  const prevSession = filteredSessions[currentIdx - 1] || null;
  const currentSession = filteredSessions[currentIdx];
  const nextSession = filteredSessions[currentIdx + 1] || null;

  const canPrev = !!prevSession;
  const canNext = !!nextSession;

  const SWIPE_THRESHOLD = 130;
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [direction, setDirection] = useState(null);
  const [delta, setDelta] = useState(0);
  const [committing, setCommitting] = useState(null);
  // skipTransition is true for exactly one render after a commit, so the
  // track snaps to its new "centered" position without animating backwards
  // through the shifted session content.
  const [skipTransition, setSkipTransition] = useState(false);

  useEffect(() => {
    if (!committing) return;
    const t = setTimeout(() => {
      // Batch the state swap so the next render: shifts sessions, resets delta,
      // and skips the transition. The user sees the same card stay put.
      setSkipTransition(true);
      if (committing === 'next') onNext();
      else if (committing === 'prev') onPrev();
      setDelta(0);
      setCommitting(null);
      setTouchStartX(null);
      setTouchStartY(null);
      setDirection(null);
    }, 300);
    return () => clearTimeout(t);
  }, [committing]);

  // Re-enable transitions after two animation frames so the snap completes
  // visually before the next swipe is allowed to animate.
  useEffect(() => {
    if (!skipTransition) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSkipTransition(false));
    });
    return () => cancelAnimationFrame(id);
  }, [skipTransition]);

  const handleTouchStart = (e) => {
    if (committing) return;
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
    setDirection(null);
    setDelta(0);
  };
  const handleTouchMove = (e) => {
    if (committing || touchStartX === null) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (direction === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      setDirection(Math.abs(dx) > Math.abs(dy) ? 'h' : 'v');
    }
    if (direction === 'h') {
      let eff = dx;
      if (eff > 0 && !canPrev) eff = eff / 4;
      if (eff < 0 && !canNext) eff = eff / 4;
      setDelta(eff);
    }
  };
  const handleTouchEnd = () => {
    if (committing) return;
    if (direction === 'h' && delta > SWIPE_THRESHOLD && canPrev) {
      setCommitting('prev');
    } else if (direction === 'h' && delta < -SWIPE_THRESHOLD && canNext) {
      setCommitting('next');
    } else {
      setDelta(0);
      setTouchStartX(null);
      setTouchStartY(null);
      setDirection(null);
    }
  };

  let trackDelta = delta;
  if (committing === 'prev') trackDelta = window.innerWidth || 400;
  if (committing === 'next') trackDelta = -(window.innerWidth || 400);

  const transitionEnabled = !skipTransition && (committing || delta === 0);

  return (
    <div className="-mx-5 overflow-hidden" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div
        className="flex"
        style={{
          width: '300%',
          transform: `translateX(calc(-33.3333% + ${trackDelta}px))`,
          transition: transitionEnabled ? 'transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1)' : 'none',
          touchAction: 'pan-y',
        }}
      >
        {/* Previous */}
        <div className="px-5" style={{ flex: '0 0 33.3333%', width: '33.3333%' }}>
          {prevSession ? (
            <SessionCard
              session={prevSession}
              confirmed={prevSession.in} tentative={prevSession.maybe} out={prevSession.out} undecided={prevSession.undecided}
              myStatus={prevSession.myStatus} myPartySize={prevSession.myPartySize || 1} displayPartySize={prevSession.myPartySize || 1}
              onMyStatus={() => {}} interactive={false} meName={meName}
              canPrev={currentIdx - 1 > 0} canNext canEdit={canEditOf(prevSession)}
            />
          ) : <PeekPlaceholder label="No earlier sessions" />}
        </div>
        {/* Current */}
        <div className="px-5" style={{ flex: '0 0 33.3333%', width: '33.3333%' }}>
          <SessionCard
            session={currentSession}
            confirmed={confirmed} tentative={tentative} out={out} undecided={undecided}
            myStatus={myStatus} myPartySize={myPartySize} displayPartySize={displayPartySize} onMyStatus={onMyStatus} onAdjustParty={onAdjustParty} interactive={true}
            meName={meName}
            onPrev={onPrev} onNext={onNext} canPrev={canPrev} canNext={canNext}
            canEdit={canEdit} onEdit={onEdit}
            onSetWatch={onSetWatch} onClearWatch={onClearWatch}
            onCancel={onCancel} onUncancel={onUncancel} onDelete={onDelete}
          />
        </div>
        {/* Next */}
        <div className="px-5" style={{ flex: '0 0 33.3333%', width: '33.3333%' }}>
          {nextSession ? (
            <SessionCard
              session={nextSession}
              confirmed={nextSession.in} tentative={nextSession.maybe} out={nextSession.out} undecided={nextSession.undecided}
              myStatus={nextSession.myStatus} myPartySize={nextSession.myPartySize || 1} displayPartySize={nextSession.myPartySize || 1}
              onMyStatus={() => {}} interactive={false} meName={meName}
              canPrev canNext={!!filteredSessions[currentIdx + 2]} canEdit={canEditOf(nextSession)}
            />
          ) : <PeekPlaceholder label="No upcoming sessions" />}
        </div>
      </div>
    </div>
  );
};

const PeekPlaceholder = ({ label }) => (
  <div className="rounded-3xl flex items-center justify-center py-20"
    style={{ background: 'var(--bg-subtle)', border: '1px dashed var(--border-medium)' }}>
    <div className="text-[12px] text-zinc-600">{label}</div>
  </div>
);

// ────────────────────────────────────────────────────────────────────
// WEEK / LIST VIEW
// ────────────────────────────────────────────────────────────────────
const WeekView = ({ sessions, onSelect }) => {
  const byDate = useMemo(() => {
    const groups = new Map();
    sessions.forEach(s => {
      const key = s.dateObj.toDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    });
    return Array.from(groups.entries());
  }, [sessions]);
  return (
    <div className="space-y-2.5">
      {byDate.map(([dateKey, daySessions]) => {
        const day = daySessions[0].dateObj;
        const ctx = dayContext(day);
        return (
          <div key={dateKey} className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', backdropFilter: 'blur(12px)' }}>
            <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-white/5">
              <div className="text-[11px] tracking-[0.18em] font-bold"
                style={{ color: ['TODAY', 'TOMORROW'].includes(ctx) ? '#c5e500' : 'var(--text-secondary)' }}>
                {ctx} · {DAYS_LONG[day.getDay()]}, {MONTHS[day.getMonth()]} {day.getDate()}
              </div>
              <div className="text-[10px] text-zinc-500 font-semibold">{daySessions.length} {daySessions.length === 1 ? 'session' : 'sessions'}</div>
            </div>
            {daySessions.map(s => {
              const groupName = s.groupName || GROUP_INFO[s.groupId]?.name || 'Group';
              const overall = getOverallStatus(s.in);
              const o = COLOR[overall];
              return (
                <button key={s.id} onClick={() => onSelect(s.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: o.dot, boxShadow: `0 0 8px ${o.dot}` }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{groupName}</div>
                    <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                      <span>{fmtTime(s.dateObj)}</span><span>·</span>
                      <span className="font-semibold text-emerald-300">{s.in} IN</span>
                      {s.maybe > 0 && <><span>·</span><span className="font-semibold text-amber-300">{s.maybe} MAYBE</span></>}
                    </div>
                  </div>
                  <StatusPill status={s.myStatus} small />
                  <ChevR size={14} style={{ color: 'var(--text-faint)' }} />
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────
// GROUPS MENU
// ────────────────────────────────────────────────────────────────────
const GroupsMenu = ({ open, onClose, onManage, onDetails, visibleGroups, setVisibleGroups, onAddInstance, onDiscover, groups = [], onCreateGroup, onInviteMember, isDemo = false }) => {
  const allIds = groups.map((g) => g.id);
  const allVisible = allIds.every(id => visibleGroups.has(id));
  const noneVisible = visibleGroups.size === 0;
  const toggle = (id) => {
    const next = new Set(visibleGroups);
    if (next.has(id)) next.delete(id); else next.add(id);
    setVisibleGroups(next);
  };
  return (
  <>
    <div className="fixed inset-0 z-40 transition-opacity duration-300"
      style={{ background: 'var(--bg-overlay)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      onClick={onClose} />
    <div className="fixed top-0 left-0 bottom-0 z-50 w-80 max-w-[85vw] transition-transform duration-300 overflow-y-auto"
      style={{ background: 'var(--bg-card-solid)', borderRight: '1px solid var(--border-subtle)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)', boxShadow: '0 0 40px rgba(0,0,0,0.45)' }}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] tracking-[0.2em] font-bold text-zinc-500">YOUR GROUPS</div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: 'var(--bg-glass)' }}>
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        <div className="text-[11px] text-zinc-500 mb-3 leading-snug">
          Tap a group to show or hide it in your feed. Use Select all / Clear to bulk-toggle.
        </div>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setVisibleGroups(new Set(allIds))}
            disabled={allVisible}
            className="flex-1 py-1.5 rounded-full text-[10px] font-bold tracking-wider disabled:opacity-40"
            style={{ background: 'rgba(197,229,0,0.1)', color: '#c5e500', border: '1px solid rgba(197,229,0,0.2)' }}>
            SELECT ALL
          </button>
          <button onClick={() => setVisibleGroups(new Set())}
            disabled={noneVisible}
            className="flex-1 py-1.5 rounded-full text-[10px] font-bold tracking-wider disabled:opacity-40"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
            CLEAR VISIBLE
          </button>
        </div>
        <div className="space-y-2.5">
          {groups.map(g => {
            const isVisible = visibleGroups.has(g.id);
            return (
            <div key={g.id} className="rounded-2xl overflow-hidden transition-all"
              style={{
                background: 'var(--bg-subtle)',
                border: isVisible ? '1px solid rgba(197,229,0,0.45)' : '1px solid var(--border-subtle)',
                boxShadow: isVisible ? '0 0 14px rgba(197,229,0,0.08)' : 'none',
                opacity: isVisible ? 1 : 0.6,
              }}>
              <button onClick={() => toggle(g.id)} className="w-full flex items-center gap-3 text-left p-3.5 min-w-0"
                aria-label={isVisible ? `Hide ${g.name} from feed` : `Show ${g.name} in feed`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-base font-bold tracking-tight truncate" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{g.name}</div>
                    {g.role === 'admin' && (
                      <span className="flex items-center gap-1 text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: 'rgba(197,229,0,0.12)', color: '#c5e500' }}>
                        <Shield size={10} />ADMIN
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500">{g.schedule || g.location || 'No schedule yet'}</div>
                  <div className="text-[11px] text-zinc-600 mt-0.5">{g.members ?? 0} members</div>
                </div>
                <div className="w-5 h-5 rounded-full transition-all flex-shrink-0"
                  style={{
                    background: isVisible ? '#c5e500' : 'transparent',
                    border: isVisible ? '1px solid var(--text-tertiary)' : '1.5px solid var(--text-faint)',
                    boxShadow: isVisible ? '0 0 10px rgba(197,229,0,0.55)' : 'none',
                  }} />
              </button>
              {(() => {
                const showAdd = isDemo || g.role === 'admin' || g.allow_adhoc;
                const showInvite = (g.role === 'admin' || g.allow_member_invites) && !!onInviteMember;
                const showManage = g.role === 'admin';
                const showDetails = !showManage && !isDemo && !!onDetails;
                if (!showAdd && !showInvite && !showManage && !showDetails) return null;
                return (
                  <div className="flex border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    {showAdd && (
                      <button onClick={() => onAddInstance(g.id)} className="flex-1 px-3.5 py-2 text-[11px] font-semibold flex items-center justify-center gap-1"
                        style={{ color: 'var(--text-secondary)' }}>
                        <Plus size={12} />Add instance
                      </button>
                    )}
                    {showInvite && (
                      <button onClick={() => onInviteMember(g.id)} className="flex-1 px-3.5 py-2 text-[11px] font-semibold flex items-center justify-center gap-1 border-l"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                        <Plus size={11} />Invite
                      </button>
                    )}
                    {showManage && (
                      <button onClick={() => onManage(g.id)} className="flex-1 px-3.5 py-2 text-[11px] font-semibold flex items-center justify-center gap-1 border-l"
                        style={{ borderColor: 'var(--border-subtle)', color: 'rgba(197,229,0,0.85)' }}>
                        Manage<ChevR size={11} />
                      </button>
                    )}
                    {showDetails && (
                      <button onClick={() => onDetails(g.id)} className="flex-1 px-3.5 py-2 text-[11px] font-semibold flex items-center justify-center gap-1 border-l"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                        Details<ChevR size={11} />
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
            );
          })}
        </div>
        {onCreateGroup && (
          <button onClick={onCreateGroup} className="w-full mt-4 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: 'rgba(197,229,0,0.12)', color: '#c5e500', border: '1px solid rgba(197,229,0,0.3)' }}>
            <Plus size={14} />Create group
          </button>
        )}
        <button onClick={onDiscover} className="w-full mt-2 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px dashed var(--border-strong)' }}>
          <Plus size={14} />Discover groups
        </button>
      </div>
    </div>
  </>
  );
};

// ────────────────────────────────────────────────────────────────────
// SETTINGS / GROUP SETTINGS
// ────────────────────────────────────────────────────────────────────
const SettingsRow = ({ label, value, action, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between py-3.5 px-4 hover:bg-white/[0.02] transition-colors text-left">
    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
    <span className="flex items-center gap-1.5 text-sm text-zinc-500">{value}{action && <ChevR size={14} />}</span>
  </button>
);
const ToggleRow = ({ label, sub, on, onChange }) => (
  <div className="flex items-center justify-between py-3.5 px-4">
    <div>
      <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</div>
      {sub && <div className="text-[11px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
    <button onClick={() => onChange(!on)} className="w-10 h-6 rounded-full transition-colors flex-shrink-0"
      style={{ background: on ? '#c5e500' : 'var(--bg-input-hover)' }}>
      <div className="w-5 h-5 rounded-full bg-white transition-transform"
        style={{ transform: on ? 'translateX(18px)' : 'translateX(2px)', boxShadow: '0 1px 3px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)' }} />
    </button>
  </div>
);
const SettingsSection = ({ title, children }) => (
  <div className="mb-5">
    <div className="text-[10px] tracking-[0.2em] font-bold text-zinc-500 mb-2 px-1 uppercase">{title}</div>
    <div className="rounded-2xl overflow-hidden divide-y" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderColor: 'var(--border-subtle)' }}>
      {children}
    </div>
  </div>
);

// Inline editable text field for settings rows
const EditableRow = ({ label, value, onSave, type = 'text', placeholder }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="w-full flex items-center justify-between py-3.5 px-4 text-left">
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
        <span className="flex items-center gap-1.5 text-sm text-zinc-500 max-w-[55%] truncate">
          {type === 'password' ? '••••••••' : (value || <span className="italic">{placeholder || 'Not set'}</span>)}
          <ChevR size={14} />
        </span>
      </button>
    );
  }
  return (
    <div className="py-2.5 px-4">
      <div className="text-[11px] text-zinc-500 mb-1.5 font-semibold tracking-wider uppercase">{label}</div>
      <div className="flex gap-2">
        <input autoFocus type={type} value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { setDraft(value); setEditing(false); }}
          className="flex-1 bg-transparent text-sm py-1.5 px-2 rounded-lg"
          style={{ color: 'var(--text-strong)', border: '1px solid rgba(197,229,0,0.4)', outline: 'none' }} />
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => { onSave(draft); setEditing(false); }}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
          style={{ background: '#c5e500', color: '#1a1f00' }}>Save</button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setDraft(value); setEditing(false); }}
          className="px-2 py-1.5 rounded-lg text-[11px] font-bold"
          style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Cancel</button>
      </div>
    </div>
  );
};

// Inline stepper for numeric settings (party size, horizon, etc.)
const StepperRow = ({ label, sub, value, onChange, min = 1, max = 10, unit }) => (
  <div className="flex items-center justify-between py-3 px-4 gap-3">
    <div className="min-w-0">
      <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</div>
      {sub && <div className="text-[11px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-lg leading-none disabled:opacity-30"
        style={{ background: 'var(--bg-input-hover)', color: 'var(--text-strong)' }}>−</button>
      <div className="text-sm font-bold tabular-nums min-w-[42px] text-center" style={{ color: 'var(--text-strong)', fontFamily: "'Bricolage Grotesque', sans-serif" }}>
        {value}{unit && <span className="text-[11px] text-zinc-500 font-semibold ml-0.5">{unit}</span>}
      </div>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-lg leading-none disabled:opacity-30"
        style={{ background: 'var(--bg-input-hover)', color: 'var(--text-strong)' }}>+</button>
    </div>
  </div>
);

// Generic centered modal sheet
const ModalSheet = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'var(--bg-overlay)' }} />
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-modal)', border: '1px solid var(--border-medium)', boxShadow: '0 -10px 40px rgba(0,0,0,0.6)' }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="text-base font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{title}</div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-glass)' }}>
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

const ThemeModal = ({ open, onClose, theme, setTheme }) => {
  const options = [
    { id: 'dark',   label: 'Dark',   sub: 'Neon on charcoal',              available: true  },
    { id: 'medium', label: 'Medium', sub: 'A touch lighter than dark',     available: true  },
    { id: 'light',  label: 'Light',  sub: 'Bright surfaces, dark text',    available: true  },
    { id: 'system', label: 'System', sub: 'Match your device setting',     available: false },
  ];
  return (
    <ModalSheet open={open} onClose={onClose} title="Theme">
      <div className="space-y-2 text-sm">
        {options.map(o => {
          const selected = o.id === theme;
          return (
            <button key={o.id} disabled={!o.available}
              onClick={() => { if (o.available) { setTheme(o.id); onClose(); } }}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-left ${o.available ? '' : 'cursor-not-allowed'}`}
              style={{
                background: selected ? 'rgba(197,229,0,0.12)' : 'var(--bg-subtle)',
                border: selected ? '1px solid rgba(197,229,0,0.35)' : '1px solid var(--border-subtle)',
                opacity: o.available ? 1 : 0.55,
              }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{
                    border: selected ? '5px solid #c5e500' : '1.5px solid var(--text-tertiary)',
                    background: selected ? '#1a1f00' : 'transparent',
                  }} />
                <div className="min-w-0">
                  <div className="font-bold" style={{ color: 'var(--text-strong)' }}>{o.label}</div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{o.sub}</div>
                </div>
              </div>
              {!o.available && (
                <span className="text-[9px] tracking-[0.15em] font-bold uppercase flex-shrink-0 px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--bg-glass)', color: 'var(--text-muted)' }}>In dev</span>
              )}
            </button>
          );
        })}
      </div>
    </ModalSheet>
  );
};

const AddInstanceModal = ({ groupId, groupName, groupLocation, members = [], onClose, onCreate }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [rosterOpen, setRosterOpen] = useState(false);
  const open = !!groupId;
  const g = groupId ? GROUP_INFO[groupId] : null;
  const titleName = groupName || g?.name;
  // Default the location to the group's standing location; admin can override per session.
  useEffect(() => {
    if (open) {
      setDate(''); setTime(''); setLocation(groupLocation || '');
      setBusy(false); setErr(null);
      setSelected(new Set((members || []).map((m) => m.id)));
      setRosterOpen(false);
    }
  }, [open, groupId, groupLocation, members]);
  const allCount = (members || []).length;
  const selectedCount = selected.size;
  const allSelected = allCount > 0 && selectedCount === allCount;
  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectAll = () => setSelected(new Set((members || []).map((m) => m.id)));
  const unselectAll = () => setSelected(new Set());
  const submit = async () => {
    if (!date || !time) return;
    setBusy(true); setErr(null);
    try {
      const startsAt = new Date(`${date}T${time}`).toISOString();
      // null = open to whole group (no restriction). Send the explicit list only
      // if the admin actually de-selected someone.
      const invitedUserIds = allSelected ? null : [...selected];
      if (onCreate) await onCreate({ groupId, startsAt, location: location.trim() || null, invitedUserIds });
      onClose();
    } catch (e) { setErr(e.message || 'Could not create session'); setBusy(false); }
  };
  return (
    <ModalSheet open={open} onClose={onClose} title={titleName ? `Add instance · ${titleName}` : 'Add instance'}>
      <div className="space-y-3 text-sm">
        <div className="text-[11px] text-zinc-500 leading-snug">
          Create a one-off session outside the recurring schedule. By default everyone in the group is invited — tap Roster to limit it.
        </div>
        <label className="block">
          <div className="text-[10px] tracking-wider text-zinc-500 font-bold mb-1 uppercase">Date</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-transparent py-2 px-2.5 rounded-lg text-sm"
            style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
        </label>
        <label className="block">
          <div className="text-[10px] tracking-wider text-zinc-500 font-bold mb-1 uppercase">Time</div>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
            className="w-full bg-transparent py-2 px-2.5 rounded-lg text-sm"
            style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
        </label>
        <label className="block">
          <div className="text-[10px] tracking-wider text-zinc-500 font-bold mb-1 uppercase">Location</div>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Riverside Courts"
            className="w-full bg-transparent py-2 px-2.5 rounded-lg text-sm"
            style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
        </label>
        {allCount > 0 && (
          <div>
            <div className="text-[10px] tracking-wider text-zinc-500 font-bold mb-1 uppercase">Who&rsquo;s invited</div>
            <button onClick={() => setRosterOpen((v) => !v)}
              className="w-full bg-transparent py-2 px-2.5 rounded-lg text-sm flex items-center justify-between"
              style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }}>
              <span className="flex items-center gap-2">
                <Users size={15} style={{ color: allSelected ? '#c5e500' : '#fcd34d' }} />
                <span style={{ fontWeight: 600 }}>
                  {allSelected ? `Everyone · ${allCount} members` : `${selectedCount} of ${allCount} selected`}
                </span>
              </span>
              <ChevronDown size={16} style={{ color: 'var(--text-tertiary)', transform: rosterOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms' }} />
            </button>
            <div className="mt-1 text-[10px] leading-snug" style={{ color: allSelected ? 'var(--text-tertiary)' : '#fcd34d' }}>
              {allSelected
                ? 'Tap above to limit who sees this instance.'
                : `Restricted — only ${selectedCount} member${selectedCount === 1 ? '' : 's'} will see it and get notified.`}
            </div>
            {rosterOpen && (
              <>
                <div className="mt-2 flex justify-end gap-2 text-[10px] font-bold">
                  <button onClick={selectAll} style={{ color: '#c5e500' }}>Select all</button>
                  <span style={{ color: 'var(--text-faint)' }}>·</span>
                  <button onClick={unselectAll} style={{ color: 'var(--text-tertiary)' }}>Unselect all</button>
                </div>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg" style={{ background: 'var(--bg-faint)', border: '1px solid var(--border-medium)' }}>
                  {members.map((m) => {
                    const nm = m.full_name || 'Member';
                    const checked = selected.has(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-2.5 px-3 py-2 border-b last:border-b-0 cursor-pointer" style={{ borderColor: 'var(--border-subtle)' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(m.id)} className="accent-lime-400" />
                        <Avatar name={nm} size={24} />
                        <span className="text-sm">{nm}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
        <button onClick={submit} disabled={!date || !time || busy || (allCount > 0 && selectedCount === 0)}
          className="w-full py-3 rounded-2xl text-sm font-bold disabled:opacity-40 mt-1"
          style={{ background: '#c5e500', color: '#1a1f00' }}>{busy ? 'Creating…' : 'Create instance'}</button>
        {err && <div className="text-[12px] text-center" style={{ color: '#fb7185' }}>{err}</div>}
      </div>
    </ModalSheet>
  );
};

const EditInstanceModal = ({ session, onClose, onSave }) => {
  const open = !!session;
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (session) {
      const d = session.dateObj;
      const pad = (n) => String(n).padStart(2, '0');
      setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      setLocation(session.location || '');
      setBusy(false); setErr('');
    }
  }, [session]);
  const save = async () => {
    if (!date || !time) return;
    setBusy(true); setErr('');
    try { await onSave({ starts_at: new Date(`${date}T${time}`).toISOString(), location: location.trim() || null }); onClose(); }
    catch (e) { setErr(e.message || 'Could not save'); setBusy(false); }
  };
  return (
    <ModalSheet open={open} onClose={onClose} title="Edit session">
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <div className="text-[10px] tracking-wider text-zinc-500 font-bold mb-1 uppercase">Date</div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent py-2 px-2.5 rounded-lg text-sm"
              style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
          </label>
          <label className="block">
            <div className="text-[10px] tracking-wider text-zinc-500 font-bold mb-1 uppercase">Time</div>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="w-full bg-transparent py-2 px-2.5 rounded-lg text-sm"
              style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
          </label>
        </div>
        <label className="block">
          <div className="text-[10px] tracking-wider text-zinc-500 font-bold mb-1 uppercase">Location</div>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Riverside Courts"
            className="w-full bg-transparent py-2 px-2.5 rounded-lg text-sm"
            style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
        </label>
        <button onClick={save} disabled={!date || !time || busy}
          className="w-full py-3 rounded-2xl text-sm font-bold disabled:opacity-40"
          style={{ background: '#c5e500', color: '#1a1f00' }}>{busy ? 'Saving…' : 'Save changes'}</button>
        {err && <div className="text-[12px] text-center" style={{ color: '#fb7185' }}>{err}</div>}
        <div className="text-[10px] text-zinc-600 text-center">Cancel &amp; delete now live under &ldquo;Admin controls&rdquo; on the session card.</div>
      </div>
    </ModalSheet>
  );
};

// Confirm modal when an IN player tries to drop close to start. Yes alerts the group.
const DropoutConfirmModal = ({ control, onConfirm, onClose }) => {
  const open = !!control;
  const action = control?.targetStatus === 'out' ? 'drop out' : 'switch to tentative';
  const grp = control?.groupName || 'the group';
  return (
    <ModalSheet open={open} onClose={onClose} title="Heads up — close to game time">
      <div className="space-y-4">
        <div className="text-[13px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
          You're checked <span style={{ color: '#c5e500', fontWeight: 700 }}>IN</span> for this session. If you {action} now, the rest of <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{grp}</span> will get a push so someone can step in. Sure?
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-strong)' }}>Stay in</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-2xl text-sm font-bold" style={{ background: '#fb3b5e', color: '#fff' }}>Yes, {action}</button>
        </div>
      </div>
    </ModalSheet>
  );
};

const PartySizeModal = ({ control, onConfirm, onClose }) => {
  const [size, setSize] = useState(1);
  useEffect(() => { if (control) setSize(control.initialSize); }, [control]);
  const open = !!control;
  const actionLabel = (() => {
    if (!control) return 'Confirm';
    if (control.targetStatus === null) return 'Save';
    return control.targetStatus === 'in' ? 'Confirm I\u2019m IN' : control.targetStatus === 'maybe' ? 'Confirm MAYBE' : 'Confirm';
  })();
  return (
    <ModalSheet open={open} onClose={onClose} title="Going as a group?">
      <div className="space-y-4">
        <div className="text-[12px] text-zinc-400 leading-snug">
          How many players are committing in total? Includes yourself.
        </div>
        <div className="flex items-center justify-center gap-5 py-3">
          <button onClick={() => setSize(Math.max(1, size - 1))} disabled={size <= 1}
            className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl leading-none disabled:opacity-30"
            style={{ background: 'var(--bg-input-hover)', color: 'var(--text-strong)' }}
            aria-label="Decrease party size">−</button>
          <div className="text-center min-w-[80px]">
            <div className="text-6xl font-bold tabular-nums leading-none" style={{ color: '#c5e500', fontFamily: "'Bricolage Grotesque', sans-serif", fontVariationSettings: "'wdth' 95" }}>{size}</div>
            <div className="text-[10px] tracking-[0.2em] text-zinc-500 font-bold uppercase mt-2">{size === 1 ? 'Player' : 'Players'}</div>
          </div>
          <button onClick={() => setSize(Math.min(8, size + 1))} disabled={size >= 8}
            className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl leading-none disabled:opacity-30"
            style={{ background: 'var(--bg-input-hover)', color: 'var(--text-strong)' }}
            aria-label="Increase party size">+</button>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-bold"
            style={{ background: 'var(--bg-input)', color: 'var(--text-strong)' }}>Cancel</button>
          <button onClick={() => onConfirm(size)} className="flex-1 py-3 rounded-2xl text-sm font-bold"
            style={{ background: '#c5e500', color: '#1a1f00' }}>{actionLabel}</button>
        </div>
      </div>
    </ModalSheet>
  );
};

const DiscoverGroupsModal = ({ open, onClose, onJoin, myGroupIds = [] }) => {
  const real = !!onJoin;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [joiningId, setJoiningId] = useState(null);
  useEffect(() => {
    if (!open || !real) return;
    let active = true;
    setLoading(true); setErr('');
    const t = setTimeout(() => {
      searchPublicGroups(query)
        .then((r) => { if (active) { setResults(r); setLoading(false); } })
        .catch((e) => { if (active) { setErr(e.message || 'Search failed'); setLoading(false); } });
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [query, open, real]);
  const fakeResults = [
    { id: 'cinc-1', name: 'Cincinnati Sunday Open Play', location: 'Sawyer Point' },
    { id: 'cinc-2', name: 'Mason Morning Crew', location: 'Life Time Mason' },
    { id: 'cinc-3', name: 'West Chester Pickleball', location: 'Voice of America Park' },
  ].filter((g) => g.name.toLowerCase().includes(query.toLowerCase()));
  const list = real ? results : fakeResults;
  const join = async (g) => {
    if (!real) return;
    setJoiningId(g.id); setErr('');
    try { await onJoin(g.id); onClose(); } catch (e) { setErr(e.message || 'Could not join'); setJoiningId(null); }
  };
  return (
    <ModalSheet open={open} onClose={onClose} title="Find a group">
      <div className="space-y-3 text-sm">
        <div className="text-[11px] text-zinc-500 leading-snug">
          Search public groups by name. Private groups need an invite link from an admin.
        </div>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name"
          className="w-full bg-transparent py-2.5 px-3 rounded-lg text-sm"
          style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} autoFocus />
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {real && loading && <div className="text-center text-[11px] text-zinc-500 py-6">Searching…</div>}
          {!loading && list.length === 0 && <div className="text-center text-[11px] text-zinc-500 py-6">No public groups found.</div>}
          {!loading && list.map((g) => {
            const already = myGroupIds.includes(g.id);
            return (
              <div key={g.id} className="rounded-xl p-3 flex items-center justify-between gap-2" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{g.name}</div>
                  {g.location && <div className="text-[11px] text-zinc-500 truncate">{g.location}</div>}
                </div>
                {already ? (
                  <span className="text-[10px] font-bold tracking-wider px-2.5 py-1.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>JOINED</span>
                ) : (
                  <button onClick={() => join(g)} disabled={!real || joiningId === g.id}
                    className="px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider flex-shrink-0 disabled:opacity-50"
                    style={{ background: 'rgba(197,229,0,0.15)', color: '#c5e500', border: '1px solid rgba(197,229,0,0.3)' }}>
                    {joiningId === g.id ? 'JOINING…' : 'JOIN'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {err && <div className="text-[11px] text-center" style={{ color: '#fb7185' }}>{err}</div>}
        {!real && <div className="text-[10px] text-zinc-600 text-center pt-1">Demo — sign in to find and join real groups.</div>}
      </div>
    </ModalSheet>
  );
};
// In the demo, the gear opens a sign-up prompt instead of real settings.
const DemoSettings = ({ onBack, onOpenTutorial }) => (
  <div>
    <div className="flex items-center gap-3 pb-4">
      <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: 'var(--bg-glass)' }}>
        <ArrowLeft size={18} style={{ color: 'var(--text-strong)' }} />
      </button>
      <div className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Demo</div>
    </div>
    <div className="rounded-3xl px-6 py-10 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)' }}>
      <BrandHeader />
      <div className="text-lg font-bold mt-4 mb-1.5" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: 'var(--text-strong)' }}>You&rsquo;re in the demo</div>
      <div className="text-[13px] mb-6 leading-snug" style={{ color: 'var(--text-muted)' }}>
        A sandbox with sample data — nothing here is saved. Create a free account to start your own groups, invite players, and check in for real.
      </div>
      <a href="/" onClick={(e) => hardReplace(e, '/')} className="inline-block px-7 py-3 rounded-full text-sm font-bold" style={{ background: '#c5e500', color: '#1a1f00' }}>
        Sign up / Log in
      </a>
    </div>
    <button onClick={() => onOpenTutorial?.()} className="w-full mt-3 py-3 rounded-2xl text-sm font-semibold" style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
      Replay the tour
    </button>
  </div>
);

// Weekly nudge for people who DENIED notifications (the one case auto-enable
// can't fix — re-enabling needs OS settings). Snoozes 7 days when dismissed.
const NUDGE_KEY = 'pc_notif_nudge_dismissed_at';
const NUDGE_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

const NotificationNudge = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    getPushState().then((s) => {
      if (!alive) return;
      let snoozed = false;
      try { const t = Number(localStorage.getItem(NUDGE_KEY) || 0); snoozed = !!t && (Date.now() - t < NUDGE_SNOOZE_MS); } catch { /* ignore */ }
      setShow(s === 'denied' && !snoozed);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!show) return null;
  const dismiss = () => { try { localStorage.setItem(NUDGE_KEY, String(Date.now())); } catch { /* ignore */ } setShow(false); };
  return (
    <div className="rounded-2xl px-4 py-3 flex items-start gap-3" style={{ background: 'rgba(252,211,77,0.10)', border: '1px solid rgba(252,211,77,0.35)' }}>
      <Bell size={18} style={{ color: '#fcd34d', flexShrink: 0, marginTop: '1px' }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold" style={{ color: 'var(--text-strong)' }}>Notifications are off</div>
        <div className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
          You&rsquo;re missing check-in reminders, cancellations &amp; weather watches. Turn them on for PickleCheck in your phone&rsquo;s Settings &rarr; Notifications, then reopen the app.
        </div>
      </div>
      <button onClick={dismiss} aria-label="Dismiss" className="flex-shrink-0 p-0.5" style={{ color: 'var(--text-tertiary)' }}>
        <X size={16} />
      </button>
    </div>
  );
};

// Device-level push enable/disable + a "send test" check. The per-type toggles
// below it are personal preferences; THIS is the actual on/off for this device.
const PushControl = () => {
  const [state, setState] = useState('loading'); // loading|on|off|needs-install|denied|unsupported
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text } | null

  useEffect(() => { getPushState().then(setState).catch(() => setState('off')); }, []);

  const run = async (fn, okText) => {
    setBusy(true); setMsg(null);
    try {
      const next = await fn();
      if (typeof next === 'string') setState(next);
      if (okText) setMsg({ ok: true, text: okText });
    } catch (e) {
      setMsg({ ok: false, text: e.message || String(e) });
    } finally {
      setBusy(false);
    }
  };

  const turnOn = () => run(enablePush, 'Notifications are on for this device.');
  const test = () => run(async () => {
    const r = await sendTestPush();
    if (!r || r.sent === 0) throw new Error('No registered device received it — try turning notifications off and on.');
    return undefined;
  }, 'Test sent — check your notifications.');

  const pill = (label, onClick, primary) => (
    <button onClick={onClick} disabled={busy}
      className="px-3 py-1.5 rounded-full text-[12px] font-bold disabled:opacity-40"
      style={primary
        ? { background: '#c5e500', color: '#1a1f00' }
        : { background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
      {label}
    </button>
  );

  const note = (text) => (
    <div className="px-4 py-3 text-[12px] leading-snug" style={{ color: 'var(--text-tertiary)' }}>{text}</div>
  );

  let inner;
  if (state === 'loading') inner = <div className="px-4 py-3 text-[12px]" style={{ color: 'var(--text-faint)' }}>Checking…</div>;
  else if (state === 'unsupported') inner = note("This browser doesn’t support notifications.");
  else if (state === 'needs-install') inner = note("To get notifications on iPhone, first add PickleCheck to your Home Screen (Share → “Add to Home Screen”), open it from there, then come back here to turn them on.");
  else if (state === 'denied') inner = note("Notifications are blocked. Turn them back on in your browser/phone settings, then reload.");
  else if (state === 'on') inner = (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#c5e500', boxShadow: '0 0 8px #c5e500' }} />
        <div className="min-w-0">
          <div className="text-sm font-bold">Notifications on</div>
          <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>You’ll get reminders, cancellations & weather watches</div>
        </div>
      </div>
      <div className="flex-shrink-0">{pill('Test', test)}</div>
    </div>
  );
  else inner = (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <Bell size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <div className="min-w-0">
          <div className="text-sm font-bold">Push on this device</div>
          <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Get check-in nudges & cancellations</div>
        </div>
      </div>
      <div className="flex-shrink-0">{pill('Turn on', turnOn, true)}</div>
    </div>
  );

  return (
    <>
      {inner}
      {msg && (
        <div className="px-4 pb-3 text-[12px]" style={{ color: msg.ok ? '#c5e500' : '#fb7185' }}>{msg.text}</div>
      )}
    </>
  );
};

const SettingsView = ({ onBack, settings, update, theme, setTheme, account, onOpenTutorial }) => {
  const { name, email, remind24, remind3, lockIn, summary } = settings;
  // In the real app, profile name/email come from the signed-in account.
  const displayName = account?.name ?? name;
  const displayEmail = account?.email ?? email;
  const [adding, setAdding] = useState(false);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newReason, setNewReason] = useState('');
  const [themeOpen, setThemeOpen] = useState(false);
  // Auto-out ranges are stored per-user in the DB (user_out_ranges).
  const [outRanges, setOutRanges] = useState([]);
  useEffect(() => { if (account) listOutRanges().then(setOutRanges).catch(() => {}); }, [account]);
  const addRange = async () => {
    if (!newStart || !newEnd) return;
    try { await addOutRange({ start: newStart, end: newEnd, reason: newReason || null }); setOutRanges(await listOutRanges()); }
    catch (e) { console.warn('[out-range] add failed:', e); }
    setNewStart(''); setNewEnd(''); setNewReason(''); setAdding(false);
  };
  const removeRange = async (id) => {
    try { await deleteOutRange(id); setOutRanges(await listOutRanges()); }
    catch (e) { console.warn('[out-range] remove failed:', e); }
  };
  const fmtRange = (r) => {
    const fmt = (d) => { const dt = new Date(d + 'T12:00'); return `${MONTHS[dt.getMonth()]} ${dt.getDate()}`; };
    return `${fmt(r.start_date)} – ${fmt(r.end_date)}`;
  };
  return (
    <div>
      <div className="flex items-center gap-3 pb-4">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: 'var(--bg-glass)' }}>
          <ArrowLeft size={18} style={{ color: 'var(--text-strong)' }} />
        </button>
        <div className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Settings</div>
      </div>
      <SettingsSection title="Profile">
        <div className="flex items-center gap-3 p-4">
          <Avatar name={displayName} size={44} isYou />
          <div className="min-w-0"><div className="text-sm font-bold truncate">{displayName}</div><div className="text-[12px] text-zinc-500 truncate">{displayEmail}</div></div>
        </div>
        <EditableRow label="Name" value={displayName} onSave={(v) => (account ? account.updateName(v) : update({ name: v }))} />
        {account ? (
          <>
            <SettingsRow label="Email" value={displayEmail} />
            <SettingsRow label="Account" value="Signed in with Google" />
          </>
        ) : (
          <>
            <EditableRow label="Email" value={email} onSave={(v) => update({ email: v })} type="email" />
            <EditableRow label="Change password" value="" onSave={() => {}} type="password" placeholder="New password" />
          </>
        )}
      </SettingsSection>
      <SettingsSection title="Notifications">
        <PushControl />
        <ToggleRow label="Night-before reminder" sub="24 hours before session" on={remind24} onChange={(v) => update({ remind24: v })} />
        <ToggleRow label="3-hour reminder" sub="For unconfirmed sessions" on={remind3} onChange={(v) => update({ remind3: v })} />
        <ToggleRow label="Lock-in nudge" sub="If you're MAYBE the night before" on={lockIn} onChange={(v) => update({ lockIn: v })} />
        <ToggleRow label="Confirmation summary" sub="Even when you've checked in" on={summary} onChange={(v) => update({ summary: v })} />
      </SettingsSection>
      <SettingsSection title="Auto-out">
        <div className="px-4 pt-3 pb-2 text-[11px] text-zinc-400 leading-snug">
          Any session that falls within these date ranges will automatically be set to OUT. Useful for vacations or busy weeks.
        </div>
        {outRanges.map(r => (
          <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm">{fmtRange(r)}</div>
              <div className="text-[11px] text-zinc-500">{r.reason || 'Out'}</div>
            </div>
            <button onClick={() => removeRange(r.id)} className="text-[11px] text-zinc-500 hover:text-rose-400">Remove</button>
          </div>
        ))}
        {adding ? (
          <div className="px-4 py-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)}
                className="bg-transparent py-1.5 px-2 rounded-lg text-sm"
                style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
              <input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)}
                className="bg-transparent py-1.5 px-2 rounded-lg text-sm"
                style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
            </div>
            <input type="text" value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="Reason (optional)"
              className="w-full bg-transparent py-1.5 px-2 rounded-lg text-sm"
              style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
            <div className="flex gap-2">
              <button onClick={addRange} disabled={!newStart || !newEnd} className="flex-1 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-40" style={{ background: '#c5e500', color: '#1a1f00' }}>Add</button>
              <button onClick={() => { setAdding(false); setNewStart(''); setNewEnd(''); setNewReason(''); }} className="px-3 py-1.5 rounded-lg text-[11px] font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-1.5 py-3 text-[12px] font-semibold" style={{ color: '#c5e500' }}>
            <Plus size={13} />Add out-range
          </button>
        )}
      </SettingsSection>
      <SettingsSection title="App">
        <SettingsRow label="Theme" value={theme === 'light' ? 'Light' : theme === 'medium' ? 'Medium' : theme === 'system' ? 'System' : 'Dark'} action onClick={() => setThemeOpen(true)} />
        <SettingsRow label="Tutorial" value="Replay the tour" action onClick={() => onOpenTutorial?.()} />
        <SettingsRow label="About" action />
      </SettingsSection>
      <div className="text-center text-[10px] pt-2 pb-4" style={{ color: 'var(--text-faint)' }}><BrandHeader /><div className="mt-2">v0.1 · prototype</div></div>
      <button onClick={() => account?.signOut?.()} className="w-full py-3 rounded-2xl text-sm font-semibold mb-2" style={{ background: 'rgba(244,63,94,0.1)', color: '#fca5a5', border: '1px solid rgba(244,63,94,0.2)' }}>Sign out</button>
      <ThemeModal open={themeOpen} onClose={() => setThemeOpen(false)} theme={theme} setTheme={setTheme} />
    </div>
  );
};

const DOW_OPTS = [{ i: 0, l: 'Su' }, { i: 1, l: 'Mo' }, { i: 2, l: 'Tu' }, { i: 3, l: 'We' }, { i: 4, l: 'Th' }, { i: 5, l: 'Fr' }, { i: 6, l: 'Sa' }];

const ScheduleEditor = ({ schedule, horizon, onSave, onGenerate }) => {
  const [days, setDays] = useState([]);
  const [frequency, setFrequency] = useState('weekly');
  const [time, setTime] = useState('18:00');
  const [hasEnd, setHasEnd] = useState(false);
  const [endsOn, setEndsOn] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    setDays(schedule?.days_of_week || []);
    setFrequency(schedule?.frequency || 'weekly');
    setTime(schedule?.start_time ? schedule.start_time.slice(0, 5) : '18:00');
    setHasEnd(!!schedule?.ends_on);
    setEndsOn(schedule?.ends_on || '');
    setMsg('');
  }, [schedule]);
  const toggleDay = (i) => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort((a, b) => a - b)));
  const canSave = days.length > 0 && !!time;
  const rule = () => ({ days_of_week: days, frequency, start_time: `${time}:00`, ends_on: hasEnd ? (endsOn || null) : null, location: null });
  const save = async () => {
    if (!canSave) return;
    setBusy(true); setMsg('');
    try { await onSave(rule()); setMsg('Schedule saved.'); } catch (e) { setMsg(e.message || 'Could not save'); }
    setBusy(false);
  };
  const generate = async () => {
    if (!canSave) return;
    setBusy(true); setMsg('');
    try { const n = await onGenerate(rule()); setMsg(n > 0 ? `Generated ${n} session${n === 1 ? '' : 's'}.` : 'Already up to date — no new sessions.'); }
    catch (e) { setMsg(e.message || 'Could not generate'); }
    setBusy(false);
  };
  return (
    <div className="px-4 py-3 space-y-3">
      <div>
        <div className="text-[10px] tracking-wider text-zinc-500 font-bold mb-1.5 uppercase">Days</div>
        <div className="flex gap-1">
          {DOW_OPTS.map((d) => (
            <button key={d.i} onClick={() => toggleDay(d.i)} className="flex-1 py-2 rounded-lg text-[12px] font-bold"
              style={days.includes(d.i) ? { background: '#c5e500', color: '#1a1f00' } : { background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
              {d.l}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] tracking-wider text-zinc-500 font-bold mb-1.5 uppercase">Cadence</div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-strong)' }}>
            {['weekly', 'biweekly'].map((f) => (
              <button key={f} onClick={() => setFrequency(f)} className="flex-1 py-2 text-[11px] font-bold"
                style={frequency === f ? { background: '#c5e500', color: '#1a1f00' } : { background: 'transparent', color: 'var(--text-secondary)' }}>
                {f === 'biweekly' ? 'Biweekly' : 'Weekly'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] tracking-wider text-zinc-500 font-bold mb-1.5 uppercase">Time</div>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
            className="w-full bg-transparent py-1.5 px-2 rounded-lg text-sm"
            style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <div className="text-[12px]" style={{ color: 'var(--text-primary)' }}>Set an end date</div>
          <button onClick={() => setHasEnd((v) => !v)} className="w-10 h-6 rounded-full transition-colors flex-shrink-0" style={{ background: hasEnd ? '#c5e500' : 'var(--bg-input-hover)' }}>
            <div className="w-5 h-5 rounded-full bg-white" style={{ transform: hasEnd ? 'translateX(18px)' : 'translateX(2px)' }} />
          </button>
        </div>
        {hasEnd ? (
          <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)}
            className="w-full bg-transparent py-1.5 px-2 rounded-lg text-sm mt-2"
            style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
        ) : (
          <div className="text-[11px] text-zinc-500 mt-1">Runs indefinitely (no end date).</div>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={!canSave || busy} className="flex-1 py-2.5 rounded-xl text-[12px] font-bold disabled:opacity-40" style={{ background: 'var(--bg-input)', color: 'var(--text-strong)' }}>
          {busy ? '…' : 'Save schedule'}
        </button>
        <button onClick={generate} disabled={!canSave || busy} className="flex-1 py-2.5 rounded-xl text-[12px] font-bold disabled:opacity-40" style={{ background: '#c5e500', color: '#1a1f00' }}>
          Finalize &amp; generate
        </button>
      </div>
      {msg && <div className="text-[11px] text-center" style={{ color: msg.startsWith('Could not') ? '#fb7185' : '#c5e500' }}>{msg}</div>}
      <div className="text-[10px] text-zinc-600 text-center leading-snug">
        &ldquo;Finalize&rdquo; saves the cadence and fills upcoming sessions up to your horizon ({horizon}).
      </div>
    </div>
  );
};

// Pretty-print an offset (minutes-before-start) and its resulting wall-clock time.
const fmtOffset = (min) => (min % 60 === 0 ? `${min / 60}h before` : `${min}m before`);
function firePreview(startTime, offMin) {
  const [h, m] = String(startTime).split(':').map(Number);
  let total = h * 60 + (m || 0) - offMin;
  let prevDay = false;
  while (total < 0) { total += 1440; prevDay = true; }
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}${prevDay ? ' (prev day)' : ''}`;
}

// Phase 3: per-group reminder ladder (offsets before start) + change-alert toggles.
// Audience is fixed (Undecided + Maybe); only the timing is configurable here.
const NotificationLadderEditor = ({ groupId, startTime }) => {
  const [offsets, setOffsets] = useState([]); // minutes, sorted descending
  const [onCancel, setOnCancel] = useState(true);
  const [onChange, setOnChange] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let alive = true;
    getNotificationSettings(groupId).then((row) => {
      if (!alive) return;
      if (row) {
        setOffsets([...(row.reminder_offsets || [])].sort((a, b) => b - a));
        setOnCancel(row.notify_on_cancel);
        setOnChange(row.notify_on_change);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
    return () => { alive = false; };
  }, [groupId]);

  const persist = async (over) => {
    setStatus('Saving…');
    try {
      await saveNotificationSettings(groupId, {
        reminder_offsets: over.offsets ?? offsets,
        notify_on_cancel: over.onCancel ?? onCancel,
        notify_on_change: over.onChange ?? onChange,
      });
      setStatus('Saved'); setTimeout(() => setStatus(''), 1200);
    } catch (e) { setStatus(e.message || 'Save failed'); }
  };

  const addOffset = () => {
    const hrs = parseFloat(adding);
    if (!hrs || hrs <= 0) { setAdding(''); return; }
    const min = Math.round(hrs * 60);
    if (offsets.includes(min)) { setAdding(''); return; }
    const next = [...offsets, min].sort((a, b) => b - a);
    setOffsets(next); setAdding(''); persist({ offsets: next });
  };
  const removeOffset = (min) => {
    const next = offsets.filter((o) => o !== min);
    setOffsets(next); persist({ offsets: next });
  };

  if (!loaded) return <div className="px-4 py-3 text-[12px]" style={{ color: 'var(--text-faint)' }}>Loading…</div>;

  return (
    <>
      <div className="px-4 pt-3 pb-2 text-[11px] leading-snug" style={{ color: 'var(--text-tertiary)' }}>
        Nudge players who haven’t answered yet (Undecided or Maybe). Set how far ahead of each session a reminder goes out.
      </div>
      {offsets.length === 0 && (
        <div className="px-4 pb-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>No reminders yet — add one below.</div>
      )}
      {offsets.map((min) => (
        <div key={min} className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Bell size={14} style={{ color: '#c5e500', flexShrink: 0 }} />
            <span className="text-sm font-semibold">{fmtOffset(min)}</span>
            {startTime && <span className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>· fires {firePreview(startTime, min)}</span>}
          </div>
          <button onClick={() => removeOffset(min)} className="text-[11px] text-zinc-500 hover:text-rose-400 flex-shrink-0 ml-2">Remove</button>
        </div>
      ))}
      <div className="px-4 py-2.5 flex items-center gap-2">
        <input type="number" inputMode="decimal" min="0.5" max="48" step="0.5" value={adding}
          onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addOffset(); }}
          placeholder="Hours before"
          className="flex-1 bg-transparent py-1.5 px-2 rounded-lg text-sm"
          style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
        <button onClick={addOffset} disabled={!adding} className="px-4 py-1.5 rounded-lg text-[12px] font-bold disabled:opacity-40"
          style={{ background: '#c5e500', color: '#1a1f00' }}>Add</button>
      </div>
      <div className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <ToggleRow label="Notify on cancellation" sub="Alert IN/MAYBE players if a session is cancelled" on={onCancel} onChange={(v) => { setOnCancel(v); persist({ onCancel: v }); }} />
        <ToggleRow label="Notify on time/location change" sub="Alert IN/MAYBE players if details change" on={onChange} onChange={(v) => { setOnChange(v); persist({ onChange: v }); }} />
      </div>
      {status && <div className="px-4 pb-2 text-[11px]" style={{ color: status.startsWith('Save fail') ? '#fb7185' : '#c5e500' }}>{status}</div>}
    </>
  );
};

// Admin view: which members have push enabled (no endpoints exposed).
// Admin roster: each member with notifications/install status + role delegation.
const Pill = ({ children, on }) => (
  <span className="text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded-full"
    style={on
      ? { background: 'rgba(197,229,0,0.15)', color: '#c5e500' }
      : { background: 'var(--bg-subtle)', color: 'var(--text-faint)' }}>
    {children}
  </span>
);

const GroupRoster = ({ groupId, meName }) => {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => getGroupPushStatus(groupId).then(setRows).catch((e) => setErr(e.message || 'Could not load'));
  useEffect(() => {
    let alive = true;
    getGroupPushStatus(groupId).then((r) => { if (alive) setRows(r); }).catch((e) => { if (alive) setErr(e.message || 'Could not load'); });
    return () => { alive = false; };
  }, [groupId]);

  if (err) return <div className="px-4 py-3 text-[12px]" style={{ color: '#fb7185' }}>{err}</div>;
  if (!rows) return <div className="px-4 py-3 text-[12px]" style={{ color: 'var(--text-faint)' }}>Loading…</div>;

  const onCount = rows.filter((r) => r.devices > 0).length;
  const adminCount = rows.filter((r) => r.role === 'admin').length;
  const setRole = async (userId, role) => {
    setBusyId(userId); setErr('');
    try { await updateMemberRole(groupId, userId, role); await load(); }
    catch (e) { setErr(e.message || 'Could not update role'); }
    finally { setBusyId(null); }
  };

  return (
    <>
      <div className="px-4 pt-3 pb-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
        {onCount} of {rows.length} have notifications on.
      </div>
      {rows.map((r) => {
        const nm = r.full_name || 'Member';
        const you = nm === meName;
        const isAdmin = r.role === 'admin';
        return (
          <div key={r.user_id} className="px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name={nm} size={32} isYou={you} />
              <div className="min-w-0">
                <div className="text-sm truncate">{you ? `${nm} (you)` : nm}{isAdmin && <span className="ml-1.5 text-[9px] font-bold tracking-wider" style={{ color: '#c5e500' }}>ADMIN</span>}</div>
                <div className="flex items-center gap-1 mt-1">
                  <Pill on={r.devices > 0}>{r.devices > 0 ? 'NOTIFS ON' : 'NO NOTIFS'}</Pill>
                  {r.installed > 0 && <Pill on>APP</Pill>}
                </div>
              </div>
            </div>
            <div className="flex-shrink-0">
              {isAdmin ? (
                <button disabled={busyId === r.user_id || adminCount <= 1} onClick={() => setRole(r.user_id, 'member')}
                  className="text-[11px] font-semibold disabled:opacity-30" style={{ color: 'var(--text-tertiary)' }}>
                  Remove admin
                </button>
              ) : (
                <button disabled={busyId === r.user_id} onClick={() => setRole(r.user_id, 'admin')}
                  className="text-[11px] font-semibold disabled:opacity-40" style={{ color: '#c5e500' }}>
                  Make admin
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};

// Plain-English schedule summary for the member Details view.
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function scheduleSummary(schedule) {
  if (!schedule || !schedule.days_of_week?.length || !schedule.start_time) return 'No recurring schedule yet';
  const days = [...schedule.days_of_week].map(Number).sort();
  const dayStr = days.length === 1 ? DAY_FULL[days[0]] : days.map((d) => DAY_ABBR[d]).join(', ');
  const [h, m] = String(schedule.start_time).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  const timeStr = `${h12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
  const prefix = schedule.frequency === 'biweekly' ? 'Every other' : 'Every';
  return `${prefix} ${dayStr} at ${timeStr}`;
}

// Read-only view for non-admin members: schedule summary + members list with role badges.
const GroupDetailsView = ({ group, onBack, schedule = null, members = [], meName = MOCK_USER.name }) => (
  <div>
    <div className="flex items-center gap-3 pb-4">
      <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: 'var(--bg-glass)' }}>
        <ArrowLeft size={18} style={{ color: 'var(--text-strong)' }} />
      </button>
      <div className="min-w-0">
        <div className="text-xl font-bold tracking-tight truncate" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{group?.name || 'Group'}</div>
        <div className="text-[10px] font-bold tracking-wider mt-0.5" style={{ color: 'var(--text-tertiary)' }}>DETAILS</div>
      </div>
    </div>
    <SettingsSection title="About">
      <div className="px-4 py-3">
        <div className="text-[10px] tracking-wider font-bold uppercase mb-1" style={{ color: 'var(--text-tertiary)' }}>Schedule</div>
        <div className="text-sm" style={{ color: 'var(--text-strong)' }}>{scheduleSummary(schedule)}</div>
        {group?.location && (
          <>
            <div className="text-[10px] tracking-wider font-bold uppercase mb-1 mt-3" style={{ color: 'var(--text-tertiary)' }}>Location</div>
            <div className="text-sm" style={{ color: 'var(--text-strong)' }}>{group.location}</div>
          </>
        )}
      </div>
    </SettingsSection>
    <SettingsSection title={`Members · ${members.length}`}>
      {members.map((m, i) => {
        const mname = m.full_name || 'Member';
        const isYou = mname === meName;
        const isAdmin = m.role === 'admin';
        return (
          <div key={m.id ?? i} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar name={mname} size={32} isYou={isYou} />
              <div className="text-sm">{isYou ? `${mname} (you)` : mname}</div>
            </div>
            <div className="text-[10px] tracking-wider font-bold" style={{ color: isAdmin ? '#c5e500' : 'var(--text-faint)' }}>{(m.role || 'member').toUpperCase()}</div>
          </div>
        );
      })}
    </SettingsSection>
  </div>
);

const GroupSettingsView = ({ groupId, onBack, settings, update, members = null, meName = MOCK_USER.name, isDemo = false, schedule = null, onSaveSchedule, onGenerateSessions, onDelete }) => {
  const g = GROUP_INFO[groupId] || {};
  const s = settings || { name: g.name, location: g.location, allowAdhoc: true, isPublic: false, horizon: 4, schedule: [] };
  // Defaults guard against partial settings objects (prevents schedule.map crashes).
  const { name, location, allowAdhoc, isPublic, horizon = 4, allowMemberInvites = false, autoCancelWindow = null, autoCancelMin = 4, lastminuteWindow = null } = s;
  const memberList = members ?? [
    { full_name: 'Pickleballer', role: 'admin' }, { full_name: 'Devin Smith', role: 'member' },
    { full_name: 'Aaron Tucker', role: 'member' }, { full_name: 'Sara Klein', role: 'member' }, { full_name: 'Jay Pickett', role: 'member' },
  ];
  const memberCount = members ? members.length : g.members;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDelGroup, setConfirmDelGroup] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-3 pb-4">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: 'var(--bg-glass)' }}>
          <ArrowLeft size={18} style={{ color: 'var(--text-strong)' }} />
        </button>
        <div className="min-w-0">
          <div className="text-xl font-bold tracking-tight truncate" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{name}</div>
          <div className="flex items-center gap-1 text-[10px] font-bold tracking-wider mt-0.5" style={{ color: '#c5e500' }}>
            <Shield size={10} />ADMIN
          </div>
        </div>
      </div>
      <SettingsSection title="Group">
        <EditableRow label="Name" value={name} onSave={(v) => update({ name: v })} />
        <EditableRow label="Location" value={location} onSave={(v) => update({ location: v })} />
        <ToggleRow label="Public group" sub={isPublic ? 'Searchable in Discover Groups' : 'Invite only · share URL or email'} on={isPublic} onChange={(v) => update({ isPublic: v })} />
      </SettingsSection>
      <SettingsSection title="Schedule">
        {isDemo ? (
          <div className="px-4 py-4 text-[12px] leading-snug" style={{ color: 'var(--text-muted)' }}>
            Recurring schedule editing is available in the live app.
          </div>
        ) : (
          <ScheduleEditor schedule={schedule} horizon={horizon} onSave={onSaveSchedule} onGenerate={onGenerateSessions} />
        )}
      </SettingsSection>
      <SettingsSection title="Options">
        <StepperRow label="Horizon" sub="Number of upcoming instances to generate" value={horizon} onChange={(v) => update({ horizon: v })} min={1} max={10} unit=" ahead" />
        <ToggleRow label="Members can create ad-hoc" sub="Allow non-admins to add one-off sessions" on={allowAdhoc} onChange={(v) => update({ allowAdhoc: v })} />
        <ToggleRow label="Members can invite" sub="Let any member share a join link" on={allowMemberInvites} onChange={(v) => update({ allowMemberInvites: v })} />
      </SettingsSection>
      <SettingsSection title="Auto-cancel">
        <div className="px-4 pt-3 pb-2 text-[11px] leading-snug" style={{ color: 'var(--text-tertiary)' }}>
          If fewer than the minimum have committed by the cutoff before start, cancel the session and notify everyone.
        </div>
        <div className="px-4 py-2 flex items-center justify-between gap-2">
          <div className="text-sm">Cancel-if-short within</div>
          <select value={autoCancelWindow ?? ''} onChange={(e) => update({ autoCancelWindow: e.target.value === '' ? null : Number(e.target.value) })}
            className="bg-transparent py-1.5 px-2 rounded-lg text-sm"
            style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }}>
            <option value="">Off</option>
            <option value="15">15 min before</option>
            <option value="30">30 min before</option>
            <option value="45">45 min before</option>
            <option value="60">1 hr before</option>
            <option value="90">90 min before</option>
            <option value="120">2 hr before</option>
            <option value="180">3 hr before</option>
            <option value="240">4 hr before</option>
            <option value="360">6 hr before</option>
            <option value="720">12 hr before</option>
          </select>
        </div>
        <StepperRow label="Minimum to play" sub="Auto-cancel triggers below this IN count" value={autoCancelMin ?? 4} onChange={(v) => update({ autoCancelMin: v })} min={2} max={16} unit=" players" />
      </SettingsSection>
      <SettingsSection title="Last-minute drops">
        <div className="px-4 pt-3 pb-2 text-[11px] leading-snug" style={{ color: 'var(--text-tertiary)' }}>
          If an IN player drops within this window before start, confirm with them and then alert everyone NOT IN so someone can step in.
        </div>
        <div className="px-4 py-2 flex items-center justify-between gap-2">
          <div className="text-sm">Alert window</div>
          <select value={lastminuteWindow ?? ''} onChange={(e) => update({ lastminuteWindow: e.target.value === '' ? null : Number(e.target.value) })}
            className="bg-transparent py-1.5 px-2 rounded-lg text-sm"
            style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }}>
            <option value="">Off</option>
            <option value="30">30 min before</option>
            <option value="60">1 hr before</option>
            <option value="90">90 min before</option>
            <option value="120">2 hr before</option>
            <option value="180">3 hr before</option>
            <option value="240">4 hr before</option>
            <option value="360">6 hr before</option>
          </select>
        </div>
      </SettingsSection>
      <SettingsSection title="Check-in reminders">
        {isDemo ? (
          <div className="px-4 py-4 text-[12px] leading-snug" style={{ color: 'var(--text-muted)' }}>
            Set automatic check-in reminders (e.g. 12h, 8h before) for players who haven’t answered — available in the live app.
          </div>
        ) : (
          <NotificationLadderEditor groupId={groupId} startTime={schedule?.start_time} />
        )}
      </SettingsSection>
      <SettingsSection title={`Members · ${memberCount}`}>
        {isDemo ? (
          memberList.map((m, i) => {
            const mname = m.full_name || 'Member';
            const isYou = mname === meName;
            return (
              <div key={m.id ?? i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={mname} size={32} isYou={isYou} />
                  <div className="text-sm">{isYou ? `${mname} (you)` : mname}</div>
                </div>
                <div className="text-[10px] tracking-wider font-bold text-zinc-500">{(m.role || 'member').toUpperCase()}</div>
              </div>
            );
          })
        ) : (
          <GroupRoster groupId={groupId} meName={meName} />
        )}
        <button onClick={() => setInviteOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-3 text-[12px] font-semibold" style={{ color: '#c5e500' }}>
          <Plus size={13} />Invite member
        </button>
      </SettingsSection>
      {!isDemo && (
        <button
          disabled={delBusy}
          onClick={async () => {
            if (!confirmDelGroup) { setConfirmDelGroup(true); return; }
            setDelBusy(true);
            try { await onDelete?.(); }
            catch (e) { setDelBusy(false); alert(e.message || 'Could not delete group'); }
          }}
          className="w-full py-3 rounded-2xl text-sm font-semibold mb-2 disabled:opacity-60"
          style={{ background: confirmDelGroup ? 'rgba(244,63,94,0.22)' : 'rgba(244,63,94,0.1)', color: '#fca5a5', border: '1px solid rgba(244,63,94,0.25)' }}>
          {delBusy ? 'Deleting…' : confirmDelGroup ? 'Tap again to permanently delete this group' : 'Delete group'}
        </button>
      )}
      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} groupName={name} groupId={groupId} real={!isDemo} />
    </div>
  );
};

const InviteMemberModal = ({ open, onClose, groupName, groupId, real = false }) => {
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [genErr, setGenErr] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!open) { setLink(''); setGenErr(''); setEmail(''); setCopied(false); } }, [open]);
  const generate = async () => {
    setGenLoading(true); setGenErr('');
    try { const inv = await createInvite(groupId); setLink(inviteUrl(inv.token)); }
    catch (e) { setGenErr(e.message || 'Could not create link'); }
    setGenLoading(false);
  };
  const fakeLink = `https://picklecheck.in/join/${(groupName || '').toLowerCase().replace(/\s+/g, '-')}`;
  const shownLink = real ? link : fakeLink;
  // Ready-to-paste invite (group name + one-line blurb + link).
  const message = `Hey! You're invited to join ${groupName || 'our group'} on PickleCheck 🎾 — it shows who's IN for each pickleball session so you know before you go. Join here: ${shownLink}`;
  const copyMsg = () => { navigator.clipboard?.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  return (
    <ModalSheet open={open} onClose={onClose} title="Invite member">
      <div className="space-y-3 text-sm">
        <div>
          <div className="text-[10px] tracking-wider text-zinc-500 font-bold mb-1.5 uppercase">Share invite link</div>
          {real && !link ? (
            <button onClick={generate} disabled={genLoading}
              className="w-full py-2.5 rounded-lg text-[12px] font-bold disabled:opacity-50"
              style={{ background: 'rgba(197,229,0,0.15)', color: '#c5e500', border: '1px solid rgba(197,229,0,0.3)' }}>
              {genLoading ? 'Generating…' : 'Generate invite link'}
            </button>
          ) : (
            <div className="space-y-2">
              <textarea readOnly value={message} rows={4}
                className="w-full bg-transparent py-2 px-2.5 rounded-lg text-xs leading-snug resize-none"
                style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
              <button onClick={copyMsg} className="w-full py-2.5 rounded-lg text-[12px] font-bold transition-colors"
                style={copied
                  ? { background: '#c5e500', color: '#1a1f00', border: '1px solid #c5e500' }
                  : { background: 'rgba(197,229,0,0.15)', color: '#c5e500', border: '1px solid rgba(197,229,0,0.3)' }}>
                {copied ? 'Copied! Paste it in your group chat' : 'Copy invite message'}
              </button>
            </div>
          )}
          {genErr && <div className="text-[11px] mt-1" style={{ color: '#fb7185' }}>{genErr}</div>}
          {real && <div className="text-[10px] text-zinc-600 mt-1.5">Anyone who taps the link can join after signing in.</div>}
        </div>
        {!real && (
          <>
            <div className="text-center text-[10px] text-zinc-600 my-2">— OR —</div>
            <div>
              <div className="text-[10px] tracking-wider text-zinc-500 font-bold mb-1.5 uppercase">Email invitation</div>
              <div className="flex gap-2">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com"
                  className="flex-1 bg-transparent py-2 px-2.5 rounded-lg text-sm"
                  style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
                <button disabled={!email.includes('@')} onClick={() => { setEmail(''); onClose(); }}
                  className="px-3 py-2 rounded-lg text-[11px] font-bold disabled:opacity-40" style={{ background: '#c5e500', color: '#1a1f00' }}>Send</button>
              </div>
            </div>
            <div className="text-[10px] text-zinc-600 text-center pt-1">Prototype — email send is a stub.</div>
          </>
        )}
      </div>
    </ModalSheet>
  );
};

// ────────────────────────────────────────────────────────────────────
// DEMO CONTROLS
// ────────────────────────────────────────────────────────────────────
const DemoControls = ({ confirmed, setConfirmed, tentative, setTentative, out, setOut, undecided, setUndecided }) => (
  <div className="rounded-3xl backdrop-blur-xl p-4 space-y-3"
    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
    <div className="text-[10px] tracking-[0.25em] text-zinc-500 font-bold uppercase">Demo · adjust counts</div>
    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
      <DemoStepper label="IN"    value={confirmed} onChange={setConfirmed} max={32} color="#86efac" />
      <DemoStepper label="MAYBE" value={tentative} onChange={setTentative} max={8}  color="#fcd34d" />
      <DemoStepper label="OUT"   value={out}       onChange={setOut}       max={16} color="#a1a1aa" />
      <DemoStepper label="?"     value={undecided} onChange={setUndecided} max={16} color="#71717a" />
    </div>
    <div className="flex gap-1.5 flex-wrap pt-1">
      {[3, 4, 6, 7, 8, 11, 12, 16, 24].map(n => (
        <button key={n} onClick={() => { setConfirmed(n); setTentative(0); }}
          className="text-xs px-2.5 py-1 rounded-full font-bold"
          style={confirmed === n ? { background: '#c5e500', color: '#1a1f00' } : { background: 'var(--bg-glass)', color: 'var(--text-muted)' }}>
          {n}
        </button>
      ))}
    </div>
  </div>
);
const DemoStepper = ({ label, value, onChange, max, color }) => (
  <div className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5"
    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
    <div className="flex items-baseline gap-2 min-w-0">
      <div className="text-[10px] tracking-wider text-zinc-400 font-bold uppercase">{label}</div>
      <div className="text-base font-bold tabular-nums" style={{ color, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{value}</div>
    </div>
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-lg leading-none disabled:opacity-30"
        style={{ background: 'var(--bg-input-hover)', color: 'var(--text-strong)' }}
        aria-label={`Decrease ${label}`}
      >−</button>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-lg leading-none disabled:opacity-30"
        style={{ background: 'var(--bg-input-hover)', color: 'var(--text-strong)' }}
        aria-label={`Increase ${label}`}
      >+</button>
    </div>
  </div>
);

// ────────────────────────────────────────────────────────────────────
// EMPTY STATE + CREATE GROUP (real app)
// ────────────────────────────────────────────────────────────────────
const EmptyState = ({ title, body, cta, onCta, cta2, onCta2 }) => (
  <div className="rounded-3xl px-6 py-12 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)' }}>
    <div className="text-lg font-bold mb-1.5" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: 'var(--text-strong)' }}>{title}</div>
    <div className="text-[13px] mb-5 leading-snug" style={{ color: 'var(--text-muted)' }}>{body}</div>
    <div className="flex flex-col gap-2 items-center">
      {cta && (
        <button onClick={onCta} className="w-full max-w-[240px] px-5 py-2.5 rounded-full text-sm font-bold" style={{ background: '#c5e500', color: '#1a1f00' }}>{cta}</button>
      )}
      {cta2 && (
        <button onClick={onCta2} className="w-full max-w-[240px] px-5 py-2.5 rounded-full text-sm font-bold" style={{ background: 'var(--bg-subtle)', color: 'var(--text-strong)', border: '1px solid var(--border-medium)' }}>{cta2}</button>
      )}
    </div>
  </div>
);

const CreateGroupModal = ({ open, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { if (open) { setName(''); setLocation(''); setErr(null); setBusy(false); } }, [open]);
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    try { await onCreate({ name: name.trim(), location: location.trim() || null }); onClose(); }
    catch (e) { setErr(e.message || 'Could not create group'); setBusy(false); }
  };
  return (
    <ModalSheet open={open} onClose={onClose} title="Create a group">
      <div className="space-y-3 text-sm">
        <div className="text-[11px] text-zinc-500 leading-snug">Your recurring crew. You&rsquo;ll be the admin and can invite players with a link.</div>
        <label className="block">
          <div className="text-[10px] tracking-wider text-zinc-500 font-bold mb-1 uppercase">Group name</div>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunday Doubles" autoFocus
            className="w-full bg-transparent py-2 px-2.5 rounded-lg text-sm"
            style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
        </label>
        <label className="block">
          <div className="text-[10px] tracking-wider text-zinc-500 font-bold mb-1 uppercase">Location (optional)</div>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Riverside Courts"
            className="w-full bg-transparent py-2 px-2.5 rounded-lg text-sm"
            style={{ color: 'var(--text-strong)', border: '1px solid var(--border-strong)', outline: 'none' }} />
        </label>
        {err && <div className="text-[12px]" style={{ color: '#fb7185' }}>{err}</div>}
        <button onClick={submit} disabled={!name.trim() || busy}
          className="w-full py-3 rounded-2xl text-sm font-bold disabled:opacity-40 mt-1"
          style={{ background: '#c5e500', color: '#1a1f00' }}>{busy ? 'Creating…' : 'Create group'}</button>
      </div>
    </ModalSheet>
  );
};

// ────────────────────────────────────────────────────────────────────
// APP
// ────────────────────────────────────────────────────────────────────
export default function App({ account = null }) {
  // `account` present = real signed-in app; null = public /demo sandbox.
  const isDemo = !account;
  const live = useLiveData(!isDemo);
  const meName = account?.name || MOCK_USER.name;
  // Data source: mock in the demo, real Supabase data in the signed-in app.
  const sessions = isDemo ? MOCK_SESSIONS : live.sessions;
  const groupInfo = isDemo ? GROUP_INFO : Object.fromEntries((live.groups || []).map((g) => [g.id, g]));
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [inviteForGroup, setInviteForGroup] = useState(null);
  const [editSession, setEditSession] = useState(null);
  const [view, setView] = useState('today');
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(DEFAULT_IDX);

  const initial = MOCK_SESSIONS[DEFAULT_IDX];
  const [confirmed, setConfirmed] = useState(initial.in);
  const [tentative, setTentative] = useState(initial.maybe);
  const [out, setOut] = useState(initial.out);
  const [undecided, setUndecided] = useState(initial.undecided);
  const [myStatus, setMyStatus] = useState(initial.myStatus);
  const [myPartySize, setMyPartySize] = useState(1);
  const [visibleGroups, setVisibleGroups] = useState(new Set(Object.keys(GROUP_INFO)));
  const [addInstanceFor, setAddInstanceFor] = useState(null);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  // User settings — lifted here so they persist across view navigation
  const [userSettings, setUserSettings] = useState({
    name: account?.name || MOCK_USER.name,
    email: account?.email || MOCK_USER.email,
    remind24: true,
    remind3: true,
    lockIn: true,
    summary: false,
    outRanges: [{ id: 1, start: '2026-05-28', end: '2026-06-03', reason: 'Vacation' }],
  });
  const updateUserSettings = (patch) => setUserSettings(s => ({ ...s, ...patch }));
  // Party size: sticky default for next IN/MAYBE commit, plus a modal control object
  const [lastPartySize, setLastPartySize] = useState(1);
  const [partyModal, setPartyModal] = useState(null); // { targetStatus, initialSize } | null
  const [dropoutConfirm, setDropoutConfirm] = useState(null); // { targetStatus, sessionId } | null
  const [tutorialOpen, setTutorialOpen] = useState(false);
  // Persisted in localStorage so it survives backgrounding / reload.
  // One-time migration: anyone whose stored theme is 'dark' (or unset) at
  // first load after this deploy gets bumped to 'medium' (the new default).
  // The flag stops it from re-running, so a user who later picks Dark by hand
  // will keep Dark on the next launch.
  const [theme, setTheme] = useState(() => {
    try {
      const flag = localStorage.getItem('pc_theme_migrated_medium_default');
      const t = localStorage.getItem('pc_theme');
      if (!flag) {
        localStorage.setItem('pc_theme_migrated_medium_default', '1');
        if (!t || t === 'dark') {
          localStorage.setItem('pc_theme', 'medium');
          return 'medium';
        }
      }
      return t === 'dark' || t === 'medium' || t === 'light' ? t : 'medium';
    } catch { return 'medium'; }
  });
  useEffect(() => {
    try { localStorage.setItem('pc_theme', theme); } catch { /* ignore */ }
  }, [theme]);
  // Group settings keyed by groupId — also lifted for persistence
  const [groupSettingsMap, setGroupSettingsMap] = useState(() => {
    const m = {};
    Object.values(GROUP_INFO).forEach(g => {
      m[g.id] = {
        name: g.name,
        location: g.location,
        allowAdhoc: true,
        isPublic: false,
        horizon: 5,
        schedule: [],
      };
    });
    return m;
  });
  const updateGroupSettings = (gid, patch) => {
    setGroupSettingsMap(m => ({ ...m, [gid]: { ...(m[gid] || {}), ...patch } }));
  };

  // The feed shows sessions from groups the user has toggled visible.
  const allGroupIds = Object.keys(groupInfo);
  const isFiltered = allGroupIds.length > 0 && allGroupIds.some((id) => !visibleGroups.has(id));
  const filtered = sessions.filter(s => visibleGroups.has(s.groupId));
  const safeIdx = Math.min(currentIdx, filtered.length - 1);
  const filteredDefaultIdx = filtered.findIndex(s => !s.past);
  const atDefault = safeIdx === filteredDefaultIdx;
  const currentSession = filtered[safeIdx];
  // Admins of the group OR the session's creator can edit/cancel/delete it.
  const canEditOf = (s) => !isDemo && !!s && !!account?.user &&
    (groupInfo[s.groupId]?.role === 'admin' || s.createdBy === account.user.id);
  const canEditCurrent = canEditOf(currentSession);

  const loadSession = (s) => {
    if (!s) return;
    setConfirmed(s.in); setTentative(s.maybe); setOut(s.out); setUndecided(s.undecided); setMyStatus(s.myStatus);
    setMyPartySize(1); // reset — mock sessions don't carry party size
  };

  // Apply a status change with a specific party size. Updates buckets and state
  // optimistically; in the real app it also persists the RSVP to the DB.
  const applyStatusChange = (newStatus, newSize) => {
    const oldSize = (myStatus === 'in' || myStatus === 'maybe') ? myPartySize : 1;
    const actualNewSize = (newStatus === 'in' || newStatus === 'maybe') ? newSize : 1;
    const setters = { in: setConfirmed, maybe: setTentative, out: setOut, undecided: setUndecided };
    setters[myStatus]?.(v => Math.max(0, v - oldSize));
    setters[newStatus]?.(v => v + actualNewSize);
    setMyStatus(newStatus);
    setMyPartySize(actualNewSize);
    if (!isDemo) {
      const sid = filtered[safeIdx]?.id;
      if (sid) live.setRsvp(sid, newStatus, actualNewSize);
    }
  };

  // Button tap on IN/MAYBE/OUT. Opens modal if user is committing with size > 1.
  const handleMyStatus = (newStatus) => {
    if (newStatus === myStatus) return;
    // Last-minute drop check: currently IN, switching to OUT/TENTATIVE inside the
    // group's drop-out window → confirm with a modal first (and the confirm fires
    // the alert to everyone NOT IN so someone can fill in).
    if (!isDemo && myStatus === 'in' && (newStatus === 'out' || newStatus === 'maybe')) {
      const cs = filtered[safeIdx];
      const win = cs && groupInfo[cs.groupId]?.lastminute_window_minutes;
      if (cs && win) {
        const minsTo = (cs.dateObj.getTime() - Date.now()) / 60000;
        if (minsTo > 0 && minsTo <= win) {
          setDropoutConfirm({ targetStatus: newStatus, sessionId: cs.id, groupName: cs.groupName });
          return;
        }
      }
    }
    // OUT/UNDECIDED don't track party size — direct commit at size 1
    if (newStatus === 'out' || newStatus === 'undecided') {
      applyStatusChange(newStatus, 1);
      return;
    }
    // IN/MAYBE: figure out "intended" size — current size if already committed,
    // otherwise the sticky default from last commit
    const isCommitted = myStatus === 'in' || myStatus === 'maybe';
    const intendedSize = isCommitted ? myPartySize : lastPartySize;
    if (intendedSize <= 1) {
      applyStatusChange(newStatus, 1);
      setLastPartySize(1);
    } else {
      setPartyModal({ targetStatus: newStatus, initialSize: intendedSize });
    }
  };

  // Tap on the party-size chip. If currently IN/MAYBE, modal will adjust count
  // in-place. If undecided/out, modal updates the sticky default only — actual
  // commit happens when the user later taps IN/MAYBE.
  const handleAdjustParty = () => {
    const isCommitted = myStatus === 'in' || myStatus === 'maybe';
    setPartyModal({
      targetStatus: isCommitted ? myStatus : null,
      initialSize: isCommitted ? myPartySize : lastPartySize,
    });
  };

  // Modal confirm
  const handlePartyConfirm = (newSize) => {
    if (!partyModal) return;
    // null targetStatus = "prepare" mode: just update sticky, no commit
    if (partyModal.targetStatus !== null) {
      applyStatusChange(partyModal.targetStatus, newSize);
    }
    setLastPartySize(newSize);
    setPartyModal(null);
  };

  // Displayed in the chip — sticky when not committed, live size when in/maybe
  const displayPartySize = (myStatus === 'in' || myStatus === 'maybe') ? myPartySize : lastPartySize;
  const goTo = (idx) => {
    const s = filtered[idx];
    if (!s) return;
    setCurrentIdx(idx);
    loadSession(s);
  };
  const goNext = () => goTo(safeIdx + 1);
  const goPrev = () => goTo(safeIdx - 1);
  const backToDefault = () => goTo(filteredDefaultIdx);

  const goToSessionById = (id) => {
    const idx = filtered.findIndex(s => s.id === id);
    if (idx >= 0) { goTo(idx); setView('today'); }
  };
  // "Clear filter" = make every group visible again.
  const handleClearFilter = () => setVisibleGroups(new Set(allGroupIds));
  const handleManage = (gid) => { setActiveGroupId(gid); setGroupsOpen(false); setView('group-settings'); };
  const handleDetails = (gid) => { setActiveGroupId(gid); setGroupsOpen(false); setView('group-details'); };

  // Real groups are visible-by-default in the menu (union in new ones; never wipe user hides).
  useEffect(() => {
    if (isDemo) return;
    setVisibleGroups((prev) => {
      const next = new Set(prev);
      (live.groups || []).forEach((g) => next.add(g.id));
      return next;
    });
  }, [isDemo, live.groups]);

  // Real app: keep the current card's counts/roster mirrored from the live session.
  useEffect(() => {
    if (isDemo) return;
    const s = filtered[safeIdx];
    if (s) {
      setConfirmed(s.in); setTentative(s.maybe); setOut(s.out); setUndecided(s.undecided);
      setMyStatus(s.myStatus); setMyPartySize(s.myPartySize || 1);
    }
  }, [isDemo, safeIdx, live.sessions, visibleGroups]);

  // Real app: on first load, land on the next upcoming session.
  const didInitIdx = useRef(false);
  useEffect(() => {
    if (isDemo || didInitIdx.current) return;
    if (live.sessions.length > 0) {
      const idx = live.sessions.findIndex((s) => !s.past);
      setCurrentIdx(idx >= 0 ? idx : 0);
      didInitIdx.current = true;
    }
  }, [isDemo, live.sessions]);

  // Deep link from a push tap: /?session=<id>[&rsvp=in|out|maybe]. Jump to that
  // session, apply the tapped RSVP, then strip the params so refresh is clean.
  const didDeepLink = useRef(false);
  useEffect(() => {
    if (isDemo || didDeepLink.current || !live.sessions.length) return;
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session');
    const rsvp = params.get('rsvp');
    if (sid) {
      const idx = filtered.findIndex((s) => s.id === sid);
      if (idx >= 0) {
        setView('today');
        setCurrentIdx(idx);
        loadSession(filtered[idx]);
        if (rsvp && ['in', 'out', 'maybe'].includes(rsvp)) {
          live.setRsvp(sid, rsvp, 1).catch((e) => console.warn('[deeplink] rsvp failed', e));
        }
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('session');
      url.searchParams.delete('rsvp');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
    didDeepLink.current = true;
  }, [isDemo, live.sessions, filtered]);

  // Keep install-status (standalone) + last_seen fresh each open. The actual
  // permission prompt is owned by NotificationsPromptModal — full-screen nag,
  // not a silent first-tap surprise.
  const didAutoPush = useRef(false);
  useEffect(() => {
    if (isDemo || !account || didAutoPush.current) return;
    didAutoPush.current = true;
    refreshSubscription();
    // If permission is already granted but not subscribed yet (e.g. fresh
    // device after re-installing), silently subscribe — no need to bug them.
    (async () => {
      try {
        const state = await getPushState();
        if (state === 'off' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          enablePush().catch(() => {});
        }
      } catch { /* ignore */ }
    })();
  }, [isDemo, account]);

  // First-run tutorial: auto-open once per device (demo + real app keyed separately).
  // A Settings → Tutorial row reopens it anytime.
  useEffect(() => {
    const key = isDemo ? 'pc_demo_tutorial_v2' : 'pc_app_tutorial_v2';
    try {
      if (!localStorage.getItem(key)) {
        const t = setTimeout(() => setTutorialOpen(true), 700);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, [isDemo]);

  const closeTutorial = () => {
    setTutorialOpen(false);
    const key = isDemo ? 'pc_demo_tutorial_v2' : 'pc_app_tutorial_v2';
    try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
  };

  return (
    <div className={`min-h-screen relative overflow-hidden theme-${theme}`}
      style={{
        ...THEME[theme],
        background: 'var(--bg-app)',
        color: 'var(--text-strong)',
        backgroundImage: `
          radial-gradient(ellipse 80% 50% at 50% -10%, var(--orb-green), transparent 60%),
          radial-gradient(ellipse 60% 40% at 90% 30%, var(--orb-emerald), transparent 60%),
          radial-gradient(ellipse 60% 40% at 10% 80%, var(--orb-rose), transparent 60%)
        `,
      }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        body, html { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        /* Light-theme overrides for Tailwind color utilities used throughout the app.
           Inline styles already reference --text-* / --bg-* CSS vars; this block handles
           the remaining className-based color references. */
        .theme-light .text-zinc-100 { color: var(--text-strong) !important; }
        .theme-light .text-zinc-200 { color: var(--text-strong) !important; }
        .theme-light .text-zinc-300 { color: var(--text-primary) !important; }
        .theme-light .text-zinc-400 { color: var(--text-muted) !important; }
        .theme-light .text-zinc-500 { color: var(--text-tertiary) !important; }
        .theme-light .text-zinc-600 { color: var(--text-faint) !important; }
        .theme-light .text-zinc-700 { color: var(--text-disabled) !important; }
        /* Light-theme status badge text — Tailwind 200/100 shades are too pale on white bg */
        .theme-light .text-rose-200    { color: #9f1239 !important; }
        .theme-light .text-orange-200  { color: #9a3412 !important; }
        .theme-light .text-amber-100   { color: #854d0e !important; }
        .theme-light .text-emerald-200 { color: #065f46 !important; }
        .theme-light .text-emerald-300 { color: #047857 !important; }
        .theme-light .text-amber-200   { color: #92400e !important; }
        .theme-light .text-emerald-400 { color: #059669 !important; }
        .theme-light .text-zinc-200    { color: #18181b !important; }
        .theme-light .bg-white\\/\\[0\\.02\\] { background-color: rgba(0,0,0,0.03) !important; }
        .theme-light .hover\\:bg-white\\/\\[0\\.02\\]:hover { background-color: rgba(0,0,0,0.04) !important; }
        /* Tailwind border utilities used as dividers */
        .theme-light .border-white\\/5  { border-color: var(--border-subtle) !important; }
        .theme-light .border-white\\/10 { border-color: var(--border-medium) !important; }
        /* Date/time native control polish for both themes */
        .theme-dark input[type="date"], .theme-dark input[type="time"] { color-scheme: dark; }
        .theme-light input[type="date"], .theme-light input[type="time"] { color-scheme: light; }
        .theme-light select { color-scheme: light; }
      `}</style>

      <div className="max-w-md mx-auto px-5 py-3 relative">
        <TopBar
          onMenuClick={() => setGroupsOpen(true)}
          onSettingsClick={() => setView('settings')}
          view={view}
          onViewChange={(v) => { setView(v); }}
          isFiltered={isFiltered}
          onClearFilter={handleClearFilter}
          showBackButton={view === 'today' && !atDefault && filtered.length > 0}
          onBackToDefault={backToDefault}
        />

        <div className="space-y-4 mt-3">
          {view === 'today' && (isDemo ? (
            filtered.length > 0 && (
              <>
                <SessionCarousel
                  filteredSessions={filtered}
                  currentIdx={safeIdx}
                  confirmed={confirmed} tentative={tentative} out={out} undecided={undecided}
                  myStatus={myStatus} myPartySize={myPartySize} displayPartySize={displayPartySize} onMyStatus={handleMyStatus} onAdjustParty={handleAdjustParty}
                  onPrev={goPrev} onNext={goNext}
                  meName={meName}
                />
                <DemoControls
                  confirmed={confirmed} setConfirmed={setConfirmed}
                  tentative={tentative} setTentative={setTentative}
                  out={out} setOut={setOut}
                  undecided={undecided} setUndecided={setUndecided}
                />
              </>
            )
          ) : (
            live.loading ? (
              <div className="rounded-3xl px-6 py-12 text-center text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>Loading your groups…</div>
            ) : live.error ? (
              <EmptyState title="Couldn’t load your data" body={live.error} cta="Retry" onCta={live.reload} />
            ) : (live.groups || []).length === 0 ? (
              <EmptyState title="Get started" body="Create your own recurring crew, or find a public group near you to join." cta="Create a group" onCta={() => setCreateGroupOpen(true)} cta2="Find a group" onCta2={() => setDiscoverOpen(true)} />
            ) : filtered.length === 0 ? (
              <EmptyState title="No sessions yet" body="Open the menu (top-left) and tap “Add instance” on a group to create a session." cta="Open groups" onCta={() => setGroupsOpen(true)} />
            ) : (
              <SessionCarousel
                filteredSessions={filtered}
                currentIdx={safeIdx}
                confirmed={confirmed} tentative={tentative} out={out} undecided={undecided}
                myStatus={myStatus} myPartySize={myPartySize} displayPartySize={displayPartySize} onMyStatus={handleMyStatus} onAdjustParty={handleAdjustParty}
                onPrev={goPrev} onNext={goNext}
                meName={meName}
                canEdit={canEditCurrent} onEdit={() => setEditSession(currentSession)}
                canEditOf={canEditOf}
                onSetWatch={(r) => currentSession && live.updateSession(currentSession.id, { watch_reason: r })}
                onClearWatch={() => currentSession && live.updateSession(currentSession.id, { watch_reason: null })}
                onCancel={(reason) => currentSession && live.updateSession(currentSession.id, { cancelled_at: new Date().toISOString(), cancel_reason: reason || null, watch_reason: null })}
                onUncancel={() => currentSession && live.updateSession(currentSession.id, { cancelled_at: null, cancel_reason: null })}
                onDelete={() => currentSession && live.deleteSession(currentSession.id)}
              />
            )
          ))}
          {view === 'week' && <WeekView sessions={filtered.filter(s => !s.past)} onSelect={goToSessionById} />}
          {view === 'settings' && (isDemo
            ? <DemoSettings onBack={() => setView('today')} onOpenTutorial={() => setTutorialOpen(true)} />
            : <SettingsView onBack={() => setView('today')} settings={userSettings} update={updateUserSettings} theme={theme} setTheme={setTheme} account={account} onOpenTutorial={() => setTutorialOpen(true)} />
          )}
          {view === 'group-details' && !isDemo && (() => {
            const ag = (live.groups || []).find((g) => g.id === activeGroupId);
            if (!ag) return <div className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Group not found.</div>;
            return (
              <GroupDetailsView
                group={ag}
                onBack={() => setView('today')}
                schedule={live.schedulesByGroup?.[activeGroupId] || null}
                members={live.membersByGroup?.[activeGroupId] || []}
                meName={meName}
              />
            );
          })()}
          {view === 'group-settings' && (isDemo ? (
            <GroupSettingsView groupId={activeGroupId} onBack={() => setView('today')} settings={groupSettingsMap[activeGroupId]} update={(patch) => updateGroupSettings(activeGroupId, patch)} isDemo />
          ) : (() => {
            const ag = (live.groups || []).find(g => g.id === activeGroupId);
            if (!ag) return <div className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Group not found.</div>;
            const realSettings = { name: ag.name, location: ag.location || '', allowAdhoc: ag.allow_adhoc, isPublic: ag.is_public, horizon: ag.horizon ?? 5, schedule: [], allowMemberInvites: ag.allow_member_invites, autoCancelWindow: ag.auto_cancel_minutes_before, autoCancelMin: ag.auto_cancel_min_players, lastminuteWindow: ag.lastminute_window_minutes };
            return (
              <GroupSettingsView
                groupId={activeGroupId}
                onBack={() => setView('today')}
                settings={realSettings}
                members={live.membersByGroup?.[activeGroupId] || []}
                meName={meName}
                schedule={live.schedulesByGroup?.[activeGroupId] || null}
                onSaveSchedule={(r) => live.saveSchedule(activeGroupId, r)}
                onGenerateSessions={async (r) => { const s = await live.saveSchedule(activeGroupId, r); return live.generateSessions(activeGroupId, s, ag.horizon ?? 5); }}
                onDelete={async () => { await live.deleteGroup(activeGroupId); setActiveGroupId(null); setView('today'); }}
                update={(patch) => {
                  const db = {};
                  if ('name' in patch) db.name = patch.name;
                  if ('location' in patch) db.location = patch.location;
                  if ('isPublic' in patch) db.is_public = patch.isPublic;
                  if ('allowAdhoc' in patch) db.allow_adhoc = patch.allowAdhoc;
                  if ('allowMemberInvites' in patch) db.allow_member_invites = patch.allowMemberInvites;
                  if ('horizon' in patch) db.horizon = patch.horizon;
                  if ('autoCancelWindow' in patch) db.auto_cancel_minutes_before = patch.autoCancelWindow;
                  if ('autoCancelMin' in patch) db.auto_cancel_min_players = patch.autoCancelMin;
                  if ('lastminuteWindow' in patch) db.lastminute_window_minutes = patch.lastminuteWindow;
                  if (Object.keys(db).length) live.saveGroup(activeGroupId, db);
                }}
              />
            );
          })())}
        </div>
      </div>

      <GroupsMenu open={groupsOpen} onClose={() => setGroupsOpen(false)} onManage={handleManage} onDetails={handleDetails}
        visibleGroups={visibleGroups} setVisibleGroups={setVisibleGroups}
        groups={Object.values(groupInfo)} isDemo={isDemo}
        onCreateGroup={() => { setGroupsOpen(false); if (isDemo) setView('settings'); else setCreateGroupOpen(true); }}
        onInviteMember={isDemo ? null : (gid) => { setInviteForGroup(gid); setGroupsOpen(false); }}
        onAddInstance={(gid) => { setGroupsOpen(false); if (isDemo) setView('settings'); else setAddInstanceFor(gid); }}
        onDiscover={() => { setGroupsOpen(false); if (isDemo) setView('settings'); else setDiscoverOpen(true); }} />
      <AddInstanceModal groupId={addInstanceFor} groupName={addInstanceFor ? groupInfo[addInstanceFor]?.name : null}
        groupLocation={addInstanceFor ? groupInfo[addInstanceFor]?.location : ''}
        members={addInstanceFor ? (live.membersByGroup?.[addInstanceFor] || []) : []}
        onClose={() => setAddInstanceFor(null)} onCreate={isDemo ? null : live.createSession} />
      <DiscoverGroupsModal open={discoverOpen} onClose={() => setDiscoverOpen(false)}
        onJoin={isDemo ? null : live.joinGroup} myGroupIds={(live.groups || []).map((g) => g.id)} />
      <PartySizeModal control={partyModal} onConfirm={handlePartyConfirm} onClose={() => setPartyModal(null)} />
      <TutorialModal open={tutorialOpen} onClose={closeTutorial} />
      <NotificationsPromptModal active={!isDemo && !!account && !tutorialOpen} />
      <DropoutConfirmModal
        control={dropoutConfirm}
        onClose={() => setDropoutConfirm(null)}
        onConfirm={() => {
          const ctl = dropoutConfirm;
          setDropoutConfirm(null);
          if (!ctl) return;
          applyStatusChange(ctl.targetStatus, 1);
          notifyDropout(ctl.sessionId).catch((e) => console.warn('[dropout] notify failed', e));
        }}
      />
      <CreateGroupModal open={createGroupOpen} onClose={() => setCreateGroupOpen(false)}
        onCreate={async (args) => {
          const g = await live.createGroup(args);
          if (g?.id) { setActiveGroupId(g.id); setView('group-settings'); }
          return g;
        }} />
      <InviteMemberModal open={!!inviteForGroup} onClose={() => setInviteForGroup(null)}
        groupName={inviteForGroup ? groupInfo[inviteForGroup]?.name : ''} groupId={inviteForGroup} real={!isDemo} />
      <EditInstanceModal session={editSession} onClose={() => setEditSession(null)}
        onSave={(patch) => live.updateSession(editSession.id, patch)} />
    </div>
  );
}
