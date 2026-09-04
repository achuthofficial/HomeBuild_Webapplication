import { supabase, unwrap, requireConfigured } from '@/api/client'

/**
 * Master Construction Schedule.
 *
 * Phases are stored flat with a `phase_group` label; the Gantt renders them
 * grouped and collapsible, so they are folded into groups here rather than in
 * the component.
 */

/** The visible window, in weeks. Matches the 12 columns the Gantt draws. */
export const TOTAL_WEEKS = 12

const BADGES = {
  done: { label: 'DONE', tone: 'success' },
  in_progress: { label: 'IN PROGRESS', tone: 'violet' },
  critical: { label: 'CRITICAL', tone: 'warning' },
  delayed: { label: 'DELAYED', tone: 'danger' },
  queued: { label: 'QUEUED', tone: 'neutral' },
  on_hold: { label: 'ON HOLD', tone: 'neutral' },
}

const BAR_TONES = {
  done: 'success',
  in_progress: 'violet',
  critical: 'violet',
  delayed: 'danger',
  queued: 'neutral',
  on_hold: 'neutral',
}

export async function getSchedule(projectId) {
  requireConfigured()
  const rows = unwrap(
    await supabase
      .from('schedule_phases')
      .select('*')
      .eq('project_id', projectId)
      .order('sequence', { ascending: true }),
  )

  /* Group in insertion order so the Gantt's row order follows `sequence`. */
  const groups = new Map()

  for (const row of rows) {
    const key = row.phase_group ?? 'Phases'
    if (!groups.has(key)) {
      groups.set(key, {
        id: key.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: key,
        /* The first two groups start expanded, matching the mockup. */
        defaultOpen: groups.size === 0,
        baseline: { start: Infinity, end: 0 },
        tasks: [],
      })
    }
    const group = groups.get(key)

    const start = Number(row.actual_start_week ?? row.baseline_start_week ?? 0)
    const end = Number(row.actual_end_week ?? row.baseline_end_week ?? 0)

    /* The group's baseline bar spans its phases' baselines. */
    group.baseline.start = Math.min(
      group.baseline.start,
      Number(row.baseline_start_week ?? 0),
    )
    group.baseline.end = Math.max(
      group.baseline.end,
      Number(row.baseline_end_week ?? 0),
    )

    group.tasks.push({
      id: row.id,
      name: row.name,
      badge: BADGES[row.status] ?? BADGES.queued,
      bar: { start, end, tone: BAR_TONES[row.status] ?? 'neutral' },
      forecast:
        row.forecast_start_week != null && row.forecast_end_week != null
          ? {
              start: Number(row.forecast_start_week),
              end: Number(row.forecast_end_week),
            }
          : null,
      /* "+4 Days" flag on an overrunning bar. */
      flag: row.delay_days > 0 ? `+${row.delay_days} Days` : null,
      cost: Number(row.cost) || 0,
      status: row.status,
      delayDays: row.delay_days ?? 0,
      delayCause: row.delay_cause ?? null,
      delayCostImpact: Number(row.delay_cost_impact) || 0,
      delayRecoverable: row.delay_recoverable,
    })
  }

  const list = [...groups.values()].map((g) => ({
    ...g,
    baseline: {
      start: Number.isFinite(g.baseline.start) ? g.baseline.start : 0,
      end: g.baseline.end,
    },
  }))

  return {
    groups: list,
    months: buildMonths(),
    totalDelayDays: rows.reduce((sum, r) => sum + (r.delay_days ?? 0), 0),
    phaseCount: rows.length,
  }
}

/**
 * Column headers for the visible window. Derived from today rather than
 * hard-coded, so the chart does not silently go stale.
 */
function buildMonths() {
  const out = []
  const now = new Date()
  const startWeek = isoWeek(now)

  for (let m = 0; m < 3; m++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + m, 1)
    out.push({
      label: monthDate
        .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        .toUpperCase(),
      weeks: Array.from({ length: 4 }, (_, i) => `W${startWeek + m * 4 + i}`),
    })
  }
  return out
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

