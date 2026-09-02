# HomeBuild — Web Application

A pixel-faithful React rebuild of the nine HomeBuild UI mockups, running on
static fixture data with every control wired up. No backend, no network calls.

**Stack:** React 19 · Vite 8 · Tailwind CSS 4 · React Router 7 · lucide-react

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview  # serve the production build locally
```

Any credentials are accepted on the sign-in screen — it fills in
`manish@homebuild.com` by default. Press **Sign In to Workspace** to enter.

---

## Deploying to Vercel

Import the repo at [vercel.com/new](https://vercel.com/new). Vercel detects Vite
and reads `vercel.json`, so no dashboard configuration is required:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |

### Why deep links don't 404

This is a client-routed SPA: only `/index.html` exists on disk, so a hard
refresh on `/finance` would normally ask Vercel for a `/finance` file that isn't
there and get the platform 404. `vercel.json` prevents that:

```json
"rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
```

Every path that isn't under `/api/` is served `index.html`, React Router reads
the URL client-side, and the right page renders. Static assets are unaffected —
Vercel matches real files in `dist/` before applying rewrites.

Unknown paths are caught by the router's `path: '*'` route and render the in-app
404 (`src/pages/NotFound.jsx`), which offers links into every module rather than
a dead end. `RootError.jsx` is wired as the router `errorElement` so render
errors also stay inside the product shell.

**Verified routes:** `/` (redirects to `/dashboard`), `/sign-in`, `/dashboard`,
`/projects`, `/construction`, `/finance`, `/schedule`, `/contractors`,
`/analytics`, `/settings`, `/support`, plus `*` → in-app 404.

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
│   ├── context/             AuthContext · ToastContext
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

**Where to change things**

- **Data** — `src/data/*.js`. Every number, name and string on screen lives
  here, nothing is hardcoded in a page component.
- **Colors / type / radii** — the `@theme` block at the top of `src/index.css`.
  Change a token there and it propagates everywhere.
- **Images** — `src/data/media.js` centralises every external URL (Unsplash for
  photography, pravatar for faces) so the demo can be re-pointed in one file.

---

## Design tokens

Sampled pixel-by-pixel from the mockups; the full derivation, per-screen data
inventory and a list of inconsistencies is in `POTIIP/design/design_system.md`.

| Role | Hex |
|---|---|
| Primary | `#0058BE` |
| Success | `#10B981` |
| Warning | `#F59E0B` |
| Danger | `#BA1A1A` (bars `#C84848`) |
| Violet | `#8B5CF6` (Gantt bars `#7D53DD`) |
| Canvas / surface / hairline | `#F7F9FB` / `#FFFFFF` / `#E2E8F0` |
| Ink ramp | `#0F172A` → `#505F76` → `#7A8597` → `#A7AFBA` |

Type is Inter on a 24 / 18 / 14 / 12 / 11 ladder, with uppercase letter-spaced
11px overlines on KPI cards and table headers. Cards are 12px radius, buttons
8px, chips fully rounded.

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
| Settings | Theme picker, language switch, Invite Member, member action sheet, Log Out |
| Global | Sidebar nav, topbar search, notifications, avatar menu, Create New Project, toasts |

Actions that would hit a backend raise a toast saying so — no click is a dead
end, and nothing silently pretends to have saved.

---

## Deliberate deviations from the mockups

The screenshots contain internal inconsistencies. Each is resolved here and
recorded so the choice is visible rather than silently baked in:

1. **Sidebar active state** — the mockups show a green left bar on eight
   screens and a blue right bar on Settings. This build uses the green left bar
   everywhere.
2. **Finance donut** — the source figures (45 / 25 / 38) sum to 108% under a
   "100% Total Costs" label. The legend prints them verbatim; arc lengths are
   normalised against the real sum so the ring closes.
3. **Dark mode** — every mockup is light-only, so Dark and System in the theme
   picker are selectable but not implemented, and say so when picked.
4. **Project names** — the mockups use three non-overlapping sets across
   Dashboard, Portfolio and Alerts. All of them are kept so each screen matches
   its source; unify `src/data/` before using this as demo data.
5. **Pagination depth** — Portfolio claims 12 projects and Alerts claims 128.
   Both are fully populated so the pagers have real pages behind them.
6. **Support** — linked from every screen but never mocked up; a plain
   placeholder page keeps the link from dead-ending.

---

## Notes

This is a UI prototype. There is no persistence beyond a single
`sessionStorage` flag for the demo session, and no request leaves the browser.
The database schema this UI is modelled against lives at
`POTIIP/db/homebuild_schema.sql`.
