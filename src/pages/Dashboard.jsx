import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import {
  Building2,
  CalendarClock,
  Sparkles,
  FileCheck2,
  Wallet,
} from 'lucide-react'

import PageHeader from '@/components/layout/PageHeader'
import Card, { CardHeader } from '@/components/ui/Card'
import KpiCard from '@/components/ui/KpiCard'
import ProgressBar from '@/components/ui/ProgressBar'
import AvatarStack from '@/components/ui/AvatarStack'
import QueryBoundary, { KpiSkeleton, RowSkeleton } from '@/components/ui/QueryBoundary'
import { cn } from '@/lib/cn'
import { clockTime } from '@/lib/format'
import { onImageError } from '@/lib/imageFallback'
import { useAuth } from '@/context/AuthContext'
import { useQuery } from '@/hooks/useQuery'
import {
  getDashboardKpis,
  getStatusOverview,
  getRecentUpdates,
} from '@/api/dashboard'

const rowIconTones = {
  brand: 'bg-brand-50 text-brand-ink',
  violet: 'bg-violet-bg text-violet',
  success: 'bg-success-bg text-success',
}

const labelTones = {
  brand: 'text-ink-3',
  violet: 'text-violet',
  success: 'text-ink-3',
}

const dotTones = {
  brand: 'bg-brand-600',
  success: 'bg-success',
  neutral: 'bg-line-strong',
}

/**
 * Builds the five KPI cards from the aggregate query.
 *
 * Icons, tones and copy stay in the client — they are presentation, and the
 * database has no business knowing that "Delayed" is rendered in violet.
 */
