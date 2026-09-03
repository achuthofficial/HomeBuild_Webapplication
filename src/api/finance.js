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

/**
 * Milestone payment workflow (PRD 8.5).
 *
 * The legal transitions are enforced in the database by `advance_milestone`,
 * not here — a milestone cannot be paid before the customer approves, and a
 * client that tries gets an error rather than a silent skip. Timestamps and
 * the payment reference are stamped server-side so they cannot be back-dated.
 */
export const MILESTONE_ACTIONS = {
  upcoming: { next: 'pending_verification', label: 'Submit for Verification' },
  pending_verification: { next: 'approved', label: 'Verify & Approve' },
  approved: { next: 'paid', label: 'Release Payment' },
}

export async function advanceMilestone(milestoneId, nextStatus) {
  requireConfigured()
  const rows = unwrap(
    await supabase.rpc('advance_milestone', {
      p_milestone_id: milestoneId,
      p_next_status: nextStatus,
    }),
  )
  return Array.isArray(rows) ? rows[0] : rows
}

/** Sends an approved milestone back for rework. */
export async function rejectMilestone(milestoneId) {
  return advanceMilestone(milestoneId, 'upcoming')
}

/**
 * "New Invoice" creates the next milestone in the sequence — in PRD terms an
 * invoice IS a milestone release, so this does not invent a parallel concept.
 */
export async function createMilestone({
  projectId,
  name,
  amount,
  dueDate,
  contractorId,
}) {
  requireConfigured()

  /* Append after the current highest sequence. */
  const existing = unwrap(
    await supabase
      .from('milestones')
      .select('sequence')
      .eq('project_id', projectId)
      .order('sequence', { ascending: false })
      .limit(1),
  )
  const nextSequence = (existing[0]?.sequence ?? 0) + 1

  const project = unwrap(
    await supabase
      .from('projects')
      .select('budget_total')
      .eq('id', projectId)
      .single(),
  )

  const releaseAmount = Math.round(Number(amount) || 0)
  const total = Number(project.budget_total) || 0

  return unwrap(
    await supabase
      .from('milestones')
      .insert({
        project_id: projectId,
        sequence: nextSequence,
        name: name.trim(),
        release_amount: releaseAmount,
        /* Derived rather than asked for: the percentage is a function of the
           amount and the budget, so making the user type both invites drift. */
        release_pct: total ? Number(((releaseAmount / total) * 100).toFixed(2)) : null,
        due_date: dueDate || null,
        contractor_id: contractorId || null,
        status: 'pending_verification',
      })
      .select('id, name, sequence')
      .single(),
  )
}

/** Contractors available to bill against, for the invoice dialog. */
export async function listContractorOptions() {
  requireConfigured()
  const rows = unwrap(
    await supabase.from('contractors').select('id, name').order('name'),
  )
  return rows
}
