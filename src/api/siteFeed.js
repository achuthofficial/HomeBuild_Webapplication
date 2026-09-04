import { supabase, unwrap, requireConfigured } from '@/api/client'
import { BUCKETS } from '@/lib/supabaseStorage'

/**
 * Daily Site Feed (PRD 8.3).
 *
 * Photos now live in a table rather than being inferred from storage prefixes,
 * so each carries its own uploader and caption. Paths are signed in one batch
 * per request — the site-photos bucket is private.
 */

const SIGNED_URL_TTL = 60 * 60

const STATUS_LABELS = {
  in_progress: { label: 'In Progress', tone: 'success' },
  done: { label: 'Done', tone: 'success' },
  blocked: { label: 'On Hold', tone: 'neutral' },
}

/** Category → chip tone, matching the mockup's colour assignments. */
const CATEGORY_TONES = {
  'Slab Casting': 'success',
  'MEP Installation': 'neutral',
  'Structural Steel': 'brand',
  Electrical: 'violet',
}

export async function listFeedEntries({ projectId, category } = {}) {
  requireConfigured()

  let query = supabase
    .from('site_updates')
    .select(`
      id, work_category, location_on_site, notes, status, uploaded_at,
      workers_present, materials_used,
      projects ( id, name ),
      supervisor:profiles!site_updates_supervisor_uid_fkey ( full_name, avatar_url ),
      site_update_photos ( id, storage_path, caption )
    `)
    .order('uploaded_at', { ascending: false })

  if (projectId) query = query.eq('project_id', projectId)
  if (category && category !== 'All Activity') {
    query = query.eq('work_category', category)
  }

  const rows = unwrap(await query)

  /* Collect every path across every entry, then sign them in ONE call rather
     than one request per photo. */
  const allPaths = rows.flatMap((r) =>
    (r.site_update_photos ?? []).map((p) => p.storage_path),
  )

  const urlByPath = new Map()
  if (allPaths.length) {
    const { data: signed } = await supabase.storage
      .from(BUCKETS.sitePhotos)
      .createSignedUrls(allPaths, SIGNED_URL_TTL)

    for (const item of signed ?? []) {
      if (item?.path && item?.signedUrl) urlByPath.set(item.path, item.signedUrl)
    }
  }

  return rows.map((row) => ({
    id: row.id,
    projectId: row.projects?.id,
    projectName: row.projects?.name,
    chip: {
      label: row.work_category.toUpperCase(),
      tone: CATEGORY_TONES[row.work_category] ?? 'neutral',
    },
    title: row.location_on_site
      ? `${row.location_on_site}`
      : row.work_category,
    category: row.work_category,
    date: row.uploaded_at,
    status: STATUS_LABELS[row.status] ?? STATUS_LABELS.in_progress,
    note: row.notes,
    workersPresent: row.workers_present ?? null,
    materialsUsed: row.materials_used ?? null,
    team: row.supervisor?.avatar_url ? [row.supervisor.avatar_url] : [],
    supervisor: row.supervisor?.full_name ?? null,
    photos: (row.site_update_photos ?? []).map((p) => ({
      id: p.id,
      path: p.storage_path,
      caption: p.caption,
      url: urlByPath.get(p.storage_path) ?? null,
    })),
    /* Two spare slots so there is always somewhere to drop a new photo. */
    uploadSlots: 2,
  }))
}

/** Distinct work categories, for the feed filter. */
export async function listFeedCategories() {
  requireConfigured()
  const rows = unwrap(await supabase.from('site_updates').select('work_category'))
  const categories = [...new Set(rows.map((r) => r.work_category).filter(Boolean))].sort()
  return ['All Activity', ...categories]
}

/** Posts a new update from the "New Site Update" dialog. */
export async function createSiteUpdate({
  projectId,
  supervisorUid,
  workCategory,
  location,
  notes,
  status = 'in_progress',
  milestoneId = null,
  workersPresent = null,
  materialsUsed = null,
  clientToken = null,
}) {
  requireConfigured()

  /* Upsert rather than insert, so a retry from the offline queue lands as a
     no-op instead of a second copy of the same day's work. `ignoreDuplicates`
     makes PostgREST return the existing row rather than a 409. */
  return unwrap(
    await supabase
      .from('site_updates')
      .upsert(
        {
          project_id: projectId,
          supervisor_uid: supervisorUid,
          work_category: workCategory,
          location_on_site: location || null,
          notes: notes || null,
          status,
          milestone_id: milestoneId || null,
          /* PRD 5.2.5 optional metadata. */
          workers_present: workersPresent ? Number(workersPresent) : null,
          materials_used: materialsUsed?.trim() || null,
          client_token: clientToken,
        },
        { onConflict: 'client_token', ignoreDuplicates: true },
      )
      .select('id'),
  )
}

/**
 * Share of site updates by work category — the "Activity Breakdown" list.
 *
 * It used to be four fixed percentages in a data file (Casting 45, Structural
 * Steel 28, Electrical 17, Others 10) that were identical on every project.
 *
 * Percentages are cumulative-rounded so the list totals exactly 100 rather
 * than 99 or 101, which is visible when four numbers sit in a column.
 */
const BREAKDOWN_TONES = ['success', 'brand', 'violet', 'neutral']

export async function getActivityBreakdown(projectId) {
  requireConfigured()

  let query = supabase.from('site_updates').select('work_category')
  if (projectId) query = query.eq('project_id', projectId)
  const rows = unwrap(await query)
  if (!rows.length) return []

  const counts = new Map()
  for (const r of rows) {
    counts.set(r.work_category, (counts.get(r.work_category) ?? 0) + 1)
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  /* Everything past the top three becomes "Others", so the list stays
     readable on a project with a dozen categories. */
  const top = ranked.slice(0, 3)
  const restCount = ranked.slice(3).reduce((sum, [, n]) => sum + n, 0)
  if (restCount > 0) top.push(['Others', restCount])

  const total = rows.length
  let cumulative = 0
  let previousPct = 0

  return top.map(([label, count], i) => {
    cumulative += count
    const runningPct = Math.round((cumulative / total) * 100)
    const value = runningPct - previousPct
    previousPct = runningPct
    return { label, value, tone: BREAKDOWN_TONES[i] ?? 'neutral' }
  })
}

/** Records an uploaded photo against an update. */
export async function attachPhoto({ siteUpdateId, storagePath, uploadedBy }) {
  requireConfigured()
  return unwrap(
    await supabase
      .from('site_update_photos')
      .insert({
        site_update_id: siteUpdateId,
        storage_path: storagePath,
        uploaded_by: uploadedBy,
      })
      .select('id, storage_path')
      .single(),
  )
}

/** Projects to post an update against, for the New Update dialog. */
export async function listProjectOptions() {
  requireConfigured()
  return unwrap(
    await supabase
      .from('projects')
      .select('id, name')
      .in('status', ['active', 'in_design', 'lead'])
      .order('name'),
  )
}

/** Work categories offered in the dialog, per PRD 8.3's examples. */
export const WORK_CATEGORIES = [
  'Slab Casting',
  'MEP Installation',
  'Structural Steel',
  'Electrical',
  'Brickwork',
  'Plastering',
  'Flooring',
  'Painting',
]

/**
 * Milestones on a project, for PRD 8.3's optional "Milestone Reference" —
 * which milestone the day's work contributes to.
 */
export async function listMilestoneOptions(projectId) {
  requireConfigured()
  if (!projectId) return []
  return unwrap(
    await supabase
      .from('milestones')
      .select('id, name, sequence')
      .eq('project_id', projectId)
      .order('sequence', { ascending: true }),
  )
}
