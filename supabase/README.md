# Database setup

Every screen in HomeBuild now reads from Supabase. Authentication stays with
Firebase — Supabase holds the data and the files.

## Which files to run

In the Supabase dashboard, open **SQL Editor**.

### Starting clean — the fast path

If the data in this database is expendable (a prototype, or anything that came
from `seed.sql` in the first place), rebuild rather than repair:

```
1. reset.sql    -- DELETES every HomeBuild table and its rows
2. schema.sql
3. seed.sql
```

`reset.sql` does not touch **uploaded files** — storage buckets and their
objects are left alone, so avatars and site photos survive — and it does not
touch **Firebase**, so no account, password or sign-in provider is affected.

### Keeping the data — the in-place path

```
1. schema.sql   -- repairs an existing database, then brings it up to date
2. seed.sql     -- optional; demo data only
```

`schema.sql` reconciles missing columns, key columns, column types, missing
defaults and duplicate rows, and tells you what it changed. Use this once the
database holds anything real. If it hits a shape it cannot repair, it says
which table and column rather than failing obscurely — and `reset.sql` is the
fallback.

**What each file is:** `schema.sql` — tables, indexes, the `dashboard_kpis()`
aggregate, workflow functions and Row Level Security. `seed.sql` — demo data:
12 projects, 6 contractors, 128 alerts, milestones, schedule phases and spend
history.

Both are safe to re-run. The seed upserts on stable ids, and the alert filler
only generates on a fresh database rather than doubling each time.

The last statement in `seed.sql` prints a count. Expect:

```
 projects | contractors | alerts | milestones | phases | expenses
       12 |           6 |    128 |         65 |    130 |        5
```

The milestone and phase counts are higher than they used to be because the
seed now applies the PRD's default templates to *every* demo project, not just
the first. Before, opening any project but Sky Villa 42 showed an empty
Finance page and an empty Gantt.

## Prerequisite: the Firebase bridge

The policies key on `auth.jwt() ->> 'sub'`, which only has a value once
Supabase is configured to trust your Firebase project as a third-party auth
issuer. That is the same setup Storage already needs — see `STORAGE_SETUP.md`
section 2.

Without it every query is anonymous and returns nothing. The symptom is
"You do not have permission to read this" on every screen while the app is
otherwise working.

## What is modelled

The five entities from PRD section 8, plus what the interface needs:

| Table | PRD | Feeds |
|---|---|---|
| `projects` | 8.1 | Portfolio, dashboard rail, finance |
| `floor_plans` | 8.2 | Design module — plan options and selection |
| `site_updates` + `site_update_photos` | 8.3 | Daily Site Feed |
| `ai_alerts` | 8.4 | Alert Management |
| `milestones` | 8.5 | Finance payments table |
| `profiles` | §4 personas | Settings, team lists, avatars |
| `contractors` | goal 4 | Contractor Management |
| `schedule_phases` | 5.4.2 | Gantt, list and board views |
| `expenses` | 5.3.5 | The spend ledger — category bars, trend chart, consumption KPI |
| `cost_categories` | 5.3.2 | Category budget-vs-spent bars and the donut |
| `budget_entries` | — | Legacy monthly series; only a fallback for demo projects |
| `invitations` | §4 personas | Team invites on Settings |
| `activity_log` | audit fields | Audit log, payment ledger |

Money is stored in **rupees**, not lakhs. The UI formats to ₹ / L / Cr at the
edge, and keeping the base unit avoids rounding drift between screens that
show the same figure at different magnitudes.

## PRD field alignment

Checked field by field against the PRD's entity tables. Every column exists;
this records which are collected in the UI and which are set by the system.

**8.1 Project** — all 15 fields present.

| PRD field | Column | Where it comes from |
|---|---|---|
| Project Name | `name` | Create dialog |
| Customer | `customer_uid` | Create dialog — a **link** to a homeowner's profile |
| Project Manager | `manager_uid` | Create dialog, defaults to the creator |
| Status | `status` | Create dialog (Lead / In Design / Active) |
| Plot Address | `plot_address` | Create dialog |
| Plot Coordinates | `plot_lat`, `plot_lng` | Create dialog, optional |
| Plot Length & Width | `plot_length_ft`, `plot_width_ft` | Create dialog |
| Plot Facing | `plot_facing` | Create dialog |
| Total Floors | `total_floors` | Create dialog |
| BHK per Floor | `bhk_per_floor` | Create dialog |
| Selected Plan | `floor_plans.is_selected` | Design module — see the deviation note in `schema.sql` |
| Budget Total | `budget_total` | Create dialog |
| Start Date | `start_date` | Create dialog |
| Expected Completion | `expected_completion` | Create dialog |
| Actual Completion | `actual_completion` | Stamped automatically on handover |

