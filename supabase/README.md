# Database setup

Every screen in HomeBuild now reads from Supabase. Authentication stays with
Firebase — Supabase holds the data and the files.

## Run these two files

In the Supabase dashboard, open **SQL Editor** and run, in order:

1. **`schema.sql`** — tables, indexes, the `dashboard_kpis()` aggregate, and
   Row Level Security policies.
2. **`seed.sql`** — dummy data matching what the UI used to show: 12 projects,
   6 contractors, 128 alerts, milestones, schedule phases and spend history.

Both are safe to re-run. The seed upserts on stable ids, and the alert filler
only generates on a fresh database rather than doubling each time.

The last statement in `seed.sql` prints a count. Expect:

```
 projects | contractors | alerts | milestones | phases
       12 |           6 |    128 |          5 |      9
```

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
| `floor_plans` | 8.2 | Design module (not yet built) |
| `site_updates` + `site_update_photos` | 8.3 | Daily Site Feed |
| `ai_alerts` | 8.4 | Alert Management |
| `milestones` | 8.5 | Finance payments table |
| `profiles` | §4 personas | Settings, team lists, avatars |
| `contractors` | goal 4 | Contractor Management |
| `schedule_phases` | 5.4.2 | Gantt, list and board views |
| `budget_entries`, `cost_categories` | — | Trend chart, category donut |

Money is stored in **rupees**, not lakhs. The UI formats to ₹ / L / Cr at the
edge, and keeping the base unit avoids rounding drift between screens that
show the same figure at different magnitudes.

## Two things to know before this goes near real customers

**Reads are open to any signed-in user.** There is no organisation or
project-membership table yet, so every authenticated account can read every
project, alert and site photo. That is correct for an internal single-tenant
tool and wrong for anything multi-tenant. The place to fix it is the
`"signed-in read"` policies in `schema.sql` — replace `is_signed_in()` with a
join against membership.

**Seeded profiles are placeholders.** Rows prefixed `seed-` exist so team
stacks and assignments point at something. Real rows are created on first
sign-in, keyed on the actual Firebase UID, so they can never collide. Delete
the seeded ones once you have real users.

## Where the queries live

`src/api/` is the data layer — one module per domain, each returning
UI-shaped objects rather than raw rows, so the mapping from
`timeline_status: 'on_track'` to a green "On Track" chip happens in one place
instead of in every component that renders one.

`src/hooks/useQuery.js` handles loading, errors and refetch. It guards against
the two things a naive `useEffect` gets wrong: a slow response overwriting a
newer one, and setting state after unmount.
