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

## Known scope drift to resolve

Built before that constraint was known, and now questionable here:

- `src/pages/Compass.jsx` + `src/router/Landing.jsx` — the customer's home
  screen, and role-based routing to it.
- "New Update" / "Post Update" on Construction — the supervisor's job.
- `src/lib/offlineQueue.js`, `public/sw.js`, the 1080p compression in
  `src/lib/storage.js` — all built for the supervisor persona on a bad site
  connection. A PM on a laptop does not need them.
- `MILESTONE_ACTIONS` in `src/api/finance.js` — includes the customer's
  approval step alongside the PM's.

Do not delete any of it without asking. Some may be worth keeping as a
read-only or admin-override view.

## Design

The UI follows supplied design mockups. **If a mockup exists for a screen, it
wins over invention.** Ask for the mockup rather than guessing, and do not add
navigation items, screens or icons that are not in the design — that has
already caused rework once (a "Home" nav item added unasked, then removed).

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
