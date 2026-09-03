import { supabase, unwrap, requireConfigured } from '@/api/client'

/** Financial Overview — KPIs, spend trend, category donut, milestone payments. */

const STATUS_LABELS = {
  upcoming: { label: 'Scheduled', tone: 'neutral' },
  pending_verification: { label: 'Pending Verification', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  paid: { label: 'Paid', tone: 'success' },
}

/** The finance screen is per-project; default to the first active one. */
export async function getPrimaryProjectId() {
  requireConfigured()
  const rows = unwrap(
    await supabase
      .from('projects')
      .select('id, name')
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1),
  )
  return rows[0] ?? null
}

export async function getFinanceSummary(projectId) {
  requireConfigured()
  const row = unwrap(
    await supabase
      .from('projects')
      .select('id, name, budget_total, budget_consumed')
      .eq('id', projectId)
      .single(),
  )

  const total = Number(row.budget_total) || 0
  const consumed = Number(row.budget_consumed) || 0

  return {
    projectName: row.name,
    total,
    consumed,
    remaining: Math.max(0, total - consumed),
    /* Guarded: a project with no budget set would divide by zero. */
    consumedPct: total ? Math.round((consumed / total) * 100) : 0,
  }
}

/** Monthly spend series for the area chart. */
export async function getBudgetTrend(projectId, months = 8) {
  requireConfigured()
  const rows = unwrap(
    await supabase
      .from('budget_entries')
      .select('period, amount')
      .eq('project_id', projectId)
      .order('period', { ascending: false })
      .limit(months),
  )

  /* Fetched newest-first to honour the limit, rendered oldest-first. */
  return rows
    .slice()
    .reverse()
    .map((r) => ({
      month: new Date(r.period)
        .toLocaleDateString('en-US', { month: 'short' })
        .toUpperCase(),
      value: Number(r.amount) || 0,
    }))
}

export async function getCostCategories(projectId) {
  requireConfigured()
  const rows = unwrap(
    await supabase
      .from('cost_categories')
      .select('label, pct, tone, sequence')
      .eq('project_id', projectId)
      .order('sequence', { ascending: true }),
  )
  return rows.map((r) => ({
    label: r.label,
    value: Number(r.pct),
    tone: r.tone ?? 'brand',
  }))
}

export async function listMilestones(projectId) {
  requireConfigured()
  const rows = unwrap(
    await supabase
      .from('milestones')
      .select('id, sequence, name, release_amount, due_date, status, contractors ( name )')
      .eq('project_id', projectId)
      .order('sequence', { ascending: true }),
  )

  return rows.map((r) => ({
    id: r.id,
    milestone: r.name,
    contractor: r.contractors?.name ?? 'Unassigned',
    dueDate: r.due_date,
    amount: Number(r.release_amount) || 0,
    status: STATUS_LABELS[r.status] ?? STATUS_LABELS.upcoming,
    statusKey: r.status,
  }))
}