**8.3 Site Update** — all 9 fields present, including the optional Milestone
Reference. Supervisor and Uploaded At are set by the system rather than typed.

**8.5 Milestone** — all 10 fields present, including the Verification Criteria
from 5.3.3, so the PM verifying a release reads the same condition the customer
agreed to. Release Percentage is *derived* from the amount against the project
budget rather than entered, so the two cannot disagree. PM verification, customer approval and the transaction id are
stamped server-side by `advance_milestone`.

### Two places the implementation differs from the document, on purpose

**Budget is stored in rupees, not lakhs.** PRD 8.1 says "in Indian Lakhs".
Storing the base unit avoids rounding drift between screens that show the same
figure at different magnitudes (₹ / L / Cr). The create dialog shows the lakh
equivalent live as you type, so the PRD's unit is still what you read.

**Selected Plan lives on the plan, not the project.** See the note in
`schema.sql` — one home for the fact, rather than two that can disagree.

## Every project starts with the PRD's templates

`create_project()` calls `apply_project_templates()` in the same transaction,
which applies all three fixed tables from the document:

- **5.3.2** — the six cost categories, at 48 / 20 / 10 / 9 / 7 / 6 %. The
  document gives ranges; those are the only figures inside every range that
  also sum to 100.
- **5.3.3** — the six escrow milestones with their release percentages and
  verification criteria, due-dated across the project's own start and finish.
- **5.4.2** — the eleven-phase, 60-week construction schedule, scaled onto the
  12-week window the Gantt draws, with each phase's cost taken as the
  document's proportion of *this* project's budget.

Two details worth knowing:

**Amounts are cumulative-rounded.** Rounding each percentage on its own leaves
the rows summing to a rupee or two either side of the budget — invisible in any
one row and wrong in the total. Each amount is the difference between
successive cumulative roundings, so all three tables add to the budget exactly.

**The phase template used to run in the browser**, after `create_project`
returned, inside a `try/catch` that logged the failure and carried on. A
project could be created with no schedule at all and nothing would say so.

## The spend ledger

`expenses` is where money leaving the project is recorded, and it is the
single source for three things that used to disagree or sit empty:

- the **category bars** (PRD 5.3.5's first acceptance criterion — budget vs
  spent per category, which the donut alone never showed: it only ever drew
  the *plan*),
- the **budget consumption trend**, which read `budget_entries` — a table
  nothing in the app ever wrote, so the chart was permanently empty on any
  real project,
- the project's **`budget_consumed`**, recalculated by trigger.

Paying a milestone posts its own ledger line, so escrow releases and direct
spending are counted once each in the same place rather than tracked
separately. That line is written by `post_milestone_expense()`, a
`SECURITY DEFINER` helper, because the RLS policy deliberately forbids a member
from inserting a row that claims a milestone — escrow lines must come from the
payment workflow, not from a client.

## Escrow release rules (PRD 5.3.4)

A milestone moves `upcoming → pending_verification → approved → paid`, and the
database refuses any other transition.

Above **₹5,00,000** a release needs a second sign-off before payment, and
`second_approve_milestone()` refuses it from the person who verified the
milestone. Dual approval that one account can satisfy twice is a log entry,
not a control. The threshold is a function (`dual_approval_threshold()`)
rather than a literal, because it is a policy number and policy numbers move.

Paying a milestone stamps `paid_at`, mints a payment reference, posts the
ledger line, and writes an audit entry — all server-side, so none of it can be
back-dated by a client.

**Not implemented: KYC and bank verification.** 5.3.4 lists them under the
payment provider, and there is no provider connected — a KYC step that
verifies nothing would be worse than none. Payment references are prefixed
`SIM-` and every receipt says so on its face.

## Workflow rules live in SQL, not the client

