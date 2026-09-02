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
import { rupees, longDate } from '@/lib/format'
import { useToast } from '@/context/ToastContext'
import {
  financeKpis,
  budgetTrend,
  trendRanges,
  categoryBreakdown,
  milestonePayments,
} from '@/data/finance'

/* Tile tints sampled from the mockup: #D8E2FF / #FEF5E7 / #F3EFFE. */
const iconTones = {
  brand: 'bg-brand-tile text-brand-600',
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
  const [range, setRange] = useState(trendRanges[0])
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [menuFor, setMenuFor] = useState(null)

  return (
    <>
      <PageHeader
        title="Financial Overview"
        subtitle="Real-time budget analysis and tracking for Project Alpha."
        actions={
          <>
            <Button
              variant="outline"
              icon={Download}
              onClick={() => toast('Financial report exported as PDF.')}
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

      <div className="grid gap-4 md:grid-cols-3">
        {financeKpis.map((kpi) => (
          <FinanceKpi key={kpi.id} {...kpi} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
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
            <AreaTrend data={budgetTrend} />
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="Category Breakdown" />
          <div className="mt-5">
            <DonutChart data={categoryBreakdown} />
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
            onClick={() => toast('Full payment ledger is not in this prototype.', { tone: 'info' })}
            className="focus-ring rounded text-[12px] font-semibold text-brand-600 hover:underline"
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
              {milestonePayments.map((row) => (
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
        description="Raise an invoice against a verified milestone."
        footer={
          <>
            <Button variant="outline" onClick={() => setInvoiceOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="warning"
              onClick={() => {
                setInvoiceOpen(false)
                toast('Invoice raised and sent for PM sign-off.')
              }}
            >
              Raise Invoice
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="inv-ms" className="eyebrow mb-1.5 block">
              Milestone
            </label>
            <select
              id="inv-ms"
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px]"
            >
              {milestonePayments.map((m) => (
                <option key={m.id}>{m.milestone}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="inv-amt" className="eyebrow mb-1.5 block">
              Amount (₹)
            </label>
            <input
              id="inv-amt"
              type="number"
              defaultValue={450000}
              className="focus-ring tnum h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px]"
            />
          </div>
        </div>
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
          {['Approve Payment', 'Request Re-verification', 'View Invoice', 'Download Receipt'].map(
            (action) => (
              <button
                key={action}
                type="button"
                onClick={() => {
                  setMenuFor(null)
                  toast(`${action} — not wired up in this prototype.`, {
                    tone: 'info',
                  })
                }}
                className="focus-ring block w-full rounded-[8px] px-3 py-2.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-subtle hover:text-ink"
              >
                {action}
              </button>
            ),
          )}
        </div>
      </Modal>
    </>
  )
}
