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

/**
 * PRD goal 4 targets "200+ active vetted contractors across 3 cities", so the
 * directory pages in the query rather than fetching the lot. The footer used
 * to read "Showing 1-N of N" over an unpaged fetch with a Next button that
 * raised a toast — honest at six seeded rows, a lie at two hundred.
 */
export const CONTRACTORS_PER_PAGE = 10

export async function listContractors({ tab, trade, minRating, page = 1 } = {}) {
  requireConfigured()

  let query = supabase
    .from('contractors')
    .select(`
      id, code, name, initials, trade, rating, score, kind,
      score_history, compliance_ok,
      contractor_assignments ( projects ( name, city ) )
    `, { count: 'exact' })

  if (tab === 'Internal') query = query.eq('kind', 'internal')
  if (tab === 'Sub-Contractors') query = query.eq('kind', 'sub')
  if (trade && trade !== 'All Trades') query = query.eq('trade', trade.toUpperCase())
  if (minRating) query = query.gte('rating', 4)

  const from = (page - 1) * CONTRACTORS_PER_PAGE
  const { data, error, count } = await query
    .order('score', { ascending: false })
    .range(from, from + CONTRACTORS_PER_PAGE - 1)

  unwrap({ data, error })
  const rows = data ?? []

  const contractors = rows.map((row) => {
    const assignments = (row.contractor_assignments ?? [])
      .map((a) => a.projects)
      .filter(Boolean)
    const projects = assignments.map((p) => p.name).filter(Boolean)
    /* Goal 4 counts the network "across 3 cities". A contractor has no city
       column — where they work is where their projects are, so it is derived
       rather than stored and cannot drift from the assignments. */
    const cities = [...new Set(assignments.map((p) => p.city).filter(Boolean))]

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
      cities,
      complianceOk: row.compliance_ok,
    }
  })

  return {
    contractors,
    total: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / CONTRACTORS_PER_PAGE)),
  }
}

/** First day of the current calendar quarter, as a plain date. */
function quarterStart(now = new Date()) {
  const q = Math.floor(now.getMonth() / 3) * 3
  const d = new Date(now.getFullYear(), q, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export async function getContractorKpis() {
  requireConfigured()

  const [rows, allocated] = await Promise.all([
    supabase
      .from('contractors')
      .select('rating, score, compliance_ok')
      .then(unwrap),
    /* "Budget Utilization — allocated this quarter" was the literal '74%'.
       What is actually measurable is the money committed to contractors:
       milestone releases that name one and fall due this quarter. It is an
       amount, not a percentage — there is no denominator in the schema that
       would make a percentage mean anything, and inventing one would put the
       screen back where it started. */
    supabase
      .from('milestones')
      .select('release_amount')
      .not('contractor_id', 'is', null)
      .gte('due_date', quarterStart())
      .then(unwrap),
  ])

  const count = rows.length || 1
  const avgScore = rows.reduce((s, r) => s + (r.score ?? 0), 0) / count
  const compliant = rows.filter((r) => r.compliance_ok).length

  return {
    activeWorkforce: rows.length,
    avgPerformance: `${avgScore.toFixed(1)}%`,
    complianceRate: `${Math.round((compliant / count) * 100)}%`,
    allocatedThisQuarter: allocated.reduce(
      (sum, m) => sum + (Number(m.release_amount) || 0),
      0,
    ),
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

  /* PRD section 4 names "manually reconciling contractor invoices with
     milestones" as a PM pain. The link already existed — milestones.
     contractor_id — with nothing reading it, so a PM could bill a release
     against a firm and then had no way to see what that firm was owed. */
  const milestones = unwrap(
    await supabase
      .from('milestones')
      .select('id, name, status, release_amount, due_date, projects ( name )')
      .eq('contractor_id', id)
      .order('due_date', { ascending: true }),
  )

  const billed = milestones.map((m) => ({
    id: m.id,
    name: m.name,
    project: m.projects?.name ?? '—',
    status: m.status,
    amount: Number(m.release_amount) || 0,
    dueDate: m.due_date,
  }))

  const projects = (row.contractor_assignments ?? [])
    .map((a) => a.projects)
    .filter(Boolean)

  return {
    ...row,
    projects,
    cities: [...new Set(projects.map((p) => p.city).filter(Boolean))],
    billed,
    /* Split so the sheet can show what has actually been released against
       what is still to come, which is the reconciliation itself. */
    billedPaid: billed
      .filter((m) => m.status === 'paid')
      .reduce((s, m) => s + m.amount, 0),
    billedOutstanding: billed
      .filter((m) => m.status !== 'paid')
      .reduce((s, m) => s + m.amount, 0),
  }
}