/**
 * Phase status changes.
 *
 * Marking a phase done fires the rollup trigger, so the project's progress
 * percentage and the dashboard KPI follow automatically — the figure is
 * derived in one place rather than being maintained by each caller.
 */
export const PHASE_ACTIONS = [
  { key: 'in_progress', label: 'Mark in progress' },
  { key: 'done', label: 'Mark complete' },
  { key: 'on_hold', label: 'Put on hold' },
  { key: 'delayed', label: 'Flag as delayed' },
]

export async function setPhaseStatus(
  phaseId,
  status,
  { delayDays, cause, costImpact, recoverable } = {},
) {
  requireConfigured()

  const patch = { status }
  /* Flagging a delay with no figure defaults to a week, which is the smallest
     unit the Gantt can actually show. */
  if (status === 'delayed') {
    patch.delay_days = delayDays ?? 7
    /* PRD 5.4.4 — the analysis fields. Only written when the caller supplied
       them, so flagging a delay quickly does not blank a cause recorded
       earlier. */
    if (cause !== undefined) patch.delay_cause = cause || null
    if (costImpact !== undefined) patch.delay_cost_impact = Math.round(Number(costImpact) || 0)
    if (recoverable !== undefined) patch.delay_recoverable = recoverable
  }
  if (status === 'done') {
    patch.delay_days = 0
    /* A finished phase has no outstanding delay to analyse. */
    patch.delay_cause = null
    patch.delay_cost_impact = 0
    patch.delay_recoverable = null
  }

  return unwrap(
    await supabase
      .from('schedule_phases')
      .update(patch)
      .eq('id', phaseId)
      .select('id, name, status, delay_days, project_id')
      .single(),
  )
}

/** The root causes PRD 5.4.4 asks the system to attribute a delay to. */
export const DELAY_CAUSES = [
  'Monsoon',
  'Material delay',
  'Design change',
  'Contractor capacity',
  'Other',
]

/**
 * Delay Analysis (PRD 5.4.4).
 *
 * "For each completed or active phase that has overrun its baseline, surface
 * the root cause, weeks added, additional cost, and whether the delay is
 * recoverable in subsequent phases."
 *
 * Recoverability is the PM's judgement and is stored; the rest is read off
 * the phase. Totals are returned alongside because the useful question is
 * usually "how far behind are we altogether", not phase by phase.
 */
export async function getDelayAnalysis(projectId) {
  requireConfigured()
  const rows = unwrap(
    await supabase
      .from('schedule_phases')
      .select(
        'id, name, sequence, status, delay_days, delay_cause, delay_cost_impact, delay_recoverable',
      )
      .eq('project_id', projectId)
      .gt('delay_days', 0)
      .order('sequence', { ascending: true }),
  )

  const phases = rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    days: r.delay_days ?? 0,
    /* One decimal: "1.4 weeks" is honest where "1 week" rounds away two days
       of a schedule the PRD measures in weeks. */
    weeks: Math.round(((r.delay_days ?? 0) / 7) * 10) / 10,
    cause: r.delay_cause ?? 'Not recorded',
    costImpact: Number(r.delay_cost_impact) || 0,
    recoverable: r.delay_recoverable,
  }))

  return {
    phases,
    totalWeeks:
      Math.round((phases.reduce((s, p) => s + p.days, 0) / 7) * 10) / 10,
    totalCost: phases.reduce((s, p) => s + p.costImpact, 0),
    /* Only counts a delay someone has actually judged recoverable — an
       unrecorded one is unknown, not recoverable. */
    recoverableWeeks:
      Math.round(
        (phases.filter((p) => p.recoverable === true).reduce((s, p) => s + p.days, 0) /
          7) *
          10,
      ) / 10,
  }
}

/**
 * Recalculates the forecast timeline (PRD 5.4.3).
 *
 * Rule-based only, and all three of the document's rules: cumulative delay
 * pushed into later phases, the monsoon buffer for weeks 22-36, and rework
 * days for every open high-severity alert. No model involved.
 */
export async function applyForecast(projectId) {
  requireConfigured()
  const shifted = unwrap(
    await supabase.rpc('apply_schedule_forecast', { p_project_id: projectId }),
  )
  return typeof shifted === 'number' ? shifted : 0
}
