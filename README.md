# PickleCheck

Pickleball group check-ins. Know who's playing before you go.

[picklecheck.in](https://picklecheck.in)

## Stack

- Vite + React 18
- Tailwind CSS (with inline-style theming via CSS variables)
- Supabase (Auth + Postgres + Edge Functions)
- Vercel (hosting)
- Cloudflare DNS (proxied to Vercel)

## Quick start

```bash
# 1. Install deps
npm install

# 2. Set up env
cp .env.example .env.local
# Then edit .env.local with your Supabase project URL and anon key

# 3. Run dev server
npm run dev
```

Open http://localhost:5173

## Project structure

```
picklecheck/
├── src/
│   ├── App.jsx               # Main app (the prototype — to be split)
│   ├── main.jsx              # Entry point
│   ├── index.css             # Tailwind + global styles
│   ├── lib/
│   │   ├── supabase.js       # Supabase client
│   │   └── auth.jsx          # AuthContext + useAuth hook
│   ├── components/           # (empty — will host split components)
│   ├── hooks/                # (empty — will host custom hooks)
│   └── pages/                # (empty — will host route-level pages)
├── public/
│   ├── manifest.json         # PWA manifest
│   └── icon.svg              # App icon
├── supabase/
│   └── migrations/           # SQL migrations (empty for now)
├── ROADMAP.md                # Build checklist
├── DESIGN_NOTES.md           # Design system + rationale
└── package.json
```

## Build & deploy

Vercel auto-deploys on push to `main`. Environment variables for production are set in Vercel project settings.

```bash
npm run build       # Build for production
npm run preview     # Preview production build locally
```

## Next steps

See `ROADMAP.md` for the full build plan. Highest-priority chunks:

1. Schema migration (the 8 tables)
2. Auth wiring + route protection
3. Port the in-memory prototype to real Supabase queries
4. Push notification setup (VAPID + service worker)

## Design system

See `DESIGN_NOTES.md` for the rationale behind colors, typography, court visualization, party-size logic, and theme tokens. These are decisions worth preserving as the codebase grows.
