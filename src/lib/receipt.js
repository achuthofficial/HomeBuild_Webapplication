import { PAGE, downloadPdf } from '@/lib/pdf'
import { longDate } from '@/lib/format'

/**
 * Escrow payment receipt — PRD 5.3.5, "escrow transactions are logged
 * immutably with PDF receipt generation".
 *
 * The immutable log is the `activity_log` row plus the ledger entry that
 * advance_milestone() writes; this is the customer-facing artefact of it. It
 * deliberately restates the verification chain (PM verified, customer
 * approved, released) because that chain is the product's actual promise —
 * a receipt that showed only an amount would leave out the reason the money
 * was allowed to move.
 */

const M = 56 // page margin, points

/** Indian digit grouping: 12,34,567 rather than 1,234,567. */
function inr(paise) {
  const n = Math.round(Number(paise) || 0)
  const s = String(Math.abs(n))
  if (s.length <= 3) return (n < 0 ? '-' : '') + s
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')
  return `${n < 0 ? '-' : ''}${rest},${last3}`
}

const stamp = (value) => (value ? longDate(value) : 'Not recorded')

export function downloadMilestoneReceipt({ milestone, project, payer }) {
  const items = []
  let y = M

  /* ---- header ---- */
  items.push({ type: 'text', x: M, y: y + 4, text: 'HomeBuild', size: 20, bold: true })
  items.push({
    type: 'text', x: PAGE.width - M, y: y - 2, align: 'right',
    text: 'ESCROW PAYMENT RECEIPT', size: 9, bold: true, gray: 0.35,
  })
  items.push({
    type: 'text', x: PAGE.width - M, y: y + 12, align: 'right',
    text: `Issued ${longDate(new Date().toISOString())}`, size: 8.5, gray: 0.45,
  })
  y += 22
  items.push({ type: 'line', x1: M, x2: PAGE.width - M, y, gray: 0.75, width: 1 })
  y += 34

  /* ---- amount, given the prominence it has on the screen ---- */
  /* `y` on a rect is its TOP edge, measured from the top of the page — so the
     panel has to start ABOVE the two lines it sits behind, not below them. */
  items.push({ type: 'rect', x: M, y: y - 14, width: PAGE.width - M * 2, height: 62, gray: 0.96 })
  items.push({ type: 'text', x: M + 16, y: y + 4, text: 'AMOUNT RELEASED', size: 8, bold: true, gray: 0.4 })
  items.push({
    type: 'text', x: M + 16, y: y + 30,
    text: `INR ${inr(milestone.amount)}`, size: 24, bold: true,
  })
  y += 78

  /* ---- what the money was for ---- */
  const rows = [
    ['Milestone', milestone.milestone ?? milestone.name],
    ['Project', project?.name ?? '-'],
    ['Contractor', milestone.contractor ?? 'Unassigned'],
    ['Release share', milestone.releasePct ? `${milestone.releasePct}% of project budget` : '-'],
    ['Transaction reference', milestone.txnId ?? 'Not recorded'],
  ]

  if (milestone.criteria) rows.push(['Verification criteria', milestone.criteria])

  for (const [label, value] of rows) {
    items.push({ type: 'text', x: M, y, text: label, size: 9.5, gray: 0.45 })
    items.push({ type: 'text', x: M + 168, y, text: value, size: 9.5 })
    y += 20
  }

  /* ---- the approval chain, which is the point of escrow ---- */
  y += 14
  items.push({ type: 'line', x1: M, x2: PAGE.width - M, y: y - 10, gray: 0.85 })
  items.push({ type: 'text', x: M, y: y + 8, text: 'RELEASE AUTHORISATION', size: 8, bold: true, gray: 0.4 })
  y += 30

  const chain = [
    ['Project manager verified', stamp(milestone.pmVerifiedAt)],
    ['Customer approved', stamp(milestone.customerApprovedAt)],
    ['Funds released', stamp(milestone.paidAt)],
  ]
  for (const [label, value] of chain) {
    items.push({ type: 'text', x: M, y, text: label, size: 9.5, gray: 0.45 })
    items.push({ type: 'text', x: M + 168, y, text: value, size: 9.5 })
    y += 20
  }

  if (milestone.dualApproval) {
    y += 6
    items.push({
      type: 'text', x: M, y, size: 9,
      text: 'Second approval recorded (release above the INR 5,00,000 threshold).',
      gray: 0.3,
    })
    y += 20
  }

  /* ---- footer ---- */
  const footY = PAGE.height - M - 34
  items.push({ type: 'line', x1: M, x2: PAGE.width - M, y: footY, gray: 0.85 })
  items.push({
    type: 'text', x: M, y: footY + 16, size: 8, gray: 0.45,
    text: payer ? `Issued to ${payer} by HomeBuild.` : 'Issued by HomeBuild.',
  })
  items.push({
    type: 'text', x: M, y: footY + 28, size: 8, gray: 0.45,
    text: milestone.simulated
      ? 'Payment reference is simulated: no escrow provider is connected in this build.'
      : 'Retained in the project audit log.',
  })

  const safeName = String(milestone.milestone ?? 'milestone')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  downloadPdf(`homebuild-receipt-${safeName}`, items, {
    title: `Escrow receipt — ${milestone.milestone ?? 'Milestone'}`,
  })
}
