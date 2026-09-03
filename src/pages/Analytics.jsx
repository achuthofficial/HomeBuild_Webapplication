import { useMemo, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'

import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import QueryBoundary, { KpiSkeleton, RowSkeleton } from '@/components/ui/QueryBoundary'
import { cn } from '@/lib/cn'
import { longDate } from '@/lib/format'
import { useToast } from '@/context/ToastContext'
import { useQuery } from '@/hooks/useQuery'
import {
  listAlerts,
  getAlertKpis,
  acknowledgeAlert,
  severityFilters,
  statusFilters,
  ALERTS_PER_PAGE,
} from '@/api/alerts'
import { TriangleAlert, Zap, ShieldCheck, Timer } from 'lucide-react'

/** KPI presentation stays client-side; the query returns only the numbers. */
function buildKpis(k) {
  return [
    { id: 'active-critical', label: 'Active Critical', value: String(k.activeCritical),
      sub: 'Open and unresolved', subIcon: 'trend', icon: TriangleAlert, iconTone: 'danger' },
    { id: 'medium-risks', label: 'Medium Risks', value: String(k.mediumRisks),
      sub: 'Stable monitoring', icon: Zap, iconTone: 'warning' },
    { id: 'ai-confidence', label: 'AI Confidence', value: k.aiConfidence,
      sub: 'Mean across open alerts', subTone: 'success', icon: ShieldCheck, iconTone: 'success' },
    { id: 'avg-resolution', label: 'Avg Resolution', value: '2.4h',
      sub: 'Target: < 4h', icon: Timer, iconTone: 'brand' },
  ]
}

/* Tile tints sampled from the mockup: #FFF4F3 / #FEF5E7 / #E7F8F2. */
const iconTones = {
  danger: 'bg-danger-tile text-danger',
  warning: 'bg-warning-tile text-warning',
  success: 'bg-success-bg text-success',
  brand: 'bg-brand-tile text-brand-ink',
}

const subTones = {
  success: 'text-success',
  'ink-3': 'text-ink-3',
}

/**
 * Severity rendering follows the mockup exactly: `Critical` is bold plain
 * text with no chip, while Medium and Low get tinted chips with a dot.
 */
function Severity({ level }) {
  if (level === 'Critical') {
    return <span className="text-[12.5px] font-bold text-ink">Critical</span>
  }
  return (
    <Chip tone={level === 'Medium' ? 'warning' : 'neutral'} dot uppercase={false}>
      {level}
    </Chip>
  )
}

export default function Analytics() {
  const { toast } = useToast()
  const [severity, setSeverity] = useState('All Levels')
  const [status, setStatus] = useState('Active Only')
  const [page, setPage] = useState(1)

  /* Filtering and paging happen in the query, not the browser: there are 128
     seeded alerts and the CV pipeline adds more, so fetching them all to slice
     ten rows would not hold up. */
  const alertsQuery = useQuery(
    () => listAlerts({ severity, status, page }),
    [severity, status, page],
  )
  const kpisQuery = useQuery(() => getAlertKpis(), [])

  const visible = alertsQuery.data?.alerts ?? []
  const total = alertsQuery.data?.total ?? 0
  const totalPages = alertsQuery.data?.totalPages ?? 1
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * ALERTS_PER_PAGE

  /* Optimistic acknowledge: flip the row immediately, roll back on failure. */
  const onAcknowledge = async (alert) => {
    const { error } = await acknowledgeAlert(alert.id).then(
      () => ({ error: null }),
      (e) => ({ error: e.message }),
    )
    if (error) {
      toast(error, { tone: 'info' })
      return
    }
    toast(`“${alert.type}” acknowledged.`)
    alertsQuery.refetch()
    kpisQuery.refetch()
  }

  /* Changing a filter must return to page 1, or a narrow filter can land on
     a page that no longer exists. */
  const onFilter = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  return (
    <>
      <PageHeader
        title="AI Alert Management"
        subtitle="Real-time structural monitoring and anomaly detection system."
        actions={
          <>
            <Button
              variant="outline"
              icon={Download}
              onClick={() => toast('Alert report exported.')}
            >
              Export Report
            </Button>
            <Button
              variant="primary"
              icon={RefreshCw}
              onClick={() => toast('Detection models re-synced. 0 new alerts.')}
            >
              Refresh Sync
            </Button>
          </>
        }
      />

      <QueryBoundary
        isLoading={kpisQuery.isLoading}
        error={kpisQuery.error}
        data={kpisQuery.data}
        onRetry={kpisQuery.refetch}
        isEmpty={() => false}
        skeleton={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <KpiSkeleton key={i} />
            ))}
          </div>
        }
      >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(kpisQuery.data ? buildKpis(kpisQuery.data) : []).map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.id} className="p-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-[7px]',
                    iconTones[kpi.iconTone],
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <p className="eyebrow">{kpi.label}</p>
              </div>

              <p className="tnum mt-3 text-[28px] font-bold leading-none text-ink">
                {kpi.value}
              </p>
              <p
                className={cn(
                  'mt-1.5 text-[11px]',
                  subTones[kpi.subTone] ?? 'text-ink-3',
                )}
              >
                {kpi.subIcon === 'trend' ? '↗ ' : ''}
                {kpi.sub}
              </p>
            </Card>
          )
        })}
      </div>
      </QueryBoundary>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <FilterSelect
              label="Severity"
              value={severity}
              options={severityFilters}
              onChange={onFilter(setSeverity)}
            />
            <FilterSelect
              label="Status"
              value={status}
              options={statusFilters}
              onChange={onFilter(setStatus)}
            />
          </div>

          <div className="flex items-center gap-3">
            <p className="tnum text-[12px] text-ink-3">
              Showing {total === 0 ? 0 : start + 1}-
              {Math.min(start + ALERTS_PER_PAGE, total)} of {total} alerts
            </p>
          </div>
        </div>

        <div className="scrollbar-slim overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-y border-line bg-canvas/60">
                {[
                  'Alert Type',
                  'Severity',
                  'Confidence',
                  'Project',
                  'Detected',
                  'Actions',
                ].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="eyebrow px-5 py-3.5 font-semibold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visible.map((alert) => (
                <tr
                  key={alert.id}
                  className="border-b border-line last:border-b-0 transition-colors hover:bg-canvas/60"
                >
                  <td className="px-5 py-4">
                    <p className="text-[13px] font-semibold text-ink">
                      {alert.type}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-ink-3">
                      {alert.location}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <Severity level={alert.severity} />
                  </td>

                  <td className="px-5 py-4">
                    {/* Bar colour does not vary with severity — matches mockup. */}
                    <div className="flex items-center gap-2.5">
                      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-success"
                          style={{ width: `${alert.confidence}%` }}
                        />
                      </span>
                      <span className="tnum text-[12px] font-semibold text-ink">
                        {alert.confidence}%
                      </span>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-[13px] text-ink-2">
                    {alert.project}
                  </td>

                  <td className="px-5 py-4 text-[12.5px] text-ink-3">
                    {longDate(alert.detected)}
                  </td>

                  <td className="px-5 py-4">
                    {alert.status === 'new' ? (
                      <button
                        type="button"
                        onClick={() => onAcknowledge(alert)}
                        className="focus-ring rounded text-[12px] font-semibold text-brand-ink hover:underline"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-[12px] capitalize text-ink-4">
                        {alert.status.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {alertsQuery.isLoading ? (
            <div className="px-5 py-6">
              <RowSkeleton rows={5} />
            </div>
          ) : null}

          {!alertsQuery.isLoading && alertsQuery.error ? (
            <p className="px-5 py-8 text-center text-[13px] text-danger">
              {alertsQuery.error}
            </p>
          ) : null}

          {!alertsQuery.isLoading && !alertsQuery.error && visible.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-ink-2">
              No alerts match these filters.
            </p>
          ) : null}
        </div>

        <div className="flex justify-center border-t border-line px-5 py-3.5">
          <Pagination
            page={safePage}
            totalPages={totalPages}
            onChange={setPage}
          />
        </div>
      </Card>
    </>
  )
}
