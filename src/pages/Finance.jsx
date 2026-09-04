import { useState } from 'react'
import { Download, Plus, MoreHorizontal, TrendingUp, TrendingDown } from 'lucide-react'

import PageHeader from '@/components/layout/PageHeader'
import Card, { CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import FilterSelect from '@/components/ui/FilterSelect'
import Modal from '@/components/ui/Modal'
import DonutChart from '@/components/charts/DonutChart'
import AreaTrend from '@/components/charts/AreaTrend'
import { cn } from '@/lib/cn'
import QueryBoundary, { KpiSkeleton, Skeleton, RowSkeleton } from '@/components/ui/QueryBoundary'
import { FormMessage } from '@/components/auth/AuthForm'
import { downloadCsv } from '@/lib/csv'
import { listActivity } from '@/api/activity'
import { rupees, longDate } from '@/lib/format'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { useQuery } from '@/hooks/useQuery'
import { Wallet, Banknote, PiggyBank } from 'lucide-react'
import {
  MILESTONE_ACTIONS,
  advanceMilestone,
  createMilestone,
  listContractorOptions,
  getPrimaryProjectId,
  getFinanceSummary,
  getBudgetTrend,
  getCostCategories,
  listExpenseCategories,
  recordExpense,
  listMilestones,
} from '@/api/finance'

export const trendRanges = ['Last 6 Months', 'Last 12 Months', 'Year to Date']

/** How many months of spend each range asks the query for. */
const RANGE_MONTHS = {
  'Last 6 Months': 6,
  'Last 12 Months': 12,
  'Year to Date': new Date().getMonth() + 1,
}

/** KPI cards from the summary. Copy and icons stay client-side. */
function buildKpis(s) {
  return [
    { id: 'total-budget', label: 'Total Budget', value: s.total,
      delta: 2.4, icon: Wallet, iconTone: 'brand' },
    { id: 'budget-consumed', label: 'Budget Consumed', value: s.consumed,
      note: `${s.consumedPct}% Used`, icon: Banknote, iconTone: 'warning' },
    { id: 'remaining', label: 'Remaining', value: s.remaining,
      delta: -1.2, icon: PiggyBank, iconTone: 'violet' },
  ]
}

/* Tile tints sampled from the mockup: #D8E2FF / #FEF5E7 / #F3EFFE. */
const iconTones = {
  brand: 'bg-brand-tile text-brand-ink',
  warning: 'bg-warning-tile text-warning',
  violet: 'bg-violet-bg text-violet',
}

/**
 * Finance KPI card. The layout differs from the dashboard's: the tinted icon
 * sits top-LEFT with the delta top-RIGHT, then the eyebrow, then the figure.
 */
function FinanceKpi({ label, value, delta, note, icon: Icon, iconTone }) {
  const positive = delta > 0

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <span
          className={cn(
            'flex size-8 items-center justify-center rounded-[8px]',
            iconTones[iconTone],
          )}
        >
          <Icon className="size-4" strokeWidth={1.75} />
        </span>

        {delta !== undefined ? (
          <span
            className={cn(
              'tnum inline-flex items-center gap-1 text-[11.5px] font-semibold',
              positive ? 'text-success' : 'text-ink-3',
            )}
          >
            {positive ? '+' : '−'}
            {Math.abs(delta)}%
            {positive ? (
              <TrendingUp className="size-3" strokeWidth={2} />
            ) : (
              <TrendingDown className="size-3" strokeWidth={2} />
            )}
          </span>
        ) : (
          <span className="text-[11.5px] font-medium text-ink-3">{note}</span>
        )}
      </div>

      <p className="eyebrow mt-5">{label}</p>
      <p className="tnum mt-1.5 text-[26px] font-bold leading-none tracking-[-0.01em] text-ink">
        {rupees(value)}
      </p>
    </Card>
  )
}

