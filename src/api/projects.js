import { supabase, unwrap, requireConfigured } from '@/api/client'

/**
 * Projects — the portfolio screen and the dashboard's status rail.
 *
 * Every function returns UI-shaped objects rather than raw rows: the mapping
 * from database vocabulary (`timeline_status: 'on_track'`) to presentation
 * (`{ label: 'On Track', tone: 'success' }`) lives here, in one place, instead
 * of being repeated in each component that renders a chip.
 */

const TIMELINE_LABELS = {
  on_track: { label: 'On Track', tone: 'success' },
  ahead: { label: 'Ahead', tone: 'success' },
  /* The mockup renders "Delayed" with no dot — tone 'none' is that variant. */
  delayed: { label: 'Delayed', tone: 'none' },
  at_risk: { label: 'Risk Level: High', tone: 'warning' },
}

const BUDGET_LABELS = {
  on_budget: { label: 'On Budget', tone: 'success' },
  review_required: { label: 'Review Req.', tone: 'warning' },
  over_budget: { label: 'Over Budget', tone: 'danger' },
}

/** Row → the shape the portfolio card and dashboard row expect. */
function toProject(row) {
  const members = (row.project_members ?? [])
    .map((m) => m.profiles)
    .filter(Boolean)

  return {
    id: row.id,
    name: row.name,
    client: row.client_name ?? '—',
    city: row.city,
    manager: row.manager?.full_name ?? 'Unassigned',
    managerUid: row.manager_uid,
    status: row.status,
    progress: row.progress_pct ?? 0,
    budgetTotal: row.budget_total ?? 0,
    budgetConsumed: row.budget_consumed ?? 0,
    budgetStatus: BUDGET_LABELS[row.budget_status] ?? BUDGET_LABELS.on_budget,
    timeline: TIMELINE_LABELS[row.timeline_status] ?? TIMELINE_LABELS.on_track,
    timelineKey: row.timeline_status,
    estimate: row.expected_completion,
    startDate: row.start_date,
    /* Avatar stacks show at most three faces plus a +N counter. */
    team: members.slice(0, 3).map((m) => m.avatar_url).filter(Boolean),
    teamNames: members.map((m) => m.full_name),
    extraTeam: Math.max(0, members.length - 3),
  }
}

/* Selecting members and the manager in one round trip rather than N+1. */
const PROJECT_SELECT = `
  id, name, client_name, city, status, progress_pct,
  budget_total, budget_consumed, budget_status, timeline_status,
  start_date, expected_completion, manager_uid,
  manager:profiles!projects_manager_uid_fkey ( full_name, avatar_url ),
  project_members ( profiles ( full_name, avatar_url ) )
`

export async function listProjects() {
  requireConfigured()
  const rows = unwrap(
    await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .order('created_at', { ascending: true }),
  )
  return rows.map(toProject)
}

/** Distinct values for the portfolio's Status / City / PM filters. */
export async function listProjectFilters() {
  requireConfigured()
  const rows = unwrap(
    await supabase
      .from('projects')
      .select('city, manager:profiles!projects_manager_uid_fkey ( full_name )'),
  )

  const cities = [...new Set(rows.map((r) => r.city).filter(Boolean))].sort()
  const managers = [
    ...new Set(rows.map((r) => r.manager?.full_name).filter(Boolean)),
  ].sort()

  return {
    status: ['All Projects', 'On Track', 'Delayed', 'At Risk', 'Ahead'],
    city: ['All Locations', ...cities],
    manager: ['All Managers', ...managers],
  }
}

export async function getProject(id) {
  requireConfigured()
  const row = unwrap(
    await supabase.from('projects').select(PROJECT_SELECT).eq('id', id).single(),
  )
  return toProject(row)
}

/**
 * Creates a project from the topbar dialog. Only the fields that dialog
 * collects; everything else takes its column default.
 */
export async function createProject({ name, client, city, budget, managerUid }) {
  requireConfigured()
  const row = unwrap(
    await supabase
      .from('projects')
      .insert({
        name,
        client_name: client || null,
        city: city || null,
        budget_total: budget ? Number(budget) : 0,
        manager_uid: managerUid ?? null,
        status: 'lead',
      })
      .select(PROJECT_SELECT)
      .single(),
  )
  return toProject(row)
}
