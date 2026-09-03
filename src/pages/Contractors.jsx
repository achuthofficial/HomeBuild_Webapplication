import { useMemo, useState } from 'react'
import { MoreVertical, Star } from 'lucide-react'

import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import Segmented from '@/components/ui/Segmented'
import FilterSelect from '@/components/ui/FilterSelect'
import StarRating from '@/components/ui/StarRating'
import Sparkline from '@/components/ui/Sparkline'
import Modal from '@/components/ui/Modal'
import QueryBoundary, { KpiSkeleton, RowSkeleton } from '@/components/ui/QueryBoundary'
import { cn } from '@/lib/cn'
import { useToast } from '@/context/ToastContext'
import { useQuery } from '@/hooks/useQuery'
import {
  listContractors,
  getContractorKpis,
  listTradeFilters,
  contractorTabs,
  tradeTones,
} from '@/api/contractors'

/** KPI copy stays here; the query supplies only the figures. */
function buildKpis(k) {
  return [
    { id: 'active-workforce', label: 'Active Workforce', value: String(k.activeWorkforce),
      badge: { label: 'Directory', tone: 'success' }, sub: 'Vetted partners on the platform' },
    { id: 'avg-performance', label: 'Avg. Performance', value: k.avgPerformance,
      badge: { label: 'Stable', tone: 'brand' }, sub: 'Based on safety & schedule KPIs' },
    { id: 'budget-utilization', label: 'Budget Utilization', value: '74%',
      badge: { label: 'In Review', tone: 'warning' }, sub: 'Allocated this quarter' },
    { id: 'compliance-rate', label: 'Compliance Rate', value: k.complianceRate,
      sub: 'Insurance & Permits valid', watermark: true },
  ]
}

const badgeTones = {
  success: 'text-success',
  brand: 'text-brand-ink',
  warning: 'text-warning',
}

const scoreTones = {
  success: 'bg-success',
  brand: 'bg-brand-600',
  danger: 'bg-danger-bar',
}

const avatarTints = {
  ELECTRICAL: 'bg-violet-bg text-violet',
  CIVIL: 'bg-success-bg text-success',
  MECHANICAL: 'bg-info-bg text-brand-ink',
  CLEANING: 'bg-orange-bg text-orange-ink',
}

