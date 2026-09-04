import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Plus, TriangleAlert, ArrowRight } from 'lucide-react'

import { Link } from 'react-router-dom'

import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import StatusDot from '@/components/ui/StatusDot'
import AvatarStack from '@/components/ui/AvatarStack'
import FilterSelect from '@/components/ui/FilterSelect'
import Modal from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { longDate } from '@/lib/format'
import { useToast } from '@/context/ToastContext'
import { downloadCsv } from '@/lib/csv'

import QueryBoundary, { RowSkeleton } from '@/components/ui/QueryBoundary'
import { useQuery } from '@/hooks/useQuery'
import {
  listFeedEntries,
  listFeedCategories,
  attachPhoto,
  createSiteUpdate,
  listProjectOptions,
  listMilestoneOptions,
  WORK_CATEGORIES,
  getActivityBreakdown,
} from '@/api/siteFeed'
import { FormMessage } from '@/components/auth/AuthForm'
import { listOpenFindings } from '@/api/alerts'
import { onImageError } from '@/lib/imageFallback'
import { useAuth } from '@/context/AuthContext'
import { uploadSitePhoto } from '@/lib/storage'
import { isStorageConfigured } from '@/lib/supabaseStorage'

const noteRules = {
  success: 'border-success',
  neutral: 'border-line-strong',
}

const activityDots = {
  success: 'bg-success',
  brand: 'bg-brand-600',
  violet: 'bg-violet',
  neutral: 'bg-line-strong',
}