Five functions enforce the parts that must not be bypassed by a client bug:

- **`advance_milestone`** — the PRD 8.5 payment chain. A milestone cannot be
  paid before the customer approves, nor approved before the PM verifies.
  Timestamps and the payment reference are stamped server-side.
- **`resolve_alert`** — the PRD 8.4 alert workflow, with its own audit entry.
- **`apply_schedule_forecast`** — the rule-based part of PRD 5.4.3, and now
  all three of its rules: cumulative delay pushed into later phases, the
  monsoon buffer for weeks 22–36, and rework days for every open high-severity
  alert. The document says "3–7 days" without saying how to choose inside the
  range, so the severity chooses — High takes 3, Critical takes 7. Resolved
  alerts are excluded: their rework already shows as real delay on the phase,
  and counting them here would charge the schedule twice.
- **`post_milestone_expense`** — posts the ledger line for a paid milestone.
- **`second_approve_milestone`** — PRD 5.3.4's second sign-off, refused from
  the verifier.

Two triggers keep derived figures honest. Changing a phase's status or paying
a milestone recalculates the project's `progress_pct` and `budget_consumed`,
so the dashboard KPIs cannot drift away from the detail screens. Progress is
weighted by phase cost, not a plain count — a long cheap phase should not
count the same as the structure.

Re-running `schema.sql` is how you upgrade: every statement is idempotent.

## Who can see what

Access is scoped by **project membership**, not per-user silos. You reach a
project if you are its **manager**, its **customer**, or a listed **member** —
and everything hanging off it (site updates, alerts, milestones, phases,
budget lines, photos, activity) inherits that scope automatically.

Silos would have been the wrong model. PRD section 4 has three personas who
need the *same* project: the homeowner tracking it, the PM running it, and the
supervisor posting to it. What has to be private is one project from another,
not one person from another.

Two directories stay readable by every signed-in user, deliberately:
`profiles` and `contractors`. You cannot assign a PM, invite a colleague or
pick a contractor you are unable to see, and a name and trade are not
sensitive the way a client's budget is. Writes on both remain restricted.

### Two implementation details that matter

**`has_project_access()` is `SECURITY DEFINER`, and has to be.** It is called
from the policy *on* `project_members`; running as the caller would re-enter
that policy, call the function again, and recurse until Postgres rejects the
query. It takes a project id and returns a boolean, so it cannot be coaxed
into leaking rows.

**Project creation goes through `create_project()`, not a plain INSERT.** The
insert policy requires `manager_uid = you`, which is right for the common case
but blocks assigning the project to a different PM — and would let a creator
hand a project away and lose access to it in the same statement. The function
runs as definer, sets any manager, and always records the creator as a member.

### Upgrading a database that already had data

`schema.sql` repairs as it runs, and says what it touched. Watch for these
notices:

```
NOTICE:  schedule_phases: removed 11 duplicate row(s), renumbered 0
NOTICE:  restored 2 missing column default(s)
```

It reconciles three things an existing database can get wrong, none of which
`create table if not exists` can fix on its own:

| Symptom | What the script does |
|---|---|
| `ERROR: 42703: column "city" does not exist` | Adds every missing column |
| `ERROR: 23505: could not create unique index` | De-duplicates first — see below |
| `ERROR: null value in column "id"` | Restores `gen_random_uuid()` / `now()` defaults |

De-duplication loses nothing that cannot be proven redundant. Rows identical in
both key and name are an accidental double-insert and all but the oldest go;
rows that merely collide on a sequence are different records claiming one slot,
so they are renumbered instead. Superseded invitations are revoked rather than
deleted, because who invited whom is audit history.

**After upgrading, projects that predate the membership model are invisible.**
That is Row Level Security working — you reach a project by being its manager,
its customer, or a listed member, and a project imported from an older schema
is none of those. To adopt them, run this once with your own Firebase UID
(Settings shows it, or read it from `profiles`):

```sql
insert into public.project_members (project_id, member_uid, role)
select p.id, 'YOUR_FIREBASE_UID', 'manager'
from public.projects p
where not exists (
  select 1 from public.project_members m where m.project_id = p.id
)
on conflict do nothing;
```

Deliberately not shipped as a function: it grants access to every unowned
project, which is fine when you run it by hand on your own database and is not
something any signed-in user should be able to call.

