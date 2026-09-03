import { supabase, unwrap, requireConfigured } from '@/api/client'

/**
 * AI Alert Management (PRD 8.4).
 *
 * Filtering and pagination are pushed into the query rather than done in the
 * browser: with 128 seeded alerts and more arriving from the CV pipeline,
 * fetching the whole table to slice ten rows would not hold up.
 */

export const ALERTS_PER_PAGE = 10

export const severityFilters = ['All Levels', 'Critical', 'Medium', 'Low']
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

/** Acknowledge — the row action in the alerts table. */
export async function acknowledgeAlert(id) {
  requireConfigured()
  return unwrap(
    await supabase
      .from('ai_alerts')
      .update({ status: 'acknowledged' })
      .eq('id', id)
      .select('id, status')
      .single(),
  )
}