export default function Finance() {
  const { toast } = useToast()
  const { authUser } = useAuth()
  const [range, setRange] = useState(trendRanges[0])
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [menuFor, setMenuFor] = useState(null)
  const [advancing, setAdvancing] = useState(false)
  const [raising, setRaising] = useState(false)
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [invoiceError, setInvoiceError] = useState(null)
  /* Declared up here with the rest of the state, not beside the modal it
     drives: the categories query below reads it, and a `const` referenced
     before its declaration is a temporal dead zone error, not a warning. */
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [expenseError, setExpenseError] = useState(null)
  const [savingExpense, setSavingExpense] = useState(false)
  const [expense, setExpense] = useState({
    categoryId: '',
    amount: '',
    incurredOn: new Date().toISOString().slice(0, 10),
    vendor: '',
    note: '',
  })
  const [invoice, setInvoice] = useState({
    name: '',
    amount: '',
    dueDate: '',
    contractorId: '',
  })

  /* The finance screen is per-project. Resolve which project first, then fetch
     its figures — the dependent queries stay disabled until it lands. */
  const projectQuery = useQuery(() => getPrimaryProjectId(), [])
  const projectId = projectQuery.data?.id ?? null

  const summary = useQuery(
    () => getFinanceSummary(projectId),
    [projectId],
    { enabled: Boolean(projectId) },
  )
  const trend = useQuery(
    () => getBudgetTrend(projectId, RANGE_MONTHS[range] ?? 8),
    [projectId, range],
    { enabled: Boolean(projectId) },
  )
  const categories = useQuery(
    () => getCostCategories(projectId),
    [projectId],
    { enabled: Boolean(projectId) },
  )
  const milestones = useQuery(
    () => listMilestones(projectId),
    [projectId],
    { enabled: Boolean(projectId) },
  )

  /* getCostCategories returns the categories plus any spending that names no
     category, so unpack rather than treating the result as a bare list. */
  const categoryList = categories.data?.categories ?? []
  const uncategorisedSpend = categories.data?.uncategorised ?? 0

  const expenseCategories = useQuery(
    () => listExpenseCategories(projectId),
    [projectId],
    { enabled: Boolean(projectId) && expenseOpen },
  )
  const contractorOptions = useQuery(() => listContractorOptions(), [], {
    enabled: invoiceOpen,
  })
  /* Only fetched when the drawer opens — nobody reads the ledger every visit. */
  const ledger = useQuery(
    () => listActivity({ projectId, limit: 50 }),
    [projectId, ledgerOpen],
    { enabled: Boolean(projectId) && ledgerOpen },
  )

  /**
   * Moves a milestone to its next state.
   *
   * The transition rules live in the database, so an illegal move comes back
   * as an error rather than being silently allowed — this just surfaces it.
   */
  /**
   * Records spending against a category (PRD 5.3.5).
   *
   * Escrow releases are not created here — they post themselves when a
   * milestone is paid. This is the other half: the material purchases and
   * fees that never pass through the escrow chain but still spend the budget.
   */
  const saveExpense = async (e) => {
    e.preventDefault()
    setExpenseError(null)
    setSavingExpense(true)

    try {
      await recordExpense({
        projectId,
        categoryId: expense.categoryId,
        amount: expense.amount,
        incurredOn: expense.incurredOn,
        vendor: expense.vendor,
        note: expense.note,
        actorUid: authUser?.uid,
      })
      setExpenseOpen(false)
      setExpense({
        categoryId: '',
        amount: '',
        incurredOn: new Date().toISOString().slice(0, 10),
        vendor: '',
        note: '',
      })
      toast('Spending recorded.')
      /* Three things move: the category bar, the trend, and the KPI the
         database recalculated when the row landed. */
      categories.refetch()
      trend.refetch()
      summary.refetch()
    } catch (error) {
      setExpenseError(error.message)
    } finally {
      setSavingExpense(false)
    }
  }

  const raiseInvoice = async (e) => {
    e.preventDefault()
    setInvoiceError(null)
    setRaising(true)

    try {
      await createMilestone({
        projectId,
        name: invoice.name,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
        contractorId: invoice.contractorId || null,
      })
      setRaising(false)
      setInvoiceOpen(false)
      setInvoice({ name: '', amount: '', dueDate: '', contractorId: '' })
      toast(`“${invoice.name}” raised and sent for verification.`)
      milestones.refetch()
    } catch (error) {
      setRaising(false)
      setInvoiceError(error.message)
    }
  }

  const advance = async (milestone, nextStatus) => {
    setAdvancing(true)
    try {
      await advanceMilestone(milestone.id, nextStatus)
      setMenuFor(null)
      toast(
        nextStatus === 'paid'
          ? `Payment released for “${milestone.milestone}”.`
          : `“${milestone.milestone}” moved to ${nextStatus.replace(/_/g, ' ')}.`,
      )
      milestones.refetch()
      /* A paid milestone changes budget_consumed via a trigger. */
      summary.refetch()
    } catch (error) {
      toast(error.message, { tone: 'info' })
    } finally {
      setAdvancing(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Financial Overview"
        /* Named the loaded project, not "Project Alpha" — which was a
           different project's name on every screen it appeared. */
        subtitle={
          summary.data?.projectName
            ? `Budget, escrow and spend for ${summary.data.projectName}.`
            : 'Budget, escrow and spend tracking.'
        }
        actions={
          <>
            <Button
              variant="outline"
              icon={Download}
              onClick={() => {
                const rows = milestones.data ?? []
                const count = downloadCsv(
                  'homebuild-milestones',
                  [
                    { key: 'milestone', label: 'Milestone' },
                    { key: 'contractor', label: 'Contractor' },
                    { key: 'dueDate', label: 'Due Date' },
                    { key: 'amount', label: 'Amount (INR)' },
                    { key: 'statusKey', label: 'Status' },
                  ],
                  rows,
                )
                toast(`Exported ${count} milestone${count === 1 ? '' : 's'} as CSV.`)
              }}
            >
              Export Report
            </Button>
            <Button
              variant="warning"
              icon={Plus}
              onClick={() => setInvoiceOpen(true)}
            >
              New Invoice
            </Button>
          </>
        }
      />

      <QueryBoundary
        isLoading={projectQuery.isLoading || summary.isLoading}
        error={projectQuery.error ?? summary.error}
        data={summary.data}
        onRetry={summary.refetch}
        isEmpty={() => false}
        skeleton={
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <KpiSkeleton key={i} />
            ))}
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {(summary.data ? buildKpis(summary.data) : []).map((kpi) => (
            <FinanceKpi key={kpi.id} {...kpi} />
          ))}
        </div>
      </QueryBoundary>

      {/* items-start: the category card grew a bar list under its donut, and
          stretching the trend card to match left a tall empty panel beside
          it. Each card keeps its own height instead. */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <CardHeader
            title="Budget Consumption Trend"
            subtitle="Monthly spend trajectory vs. planned forecast"
            action={
              <FilterSelect
                value={range}
                options={trendRanges}
                onChange={setRange}
                align="right"
              />
            }
          />
          <div className="mt-5">
            {projectQuery.isLoading || trend.isLoading ? (
              <Skeleton className="h-[190px] w-full" />
            ) : projectQuery.error ?? trend.error ? (
              <p className="py-16 text-center text-[13px] text-danger">
                {projectQuery.error ?? trend.error}
              </p>
            ) : (trend.data?.length ?? 0) < 2 ? (
              <p className="py-16 text-center text-[13px] text-ink-2">
                Not enough spend recorded yet to draw a trend.
              </p>
            ) : (
              <AreaTrend data={trend.data} />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader
            title="Category Breakdown"
            action={
              projectId ? (
                <button
                  type="button"
                  onClick={() => setExpenseOpen(true)}
                  className="focus-ring rounded text-[12px] font-semibold text-brand-ink hover:underline"
                >
                  Record spending
                </button>
              ) : null
            }
          />
          <div className="mt-5">
            {projectQuery.isLoading || categories.isLoading ? (
              <Skeleton className="mx-auto h-[156px] w-[156px] rounded-full" />
            ) : projectQuery.error ?? categories.error ? (
              <p className="py-10 text-center text-[13px] text-danger">
                {projectQuery.error ?? categories.error}
              </p>
            ) : categoryList.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-ink-2">
                No cost categories recorded.
              </p>
            ) : (
              <>
                <DonutChart data={categoryList} />

                {/* PRD 5.3.5: budget vs spent at category level, with bars.
                    The donut alone only ever showed the PLAN — how the budget
                    was divided up, never how much of each slice had gone. */}
                <ul className="mt-5 space-y-3 border-t border-line pt-4">
                  {categoryList.map((c) => (
                    <li key={c.id ?? c.label}>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-[12.5px] font-medium text-ink">
                          {c.label}
                        </p>
                        <p className="tnum shrink-0 text-[12px] text-ink-2">
                          {rupees(c.spent)}
                          <span className="text-ink-4"> / {rupees(c.budgeted)}</span>
                        </p>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas">
                        <div
                          className={cn(
                            'h-full rounded-full transition-[width]',
                            c.over ? 'bg-danger' : 'bg-brand',
                          )}
                          /* Bar is clamped so it cannot spill out of its
                             track; the number beside it still reads over
                             100%, so an overrun is visible either way. */
                          style={{ width: `${Math.min(100, c.usedPct)}%` }}
                        />
                      </div>
                      <p
                        className={cn(
                          'mt-1 text-[11px] font-semibold',
                          c.over ? 'text-danger' : 'text-ink-4',
                        )}
                      >
                        {c.usedPct}% used{c.over ? ' — over budget' : ''}
                      </p>
                    </li>
                  ))}
                </ul>

                {uncategorisedSpend > 0 ? (
                  <p className="mt-3 text-[11.5px] text-ink-2">
                    {rupees(uncategorisedSpend)} of spending is not assigned to a
                    category, so it appears in the total but in none of the bars.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* ---------------- milestone payments ---------------- */}
      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <h2 className="text-[17px] font-semibold text-ink">
            Upcoming Milestone Payments
          </h2>
          <button
            type="button"
            onClick={() => setLedgerOpen(true)}
            className="focus-ring rounded text-[12px] font-semibold text-brand-ink hover:underline"
          >
            View All
          </button>
        </div>

        <div className="scrollbar-slim overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-y border-line bg-canvas/60">
                {['Milestone', 'Contractor', 'Due Date', 'Amount', 'Status', 'Action'].map(
                  (heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="eyebrow px-5 py-3 font-semibold"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {(milestones.data ?? []).map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-line last:border-b-0 transition-colors hover:bg-canvas/60"
                >
                  <td className="px-5 py-4 text-[13px] font-semibold text-ink">
                    {row.milestone}
                  </td>
                  <td className="px-5 py-4 text-[13px] text-ink-2">
                    {row.contractor}
                  </td>
                  <td className="px-5 py-4 text-[13px] text-ink-2">
                    {longDate(row.dueDate)}
                  </td>
                  <td className="tnum px-5 py-4 text-[13px] font-semibold text-ink">
                    {rupees(row.amount)}
                  </td>
                  <td className="px-5 py-4">
                    <Chip tone={row.status.tone} uppercase={false}>
                      {row.status.label}
                    </Chip>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setMenuFor(row)}
                      aria-label={`Actions for ${row.milestone}`}
                      className="focus-ring rounded-[6px] p-1.5 text-ink-4 transition-colors hover:bg-subtle hover:text-ink-2"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ---------------- new invoice dialog ---------------- */}
      <Modal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        title="New Invoice"
        description="Raise a milestone release against this project."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setInvoiceOpen(false)}
              disabled={raising}
            >
              Cancel
            </Button>
            <Button
              variant="warning"
              form="new-invoice-form"
              type="submit"
              disabled={raising}
            >
              {raising ? 'Raising…' : 'Raise Invoice'}
            </Button>
          </>
        }
      >
        {/* In PRD terms an invoice IS a milestone release, so this creates one
            rather than inventing a parallel concept that never reconciles. */}
        <form id="new-invoice-form" onSubmit={raiseInvoice} className="space-y-4">
          <FormMessage>{invoiceError}</FormMessage>

          <div>
            <label htmlFor="inv-name" className="eyebrow mb-1.5 block">
              Milestone Name
            </label>
            <input
              id="inv-name"
              value={invoice.name}
              onChange={(e) => setInvoice((v) => ({ ...v, name: e.target.value }))}
              placeholder="e.g. Roof Slab Sign-off"
              required
              disabled={raising}
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
            />
          </div>

          <div>
            <label htmlFor="inv-contractor" className="eyebrow mb-1.5 block">
              Contractor
            </label>
            <select
              id="inv-contractor"
              value={invoice.contractorId}
              onChange={(e) =>
                setInvoice((v) => ({ ...v, contractorId: e.target.value }))
              }
              disabled={raising}
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
            >
              <option value="">Unassigned</option>
              {(contractorOptions.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="inv-amt" className="eyebrow mb-1.5 block">
                Amount (₹)
              </label>
              <input
                id="inv-amt"
                type="number"
                min="1"
                step="1000"
                value={invoice.amount}
                onChange={(e) =>
                  setInvoice((v) => ({ ...v, amount: e.target.value }))
                }
                required
                disabled={raising}
                className="focus-ring tnum h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
              />
            </div>
            <div>
              <label htmlFor="inv-due" className="eyebrow mb-1.5 block">
                Due Date
              </label>
              <input
                id="inv-due"
                type="date"
                value={invoice.dueDate}
                onChange={(e) =>
                  setInvoice((v) => ({ ...v, dueDate: e.target.value }))
                }
                disabled={raising}
                className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
              />
            </div>
          </div>

          <p className="text-[11.5px] leading-relaxed text-ink-3">
            Raised milestones enter <strong>pending verification</strong>. The
            release percentage is derived from the amount against the project
            budget.
          </p>
        </form>
      </Modal>

      {/* ---------------- record spending (PRD 5.3.5) ---------------- */}
      <Modal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        title="Record Spending"
        description="Spending outside the escrow chain — materials, fees, hire."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setExpenseOpen(false)}
              disabled={savingExpense}
            >
              Cancel
            </Button>
            <Button form="record-expense-form" type="submit" disabled={savingExpense}>
              {savingExpense ? 'Saving…' : 'Record'}
            </Button>
          </>
        }
      >
        <form id="record-expense-form" onSubmit={saveExpense} className="space-y-3.5">
          <FormMessage>{expenseError}</FormMessage>

          <div>
            <label htmlFor="ex-cat" className="eyebrow mb-1.5 block">
              Category
            </label>
            <select
              id="ex-cat"
              required
              value={expense.categoryId}
              onChange={(e) =>
                setExpense((v) => ({ ...v, categoryId: e.target.value }))
              }
              disabled={savingExpense || expenseCategories.isLoading}
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
            >
              <option value="">
                {expenseCategories.isLoading ? 'Loading…' : 'Choose a category'}
              </option>
              {(expenseCategories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ex-amt" className="eyebrow mb-1.5 block">
                Amount (₹)
              </label>
              <input
                id="ex-amt"
                type="number"
                min="1"
                required
                value={expense.amount}
                onChange={(e) =>
                  setExpense((v) => ({ ...v, amount: e.target.value }))
                }
                disabled={savingExpense}
                className="focus-ring tnum h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
              />
            </div>
            <div>
              <label htmlFor="ex-date" className="eyebrow mb-1.5 block">
                Date
              </label>
              <input
                id="ex-date"
                type="date"
                required
                value={expense.incurredOn}
                onChange={(e) =>
                  setExpense((v) => ({ ...v, incurredOn: e.target.value }))
                }
                disabled={savingExpense}
                className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ex-vendor" className="eyebrow mb-1.5 block">
              Vendor
            </label>
            <input
              id="ex-vendor"
              value={expense.vendor}
              onChange={(e) =>
                setExpense((v) => ({ ...v, vendor: e.target.value }))
              }
              disabled={savingExpense}
              placeholder="Sri Lakshmi Electricals"
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
            />
          </div>

          <div>
            <label htmlFor="ex-note" className="eyebrow mb-1.5 block">
              Note
            </label>
            <input
              id="ex-note"
              value={expense.note}
              onChange={(e) => setExpense((v) => ({ ...v, note: e.target.value }))}
              disabled={savingExpense}
              placeholder="Conduit and wiring, ground floor"
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
            />
          </div>

          <p className="text-[11.5px] leading-relaxed text-ink-3">
            Escrow releases are not recorded here — paying a milestone posts its
            own ledger line automatically, so the two can never double-count.
          </p>
        </form>
      </Modal>

      {/* ---------------- payment ledger ---------------- */}
      <Modal
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        title="Payment Ledger"
        description="Every recorded milestone movement on this project."
        size="lg"
      >
        <QueryBoundary
          isLoading={ledger.isLoading}
          error={ledger.error}
          data={ledger.data}
          onRetry={ledger.refetch}
          emptyTitle="No payment activity yet"
          emptyBody="Verifying or releasing a milestone records an entry here."
          skeleton={<RowSkeleton rows={5} />}
        >
          <ol className="space-y-3">
            {(ledger.data ?? []).map((entry) => (
              <li
                key={entry.id}
                className="flex gap-3 border-b border-line pb-3 last:border-b-0"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-ink">{entry.summary}</p>
                  <p className="mt-0.5 text-[11.5px] text-ink-3">
                    {entry.actor} · {longDate(entry.at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </QueryBoundary>
      </Modal>

      {/* ---------------- row action sheet ---------------- */}
      <Modal
        open={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.milestone ?? ''}
        description={`${menuFor?.contractor ?? ''} • ${
          menuFor ? rupees(menuFor.amount) : ''
        }`}
        size="sm"
      >
        <div className="space-y-1">
          {/* The one legal next step, from where this milestone actually is.
              Offering "Release Payment" on an unverified milestone would only
              produce an error from the database, which enforces the order. */}
          {menuFor && MILESTONE_ACTIONS[menuFor.statusKey] ? (
            <button
              type="button"
              disabled={advancing}
              onClick={() => advance(menuFor, MILESTONE_ACTIONS[menuFor.statusKey].next)}
              className="focus-ring block w-full rounded-[8px] px-3 py-2.5 text-left text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-50 disabled:opacity-50"
            >
              {advancing ? 'Working…' : MILESTONE_ACTIONS[menuFor.statusKey].label}
            </button>
          ) : null}

          {menuFor?.statusKey === 'pending_verification' ? (
            <button
              type="button"
              disabled={advancing}
              onClick={() => advance(menuFor, 'upcoming')}
              className="focus-ring block w-full rounded-[8px] px-3 py-2.5 text-left text-[13px] text-danger transition-colors hover:bg-danger-bg/50 disabled:opacity-50"
            >
              Send Back for Rework
            </button>
          ) : null}

          {menuFor?.statusKey === 'paid' ? (
            <p className="px-3 py-2.5 text-[13px] text-ink-2">
              Paid in full. Transaction reference is on the ledger.
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  )
}
