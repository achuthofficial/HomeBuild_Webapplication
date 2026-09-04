import { supabase, unwrap, requireConfigured } from '@/api/client'

/**
 * AI Alert Management (PRD 8.4).
 *
 * Filtering and pagination are pushed into the query rather than done in the
 * browser: with 128 seeded alerts and more arriving from the CV pipeline,
 * fetching the whole table to slice ten rows would not hold up.
 */

export const ALERTS_PER_PAGE = 10

/**
 * PRD 5.2.3's quality-check vocabulary, with the severity the document
 * assigns each one as the default.
 *
 * The CV model is meant to produce these. It is out of scope for this build,
 * so they are also what a PM picks from when logging a defect by hand —
 * without that, the alert table could only ever contain seed data and PRD
 * 5.4.3's "open high-severity alerts add rework days" term would never fire
 * on a real project.
 */
export const CV_CATEGORIES = [
  { label: 'Reinforcement Spacing', severity: 'High' },
  { label: 'Concrete Curing', severity: 'High' },
  { label: 'Formwork Alignment', severity: 'High' },
  { label: 'Safety Compliance', severity: 'High' },
  { label: 'Brickwork Bonding', severity: 'Medium' },
  { label: 'Plaster Quality', severity: 'Medium' },
  { label: 'Material Storage', severity: 'Low' },
  { label: 'Site Cleanliness', severity: 'Low' },
]

export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical']

/**
 * Logs an alert a person spotted rather than the model.
 *
 * `confidence` is left null on purpose. It is the CV model's score, and
 * putting 1.0 there for a human observation would make a judgement look like
 * a measurement.
 */
export async function raiseAlert({
  projectId,
  category,
  severity,
  description,
  locationText,
}) {
  requireConfigured()

  const { data, error } = await supabase
    .from('ai_alerts')
    .insert({
      project_id: projectId,
      category,
      severity,
      description: description?.trim() || null,
      location_text: locationText?.trim() || null,
      status: 'new',
    })
    .select('id, severity')
    .single()

  if (error?.code === '42501') {
    throw new Error('You do not have permission to raise an alert on this project.')
  }
  return unwrap({ data, error })
}

/* PRD 8.4's full severity vocabulary. `High` was missing here, so an alert
   the CV pipeline marked High could be stored but never filtered for. */
export const severityFilters = ['All Levels', 'Critical', 'High', 'Medium', 'Low']
export const statusFilters = ['Active Only', 'All Statuses', 'Resolved']

/** Statuses that count as still open. */
const OPEN = ['new', 'acknowledged', 'assigned']

function toAlert(row) {
  return {
    id: row.id,
    type: row.category,
    location: row.location_text ?? '—',
    severity: row.severity,
    /* Stored 0–1, displayed as a percentage. */
    confidence: Math.round((row.confidence ?? 0) * 100),
    project: row.projects?.name ?? '—',
    detected: row.detected_at,
    resolved: row.status === 'resolved',
    status: row.status,
  }
}

export async function listAlerts({ severity, status, page = 1 } = {}) {
  requireConfigured()

  let query = supabase
    .from('ai_alerts')
    .select('id, category, severity, confidence, location_text, detected_at, status, projects ( name )', {
      count: 'exact',
    })

  if (severity && severity !== 'All Levels') {
    query = query.eq('severity', severity)
  }
  if (!status || status === 'Active Only') {
    query = query.in('status', OPEN)
  } else if (status === 'Resolved') {
    query = query.eq('status', 'resolved')
  }

  const from = (page - 1) * ALERTS_PER_PAGE
  const { data, error, count } = await query
    .order('detected_at', { ascending: false })
    .range(from, from + ALERTS_PER_PAGE - 1)

  unwrap({ data, error })

  return {
    alerts: (data ?? []).map(toAlert),
    total: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / ALERTS_PER_PAGE)),
  }
}

/** The four KPI cards above the table. */
export async function getAlertKpis() {
  requireConfigured()

  const [critical, medium, avgConfidence] = await Promise.all([
    supabase.from('ai_alerts').select('id', { count: 'exact', head: true })
      .eq('severity', 'Critical').in('status', OPEN),
    supabase.from('ai_alerts').select('id', { count: 'exact', head: true })
      .eq('severity', 'Medium').in('status', OPEN),
    supabase.from('ai_alerts').select('confidence').in('status', OPEN).limit(500),
  ])

  const scores = (avgConfidence.data ?? []).map((r) => Number(r.confidence) || 0)
  const mean = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0

  return {
    activeCritical: critical.count ?? 0,
    mediumRisks: medium.count ?? 0,
    aiConfidence: `${(mean * 100).toFixed(1)}%`,
  }
}

/**
 * Alert workflow (PRD 8.4): new → acknowledged → assigned → resolved, with
 * false positive as an escape hatch.
 *
 * Goes through the `resolve_alert` function rather than a direct update so
 * the transition is logged and the resolved timestamp is stamped server-side.
 */
export async function setAlertStatus(id, nextStatus, assignee = null) {
  requireConfigured()
  const rows = unwrap(
    await supabase.rpc('resolve_alert', {
      p_alert_id: id,
      p_next_status: nextStatus,
      p_assignee: assignee,
    }),
  )
  return Array.isArray(rows) ? rows[0] : rows
}

export const acknowledgeAlert = (id) => setAlertStatus(id, 'acknowledged')
export const resolveAlert = (id) => setAlertStatus(id, 'resolved')
export const dismissAlert = (id) => setAlertStatus(id, 'false_positive')
export const assignAlert = (id, uid) => setAlertStatus(id, 'assigned', uid)

/** The actions offered for a row, given where it currently is. */
export function alertActionsFor(status) {
  if (status === 'new') {
    return [
      { key: 'acknowledged', label: 'Acknowledge' },
      { key: 'assigned', label: 'Assign to me' },
      { key: 'false_positive', label: 'False positive' },
    ]
  }
  if (status === 'acknowledged' || status === 'assigned') {
    return [
      { key: 'resolved', label: 'Mark resolved' },
      { key: 'false_positive', label: 'False positive' },
    ]
  }
  return []
}
