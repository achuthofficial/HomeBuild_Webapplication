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

## Removed: everything that belongs to the other two apps

Built from the PRD before the manager-only scope was known:

| Removed | Belonged to |
|---|---|
| `Compass.jsx`, `Landing.jsx`, `api/compass.js` | Customer — PRD section 5 |
| `Design.jsx` and its route | Customer — PRD 5.1's stories are all "As a homeowner…" |
| `offlineQueue.js`, `public/sw.js`, the offline banner | Site supervisor on a bad connection |
| The "New Site Update" dialog, and `createSiteUpdate` / `WORK_CATEGORIES` / `listMilestoneOptions` with it | Site supervisor — PRD 8.3 "submitted by a site supervisor", 5.2.2 "site supervisor interface", 7.1 gives them an Android-only client |
| `approved -> paid` in `MILESTONE_ACTIONS` | Customer approves the release, in their app |
| "Log Alert" on Alerts | Not in `gggggg.png`; alerts come from the CV model |

**The engine behind the Design screen is deliberately kept** — the customer
app will need exactly it: `src/lib/vastu.js`, `src/lib/planValidation.js`,
`src/lib/planGenerator.js`, `src/components/design/FloorPlanSvg.jsx`,
`src/api/design.js`, and the `floor_plans` table with `select_floor_plan()`.

The database is shared by all three apps, so it is NOT trimmed to match. It
still holds `floor_plans`, the full milestone chain including the customer's
approval, and `profiles.role` for all three personas. Only this app's UI is
manager-only.

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

**The mockup wins.** Decided by the user, and applied throughout:

| Topic | Resolution |
|---|---|
| Gantt palette | Mockup: grey baseline, green done, violet in-progress, red delayed, violet TODAY line |
| Gantt legend | Mockup: Completed / In Progress / Baseline Plan / Forecasted |
| Money format | Mockup: `en-US` grouping (₹12,450,000), NOT Indian (₹1,24,50,000) |
| Category bars (PRD 5.3.5) | Removed — the mockup's card is a donut and legend only |
| Delay Analysis (PRD 5.4.4) | Removed — not in `eeeee.png` |
| Alert times | Mockup: relative ("2 mins ago") |

A mockup showing static demo content is **not** an instruction to keep the
data fake. Match its layout, labels and structure; fill it with real data. The
schema still carries what the removed screens used, so any of it can come back
without a migration.

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
KYC, push notifications, and direct messaging between users. Each is either out
of scope or needs credentials/infrastructure this repo does not have. The
topbar's message icon is honest about this — it says so rather than pretending
to work. See `supabase/README.md` for the one open security decision (the
`profiles` directory is readable by any signed-in user).

## The language picker is live, and translates on the device

Settings' language picker used to be in the list above. It now works, and the
mechanism is worth knowing before adding a string.

There are **no per-language files**. `src/i18n/strings.js` holds the English
text and is the only authored language; `src/i18n/translator.js` produces the
rest at runtime through **Chrome's built-in Translator API** — an on-device
model, no API key, no server, and no text leaving the machine. Project and
client names pass through these screens, so shipping them to a hosted
translation endpoint to localise a button was not the trade to make.

Consequences to design around:

- **Chrome 138+ / Edge 148+, desktop only.** Firefox, Safari and every mobile
  browser have no equivalent, so `canTranslate` is false there and the app
  stays in English and says why. `translateStrings` is the seam a hosted API
  would drop into for those browsers.
- **`Translator.create()` can hang forever** when the model host is
  unreachable — it does not reject. It is raced against a timeout for exactly
  that reason; do not remove it.
- **Placeholders are substituted after translation.** A translation that loses
  a `{name}` is rejected and the English is used, because a mangled
  placeholder renders literal braces at the one spot that names the user.
- Translation is asynchronous and may be partial. `t()` always has an English
  answer and upgrades in place, so nothing ever renders a raw key.

To localise a new string, add it to `strings.js` and call `t('its.key')`. It
is translated into every supported language on the next pass — there is no
second file to edit and nobody needs to write Telugu to ship a button.

**Currently localised:** the sidebar, the topbar (including global search),
every page header, and the whole of Settings. Page *bodies* — tables, dialogs,
form fields on Projects, Finance, Schedule, Construction, Contractors and
Analytics — are still English literals, and become translatable by moving
their text into `strings.js`.

## Images

The sign-in screen's hero photo and the three faces in its "+1,200 project
managers" stack are **hotlinked** (`src/data/media.js`) — Unsplash and
pravatar. That is deliberate and the user asked for it: the screen is
unauthenticated and decorative, it degrades to a neutral placeholder through
`onImageError` when a host is unreachable, and a fresh clone renders correctly
with no build step.

`public/images/` is therefore empty by design. `npm run images` still vendors
those four files for a deployment that would rather serve them locally; point
`media.js` at `/images/…` afterwards.

Every other image in the app comes out of Supabase Storage with the row that
references it. There are no other hard-coded images.
