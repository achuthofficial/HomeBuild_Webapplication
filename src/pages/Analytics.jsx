import { useMemo, useState } from 'react'
import { Download, RefreshCw, Plus } from 'lucide-react'

import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import { FormMessage } from '@/components/auth/AuthForm'
import QueryBoundary, { KpiSkeleton, RowSkeleton } from '@/components/ui/QueryBoundary'
import { cn } from '@/lib/cn'
import { longDate } from '@/lib/format'
import { useToast } from '@/context/ToastContext'
import { useQuery } from '@/hooks/useQuery'
import { getPrimaryProjectId } from '@/api/finance'
import { useAuth } from '@/context/AuthContext'
import { downloadCsv } from '@/lib/csv'
import {
  listAlerts,
  raiseAlert,
  CV_CATEGORIES,
  SEVERITIES,
  getAlertKpis,
  setAlertStatus,
  alertActionsFor,
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
const SEVERITY_TONES = {
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
}

function Severity({ level }) {
  if (level === 'Critical') {
    return <span className="text-[12.5px] font-bold text-ink">Critical</span>
  }
  /* High previously fell through to `neutral` and rendered identically to
     Low — the opposite of what the severity is telling you. */
  return (
    <Chip tone={SEVERITY_TONES[level] ?? 'neutral'} dot uppercase={false}>
      {level}
    </Chip>
  )
}

export default function Analytics() {
  const { toast } = useToast()
  const { authUser } = useAuth()
  const [severity, setSeverity] = useState('All Levels')
  const [status, setStatus] = useState('Active Only')
  const [page, setPage] = useState(1)
  const [logOpen, setLogOpen] = useState(false)
  const [logging, setLogging] = useState(false)
  const [logError, setLogError] = useState(null)
  const [log, setLog] = useState({
    category: CV_CATEGORIES[0].label,
    severity: CV_CATEGORIES[0].severity,
    locationText: '',
    description: '',
  })

  /* Alerts hang off a project, so logging one needs to know which. */
  const projectQuery = useQuery(() => getPrimaryProjectId(), [])
  const projectId = projectQuery.data?.id ?? null

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

  /**
   * Alert workflow (PRD 8.4). The transition and its audit entry are written
   * by the resolve_alert function, so an unknown status is rejected there
   * rather than silently stored.
   */
  const [actingOn, setActingOn] = useState(null)

  /**
   * Logs a defect a person spotted (PRD 5.2.3's categories).
   *
   * The CV pipeline that is supposed to raise these is out of scope, which
   * left the table readable but never writable outside the seed — and left
   * the schedule forecast's "open high-severity alerts" term with nothing to
   * count on a real project.
   */
  const saveLog = async (e) => {
    e.preventDefault()
    setLogError(null)
    setLogging(true)
    try {
      await raiseAlert({
        projectId,
        category: log.category,
        severity: log.severity,
        description: log.description,
        locationText: log.locationText,
      })
      setLogOpen(false)
      setLog({
        category: CV_CATEGORIES[0].label,
        severity: CV_CATEGORIES[0].severity,
        locationText: '',
        description: '',
      })
      toast(`${log.severity} alert logged.`)
      alertsQuery.refetch()
      kpisQuery.refetch()
    } catch (error) {
      setLogError(error.message)
    } finally {
      setLogging(false)
    }
  }

  const runAction = async (alert, nextStatus, label) => {
    setActingOn(alert.id)
    try {
      await setAlertStatus(
        alert.id,
        nextStatus,
        nextStatus === 'assigned' ? authUser?.uid : null,
      )
      toast(`“${alert.type}” — ${label.toLowerCase()}.`)
      alertsQuery.refetch()
      kpisQuery.refetch()
    } catch (error) {
      toast(error.message, { tone: 'info' })
    } finally {
      setActingOn(null)
    }
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
              onClick={() => {
                /* Exports what is on screen, which is what the filters above
                   were used to select. */
                const count = downloadCsv(
                  'homebuild-alerts',
                  [
                    { key: 'type', label: 'Alert' },
                    { key: 'location', label: 'Location' },
                    { key: 'severity', label: 'Severity' },
                    { key: 'confidence', label: 'Confidence %' },
                    { key: 'project', label: 'Project' },
                    { key: 'status', label: 'Status' },
                    { key: 'detected', label: 'Detected', format: (v) => longDate(v) },
                  ],
                  visible,
                )
                toast(`Exported ${count} alert${count === 1 ? '' : 's'} as CSV.`)
              }}
            >
              Export Report
            </Button>
            <Button
              variant="outline"
              icon={RefreshCw}
              onClick={() => {
                /* This used to raise a toast claiming the detection models had
                   re-synced and found nothing. Nothing was re-synced; there is
                   no model in this build. It refetches, which is what a
                   refresh button should do. */
                alertsQuery.refetch()
                kpisQuery.refetch()
              }}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setLogOpen(true)}
              disabled={!projectId}
            >
              Log Alert
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
                    {/* Only the transitions legal from this row's state, so a
                        click cannot produce an error from the database. */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {alertActionsFor(alert.status).map((action) => (
                        <button
                          key={action.key}
                          type="button"
                          disabled={actingOn === alert.id}
                          onClick={() => runAction(alert, action.key, action.label)}
                          className={cn(
                            'focus-ring rounded text-[12px] font-semibold hover:underline disabled:opacity-50',
                            action.key === 'false_positive'
                              ? 'text-ink-3'
                              : 'text-brand-ink',
                          )}
                        >
                          {action.label}
                        </button>
                      ))}
                      {alertActionsFor(alert.status).length === 0 ? (
                        <span className="text-[12px] capitalize text-ink-4">
                          {alert.status.replace('_', ' ')}
                        </span>
                      ) : null}
                    </div>
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

      {/* ---------------- log an alert (PRD 5.2.3) ---------------- */}
      <Modal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title="Log Alert"
        description="A quality issue observed on site, in the same categories the CV model uses."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setLogOpen(false)} disabled={logging}>
              Cancel
            </Button>
            <Button form="log-alert-form" type="submit" variant="danger" disabled={logging}>
              {logging ? 'Logging…' : 'Log Alert'}
            </Button>
          </>
        }
      >
        <form id="log-alert-form" onSubmit={saveLog} className="space-y-3.5">
          <FormMessage>{logError}</FormMessage>

          <div>
            <label htmlFor="al-cat" className="eyebrow mb-1.5 block">
              Category
            </label>
            <select
              id="al-cat"
              value={log.category}
              onChange={(e) => {
                const next = CV_CATEGORIES.find((c) => c.label === e.target.value)
                /* Picking a category also sets the severity the PRD assigns
                   it, which stays editable — a cracked column is worse than
                   the table's default for its category. */
                setLog((v) => ({
                  ...v,
                  category: e.target.value,
                  severity: next?.severity ?? v.severity,
                }))
              }}
              disabled={logging}
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
            >
              {CV_CATEGORIES.map((c) => (
                <option key={c.label} value={c.label}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="al-sev" className="eyebrow mb-1.5 block">
                Severity
              </label>
              <select
                id="al-sev"
                value={log.severity}
                onChange={(e) => setLog((v) => ({ ...v, severity: e.target.value }))}
                disabled={logging}
                className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
              >
                {SEVERITIES.map((sev) => (
                  <option key={sev} value={sev}>
                    {sev}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="al-loc" className="eyebrow mb-1.5 block">
                Location
              </label>
              <input
                id="al-loc"
                value={log.locationText}
                onChange={(e) => setLog((v) => ({ ...v, locationText: e.target.value }))}
                disabled={logging}
                placeholder="Zone 3, Column C4"
                className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
              />
            </div>
          </div>

          <div>
            <label htmlFor="al-desc" className="eyebrow mb-1.5 block">
              Description
            </label>
            <textarea
              id="al-desc"
              rows={3}
              required
              value={log.description}
              onChange={(e) => setLog((v) => ({ ...v, description: e.target.value }))}
              disabled={logging}
              placeholder="Rebar spacing wider than drawing on the third lift."
              className="focus-ring w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink"
            />
          </div>

          <p className="text-[11.5px] leading-relaxed text-ink-3">
            Logged by hand, so no confidence score is recorded — that figure
            belongs to the model. Open <strong>High</strong> and{' '}
            <strong>Critical</strong> alerts add rework days to the schedule
            forecast.
          </p>
        </form>
      </Modal>
    </>
  )
}
