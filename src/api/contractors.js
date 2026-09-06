import { supabase, unwrap, requireConfigured } from '@/api/client'

/** Contractor Management — directory, tabs, trade filter and KPIs. */

export const contractorTabs = ['All', 'Internal', 'Sub-Contractors']

/** Trade chips carry their own tint pair, sampled from the mockup. */
export const tradeTones = {
  ELECTRICAL: 'violet',
  CIVIL: 'success',
  MECHANICAL: 'info',
  CLEANING: 'orange',
  PLUMBING: 'info',
  PAINTING: 'warning',
}

function toneForScore(score) {
  if (score >= 90) return 'success'
  if (score >= 75) return 'brand'
  return 'danger'
}

export async function listContractors({ tab, trade, minRating } = {}) {
  requireConfigured()

  let query = supabase
    .from('contractors')
    .select(`
      id, code, name, initials, trade, rating, score, kind,
      score_history, compliance_ok,
      contractor_assignments ( projects ( name ) )
    `)

  if (tab === 'Internal') query = query.eq('kind', 'internal')
  if (tab === 'Sub-Contractors') query = query.eq('kind', 'sub')
  if (trade && trade !== 'All Trades') query = query.eq('trade', trade.toUpperCase())
  if (minRating) query = query.gte('rating', 4)

  const rows = unwrap(await query.order('score', { ascending: false }))

  return rows.map((row) => {
    const projects = (row.contractor_assignments ?? [])
      .map((a) => a.projects?.name)
      .filter(Boolean)

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      /* Fall back to deriving initials if the column is empty. */
      initials:
        row.initials ||
        row.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
      trade: row.trade,
      rating: Number(row.rating) || 0,
      score: row.score ?? 0,
      scoreTone: toneForScore(row.score ?? 0),
      kind: row.kind,
      history: row.score_history ?? [],
      historyTone: toneForScore(row.score ?? 0),
      /* Project initials for the avatar-stack column. */
      activeProjects: projects.slice(0, 2).map((n) =>
        n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
      ),
      extraProjects: Math.max(0, projects.length - 2),
      complianceOk: row.compliance_ok,
    }
  })
}

export async function getContractorKpis() {
  requireConfigured()
  const rows = unwrap(
    await supabase.from('contractors').select('rating, score, compliance_ok'),
  )

  const count = rows.length || 1
  const avgScore = rows.reduce((s, r) => s + (r.score ?? 0), 0) / count
  const compliant = rows.filter((r) => r.compliance_ok).length

  return {
    activeWorkforce: rows.length,
    avgPerformance: `${avgScore.toFixed(1)}%`,
    complianceRate: `${Math.round((compliant / count) * 100)}%`,
  }
}

export async function listTradeFilters() {
  requireConfigured()
  const rows = unwrap(await supabase.from('contractors').select('trade'))
  const trades = [...new Set(rows.map((r) => r.trade).filter(Boolean))]
    .sort()
    .map((t) => t.charAt(0) + t.slice(1).toLowerCase())
  return ['All Trades', ...trades]
}

/**
 * Contractor record updates — the row action sheet.
 *
 * Deactivating sets compliance to false rather than deleting: PRD goal 4
 * treats the vetted network as an asset, and a contractor's history has to
 * survive them going inactive.
 */
export async function updateContractor(id, { rating, score, complianceOk, kind }) {
  requireConfigured()

  const patch = {}
  if (rating != null) patch.rating = rating
  if (score != null) patch.score = score
  if (complianceOk != null) patch.compliance_ok = complianceOk
  if (kind) patch.kind = kind

  return unwrap(
    await supabase
      .from('contractors')
      .update(patch)
      .eq('id', id)
      .select('id, name, rating, score, compliance_ok, kind')
      .single(),
  )
}

/** Which projects a contractor is currently on — the row detail view. */
export async function getContractorDetail(id) {
  requireConfigured()
  const row = unwrap(
    await supabase
      .from('contractors')
      .select(`
        id, code, name, trade, rating, score, kind, compliance_ok, score_history,
        contractor_assignments ( projects ( id, name, progress_pct, city ) )
      `)
      .eq('id', id)
      .single(),
  )

  return {
    ...row,
    projects: (row.contractor_assignments ?? [])
      .map((a) => a.projects)
      .filter(Boolean),
  }
}
