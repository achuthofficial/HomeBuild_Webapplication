import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Plus, Sparkles, ArrowRight } from 'lucide-react'

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
import { aiInsights, activityBreakdown } from '@/data/siteFeed'
import QueryBoundary, { RowSkeleton } from '@/components/ui/QueryBoundary'
import { useQuery } from '@/hooks/useQuery'
import { listFeedEntries, listFeedCategories, attachPhoto } from '@/api/siteFeed'
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
  const fileInput = useRef(null)
  /* Which entry the hidden file input is currently acting for. */
  const pendingEntry = useRef(null)

  /* Photos now come back with the feed itself — they are rows in
     site_update_photos, signed in one batch, rather than being inferred from
     storage prefixes. */
  const feed = useQuery(() => listFeedEntries({ category: filter }), [filter])
  const categories = useQuery(() => listFeedCategories(), [])
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
        subtitle="Real-time construction logs for Phase 2: Structural Integrity"
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
              <Sparkles className="size-4 text-brand-ink" strokeWidth={2} />
              <h2 className="text-[15px] font-semibold text-ink">AI Insights</h2>
            </div>

            <p className="eyebrow mt-4">Detected Potential Issues</p>

            <ul className="mt-3 space-y-3">
              {aiInsights.map((insight) => {
                const Icon = insight.icon
                return (
                  <li
                    key={insight.id}
                    className="rounded-[10px] border border-line bg-canvas p-3.5"
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon
                        className="mt-px size-4 shrink-0 text-ink-2"
                        strokeWidth={1.75}
                      />
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-ink">
                          {insight.title}
                        </p>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">
                          {insight.body}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            toast(
                              `“${insight.action}” is not wired up in this prototype.`,
                              { tone: 'info' },
                            )
                          }
                          className="focus-ring mt-2 rounded text-[11.5px] font-semibold text-brand-ink hover:underline"
                        >
                          {insight.action}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="my-5 h-px bg-line" />

            <p className="eyebrow">Activity Breakdown</p>
            <ul className="mt-3 space-y-2.5">
              {activityBreakdown.map((item) => (
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

            <Button
              variant="outline"
              iconRight={ArrowRight}
              className="mt-5 w-full"
              onClick={() => toast('Report queued. It will appear in Analytics.')}
            >
              Generate Report
            </Button>
          </Card>
        </aside>
      </div>

      {/* ---------------- new update dialog ---------------- */}
      <Modal
        open={updateOpen}
        onClose={() => setUpdateOpen(false)}
        title="New Site Update"
        description="Log progress against Phase 2: Structural Integrity."
        footer={
          <>
            <Button variant="outline" onClick={() => setUpdateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={() => {
                setUpdateOpen(false)
                toast('Site update posted to the feed.')
              }}
            >
              Post Update
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="su-cat" className="eyebrow mb-1.5 block">
              Work Category
            </label>
            <select
              id="su-cat"
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px]"
            >
              {feedFilters.slice(1).map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="su-loc" className="eyebrow mb-1.5 block">
              Location on Site
            </label>
            <input
              id="su-loc"
              placeholder="e.g. East Wing, Level 4"
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] placeholder:text-ink-4"
            />
          </div>
          <div>
            <label htmlFor="su-note" className="eyebrow mb-1.5 block">
              Supervisor Note
            </label>
            <textarea
              id="su-note"
              rows={4}
              placeholder="Describe what happened on site…"
              className="focus-ring w-full resize-none rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-ink-4"
            />
          </div>
        </div>
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