export default function Contractors() {
  const { toast } = useToast()
  const [tab, setTab] = useState('All')
  const [trade, setTrade] = useState('All Trades')
  const [minRating, setMinRating] = useState(false)
  const [menuFor, setMenuFor] = useState(null)

  /* Filtering happens in the query so the directory can grow past what is
     reasonable to hold in memory — PRD goal 4 targets 200+ contractors. */
  const contractorsQuery = useQuery(
    () => listContractors({ tab, trade, minRating }),
    [tab, trade, minRating],
  )
  const kpisQuery = useQuery(() => getContractorKpis(), [])
  const tradesQuery = useQuery(() => listTradeFilters(), [])

  const rows = contractorsQuery.data ?? []
  const tradeFilters = tradesQuery.data ?? ['All Trades']

  return (
    <>
      <PageHeader
        eyebrow="Resources"
        title="Contractor Management"
        subtitle="Directory of active verified partners and performance tracking."
        actions={
          <>
            <Segmented
              options={contractorTabs}
              value={tab}
              onChange={setTab}
              variant="filled"
              ariaLabel="Contractor type"
            />
            <FilterSelect
              value={trade}
              options={tradeFilters}
              onChange={setTrade}
              align="right"
            />
            <button
              type="button"
              onClick={() => setMinRating((v) => !v)}
              aria-pressed={minRating}
              className={cn(
                'focus-ring inline-flex h-9 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-semibold transition-colors',
                minRating
                  ? 'border-warning bg-warning-bg text-warning'
                  : 'border-line bg-surface text-ink hover:bg-subtle',
              )}
            >
              Min Rating
              <Star
                className={cn('size-3.5', minRating && 'fill-warning')}
                strokeWidth={1.75}
              />
            </button>
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
        {(kpisQuery.data ? buildKpis(kpisQuery.data) : []).map((kpi) => (
          <Card key={kpi.id} className="relative overflow-hidden p-5">
            <p className="eyebrow">{kpi.label}</p>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="tnum text-[28px] font-bold leading-none text-ink">
                {kpi.value}
              </span>
              {kpi.badge ? (
                <span
                  className={cn(
                    'text-[11px] font-semibold',
                    badgeTones[kpi.badge.tone],
                  )}
                >
                  {kpi.badge.label}
                </span>
              ) : null}
            </div>
            <p className="mt-2 max-w-[13rem] text-[11px] leading-snug text-ink-3">
              {kpi.sub}
            </p>

            {kpi.watermark ? (
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-4 -right-3 size-24 text-line"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              >
                <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            ) : null}
          </Card>
        ))}
      </div>
      </QueryBoundary>

      <Card className="mt-4 overflow-hidden">
        <div className="scrollbar-slim overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-canvas/60">
                {[
                  'Contractor Name',
                  'Trade',
                  'Rating',
                  'Active Projects',
                  'Performance Score',
                  'History',
                  '',
                ].map((heading, i) => (
                  <th
                    key={heading || i}
                    scope="col"
                    className="eyebrow px-5 py-3.5 font-semibold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-line last:border-b-0 transition-colors hover:bg-canvas/60"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                          avatarTints[row.trade] ?? 'bg-subtle text-ink-2',
                        )}
                      >
                        {row.initials}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-ink">
                          {row.name}
                        </span>
                        <span className="tnum block text-[11px] text-ink-3">
                          ID: {row.id}
                        </span>
                      </span>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <Chip tone={tradeTones[row.trade]}>{row.trade}</Chip>
                  </td>

                  <td className="px-5 py-4">
                    <StarRating value={row.rating} />
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      {row.activeProjects.map((code) => (
                        <span
                          key={code}
                          className="rounded-[5px] bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-ink-2"
                        >
                          {code}
                        </span>
                      ))}
                      {row.extraProjects > 0 ? (
                        <span className="rounded-[5px] bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-ink-3">
                          +{row.extraProjects}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn(
                            'block h-full rounded-full',
                            scoreTones[row.scoreTone],
                          )}
                          style={{ width: `${row.score}%` }}
                        />
                      </span>
                      <span className="tnum text-[12px] font-semibold text-ink">
                        {row.score}%
                      </span>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <Sparkline data={row.history} tone={row.historyTone} />
                  </td>

                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setMenuFor(row)}
                      aria-label={`Actions for ${row.name}`}
                      className="focus-ring rounded-[6px] p-1.5 text-ink-4 transition-colors hover:bg-subtle hover:text-ink-2"
                    >
                      <MoreVertical className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {contractorsQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-6">
                    <RowSkeleton rows={4} />
                  </td>
                </tr>
              ) : null}

              {!contractorsQuery.isLoading && contractorsQuery.error ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[13px] text-danger">
                    {contractorsQuery.error}
                  </td>
                </tr>
              ) : null}

              {!contractorsQuery.isLoading && !contractorsQuery.error && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <p className="text-[14px] font-semibold text-ink">
                      No contractors match
                    </p>
                    <p className="mt-1 text-[13px] text-ink-2">
                      Clear the trade or rating filter to see the full directory.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
          <p className="text-[12px] text-ink-3">
            Showing {rows.length === 0 ? 0 : 1}-{rows.length} of {rows.length}{' '}
            contractors
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled
              onClick={() => {}}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast('Further pages are not populated in this prototype.', {
                  tone: 'info',
                })
              }
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        open={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name ?? ''}
        description={menuFor ? `ID: ${menuFor.id} • ${menuFor.trade}` : ''}
        size="sm"
      >
        <div className="space-y-1">
          {[
            'View Performance History',
            'Assign to Project',
            'Review Compliance Documents',
            'Suspend Contractor',
          ].map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => {
                setMenuFor(null)
                toast(`${action} — not wired up in this prototype.`, {
                  tone: 'info',
                })
              }}
              className={cn(
                'focus-ring block w-full rounded-[8px] px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-subtle',
                action.startsWith('Suspend')
                  ? 'text-danger hover:bg-danger-bg/50'
                  : 'text-ink-2 hover:text-ink',
              )}
            >
              {action}
            </button>
          ))}
        </div>
      </Modal>
    </>
  )
}
