import { supabase, unwrap, requireConfigured } from '@/api/client'

/**
 * Global search behind the topbar box.
 *
 * The box is in all eight mockups and did nothing — it raised a toast saying
 * "No results … in this prototype", which was the only honest thing it could
 * say while nothing was wired to it.
 *
 * Five tables in parallel rather than one query: they have no useful join
 * between them, and PostgREST cannot union across tables anyway. Five small
 * indexed lookups beat one clever one here.
 *
 * Row Level Security does the access control, so a manager can only ever find
 * what they can already open — no filtering is needed (or possible to get
 * wrong) in this file.
 */

/** What each result type carries, so the dropdown can render and route it. */
const GROUPS = [
  { key: 'projects', label: 'Projects' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'contractors', label: 'Contractors' },
  { key: 'updates', label: 'Site Updates' },
]

/**
 * Escapes a term for PostgREST's `or` filter.
 *
 * Commas separate the conditions in that syntax and parentheses delimit them,
 * so a query containing either would produce a malformed filter and a 400
 * rather than no results — which looks like a broken search, not an empty one.
 */
function safeTerm(query) {
  return query.trim().replace(/[(),*]/g, ' ').trim()
}

export async function globalSearch(query, { perGroup = 4 } = {}) {
  requireConfigured()

  const term = safeTerm(query)
  /* One character matches most of the database and helps nobody. */
  if (term.length < 2) return { term, groups: [], total: 0 }

  const like = `%${term}%`

  const [projects, milestones, alerts, contractors, updates] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, client_name, city, status')
      .or(`name.ilike.${like},client_name.ilike.${like},city.ilike.${like}`)
      .limit(perGroup)
      .then(unwrap),
    supabase
      .from('milestones')
      .select('id, name, status, release_amount, projects ( name )')
      .ilike('name', like)
      .limit(perGroup)
      .then(unwrap),
    supabase
      .from('ai_alerts')
      .select('id, category, severity, description, location_text')
      .or(`category.ilike.${like},description.ilike.${like},location_text.ilike.${like}`)
      .limit(perGroup)
      .then(unwrap),
    supabase
      .from('contractors')
      .select('id, name, trade, code')
      .or(`name.ilike.${like},trade.ilike.${like},code.ilike.${like}`)
      .limit(perGroup)
      .then(unwrap),
    supabase
      .from('site_updates')
      .select('id, work_category, location_on_site, notes, projects ( name )')
      .or(`work_category.ilike.${like},location_on_site.ilike.${like},notes.ilike.${like}`)
      .limit(perGroup)
      .then(unwrap),
  ])

  const byKey = {
    projects: projects.map((r) => ({
      id: r.id,
      title: r.name,
      detail: [r.client_name, r.city].filter(Boolean).join(' · ') || 'No client set',
      to: '/projects',
    })),
    milestones: milestones.map((r) => ({
      id: r.id,
      title: r.name,
      detail: r.projects?.name ?? 'Unassigned project',
      to: '/finance',
    })),
    alerts: alerts.map((r) => ({
      id: r.id,
      title: r.category,
      detail: r.location_text || r.description || r.severity,
      to: '/analytics',
    })),
    contractors: contractors.map((r) => ({
      id: r.id,
      title: r.name,
      detail: [r.trade, r.code].filter(Boolean).join(' · '),
      to: '/contractors',
    })),
    updates: updates.map((r) => ({
      id: r.id,
      title: r.location_on_site || r.work_category,
      detail: r.projects?.name ?? r.work_category,
      to: '/construction',
    })),
  }

  const groups = GROUPS.map((g) => ({ ...g, items: byKey[g.key] })).filter(
    (g) => g.items.length > 0,
  )

  return {
    term,
    groups,
    total: groups.reduce((sum, g) => sum + g.items.length, 0),
  }
}
