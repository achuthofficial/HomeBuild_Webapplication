import { supabase, unwrap, requireConfigured } from '@/api/client'

/**
 * Executive Dashboard.
 *
 * The five KPI cards are portfolio-wide counts. They come from the
 * `dashboard_kpis()` SQL function rather than by fetching every project and
 * counting in the browser — one small request regardless of portfolio size,
 * and the definition of "delayed" lives next to the data it describes.
 */
export async function getDashboardKpis() {
  requireConfigured()
  const rows = unwrap(await supabase.rpc('dashboard_kpis'))
  /* An RPC returning a table yields an array of one row. */
  const k = Array.isArray(rows) ? rows[0] : rows

  return {
    activeProjects: k?.active_projects ?? 0,
    delayed: k?.delayed_projects ?? 0,
    openAlerts: k?.open_alerts ?? 0,
    pendingApprovals: k?.pending_approvals ?? 0,
    budgetHealth: k?.budget_health_pct ?? 0,
  }
}

/** The four-row "Project Status Overview" rail. */
export async function getStatusOverview(limit = 4) {
  requireConfigured()
  const rows = unwrap(
    await supabase
      .from('projects')
      .select(`
        id, name, progress_pct, timeline_status,
        project_members ( profiles ( full_name, avatar_url ) )
      `)
      .eq('status', 'active')
      .order('progress_pct', { ascending: false })
      .limit(limit),
  )

  return rows.map((row) => {
    const delayed = row.timeline_status === 'delayed'
    const complete = (row.progress_pct ?? 0) >= 90
    return {
      id: row.id,
      name: row.name,
      progress: row.progress_pct ?? 0,
      /* Delayed rows read "Delayed (32%)" rather than "32% Complete". */
      label: delayed
        ? `Delayed (${row.progress_pct ?? 0}%)`
        : `${row.progress_pct ?? 0}% Complete`,
      tone: delayed ? 'violet' : complete ? 'success' : 'brand',
      team: (row.project_members ?? [])
        .map((m) => m.profiles?.avatar_url)
        .filter(Boolean)
        .slice(0, 3),
    }
  })
}

/** Site Updates rail — the newest few entries across all projects. */
export async function getRecentUpdates(limit = 3) {
  requireConfigured()
  const rows = unwrap(
    await supabase
      .from('site_updates')
      .select(`
        id, work_category, location_on_site, notes, status, uploaded_at,
        projects ( name ),
        supervisor:profiles!site_updates_supervisor_uid_fkey ( full_name ),
        site_update_photos ( storage_path )
      `)
      .order('uploaded_at', { ascending: false })
      .limit(limit),
  )

  const dotFor = { done: 'success', in_progress: 'brand', blocked: 'neutral' }

  return rows.map((row) => ({
    id: row.id,
    dot: dotFor[row.status] ?? 'neutral',
    time: row.uploaded_at,
    site: (row.projects?.name ?? 'General').toUpperCase(),
    title: `${row.work_category} — ${row.location_on_site ?? ''}`.trim(),
    body: row.notes,
    author: row.supervisor?.full_name ?? null,
    photoPath: row.site_update_photos?.[0]?.storage_path ?? null,
  }))
}
