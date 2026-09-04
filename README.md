# HomeBuild — Web Application

**Stack:** React 19 · Vite 8 · Tailwind CSS 4 · React Router 7 · lucide-react

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview  # serve the production build locally
npm run lint     # eslint
npm run images   # vendor the demo photography into public/images/
```

**Run `npm run images` once, on a machine with open network access, and commit
the result.** `src/data/media.js` points at local paths; until the folder is
populated the sign-in illustration and the demo avatars 404. The script needs
`images.unsplash.com` and `i.pravatar.cc`, and skips anything already present.

### Backend setup

1. `supabase/schema.sql`, then `supabase/seed.sql`, in the Supabase SQL editor.
   Both are idempotent — re-running `schema.sql` is the documented upgrade
   path. See `supabase/README.md`.
2. Firebase Authentication for identity, bridged to Supabase as a third-party
   issuer so Row Level Security can key on the Firebase UID. See
   `AUTH_SETUP.md` and `STORAGE_SETUP.md`.

### Offline behaviour

The production build registers a service worker that caches the app shell, so
the app opens on a site with no signal and site updates captured there queue in
IndexedDB until the connection returns. It is registered in production only —
in development it would sit in front of Vite's HMR and serve stale modules.


## Deploying to Vercel

Import the repo at [vercel.com/new](https://vercel.com/new). Vercel detects Vite
and reads `vercel.json`, so no dashboard configuration is required:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |

---

## Folder structure

```
HomeBuild_Webapplication/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── charts/          AreaTrend · DonutChart · GanttChart
│   │   ├── layout/          Sidebar · Topbar · PageHeader · Logo
│   │   ├── shared/          CreateProjectModal
│   │   └── ui/              Button · Card · Chip · StatusDot · ProgressBar
│   │                        AvatarStack · KpiCard · Segmented · FilterSelect
│   │                        Pagination · StarRating · Sparkline · Modal
│   ├── context/             ThemeContext · AuthContext · ToastContext
│   ├── data/                one module per screen — all fixture data
│   ├── layouts/             AppLayout (workspace shell) · AuthLayout
│   ├── lib/                 cn · format (₹, dates, deltas)
│   ├── pages/               one component per route
│   ├── router/              route table · ProtectedRoute · RootError
│   ├── index.css            design tokens (@theme) + base + components
│   └── main.jsx
├── index.html
├── vercel.json              SPA rewrites + asset caching
├── vite.config.js           @ → ./src alias
└── jsconfig.json            editor path intellisense
```
both. |
| `--color-scrim` | Modal and drawer overlays used `ink`, which is *light* in dark mode — the scrim would have brightened the page instead of dimming it. |

Photography is dimmed slightly (`brightness(.88)`) in dark mode so images don't
glare against the surrounding surfaces.

---

## What's interactive

| Screen | Working controls |
|---|---|
| Sign In | Email/password submit, password reveal, OAuth + forgot-password feedback, footer links |
| Dashboard | KPI cards, project rows navigate to Portfolio, View All, site-update rail |
| Projects | Status / City / PM filters, pagination, dashed card opens Create Project |
| Construction | Feed category filter, photo lightbox, New Update dialog, upload slots, AI insight actions, Generate Report |
| Finance | Trend range switch, hover readout on the chart, donut hover with centre swap, row action sheet, New Invoice dialog, Export |
| Schedule | Gantt / List / Board views, expand-collapse groups, task detail dialog, zoom, Apply optimisation, Export PDF |
| Contractors | All / Internal / Sub tabs, trade filter, Min Rating toggle, row action sheet |
| Analytics | Severity + Status filters, 13-page pagination over 128 alerts, acknowledge |
| Settings | Light / Dark / System theme picker, language switch, Invite Member, member action sheet, Log Out |
| Global | Sidebar nav, topbar search, notifications, avatar menu (with a quick theme toggle), Create New Project, toasts |

Actions that would hit a backend raise a toast saying so — no click is a dead
end, and nothing silently pretends to have saved.

