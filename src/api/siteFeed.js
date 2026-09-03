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
}) {
  requireConfigured()
  return unwrap(
    await supabase
      .from('site_updates')
      .insert({
        project_id: projectId,
        supervisor_uid: supervisorUid,
        work_category: workCategory,
        location_on_site: location || null,
        notes: notes || null,
        status,
        milestone_id: milestoneId || null,
      })
      .select('id')
      .single(),
  )
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
