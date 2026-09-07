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
    /* PRD 8.1's descriptive fields. Carried on every project because the edit
       dialog seeds its form from this shape rather than re-fetching the row. */
    plotAddress: row.plot_address,
    plotLat: row.plot_lat,
    plotLng: row.plot_lng,
    plotFacing: row.plot_facing,
    totalFloors: row.total_floors,
    bhkPerFloor: row.bhk_per_floor,
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
  plot_address, plot_lat, plot_lng, plot_facing, total_floors, bhk_per_floor,
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
  plotAddress,
  plotLat,
  plotLng,
  plotLengthFt,
  plotWidthFt,
  plotFacing,
  totalFloors,
  bhkPerFloor,
  startDate,
  expectedCompletion,
}) {
  requireConfigured()

  /* Goes through the create_project function rather than a plain insert.
     The insert policy requires manager_uid = the caller, which would block
     assigning the project to a different PM — and would let a creator hand a
     project away and lose access to it in the same statement. The function
     runs as definer and always records the creator as a member.

     It also applies the PRD's default templates — cost categories (5.3.2),
     escrow milestones (5.3.3) and the 60-week phase structure (5.4.2) — in
     the same transaction. The phase template used to be seeded from here,
     after the call returned, inside a try/catch that logged and carried on;
     a project could end up with no schedule and nothing would say so. */
  const rows = unwrap(
    await supabase.rpc('create_project', {
      p_project: {
        name,
        client_name: client ?? '',
        customer_uid: customerUid ?? '',
        manager_uid: managerUid ?? '',
        status,
        city: city ?? '',
        plot_address: plotAddress ?? '',
        plot_lat: plotLat ?? '',
        plot_lng: plotLng ?? '',
        plot_length_ft: plotLengthFt ?? '',
        plot_width_ft: plotWidthFt ?? '',
        plot_facing: plotFacing ?? '',
        total_floors: totalFloors ?? '',
        bhk_per_floor: bhkPerFloor ?? '',
        budget_total: budget ?? '',
        start_date: startDate ?? '',
        expected_completion: expectedCompletion ?? '',
      },
    }),
  )

  const created = Array.isArray(rows) ? rows[0] : rows

  /* The function returns the raw row; re-read through the normal select so
     the caller gets the same shape as every other project. */
  return created?.id ? getProject(created.id) : null
}

/**
 * Adds the signed-in user to the seeded demo projects.
 *
 * seed.sql assigns its projects to placeholder profiles, so with membership
 * scoping a real account correctly sees none of them — an empty app on first
 * sign-in, which looks broken even though it is right.
 */
export async function claimDemoProjects() {
  requireConfigured()
  const count = unwrap(await supabase.rpc('claim_demo_projects'))
  return typeof count === 'number' ? count : 0
}