### First sign-in looks empty, and that is correct

`seed.sql` assigns its projects to placeholder `seed-` profiles, so a real
account sees none of them. The Projects screen offers **Join the demo
projects**, or run it directly:

```sql
select public.claim_demo_projects();
```

Delete the seeded profiles once you have real users.

## Still to do before real customers

**There is no organisation layer, and this is the one real gap left.**
Membership isolates project from project, which is the important half. What it
does not do is stop a signed-in stranger reading the full `profiles`
directory — names, emails and phone numbers of people they share no project
with.

This is deliberately left rather than guessed at: the PRD defines no tenancy
model, and the fix is a product decision, not a mechanical one. The three
options, in ascending order of work:

1. Revoke `email` and `phone` from the table grant and serve them through a
   definer function that checks for a shared project. Smallest change; keeps
   every assignment picker working, since those need only name and role.
2. Scope `profiles` reads to "shares a project with me". Tightest, but a newly
   hired PM becomes invisible to the person who needs to assign them.
3. A real `organisations` table with a tenant id on `profiles`, `projects`,
   `contractors` and `invitations`, and every directory policy scoped to it.
   Correct for a multi-tenant product, and the largest change.

`contractors` staying readable is a separate and deliberate call — PRD goal 4
describes a shared vetted network, and a name and trade are not sensitive the
way a client's budget is.

**Seeded profiles are placeholders.** Rows prefixed `seed-` exist so team
stacks and assignments point at something. Real rows are created on first
sign-in, keyed on the actual Firebase UID, so they can never collide. Delete
the seeded ones once you have real users.

## No screen reads fixture data any more

`src/data/` used to hold a mock record for every screen. Those files are gone
— the directory now contains only UI configuration (navigation, the Gantt
legend, the auth illustration). What that removed, specifically:

- a fixed `92%` Schedule Health with a milestone called "Framing Completion",
- a Workforce card reading "24 Carpenters / 12 MEP Staff / 8 Excavation" and
  an "Optimization Active" panel that was neither,
- a Timeline Pulse rail naming three people who are not in the database,
- an "AI Insights" rail with two invented findings whose buttons admitted they
  were not wired up,
- an Activity Breakdown of four fixed percentages, identical on every project,
- `activeProjects: 12` and `teamsLed: '04'` shown under the signed-in user's
  own name and photo on Settings,
- a "TODAY" line on the Gantt frozen at `OCT 18`,
- page headers naming "Project Alpha", "Sky Villa 42" and "Phase 2:
  Structural Integrity" regardless of what was loaded.

Each is now derived: headcount from the `workers_present` a supervisor
actually recorded, the pulse rail from `activity_log`, the findings rail from
open alerts, the counters from `projects`, and the today marker from the
project's start date.

## Offline capture (PRD 5.2.5)

Site updates survive a dead connection, which for the supervisor persona —
"poor internet connectivity at most sites" — is the difference between an app
that gets used and one that does not.

- `src/lib/offlineQueue.js` queues updates in **IndexedDB** (not localStorage:
  the queue holds photo Blobs).
- `public/sw.js` caches the app shell so the app *loads* with no signal. It
  deliberately leaves Supabase and Firebase requests alone — the queue depends
  on seeing a real network error, and a worker quietly serving a stale API
  response would make the screen look right while being wrong.
- `site_updates.client_token` makes the retry idempotent. The queue is
  at-least-once by nature (it sends, then deletes); a reload timed between
  those two steps posted the same update twice before this existed.

The unique index on `client_token` is deliberately **not partial**. Postgres
can only infer a partial index as an `ON CONFLICT` target if the statement
repeats the predicate, and PostgREST's upsert does not — so the retry would
have failed rather than collapsing. NULLs are distinct in a unique index
anyway, so updates posted while online never collide.

## Where the queries live

`src/api/` is the data layer — one module per domain, each returning
UI-shaped objects rather than raw rows, so the mapping from
`timeline_status: 'on_track'` to a green "On Track" chip happens in one place
instead of in every component that renders one.

`src/hooks/useQuery.js` handles loading, errors and refetch. It guards against
the two things a naive `useEffect` gets wrong: a slow response overwriting a
newer one, and setting state after unmount.
