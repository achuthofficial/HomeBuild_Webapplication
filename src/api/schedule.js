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

/* Bar colours from the mockup (scripts/eeeee.png): green for completed,
   violet for work in progress, red for a phase that has slipped. */
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

  const [rows, project] = await Promise.all([
    supabase
      .from('schedule_phases')
      .select('*')
      .eq('project_id', projectId)
      .order('sequence', { ascending: true })
      .then(unwrap),
    supabase
      .from('projects')
      .select('start_date')
      .eq('id', projectId)
      .single()
      .then(unwrap),
  ])

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
    months: buildMonths(project?.start_date),
    today: todayMarker(project?.start_date),
    totalDelayDays: rows.reduce((sum, r) => sum + (r.delay_days ?? 0), 0),
    phaseCount: rows.length,
  }
}

/**
 * Where "today" falls on the chart — PRD 5.4.5, "today marker updates daily".
 *
 * Phase bars are positioned in weeks from the PROJECT'S START, so the marker
 * has to be measured the same way. It used to be a constant in a data file
 * (`offset: 2.45, label: 'TODAY: OCT 18'`), which meant the red line never
 * moved and, by the time you read this, pointed at a date in the past while
 * the column headers showed a different month entirely.
 *
 * Returns null when the project has no start date, so the chart draws no
 * marker rather than one placed on a guess.
 */
function todayMarker(startDate) {
  if (!startDate) return null

  const start = new Date(`${startDate}T00:00:00`)
  const now = new Date()
  const weeks = (now - start) / (7 * 86400000)

  /* Off either end of the window the line would sit on the border and read as
     a chart edge; better to leave it off than to pin it misleadingly. */
  if (weeks < 0 || weeks > TOTAL_WEEKS) return null

  return {
    offset: Math.round(weeks * 100) / 100,
    label: `TODAY: ${now
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      .toUpperCase()}`,
  }
}

/**
 * Column headers for the twelve-week window.
 *
 * Derived from the PROJECT'S start date, because that is the origin the phase
 * bars are measured from. They used to be calendar ISO weeks counted from
 * today, which put the bars and the headers on two different axes: a bar at
 * "week 2" was two weeks into the project, while the column above it read as
 * two weeks from now.
 *
 * Months are grouped by where each week actually falls in the calendar, so a
 * window can show three or four month headings of uneven width — which is
 * what a real twelve weeks looks like.
 */
function buildMonths(startDate) {
  const origin = startDate ? new Date(`${startDate}T00:00:00`) : new Date()
  const out = []

  for (let w = 0; w < TOTAL_WEEKS; w++) {
    const weekStart = new Date(origin.getTime() + w * 7 * 86400000)
    const label = weekStart
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      .toUpperCase()

    if (out.at(-1)?.label !== label) out.push({ label, weeks: [] })
    out.at(-1).weeks.push(`W${w + 1}`)
  }
  return out
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

/**
 * The three cards beside the Gantt.
 *
 * All three used to be constants in src/data/schedule.js — a fixed 92% health,
 * a fixed "24 Carpenters / 12 MEP Staff / 8 Excavation", and a fixed pulse
 * rail naming people who do not exist. They looked like live figures and
 * belonged to no project.
 */
export async function getScheduleSidebar(projectId) {
  requireConfigured()

  const [project, phases, milestones, updates] = await Promise.all([
    supabase
      .from('projects')
      .select('progress_pct, expected_completion')
      .eq('id', projectId)
      .single()
      .then(unwrap),
    supabase
      .from('schedule_phases')
      .select('name, status, delay_days, sequence')
      .eq('project_id', projectId)
      .order('sequence', { ascending: true })
      .then(unwrap),
    supabase
      .from('milestones')
      .select('name, due_date, status, sequence')
      .eq('project_id', projectId)
      .neq('status', 'paid')
      .order('sequence', { ascending: true })
      .limit(1)
      .then(unwrap),
    /* Headcount and trades come from what supervisors actually posted
       (PRD 5.2.5's "workers present"), not from a staffing table this
       product does not have. */
    supabase
      .from('site_updates')
      .select('work_category, workers_present, uploaded_at')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false })
      .limit(30)
      .then(unwrap),
  ])

  const next = milestones[0] ?? null
  const daysRemaining = next?.due_date
    ? Math.round(
        (new Date(`${next.due_date}T00:00:00`) - new Date()) / 86400000,
      )
    : null

  /* "On track" is a claim, so it has to be earned: no phase currently
     overrunning, and the next milestone not already past its date. */
  const slipping = phases.some((p) => (p.delay_days ?? 0) > 0)
  const overdue = daysRemaining !== null && daysRemaining < 0

  const done = phases.filter((p) => p.status === 'done').length

  /* One row per trade, with the most recent headcount reported for it —
     summing every update would count the same crew once per day. */
  const byCategory = new Map()
  for (const u of updates) {
    if (!u.workers_present) continue
    if (!byCategory.has(u.work_category)) {
      byCategory.set(u.work_category, u.workers_present)
    }
  }

  return {
    health: {
      value: Number(project?.progress_pct) || 0,
      caption: slipping
        ? 'Behind baseline on at least one phase'
        : 'Overall progress on track',
      onTrack: !slipping,
      nextMilestone: next?.name ?? null,
      daysRemaining,
      overdue,
      phasesDone: done,
      phaseCount: phases.length,
    },
    workforce: {
      trades: [...byCategory.entries()]
        .slice(0, 3)
        .map(([label, value]) => ({ label, value })),
      total: [...byCategory.values()].reduce((a, b) => a + b, 0),
      /* Null when no supervisor has recorded a headcount, so the card can say
         so rather than showing three zeroes. */
      reported: byCategory.size > 0,
    },
  }
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
