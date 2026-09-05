# HomeBuild — web application

## THIS APP IS FOR THE PROJECT MANAGER ONLY

HomeBuild is three applications. This repository is one of them.

| App | Who uses it | Where |
|---|---|---|
| **This web app** | **Project manager** | this repo |
| Site supervisor app | Site supervisors | separate |
| Customer app | Homeowners | separate |

The PRD describes the whole product, so it contains screens and flows that
belong to the other two apps. **Read every PRD requirement through the
question "is this the PM's job?"** before building it here.

Concretely, in PRD terms:

- **PM (build it here):** run the portfolio, create projects, verify
  milestones, triage alerts, manage the schedule and forecast, manage
  contractors, review the site feed, generate and compare floor plans.
- **Site supervisor (NOT here):** posting the daily site update, capturing
  photos on site, offline capture. The PM *reads* the feed here; they do not
  file it.
- **Customer (NOT here):** the Compass home screen (PRD section 5 explicitly
  says "upon login, **the customer** sees…"), approving a milestone release,
  choosing a floor plan.

Where a workflow spans apps — a milestone needs PM verification *then*
customer approval — this app implements the PM's half and **shows** the other
half as status, not as a button.

## Resolved: what was removed

The Design screen and the Compass home screen were built from the PRD before
the manager-only scope was known, and are **gone from this app** — absent from
every mockup, and customer-facing by the PRD's own wording.

Their engine is deliberately kept, because the customer app will need exactly
it: `src/lib/vastu.js`, `src/lib/planValidation.js`, `src/lib/planGenerator.js`,
`src/components/design/FloorPlanSvg.jsx`, `src/api/design.js`, and the
`floor_plans` table with `select_floor_plan()`.

## Still questionable here

Built for the wrong audience, not yet resolved — ask before changing:

- "New Update" / "Post Update" on Construction. The mockup HAS this button, so
  the design says it belongs; the supervisor app filing the update says it
  does not. Unresolved.
- `src/lib/offlineQueue.js`, `public/sw.js`, and the 1080p compression in
  `src/lib/storage.js` — built for the supervisor on a bad site connection. A
  PM on a laptop does not need them. Harmless, but dead weight here.
- `MILESTONE_ACTIONS` in `src/api/finance.js` includes the customer's approval
  step. This app should arguably offer only the PM's verification and show the
  customer's approval as status.
- "Log Alert" on the Alerts screen is NOT in the mockup. It was added because
  the CV pipeline is out of scope and without it no alert can ever be created
  in this build. Remove it once alerts arrive from somewhere real.

## Design mockups

Eight PNGs in `scripts/` are the UI specification. **If a mockup exists for a
screen, it wins over invention** — do not add navigation items, screens or
icons that are not in them.

| File | Screen |
|---|---|
| `aaaa.png` | Executive Dashboard (Overview) |
| `bbbbb.png` | Project Portfolio |
| `ccccc.png` | Daily Site Feed (Construction) |
| `ddddd.png` | Financial Overview |
| `eeeee.png` | Master Construction Schedule |
| `fffff.png` | Contractor Management |
| `gggggg.png` | AI Alert Management |
| `hhhhh.png` | Settings |

**The sidebar is seven items:** Overview, Projects, Construction, Finance,
Schedule, Contractors, Analytics. Every mockup agrees. There is **no Design
entry and no Compass home screen** — consistent with this being the PM's app,
since PRD 5.1's user stories are all written "As a homeowner…".

### Where the mockups and the PRD disagree

Both are authoritative and they conflict in places. Resolved conflicts are
recorded here so they are not re-litigated:

| Topic | Mockup says | PRD says |
|---|---|---|
| Gantt legend | Completed / In Progress / Baseline Plan / Forecasted | 5.4.5: baseline **blue**, actual **green**, forecast **violet** |
| Gantt baseline bar | grey | blue |
| Today marker | violet | 5.4.5: **red**, updating daily |
| Finance categories | Construction Materials / Permits & Legal / Labor & Subcontracting | 5.3.2: six fixed categories, Civil 48% … Contingency 10% |
| Construction rail | "AI Insights", invented findings | 5.2.3: CV alert categories |

A mockup showing static demo content is **not** an instruction to keep the
data fake. Match its layout, labels and structure; fill it with real data.

## The stack, briefly

React 19 · Vite · Tailwind 4 (`@theme` tokens in `src/index.css`, no config
file) · React Router 7 · Firebase Auth · Supabase (Postgres + Storage).

Colour utilities resolve against the tokens in `src/index.css`. There is **no
bare `brand` token** — the scale runs `brand-50`…`brand-700`. `bg-brand`
silently paints nothing.

## Database

`supabase/` holds three scripts and their tests:

- `schema.sql` — idempotent; repairs an existing database in place.
- `seed.sql` — demo data.
- `reset.sql` — **destructive**; wipes the tables for a clean rebuild.
- `tests/*.sh` — run these after touching schema.sql. They cover 55 legacy
  database shapes, because this file shipped three upgrade failures in a row
  when it was only ever tested against an empty database.

Money is stored in **rupees**, not lakhs. Workflow rules (the milestone
payment chain, dual approval above ₹5L) live in SQL so a client bug cannot
bypass them.

## Before saying a change works

`npm run build` and `npm run lint` both passing is not evidence a screen
renders. Several bugs in this codebase's history — a blank compass orb,
invisible progress bars, a redirect firing before its data arrived — passed
both. Check the actual page.

## Not implemented, deliberately

AI floor plan generation, computer-vision quality checks, RazorpayX escrow and
KYC, push notifications, and the eleven-language UI. Each is either out of
scope or needs credentials/infrastructure this repo does not have. See
`supabase/README.md` for the one open security decision (the `profiles`
directory is readable by any signed-in user).

`public/images/` is empty — run `npm run images` on a machine with open
network access and commit the result, or the sign-in illustration and demo
avatars 404.
