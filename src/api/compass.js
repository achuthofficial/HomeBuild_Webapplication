import { supabase, unwrap, requireConfigured } from '@/api/client'

/**
 * The Compass home screen — PRD section 5.
 *
 * "Upon login, the customer sees a project header (project name, location,
 * plot size, configuration), a status badge (active/paused/completed), and
 * four large circular buttons arranged in cardinal positions around a central
 * HomeBuild branded orb... The home screen also displays summary KPIs
 * (overall completion %, days remaining, current phase)."
 *
 * One query per fact, in parallel, rather than one wide join: the current
 * phase and the open-alert count come from different tables with different
 * filters, and a join would fan the project row out across both.
 */
export async function getCompass(projectId) {
  requireConfigured()

  const [project, phases, alerts, plan] = await Promise.all([
    supabase
      .from('projects')
      .select(
        'id, name, city, plot_address, status, progress_pct, ' +
          'plot_length_ft, plot_width_ft, plot_facing, total_floors, ' +
          'bhk_per_floor, start_date, expected_completion',
      )
      .eq('id', projectId)
      .single()
      .then(unwrap),
    supabase
      .from('schedule_phases')
      .select('name, status, sequence')
      .eq('project_id', projectId)
      .order('sequence', { ascending: true })
      .then(unwrap),
    supabase
      .from('ai_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .in('status', ['new', 'acknowledged', 'assigned']),
    supabase
      .from('floor_plans')
      .select('name')
      .eq('project_id', projectId)
      .eq('is_selected', true)
      .maybeSingle()
      .then(({ data }) => data),
  ])

  /* "Current phase" is the one in progress. Falling back to the first phase
     not yet done keeps the label useful before work starts, rather than
     showing nothing on a project that simply has not begun. */
  const current =
    phases.find((p) => p.status === 'in_progress') ??
    phases.find((p) => p.status !== 'done') ??
    null

  const days = project.expected_completion
    ? Math.round(
        (new Date(`${project.expected_completion}T00:00:00`) - new Date()) /
          86400000,
      )
    : null

  const length = project.plot_length_ft
  const width = project.plot_width_ft

  return {
    id: project.id,
    name: project.name,
    /* The PRD asks for "location". A street address is more useful than a
       city when there is one, so prefer it and fall back. */
    location: project.plot_address || project.city || 'Location not set',
    status: project.status,
    plotSize: length && width ? `${length} × ${width} ft` : null,
    plotArea: length && width ? length * width : null,
    facing: project.plot_facing,
    configuration: [
      project.total_floors,
      project.bhk_per_floor ? `${project.bhk_per_floor} BHK` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    selectedPlan: plan?.name ?? null,
    progress: project.progress_pct ?? 0,
    /* Negative means overdue; the UI says so rather than showing "-12 days
       remaining", which reads like a bug. */
    daysRemaining: days,
    currentPhase: current?.name ?? null,
    phasesDone: phases.filter((p) => p.status === 'done').length,
    phaseCount: phases.length,
    openAlerts: alerts.count ?? 0,
    expectedCompletion: project.expected_completion,
  }
}