export default function Construction() {
  const { toast } = useToast()
  const { authUser } = useAuth()
  const [filter, setFilter] = useState('All Activity')
  const [updateOpen, setUpdateOpen] = useState(false)
  const [lightbox, setLightbox] = useState(null)

  const [uploadingFor, setUploadingFor] = useState(null)
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState(null)
  const [draft, setDraft] = useState({
    projectId: '',
    workCategory: WORK_CATEGORIES[0],
    location: '',
    notes: '',
    status: 'in_progress',
    milestoneId: '',
    workersPresent: '',
    materialsUsed: '',
  })
  const fileInput = useRef(null)
  /* Which entry the hidden file input is currently acting for. */
  const pendingEntry = useRef(null)

  /* Photos now come back with the feed itself — they are rows in
     site_update_photos, signed in one batch, rather than being inferred from
     storage prefixes. */
  const feed = useQuery(() => listFeedEntries({ category: filter }), [filter])

  /* The rail beside the feed. Both used to be constants in a data file. */
  const findings = useQuery(() => listOpenFindings(null, 3), [])
  const breakdown = useQuery(() => getActivityBreakdown(null), [filter])
  const categories = useQuery(() => listFeedCategories(), [])
  const projectOptions = useQuery(() => listProjectOptions(), [], {
    enabled: updateOpen,
  })

  /* PRD 8.3's optional Milestone Reference. Scoped to the chosen project, so
     an update cannot be attached to another project's milestone. */
  const milestoneOptions = useQuery(
    () => listMilestoneOptions(draft.projectId),
    [draft.projectId],
    { enabled: updateOpen && Boolean(draft.projectId) },
  )

  /** Posts a real site update (PRD 8.3) rather than claiming one was posted. */
  const postUpdate = async (e) => {
    e.preventDefault()
    setPostError(null)

    if (!draft.projectId) {
      setPostError('Choose which project this update belongs to.')
      return
    }

    setPosting(true)
    try {
      await createSiteUpdate({
        projectId: draft.projectId,
        supervisorUid: authUser?.uid,
        workCategory: draft.workCategory,
        location: draft.location,
        notes: draft.notes,
        status: draft.status,
        milestoneId: draft.milestoneId || null,
        workersPresent: draft.workersPresent,
        materialsUsed: draft.materialsUsed,
      })
      setPosting(false)
      setUpdateOpen(false)
      setDraft((d) => ({
        ...d,
        location: '',
        notes: '',
        milestoneId: '',
        workersPresent: '',
        materialsUsed: '',
      }))
      toast('Site update posted to the feed.')
      feed.refetch()
      categories.refetch()
    } catch (error) {
      setPosting(false)
      setPostError(error.message)
    }
  }
  const feedFilters = categories.data ?? ['All Activity']

  const openPicker = (entryId) => {
    if (!isStorageConfigured) {
      toast('File storage is not configured for this build. See STORAGE_SETUP.md.', {
        tone: 'info',
      })
      return
    }
    pendingEntry.current = entryId
    fileInput.current?.click()
  }

  const onFilePicked = async (event) => {
    const file = event.target.files?.[0]
    const entryId = pendingEntry.current
    /* Reset so the same file can be re-picked after a failure. */
    event.target.value = ''
    pendingEntry.current = null
    if (!file || !entryId) return

    setUploadingFor(entryId)
    const { data, error } = await uploadSitePhoto(file, entryId, authUser?.uid)

    if (error) {
      setUploadingFor(null)
      toast(error, { tone: 'info' })
      return
    }

    /* The file is in the bucket; record it against the update so it has an
       uploader and a caption slot rather than living as an orphan object. */
    try {
      await attachPhoto({
        siteUpdateId: entryId,
        storagePath: data.path,
        uploadedBy: authUser?.uid,
      })
    } catch (failure) {
      setUploadingFor(null)
      toast(`Uploaded, but not linked to the update: ${failure.message}`, {
        tone: 'info',
      })
      return
    }

    setUploadingFor(null)
    await feed.refetch()
    toast('Photo added to the site feed.')
  }

  /* Filtering is done in the query, so this is just the result. */
  const entries = feed.data ?? []

  return (
    <>
      <PageHeader
        title="Daily Site Feed"
        /* The feed spans every project the user can reach, so it cannot name
           one phase. It used to claim "Phase 2: Structural Integrity"
           regardless of what was on screen. */
        subtitle="Daily progress updates from site supervisors, newest first."
        actions={
          <>
            <FilterSelect
              value={filter}
              options={feedFilters}
              onChange={setFilter}
              align="right"
            />
            <Button
              variant="success"
              icon={Camera}
              onClick={() => setUpdateOpen(true)}
            >
              New Update
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ---------------- feed timeline ---------------- */}
        <div className="relative">
          <span
            className="absolute bottom-6 left-[5px] top-6 w-px bg-line"
            aria-hidden="true"
          />

          <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={onFilePicked}
        className="sr-only"
        tabIndex={-1}
      />

      <QueryBoundary
        isLoading={feed.isLoading}
        error={feed.error}
        data={entries}
        onRetry={feed.refetch}
        emptyTitle="No entries for this filter"
        emptyBody="Switch back to All Activity to see the full feed."
        skeleton={<RowSkeleton rows={3} />}
      >
      <ol className="space-y-4">
            {entries.map((entry) => (
              <li key={entry.id} className="relative pl-7">
                <span
                  className={cn(
                    'absolute left-0 top-6 size-2.5 rounded-full ring-4 ring-canvas',
                    entry.status.tone === 'success'
                      ? 'bg-success'
                      : 'bg-ink-4',
                  )}
                />

                <Card className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Chip tone={entry.chip.tone}>{entry.chip.label}</Chip>
                      <h2 className="mt-2.5 text-[16px] font-semibold text-ink">
                        {entry.title}
                      </h2>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-3">
                        <span>{longDate(entry.date)}</span>
                        <span>{entry.time}</span>
                        <StatusDot
                          tone={entry.status.tone}
                          className="!text-[11.5px]"
                        >
                          {entry.status.label}
                        </StatusDot>
                      </div>
                    </div>
                    <AvatarStack avatars={entry.team} className="shrink-0" />
                  </div>

                  <div
                    className={cn(
                      'mt-4 rounded-r-[8px] border-l-[3px] bg-canvas px-4 py-3',
                      noteRules[entry.chip.tone] ?? noteRules.neutral,
                    )}
                  >
                    <p className="text-[12.5px] leading-relaxed text-ink-2">
                      <span className="font-semibold text-ink">
                        Supervisor Note:{' '}
                      </span>
                      {entry.note}
                    </p>

                    {/* Only rendered when recorded — an empty "Workers: —" row
                        on every entry would be noise. */}
                    {entry.workersPresent || entry.materialsUsed ? (
                      <p className="mt-2 text-[11.5px] text-ink-3">
                        {entry.workersPresent ? (
                          <span className="tnum">
                            {entry.workersPresent} worker
                            {entry.workersPresent === 1 ? '' : 's'} on site
                          </span>
                        ) : null}
                        {entry.workersPresent && entry.materialsUsed ? ' · ' : ''}
                        {entry.materialsUsed}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {entry.photos.map((photo, i) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setLightbox(photo.url)}
                        className="focus-ring aspect-[4/3] overflow-hidden rounded-[8px]"
                      >
                        <img
                          src={photo.url}
                          onError={onImageError}
                          alt={photo.caption ?? `${entry.title} photo ${i + 1}`}
                          loading="lazy"
                          className="size-full object-cover transition-transform duration-300 hover:scale-105"
                        />
                      </button>
                    ))}

                    {Array.from({ length: entry.uploadSlots }, (_, i) => (
                      <button
                        key={`slot-${i}`}
                        type="button"
                        disabled={uploadingFor === entry.id}
                        onClick={() => openPicker(entry.id)}
                        aria-label="Add photo"
                        className="focus-ring flex aspect-[4/3] items-center justify-center rounded-[8px] border border-dashed border-line-strong bg-subtle/60 text-ink-4 transition-colors hover:border-brand-200 hover:text-brand-ink disabled:opacity-60"
                      >
                        {uploadingFor === entry.id ? (
                          <span className="size-5 animate-spin rounded-full border-2 border-line-strong border-t-brand-600" />
                        ) : (
                          <Plus className="size-5" strokeWidth={1.75} />
                        )}
                      </button>
                    ))}
                  </div>
                </Card>
              </li>
            ))}
          </ol>
          </QueryBoundary>
        </div>

        {/* ---------------- AI insights rail ---------------- */}
        <aside className="space-y-5 lg:sticky lg:top-[88px] lg:self-start">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <TriangleAlert className="size-4 text-brand-ink" strokeWidth={2} />
              <h2 className="text-[15px] font-semibold text-ink">Open Findings</h2>
            </div>

            {/* This rail used to be headed "AI Insights" and render two fixed
                cards about an MEP clash and forecast rain, with buttons that
                admitted they were not wired up. These are the project's real
                open alerts, worst severity first. The CV pipeline that is
                meant to raise them is out of scope, so today they come from
                the seed or from a PM logging one by hand. */}
            <p className="eyebrow mt-4">Quality issues awaiting action</p>

            {findings.isLoading ? (
              <div className="mt-3">
                <RowSkeleton rows={2} />
              </div>
            ) : (findings.data?.length ?? 0) === 0 ? (
              <p className="mt-3 text-[12px] leading-relaxed text-ink-2">
                Nothing open on this project.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {findings.data.map((finding) => (
                  <li
                    key={finding.id}
                    className="rounded-[10px] border border-line bg-canvas p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12.5px] font-semibold text-ink">
                        {finding.title}
                      </p>
                      <Chip
                        tone={
                          finding.severity === 'Critical' ||
                          finding.severity === 'High'
                            ? 'danger'
                            : finding.severity === 'Medium'
                              ? 'warning'
                              : 'neutral'
                        }
                        uppercase={false}
                      >
                        {finding.severity}
                      </Chip>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">
                      {finding.body}
                    </p>
                    {finding.location ? (
                      <p className="mt-1 text-[11px] text-ink-3">
                        {finding.location}
                      </p>
                    ) : null}
                    <Link
                      to="/analytics"
                      className="focus-ring mt-2 inline-block rounded text-[11.5px] font-semibold text-brand-ink hover:underline"
                    >
                      Triage in Alerts
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="my-5 h-px bg-line" />

            <p className="eyebrow">Activity Breakdown</p>
            {(breakdown.data?.length ?? 0) === 0 ? (
              <p className="mt-3 text-[12px] text-ink-2">
                No site updates recorded yet.
              </p>
            ) : null}
            <ul className="mt-3 space-y-2.5">
              {(breakdown.data ?? []).map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-[12px]">
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      activityDots[item.tone],
                    )}
                  />
                  <span className="flex-1 truncate text-ink-2">{item.label}</span>
                  <span className="tnum font-semibold text-ink">
                    {item.value}%
                  </span>
                </li>
              ))}
            </ul>

            {/* Exports the feed as it is filtered on screen. It used to say
                "Report queued. It will appear in Analytics." — nothing was
                queued and nothing appeared. */}
            <Button
              variant="outline"
              iconRight={ArrowRight}
              className="mt-5 w-full"
              disabled={entries.length === 0}
              onClick={() => {
                const count = downloadCsv(
                  'homebuild-site-feed',
                  [
                    { key: 'date', label: 'Date' },
                    { key: 'category', label: 'Work Category' },
                    { key: 'title', label: 'Location' },
                    { key: 'supervisor', label: 'Supervisor' },
                    { key: 'note', label: 'Notes' },
                    { key: 'photoCount', label: 'Photos' },
                  ],
                  entries.map((e) => ({
                    ...e,
                    supervisor: e.supervisor ?? 'Unknown',
                    photoCount: e.photos.length,
                  })),
                )
                toast(`Exported ${count} update${count === 1 ? '' : 's'} as CSV.`)
              }}
            >
              Export Site Log
            </Button>
          </Card>
        </aside>
      </div>

      {/* ---------------- new update dialog ---------------- */}
      <Modal
        open={updateOpen}
        onClose={() => setUpdateOpen(false)}
        title="New Site Update"
        description="Record a day's work on site, with photos and metadata."
        footer={
          <>
            <Button variant="outline" onClick={() => setUpdateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              form="new-update-form"
              type="submit"
              disabled={posting}
            >
              {posting ? 'Posting…' : 'Post Update'}
            </Button>
          </>
        }
      >
        <form id="new-update-form" onSubmit={postUpdate} className="space-y-4">
          <FormMessage>{postError}</FormMessage>

          <div>
            <label htmlFor="su-project" className="eyebrow mb-1.5 block">
              Project
            </label>
            <select
              id="su-project"
              value={draft.projectId}
              onChange={(e) =>
                /* Clearing the milestone matters: it belongs to the project
                   being switched away from. */
                setDraft((d) => ({
                  ...d,
                  projectId: e.target.value,
                  milestoneId: '',
                }))
              }
              required
              disabled={posting}
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
            >
              <option value="">Select a project…</option>
              {(projectOptions.data ?? []).map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="su-cat" className="eyebrow mb-1.5 block">
                Work Category
              </label>
              <select
                id="su-cat"
                value={draft.workCategory}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, workCategory: e.target.value }))
                }
                disabled={posting}
                className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
              >
                {WORK_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="su-status" className="eyebrow mb-1.5 block">
                Work Status
              </label>
              <select
                id="su-status"
                value={draft.status}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                disabled={posting}
                className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
              >
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="su-loc" className="eyebrow mb-1.5 block">
              Location on Site
            </label>
            <input
              id="su-loc"
              value={draft.location}
              onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
              placeholder="e.g. East Wing, Level 4"
              disabled={posting}
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-ink-4"
            />
          </div>

          {/* The rest of PRD 5.2.5's optional metadata. Optional in the
              document and optional here — a supervisor with 2 minutes to post
              should not be blocked on a headcount. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="su-workers" className="eyebrow mb-1.5 block">
                Workers Present
              </label>
              <input
                id="su-workers"
                type="number"
                min="0"
                value={draft.workersPresent}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, workersPresent: e.target.value }))
                }
                placeholder="12"
                disabled={posting}
                className="focus-ring tnum h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-ink-4"
              />
            </div>
            <div>
              <label htmlFor="su-materials" className="eyebrow mb-1.5 block">
                Materials Used
              </label>
              <input
                id="su-materials"
                value={draft.materialsUsed}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, materialsUsed: e.target.value }))
                }
                placeholder="e.g. 40 bags OPC, 2 t steel"
                disabled={posting}
                className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-ink-4"
              />
            </div>
          </div>

          <div>
            <label htmlFor="su-milestone" className="eyebrow mb-1.5 block">
              Milestone Reference
            </label>
            <select
              id="su-milestone"
              value={draft.milestoneId}
              onChange={(e) =>
                setDraft((d) => ({ ...d, milestoneId: e.target.value }))
              }
              disabled={posting || !draft.projectId}
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink disabled:opacity-60"
            >
              <option value="">
                {draft.projectId ? 'Not linked' : 'Choose a project first'}
              </option>
              {(milestoneOptions.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.sequence}. {m.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11.5px] text-ink-3">
              Optional — which milestone this day’s work contributes to.
            </p>
          </div>

          <div>
            <label htmlFor="su-note" className="eyebrow mb-1.5 block">
              Supervisor Note
            </label>
            <textarea
              id="su-note"
              rows={4}
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Describe what happened on site…"
              disabled={posting}
              className="focus-ring w-full resize-none rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-4"
            />
          </div>

          <p className="text-[11.5px] leading-relaxed text-ink-3">
            Photos are added to the entry after posting, from its upload slots.
          </p>
        </form>
      </Modal>

      {/* ---------------- photo lightbox ---------------- */}
      <Modal
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        title="Site Photo"
        size="lg"
      >
        {lightbox ? (
          <img
            src={lightbox}
            onError={onImageError}
            alt="Site photo, enlarged"
            className="w-full rounded-[8px] object-cover"
          />
        ) : null}
      </Modal>
    </>
  )
}
