# PickleCheck.in — Build Roadmap

What still needs to exist to take the prototype from clickable mockup → actually usable in your three groups (LT Breakfast, EES Thursdays, CBT Sunday).

Organized by criticality. "Critical path" = nothing works without these. "Polish" = significantly degrades the product without them. "Future" = real features but punt to a later release.

---

## CRITICAL PATH — required for v1

### 1. Backend foundation
- [ ] Supabase project provisioned (prod + staging)
- [ ] Schema migration: `groups`, `group_members`, `schedules`, `sessions`, `rsvps`, `user_out_ranges`, `notification_prefs`, `push_subscriptions`, `profiles`
- [ ] RLS policies on every table (members can read own group data, admins can write group-level data, users can read/write their own RSVPs)
- [ ] Indexes on hot paths (sessions by date+group, rsvps by session)
- [ ] Google OAuth via Supabase Auth (matches BalanceBoard pattern)
- [ ] `profiles` row auto-created on first sign-in
- [ ] Repo scaffold: Vite + React + Tailwind + Supabase client, env vars wired

### 2. Session materialization
- [ ] Nightly cron edge function that reads each group's `schedules` + `horizon` and creates `sessions` rows up to N instances out
- [ ] Rollover: sessions disappear from "NEXT UP" 1 hour after `start_time`
- [ ] Past sessions remain readable but locked (archive view, possibly v1.1)
- [ ] Auto-create RSVPs (status: undecided) for every group member when a session is materialized
- [ ] Update RSVP roster when members are added/removed from a group

