# PickleCheck.in — Design Notes

Context for anyone (including future Claude Code sessions) picking up the codebase. The prototype in `picklecheck-app-v36.jsx` embodies these decisions; this doc explains *why*.

---

## Visual identity

- **Mood**: dark warm with neon accent. Light theme is supported but the brand identity reads on dark.
- **Background**: layered radial gradients — neon green at top, emerald at right, rose at bottom-left. Provides warmth without being busy. Tokenized as `--orb-*` vars.
- **Surfaces**: glassy cards with backdrop-blur, `rounded-3xl`, subtle 1px inset highlight on top edge.
- **Accent color**: `#c5e500` — bright lime-yellow-green, used for brand mark, active CTAs, "you" indicators, and neon ball. Brand-locked across themes.

## Typography

- **Display / numbers**: Bricolage Grotesque, 800 weight, `font-variation-settings: 'wdth' 95` to slightly condense.
- **Body**: Plus Jakarta Sans, 400-800 range.
- **Court numbers in SVG**: textAnchor middle, dominantBaseline central, weight 800, white. Centered over the net at `(50, 110)`.
- **Brand mark**: "Pickle" in `#c5e500` + "Check" in `--text-strong` + glowing dot pickleball + "in" muted.

## Color tokens

Two complete sets in the `THEME` object — `dark` and `light`. Applied as CSS variables on the App root via inline style. Every component references `var(--bg-card)`, `var(--text-strong)`, etc. Switching themes = swapping the var values; no per-component logic.

Tailwind text-zinc-* classes are overridden via a `<style>` block scoped under `.theme-light` since those classes don't auto-flip.

Status colors (red, orange, yellow, green, gray) are palette-level constants — same in both themes since they're semantic (RSVP state).

## Court visualization

The core UI element. Each session card shows a court grid that scales with the number of courts needed:

- 1 court: maxWidth 95px (centered)
- 2 courts: 220px total
- 3 courts: 270px total
- 4 courts: row of 4
- 5+ courts: minis on top, last 3 at full size below

Each court is 100:220 portrait aspect. Court fills are colored gradients indicating capacity state. Ball fill order alternates across the net: top-left, bottom-left, top-right, bottom-right (matches doubles-rotation visual logic).

### Gradient rules (per-court, locked)

For each court, compute `currentActual` (IN-only) and `potentialActual` (IN+MAYBE):

- **No tentatives** → solid current color
- **Same color** → solid current
- **Currently red AND potential isn't green** → solid potential (the "red was a global artifact, show the settled state" rule)
- **Otherwise** → upgrade gradient

Each color has `from`, `mid`, `to`. The `mid` is RGB average between `from` and `to`. Upgrade gradient stops at 0%: `cur.mid`, 45%: `cur.mid` (held), 100%: `pot.mid`. Direction diagonal `(0,0)` to `(100,100)`. The 45% hold gives the gradient a "current state dominates, potential is hinted" feel.

Solid courts use light→dark depth gradient (`from`→`to`) for visual interest.

## Session card states

Three court visual states selectable per card: collapsed, courts-only, courts+roster.

Header is compact: 26px inline date+time on one line (e.g., `SAT · MAY 24 · 7:00 PM` or `TODAY · 5:00 PM`). 13px secondary: `EES Thursdays · 2 CT`. TODAY/TOMORROW inline tag in neon green replaces day+date when applicable.

Counts grid was removed — redundant with court viz + roster expansion.

## Top bar

Compact left-justified row: `[NEXT UP|LIST] [↶ NEXT UP]`. Smaller pills (`px-3 py-1 text-[11px]`). Filter chip pushed right with `ml-auto`. The "back to default" pill appears inline when off-default.

## Party size system

Per-instance, not a global user setting. Sticky from last commit (`lastPartySize`).

- **Persistent chip** above IN/MAYBE/OUT buttons (always visible when interactive)
- Size 1: muted "Just you · tap to bring guests"
- Size >1: bright green "Going as N (you + N-1) · tap to adjust"

