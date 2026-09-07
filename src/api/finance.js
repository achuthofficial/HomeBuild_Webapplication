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

/**
 * Which project a per-project screen (Finance, Schedule) should show.
 *
 * A manager with more than one active project used to have no way to look at
 * anything but the oldest one — Finance and Schedule always called
 * `getPrimaryProjectId()` with nothing able to override it, so every
 * project's "Finance" and "Schedule" opened onto the same figures. The
 * project switcher on those screens, and a link from the Projects card, both
 * name a project through this instead.
 *
 * `requestedId` wins when it is a project this account can actually open —
 * checked by asking for it rather than trusting the caller, since Row Level
 * Security is what decides that, not this function. A stale link (the
 * project was deleted, or membership was removed) falls back to the old
 * default rather than showing an error for a screen that can still be useful.
 */
export async function resolveProjectRef(requestedId) {
  requireConfigured()
  if (requestedId) {
    const rows = unwrap(
      await supabase
        .from('projects')
        .select('id, name')
        .eq('id', requestedId)
        .limit(1),
    )
    if (rows[0]) return rows[0]
  }
  return getPrimaryProjectId()
}

export async function getFinanceSummary(projectId) {
  requireConfigured()

  /* First of this month and of last month, local time — the ledger stores a
     plain date, so comparing against a UTC instant would misfile spending on
     the first or last day of a month for anyone east of Greenwich. */
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`

  const [row, recent] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, budget_total, budget_consumed')
      .eq('id', projectId)
      .single()
      .then(unwrap),
    /* Only the two months the cards compare, not the whole ledger. */
    supabase
      .from('expenses')
      .select('amount, incurred_on')
      .eq('project_id', projectId)
      .gte('incurred_on', iso(prevStart))
      .then(unwrap),
  ])

  const total = Number(row.budget_total) || 0
  const consumed = Number(row.budget_consumed) || 0

  const monthStartIso = iso(monthStart)
  let thisMonth = 0
  let lastMonth = 0
  for (const e of recent) {
    const amount = Number(e.amount) || 0
    if (e.incurred_on >= monthStartIso) thisMonth += amount
    else lastMonth += amount
  }

  return {
    projectName: row.name,
    total,
    consumed,
    remaining: Math.max(0, total - consumed),
    /* Guarded: a project with no budget set would divide by zero. */
    consumedPct: total ? Math.round((consumed / total) * 100) : 0,

    /* Spend recorded so far in the current calendar month, and the same for
       the month before it. The KPI row used to carry `delta: 2.4` and
       `delta: -1.2` as literals — numbers that never moved and described
       nothing. These are what the cards show instead.

       `drawdownPct` is what the Remaining card reports: the share of the whole
       budget consumed this month, negative because remaining is what falls.
       Null when there is nothing to say — no budget set, or no spending
       recorded this month — so the card renders no figure rather than a
       confident 0.0%. */
    thisMonth,
    lastMonth,
    drawdownPct:
      total && thisMonth > 0
        ? -Math.round((thisMonth / total) * 1000) / 10
        : null,
  }
}

/**
 * Monthly spend series for the area chart.
 *
 * Built from the expense ledger, so it moves when money actually moves. It
 * used to read `budget_entries`, which nothing in the app ever wrote — the
 * chart was permanently empty on any real project and only ever showed the
 * seeded demo data. That table is still the fallback, so those demo projects
 * keep their history.
 */
export async function getBudgetTrend(projectId, months = 8) {
  requireConfigured()

  const expenses = unwrap(
    await supabase
      .from('expenses')
      .select('incurred_on, amount')
      .eq('project_id', projectId)
      .order('incurred_on', { ascending: false }),
  )

  if (expenses.length) {
    /* Bucket by month, newest first, then take the window the chart draws. */
    const buckets = new Map()
    for (const e of expenses) {
      const d = new Date(e.incurred_on)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      buckets.set(key, (buckets.get(key) ?? 0) + (Number(e.amount) || 0))
    }
    return [...buckets.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, months)
      .reverse()
      .map(([key, value]) => ({
        month: new Date(`${key}-01T00:00:00`)
          .toLocaleDateString('en-US', { month: 'short' })
          .toUpperCase(),
        value,
      }))
  }

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

/**
 * Cost categories with what has actually been spent against each — PRD 5.3.5's
 * first acceptance criterion, "budget vs spent visible at category level with
 * progress bars".
 *
 * `value` stays the planned percentage so the donut is unchanged; `budgeted`
 * and `spent` are what the bars need. Spend is summed from the ledger here
 * rather than kept as a column on the category, so it cannot drift from the
 * expenses it is supposed to total.
 */
export async function getCostCategories(projectId) {
  requireConfigured()

  const [rows, expenses] = await Promise.all([
    supabase
      .from('cost_categories')
      .select('id, label, pct, tone, sequence, budgeted')
      .eq('project_id', projectId)
      .order('sequence', { ascending: true })
      .then(unwrap),
    supabase
      .from('expenses')
      .select('category_id, amount')
      .eq('project_id', projectId)
      .then(unwrap),
  ])

  const spentByCategory = new Map()
  let uncategorised = 0
  for (const e of expenses) {
    const amount = Number(e.amount) || 0
    if (!e.category_id) uncategorised += amount
    else
      spentByCategory.set(
        e.category_id,
        (spentByCategory.get(e.category_id) ?? 0) + amount,
      )
  }

  return {
    /* Spending that names no category is reported rather than dropped —
       silently losing it would make the bars disagree with the KPI. */
    uncategorised,
    categories: rows.map((r) => {
      const budgeted = Number(r.budgeted) || 0
      const spent = spentByCategory.get(r.id) ?? 0
      return {
        id: r.id,
        label: r.label,
        value: Number(r.pct),
        tone: r.tone ?? 'brand',
        budgeted,
        spent,
        /* Uncapped on purpose: an overrun should read as over 100%, not as a
           full bar that looks the same as spending exactly to plan. */
        usedPct: budgeted ? Math.round((spent / budgeted) * 100) : 0,
        over: budgeted > 0 && spent > budgeted,
      }
    }),
  }
}

/** Options for the "record spending" dialog. */
export async function listExpenseCategories(projectId) {
  requireConfigured()
  return unwrap(
    await supabase
      .from('cost_categories')
      .select('id, label')
      .eq('project_id', projectId)
      .order('sequence', { ascending: true }),
  )
}

/** The ledger behind the category bars and the trend chart. */
export async function listExpenses(projectId, limit = 40) {
  requireConfigured()
  const rows = unwrap(
    await supabase
      .from('expenses')
      .select(
        'id, amount, incurred_on, vendor, note, milestone_id, cost_categories ( label )',
      )
      .eq('project_id', projectId)
      .order('incurred_on', { ascending: false })
      .limit(limit),
  )

  return rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount) || 0,
    date: r.incurred_on,
    vendor: r.vendor ?? '—',
    note: r.note ?? '',
    category: r.cost_categories?.label ?? 'Uncategorised',
    /* Escrow lines are posted by the payment workflow and are not editable. */
    isEscrow: Boolean(r.milestone_id),
  }))
}

/**
 * Records spending outside the escrow chain — a material purchase, a
 * consultant's fee. Escrow releases post themselves when a milestone is paid,
 * so this deliberately cannot create one: the database refuses a row that
 * claims a milestone.
 */
export async function recordExpense({
  projectId,
  categoryId,
  amount,
  incurredOn,
  vendor,
  note,
  actorUid,
}) {
  requireConfigured()

  const value = Math.round(Number(amount) || 0)
  if (value <= 0) throw new Error('Enter an amount greater than zero.')

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      project_id: projectId,
      category_id: categoryId || null,
      amount: value,
      incurred_on: incurredOn || new Date().toISOString().slice(0, 10),
      vendor: vendor?.trim() || null,
      note: note?.trim() || null,
      created_by: actorUid,
    })
    .select('id')
    .single()

  if (error?.code === '42501') {
    throw new Error('You do not have permission to record spending on this project.')
  }
  return unwrap({ data, error })
}

export async function listMilestones(projectId) {
  requireConfigured()
  const rows = unwrap(
    await supabase
      .from('milestones')
      .select(
        'id, sequence, name, release_amount, release_pct, due_date, status, ' +
          'verification_criteria, payment_txn_id, pm_verified_at, ' +
          'customer_approved_at, paid_at, second_approval_at, contractors ( name )',
      )
      .eq('project_id', projectId)
      .order('sequence', { ascending: true }),
  )

  return rows.map((r) => {
    const amount = Number(r.release_amount) || 0
    return {
      id: r.id,
      milestone: r.name,
      contractor: r.contractors?.name ?? 'Unassigned',
      dueDate: r.due_date,
      amount,
      status: STATUS_LABELS[r.status] ?? STATUS_LABELS.upcoming,
      statusKey: r.status,
      releasePct: r.release_pct ? Number(r.release_pct) : null,
      criteria: r.verification_criteria,
      txnId: r.payment_txn_id,
      pmVerifiedAt: r.pm_verified_at,
      customerApprovedAt: r.customer_approved_at,
      paidAt: r.paid_at,
      /* PRD 5.3.4's threshold, mirrored here so the table can show the extra
         step before the database refuses the payment. The database is still
         the authority — this only decides what the UI offers. */
      needsSecondApproval: amount > DUAL_APPROVAL_THRESHOLD,
      secondApprovedAt: r.second_approval_at,
      /* Reference is a stand-in until an escrow provider is connected. */
      simulated: String(r.payment_txn_id ?? '').startsWith('SIM-'),
    }
  })
}

/**
 * Milestone payment workflow (PRD 8.5).
 *
 * The legal transitions are enforced in the database by `advance_milestone`,
 * not here — a milestone cannot be paid before the customer approves, and a
 * client that tries gets an error rather than a silent skip. Timestamps and
 * the payment reference are stamped server-side so they cannot be back-dated.
 */
/** PRD 5.3.4: releases above this need a second, different approver. */
export const DUAL_APPROVAL_THRESHOLD = 500000

/**
 * Records the second sign-off (PRD 5.3.4).
 *
 * The database refuses it from the person who verified the milestone, so
 * "dual approval" cannot be satisfied by one account clicking twice.
 */
export async function secondApproveMilestone(milestoneId) {
  requireConfigured()
  const rows = unwrap(
    await supabase.rpc('second_approve_milestone', {
      p_milestone_id: milestoneId,
    }),
  )
  return Array.isArray(rows) ? rows[0] : rows
}

/**
 * What a PROJECT MANAGER may do to a milestone in this app.
 *
 * `approved -> paid` is deliberately absent. That step is the customer
 * approving the release, and the customer has their own application; the
 * database still enforces the whole chain, so a PM cannot reach it from here
 * even by accident.
 */
export const MILESTONE_ACTIONS = {
  upcoming: { next: 'pending_verification', label: 'Submit for Verification' },
  pending_verification: { next: 'approved', label: 'Verify & Approve' },
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