/** Who can see a project, for the member management panel. */
export async function listProjectMembers(projectId) {
  requireConfigured()
  const rows = unwrap(
    await supabase
      .from('project_members')
      .select('member_uid, role, profiles ( full_name, email, avatar_url, role )')
      .eq('project_id', projectId),
  )

  return rows.map((r) => ({
    uid: r.member_uid,
    projectRole: r.role,
    name: r.profiles?.full_name ?? r.member_uid,
    email: r.profiles?.email,
    persona: r.profiles?.role,
    avatar: r.profiles?.avatar_url,
    initials: (r.profiles?.full_name ?? '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join(''),
  }))
}

/** Grants someone access. Only the project's manager may do this. */
export async function addProjectMember(projectId, memberUid, role = 'member') {
  requireConfigured()
  const { data, error } = await supabase
    .from('project_members')
    .insert({ project_id: projectId, member_uid: memberUid, role })
    .select('member_uid')
    .single()

  if (error?.code === '23505') {
    throw new Error('That person is already on this project.')
  }
  if (error?.code === '42501') {
    throw new Error('Only the project manager can add members.')
  }
  return unwrap({ data, error })
}

export async function removeProjectMember(projectId, memberUid) {
  requireConfigured()
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('member_uid', memberUid)

  if (error?.code === '42501') {
    throw new Error('Only the project manager can remove members.')
  }
  unwrap({ data: null, error })
  return { memberUid }
}

/**
 * Editable project details.
 *
 * Deliberately a NARROW whitelist. Three groups of columns are excluded, each
 * for its own reason:
 *
 *   budget_total, start_date, expected_completion
 *     Not descriptive — they are the inputs the project was BUILT from.
 *     apply_project_templates() costed six escrow milestones and six cost
 *     categories from the budget, and due-dated the milestones and the
 *     eleven schedule phases across the dates, all at creation. Editing any
 *     of them here would leave those figures derived from numbers that no
 *     longer exist, which is worse than not editing them at all. Changing
 *     them properly means deciding whether the templates recost, and that is
 *     a separate piece of work.
 *
 *   manager_uid, customer_uid
 *     Access control, not detail: manager_uid is what has_project_access()
 *     and is_project_manager() read. Reassigning a project is a real action
 *     with a real failure mode — handing it away and losing it in the same
 *     statement — and does not belong behind a form labelled "edit details".
 *
 *   status, progress_pct
 *     Already have their own controls on the card, which log their own
 *     activity entries.
 *
 * Only columns that actually changed are written, so a dialog opened and
 * saved untouched is a no-op rather than a write plus a misleading audit row.
 */
const EDITABLE = {
  name: 'name',
  client: 'client_name',
  city: 'city',
  plotAddress: 'plot_address',
  plotLat: 'plot_lat',
  plotLng: 'plot_lng',
  plotFacing: 'plot_facing',
  totalFloors: 'total_floors',
  bhkPerFloor: 'bhk_per_floor',
}

/** Blank means "clear it", except for the name, which a project must have. */
function cleaned(key, value) {
  if (key === 'plotLat' || key === 'plotLng') {
    const n = Number(value)
    return value === '' || value === null || Number.isNaN(n) ? null : n
  }
  if (key === 'bhkPerFloor') {
    const n = Number(value)
    return Number.isFinite(n) && n >= 1 && n <= 4 ? Math.round(n) : null
  }
  const text = typeof value === 'string' ? value.trim() : value
  return text === '' || text === undefined ? null : text
}

export async function updateProjectDetails(projectId, fields, actorUid) {
  requireConfigured()

  const name = fields.name?.trim()
  if (!name) throw new Error('A project needs a name.')

  /* Read first so only genuine changes are written, and so the audit entry
     can name them. */
  const current = unwrap(
    await supabase
      .from('projects')
      .select(Object.values(EDITABLE).join(', '))
      .eq('id', projectId)
      .single(),
  )

  const patch = {}
  const changed = []
  for (const [key, column] of Object.entries(EDITABLE)) {
    if (!(key in fields)) continue
    const next = cleaned(key, fields[key])
    /* Numerics come back as numbers, text as strings; compare loosely so a
       lat re-typed identically does not read as a change. */
    if (String(current[column] ?? '') === String(next ?? '')) continue
    patch[column] = next
    changed.push(column.replace(/_/g, ' '))
  }

  if (!changed.length) return null

  const { data, error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', projectId)
    .select(PROJECT_SELECT)
    .single()

  if (error?.code === '42501') {
    throw new Error('You do not have permission to edit this project.')
  }
  if (error?.code === '23514') {
    throw new Error('One of those values is not allowed. Check facing, floors and BHK.')
  }
  const row = unwrap({ data, error })

  await supabase.from('activity_log').insert({
    project_id: projectId,
    actor_uid: actorUid,
    entity: 'project',
    entity_id: projectId,
    action: 'details_updated',
    summary: `Details updated: ${changed.join(', ')}`,
  })

  return toProject(row)
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