**Modal behavior:**
- Tap IN/MAYBE while planning size >1 → modal opens
- Tap chip while already IN/MAYBE → modal in "adjust" mode (Confirm I'M IN)
- Tap chip while undecided/out → modal in "prepare" mode (Save — updates sticky only)
- OUT/UNDECIDED always commit at size 1

Roster shows "Nicholas Morgan +N" when `myPartySize > 1`.

## Action buttons (IN/MAYBE/OUT)

Colored active states with subtle inner-top highlight via `boxShadow: '... 0 1px 0 rgba(255,255,255,0.18) inset'`. Glow shadow uses status color.

- IN active: `#c5e500` bg, `#0a0a0c` text, green glow
- MAYBE active: `#fcd34d` bg, `#1a1500` text, yellow glow
- OUT active: `#52525b` bg, `#fff` text, gray glow

Inactive uses `var(--bg-subtle)` + `var(--text-secondary)` + `var(--border-subtle)`.

## Swipe + carousel

Direction-lock at 8px threshold. Commit at 130px threshold. `skipTransition` flag fixes the snap-back bug (track snaps without animation during state swap).

## Roster section

Tinted background toggle button with Users icon, "3 IN" neon badge, "of 9" total, ChevronDown rotates 180° when expanded.

When expanded, four sections (IN / MAYBE / OUT / UNDECIDED) each with section header in status color + dot + names. Empty sections show muted "No one yet".

## Modals (ModalSheet pattern)

Single reusable `ModalSheet` component handles all bottom-sheet modals: Theme, AddInstance, Discover, InviteMember, PartySize. Slides up on mobile, centers on tablet+. Overlay uses `var(--bg-overlay)`.

## Settings

Two scopes:
- **User settings** (lifted to App): name, email, remind24, remind3, lockIn, summary, outRanges. Persist across view navigation.
- **Group settings map** (lifted to App): keyed by groupId. name, location, allowAdhoc, isPublic, horizon (instance count, not days), schedule.

### Auto-out date ranges
User can mark date ranges as "out" — sessions in those ranges auto-RSVP as OUT. UI lets them add and remove ranges; functional wiring to RSVPs pending.

### Group settings (admin)
- Public/Private toggle ("Searchable in Discover Groups" vs "Invite only")
- Schedule: add recurring slots (day dropdown + time picker)
- Horizon as **instance count** (StepperRow, 1-12) — not day-based
- Members can create ad-hoc toggle
- Invite member opens URL/email modal

## Groups menu (slide-out from left)

- Header: "Tap a group to filter. Toggle the dot to show or hide."
- SELECT ALL / CLEAR VISIBLE buttons
- Per-group card: filter button + visibility eye toggle
- "Add instance" button per group (members can create ad-hoc)
- "Manage" button (admin only)
- "Discover groups" button at bottom

Visibility toggles currently cosmetic — filter wiring pending (in roadmap).

## Theme switching

User-selectable in Settings → App → Theme. Modal shows Dark (default) and Light. System mode planned but currently disabled. Theme state lifted to App, applied as CSS vars on root + `theme-${theme}` class for Tailwind overrides.

## Critical decisions to preserve in the rewrite

1. **Court gradient logic** — the per-court current/potential rule is non-obvious but visually critical
2. **Party size sticky behavior** — `lastPartySize` carries over between sessions and statuses
3. **Header layout** — inline date+time at 26px is the tight version that survived multiple iterations
4. **Single-card carousel pattern** — direction-locked swipe, snap rollback, 130px commit threshold
5. **Theme token names** — keep `--bg-card`, `--text-strong` etc. stable; downstream code references these
6. **Brand mark composition** — "Pickle" green + "Check" strong-text + dot + "in" muted is the locked form
7. **Horizon as instance count** — not days. Group with `Mon-Fri 6am` schedule and horizon=5 = 5 sessions visible (not 5 days × 5 sessions)
8. **RSVP eager-creation** — when sessions are materialized, every group member gets an `rsvps` row with status=undecided. UI assumes this exists.