function buildKpis(k) {
  return [
    {
      id: 'active-projects',
      label: 'Active Projects',
      value: String(k.activeProjects),
      sub: 'Across the portfolio',
      subTone: 'success',
      subIcon: 'trend',
      icon: Building2,
      iconTone: 'brand',
      valueTone: 'ink',
    },
    {
      id: 'delayed',
      label: 'Delayed',
      value: String(k.delayed),
      sub: k.delayed > 0 ? 'Requires attention' : 'All on schedule',
      icon: CalendarClock,
      iconTone: 'violet',
      valueTone: 'violet',
    },
    {
      id: 'ai-quality-alerts',
      label: 'AI Quality Alerts',
      value: String(k.openAlerts),
      sub: 'High precision detection',
      icon: Sparkles,
      iconTone: 'success',
      valueTone: 'success',
    },
    {
      id: 'pending-approvals',
      label: 'Pending Approvals',
      value: String(k.pendingApprovals),
      sub: 'Ready for review',
      icon: FileCheck2,
      iconTone: 'warning',
      valueTone: 'warning',
    },
    {
      id: 'budget-health',
      label: 'Budget Health',
      value: `${k.budgetHealth}%`,
      progress: k.budgetHealth,
      icon: Wallet,
      iconTone: 'brand',
      valueTone: 'ink',
    },
  ]
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  /* AppLayout bumps this when Create New Project succeeds — from the topbar,
     reachable on every screen including this one, the app's landing page.
     Projects.jsx already keys its list on it; this screen never did, so a
     project created while sitting on Overview (the default screen after
     sign-in) needed a reload before "Active Projects" or the status rail
     below noticed it existed. */
  const { dataVersion } = useOutletContext()

  const kpis = useQuery(() => getDashboardKpis(), [dataVersion])
  const overview = useQuery(() => getStatusOverview(4), [dataVersion])
  const updates = useQuery(() => getRecentUpdates(3), [])

  return (
    <>
      <PageHeader
        title="Executive Dashboard"
        subtitle={`Welcome back, ${user?.firstName ?? 'there'}. Here is your portfolio status for today.`}
      />

      {/* ---------------- KPI row ---------------- */}
      <QueryBoundary
        isLoading={kpis.isLoading}
        error={kpis.error}
        data={kpis.data}
        onRetry={kpis.refetch}
        isEmpty={() => false}
        skeleton={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <KpiSkeleton key={i} />
            ))}
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {kpis.data ? buildKpis(kpis.data).map((kpi) => (
            <KpiCard key={kpi.id} {...kpi} />
          )) : null}
        </div>
      </QueryBoundary>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        {/* ---------------- project status ---------------- */}
        <Card className="p-5">
          <CardHeader
            title="Project Status Overview"
            action={
              <Link
                to="/projects"
                className="focus-ring rounded text-[12px] font-semibold text-brand-ink hover:underline"
              >
                View All
              </Link>
            }
          />

          <div className="mt-5">
            <QueryBoundary
              isLoading={overview.isLoading}
              error={overview.error}
              data={overview.data}
              onRetry={overview.refetch}
              skeleton={<RowSkeleton rows={4} />}
              emptyTitle="No active projects"
              emptyBody="Create a project to see its progress here."
            >
              <ul className="space-y-1">
                {overview.data?.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => navigate('/projects')}
                      className="focus-ring flex w-full items-center gap-3.5 rounded-[10px] p-2 text-left transition-colors hover:bg-canvas"
                    >
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-[9px]',
                          rowIconTones[row.tone],
                        )}
                      >
                        <Building2 className="size-4" strokeWidth={1.75} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[13.5px] font-semibold text-ink">
                            {row.name}
                          </span>
                          <span
                            className={cn(
                              'tnum shrink-0 text-[11.5px] font-medium',
                              labelTones[row.tone],
                            )}
                          >
                            {row.label}
                          </span>
                        </span>
                        <ProgressBar
                          value={row.progress}
                          tone={row.tone}
                          className="mt-2"
                          label={`${row.name} progress`}
                        />
                      </span>

                      <AvatarStack avatars={row.team} className="shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </QueryBoundary>
          </div>
        </Card>

        {/* ---------------- site updates ---------------- */}
        <Card className="p-5">
          <CardHeader title="Site Updates" />

          <div className="mt-5">
            <QueryBoundary
              isLoading={updates.isLoading}
              error={updates.error}
              data={updates.data}
              onRetry={updates.refetch}
              skeleton={<RowSkeleton rows={3} />}
              emptyTitle="No site updates"
              emptyBody="Updates posted from the Construction feed appear here."
            >
              <ol className="space-y-5">
                {updates.data?.map((update, i) => (
                  <li key={update.id} className="relative pl-5">
                    <span
                      className={cn(
                        'absolute left-0 top-[3px] size-2 rounded-full',
                        dotTones[update.dot],
                      )}
                    />
                    {i < (updates.data?.length ?? 0) - 1 ? (
                      <span className="absolute bottom-[-14px] left-[3.5px] top-4 w-px bg-line" />
                    ) : null}

                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-4">
                      {clockTime(update.time)} • {update.site}
                    </p>

                    <p className="mt-1 text-[13px] font-semibold leading-snug text-ink">
                      {update.title}
                    </p>

                    {update.photoUrl ? (
                      <img
                        src={update.photoUrl}
                        onError={onImageError}
                        alt=""
                        loading="lazy"
                        className="mt-2.5 aspect-[16/9] w-full rounded-[8px] object-cover"
                      />
                    ) : null}

                    {update.body ? (
                      <p className="mt-1.5 line-clamp-3 text-[11.5px] leading-relaxed text-ink-2">
                        {update.body}
                      </p>
                    ) : null}

                    {update.author ? (
                      <p className="mt-1 text-[11px] italic text-ink-3">
                        — {update.author}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </QueryBoundary>
          </div>

          <Link
            to="/construction"
            className="focus-ring mt-5 block rounded text-[12px] font-semibold text-brand-ink hover:underline"
          >
            Open Daily Site Feed
          </Link>
        </Card>
      </div>
    </>
  )
}