### 3. Core RSVP loop
- [ ] Tap IN / MAYBE / OUT writes to `rsvps`
- [ ] Party size persists per-instance, lastPartySize stickiness across sessions
- [ ] Real-time subscription so other users' RSVPs update the card live
- [ ] Optimistic UI on tap (don't block on network)
- [ ] Lock-in: after session start, status freezes (configurable per group)
- [ ] Visual indicator that a session is locked

### 4. Push notifications
- [ ] VAPID keys generated + stored
- [ ] Web Push subscription on first login (with permission prompt)
- [ ] Service worker registered for receiving pushes
- [ ] 24h reminder (per user notification_pref)
- [ ] 3h reminder (per user notification_pref)
- [ ] "New session created" notification when admin adds ad-hoc
- [ ] Daily morning summary (optional, per user)
- [ ] Cron edge function that sends scheduled notifications via web-push library

### 5. Group lifecycle
- [ ] Create group flow (name, location, role admin assigned to creator)
- [ ] Add member by email or invite URL (with single-use token)
- [ ] Member accepts invite → joins group
- [ ] Member list view (visible to all members; admin sees actions)
- [ ] Leave group (member action)
- [ ] Remove member (admin action)
- [ ] Group settings save to DB (currently in-memory)

### 6. Schedule management (admin)
- [ ] Add recurring slot writes to `schedules`
- [ ] Edit slot
- [ ] Delete slot
- [ ] Toggle "members can create ad-hoc instances"
- [ ] Update `horizon` writes to DB and triggers re-materialization

### 7. Ad-hoc instance creation
- [ ] AddInstanceModal writes a one-off session to DB
- [ ] Notifies all group members via push
- [ ] Distinguishable from scheduled sessions (already styled, just needs wire-up)
- [ ] Member-created vs admin-created (depending on `allowAdhoc`)

### 8. Profile & settings persistence
- [ ] Edit name/email writes to `profiles`
- [ ] Change password via Supabase Auth flow
- [ ] Notification preferences write to `notification_prefs`
- [ ] Auto-out date ranges write to `user_out_ranges` and auto-mark RSVPs as OUT during ranges
- [ ] Theme preference persists (currently in-memory)

### 9. Visibility filter (actually functional)
- [ ] Toggle in GroupsMenu writes to user preferences
- [ ] Main feed filters by visible groups
- [ ] "Filter by group" tap behavior unchanged but now actually persists
- [ ] Sensible default (all visible until user changes)

### 10. App states
- [ ] Empty state: zero groups → onboarding CTA ("Create a group" or "Join via invite")
- [ ] Empty state: groups but no upcoming sessions → "Nothing scheduled" with create CTA
- [ ] Loading skeleton for initial data fetch
- [ ] Error state for network/auth/write failures with retry
- [ ] Offline mode: cached last state, queue writes for replay

### 11. Production readiness
- [ ] PWA manifest (icons, name, theme colors, display: standalone)
- [ ] Service worker (caching strategy, push handler, offline fallback)
- [ ] iOS install prompt (Safari-specific quirks)
- [ ] Vercel deployment hooked to GitHub
- [ ] DNS pointing picklecheck.in → Vercel (via Cloudflare nameservers)
- [ ] SSL/cert verified
- [ ] Environment variables in Vercel (SUPABASE_URL, SUPABASE_ANON_KEY, VAPID keys)
- [ ] Production Supabase project (separate from staging)

---

## POLISH — v1.1

### Discover groups
- [ ] Search by name/location against `groups` where `is_public=true`
- [ ] "Request to join" writes a pending row
- [ ] Admin sees pending requests in group settings, approves/declines
- [ ] Public groups auto-join if `auto_approve=true`

### Onboarding
- [ ] First-time signup → "Create your first group" or "Got an invite link?"
- [ ] Sample data / demo group toggle so new users can see the UI populated
- [ ] Tooltip layer explaining the court visualization the first time it's shown

### Admin tools
- [ ] Transfer admin role
- [ ] Delete group (with confirmation)
- [ ] Pin/unpin members
- [ ] Bulk-add members via CSV (your case: porting LT and EES rosters from existing texting groups)

### Account
- [ ] Delete account + data export (GDPR-ish)
- [ ] Profile picture (pull from Google OAuth if available, otherwise initials)
- [ ] Display name vs full name distinction

### Operations & legal
- [ ] Privacy policy page
- [ ] Terms of service page
- [ ] Support email / contact form
- [ ] Basic event tracking (Posthog, Mixpanel, or self-hosted)
- [ ] Error tracking (Sentry free tier)
- [ ] Backup strategy for Supabase

### UX additions
- [ ] System theme detection (the third option in ThemeModal — currently disabled)
- [ ] Calendar export per session (.ics download)
- [ ] Copy session link to share
- [ ] Past sessions / play history view

---

## FUTURE — v2 and beyond

### Integrations
- [ ] Two-way Google/Apple Calendar sync (add session to user calendar on RSVP)
- [ ] SMS fallback for users who won't enable push (Twilio)
- [ ] Native iOS/Android shells (only if PWA hits friction)

### Social / engagement
- [ ] In-app group chat or comments per session
- [ ] Quick polls ("indoor vs outdoor this week?")
- [ ] @mention / direct ping a specific player
- [ ] "Find a sub" flow when someone drops last-minute

### Smarter features
- [ ] Skill level field on profiles + matching logic
- [ ] Show-up rate / reliability score
- [ ] Weather-aware messaging ("rain in forecast — confirm by 2pm")
- [ ] Court availability integration (Skedda, etc.)
- [ ] Suggested partners / doubles matchmaking

### Gamification
- [ ] Streak: most consecutive sessions attended
- [ ] Per-group leaderboards
- [ ] Badges / milestones
- [ ] Monthly recap email

---

## Bootstrap question

How you onboard your existing groups matters more than it sounds:

- **CBT Sunday** — you're admin, so you create it, invite the 11 members
- **LT Breakfast Club** — the existing organizer needs an account first, OR you create it and become co-admin
- **EES Thursdays** — same as LT

The invite flow needs to be smooth enough that you can DM a Namecheap-domain link to your existing text threads and people will actually sign up. That's the real test of v1.

---

## Suggested build order

1. Schema + RLS + auth (foundation, nothing works without it)
2. Session materialization cron (so there's data to render)
3. RSVP writes + real-time (the actual product)
4. Profile + group + schedule CRUD (admin can configure)
5. Visibility filter + empty states (usable end-to-end)
6. Push notifications (the reason this beats a text thread)
7. PWA + deployment (real users can install)
8. Polish based on real usage in your 3 groups
