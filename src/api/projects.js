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
 * Creates a project with the full PRD 8.1 field set.
 *
 * A new project also gets the default construction phases from PRD 5.4.2, so
 * its Gantt is populated from the start rather than being an empty chart the
 * user has to fill in before the Schedule screen means anything.
 */
export async function createProject({
  name,
  client,
  city,
  budget,
  managerUid,
  customerUid,
  status = 'lead',
  plotLat,
  plotLng,
  plotAddress,
  plotLengthFt,
  plotWidthFt,
  plotFacing,
  totalFloors,
  bhkPerFloor,
  startDate,
  expectedCompletion,
  seedPhases = true,
}) {
  requireConfigured()

  const row = unwrap(
    await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        client_name: client?.trim() || null,
        city: city || null,
        budget_total: budget ? Math.round(Number(budget)) : 0,
        manager_uid: managerUid ?? null,
        /* PRD 8.1 models Customer as a link to the homeowner's profile, not a
           name — client_name stays alongside it for the display label on the
           portfolio card. */
        customer_uid: customerUid || null,
        plot_address: plotAddress?.trim() || null,
        plot_lat: plotLat ? Number(plotLat) : null,
        plot_lng: plotLng ? Number(plotLng) : null,
        plot_length_ft: plotLengthFt ? Number(plotLengthFt) : null,
        plot_width_ft: plotWidthFt ? Number(plotWidthFt) : null,
        plot_facing: plotFacing || null,
        total_floors: totalFloors || null,
        bhk_per_floor: bhkPerFloor ? Number(bhkPerFloor) : null,
        start_date: startDate || null,
        expected_completion: expectedCompletion || null,
        /* PRD 8.1 lifecycle. Defaults to `lead`, but a project migrated from
           elsewhere may legitimately start further along. */
        status,
      })
      .select(PROJECT_SELECT)
      .single(),
  )

  if (seedPhases) {
    /* Non-fatal: a project without phases is still usable, and failing the
       whole creation over the template would be worse than an empty Gantt. */
    try {
      await seedDefaultPhases(row.id, budget ? Number(budget) : 0)
    } catch (error) {
      console.error('[projects] could not seed default phases', error)
    }
  }

  /* The creator is a member, so the project is not team-less on day one. */
  if (managerUid) {
    await supabase
      .from('project_members')
      .insert({ project_id: row.id, member_uid: managerUid, role: 'manager' })
      .then(null, () => {})
  }

  return toProject(row)
}

/**
 * The 60-week template from PRD 5.4.2, compressed onto the 12-week window the
 * Gantt draws. Costs are the PRD's proportions applied to the actual budget,
 * so a ₹50L project does not inherit the document's ₹87L example figures.
 */
const PHASE_TEMPLATE = [
  ['Site Preparation',      '1. Foundations',           0.0,  0.4,  2.5],
  ['Foundation',            '1. Foundations',           0.4,  1.6,  8.5],
  ['Ground Floor Structure','2. Structural Framing',    1.6,  3.2, 14.0],
  ['First Floor Structure', '2. Structural Framing',    3.2,  4.8, 14.0],
  ['Roof Slab',             '2. Structural Framing',    4.8,  6.0, 10.0],
  ['Brick & Block Work',    '3. MEP Installation',      6.0,  7.6,  7.0],
  ['Plastering',            '3. MEP Installation',      7.6,  8.8,  5.0],
  ['MEP Works',             '3. MEP Installation',      7.6,  9.2, 14.0],
  ['Flooring & Tiling',     '4. Interior Finishing',    8.8, 10.4,  6.0],
  ['Painting & Finishing',  '4. Interior Finishing',   10.4, 11.6,  5.0],
  ['Final Handover',        '4. Interior Finishing',   11.6, 12.0,  1.0],
]

/** Template costs total ₹91L in the PRD; used to scale to the real budget. */
const TEMPLATE_TOTAL_LAKH = PHASE_TEMPLATE.reduce((sum, p) => sum + p[4], 0)

async function seedDefaultPhases(projectId, budgetTotal) {
  const rows = PHASE_TEMPLATE.map(([name, group, start, end, lakh], i) => ({
    project_id: projectId,
    sequence: i + 1,
    name,
    phase_group: group,
    baseline_start_week: start,
    baseline_end_week: end,
    cost: budgetTotal
      ? Math.round((lakh / TEMPLATE_TOTAL_LAKH) * budgetTotal)
      : Math.round(lakh * 100000),
    status: 'queued',
  }))

  return unwrap(await supabase.from('schedule_phases').insert(rows).select('id'))
}

/**
 * Live progress tracking.
 *
 * progress_pct is normally derived from completed phases by a database
 * trigger. This is the manual override for a PM who knows better than the
 * phase data — it writes the figure directly and records who did.
 */
export async function updateProjectProgress(projectId, progressPct, actorUid) {
  requireConfigured()

  const pct = Math.max(0, Math.min(100, Math.round(Number(progressPct) || 0)))

  const row = unwrap(
    await supabase
      .from('projects')
      .update({ progress_pct: pct })
      .eq('id', projectId)
      .select(PROJECT_SELECT)
      .single(),
  )

  await supabase.from('activity_log').insert({
    project_id: projectId,
    actor_uid: actorUid,
    entity: 'project',
    entity_id: projectId,
    action: 'progress_updated',
    summary: `Progress set to ${pct}%`,
  })

  return toProject(row)
}

/** Status, timeline and budget flags — the chips on the portfolio card. */
export async function updateProjectStatus(
  projectId,
  { status, timelineStatus, budgetStatus },
  actorUid,
) {
  requireConfigured()

  const patch = {}
  if (status) patch.status = status
  if (timelineStatus) patch.timeline_status = timelineStatus
  if (budgetStatus) patch.budget_status = budgetStatus

  /* A completed project gets its actual completion date stamped, which is the
     field PRD 8.1 says is filled in on handover. */
  if (status === 'completed') {
    patch.actual_completion = new Date().toISOString().slice(0, 10)
  }

  const row = unwrap(
    await supabase
      .from('projects')
      .update(patch)
      .eq('id', projectId)
      .select(PROJECT_SELECT)
      .single(),
  )

  await supabase.from('activity_log').insert({
    project_id: projectId,
    actor_uid: actorUid,
    entity: 'project',
    entity_id: projectId,
    action: 'status_changed',
    summary: `Project updated: ${Object.entries(patch)
      .map(([k, v]) => `${k.replace(/_/g, ' ')} → ${v}`)
      .join(', ')}`,
  })

  return toProject(row)
}
