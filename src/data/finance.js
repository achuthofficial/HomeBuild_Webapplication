import { Wallet, Banknote, PiggyBank } from 'lucide-react'

/** Financial Overview — three KPI cards for Project Alpha. */
export const financeKpis = [
  {
    id: 'total-budget',
    label: 'Total Budget',
    value: 12450000,
    delta: 2.4,
    icon: Wallet,
    iconTone: 'brand',
  },
  {
    id: 'budget-consumed',
    label: 'Budget Consumed',
    value: 8466000,
    note: '68% Used',
    icon: Banknote,
    iconTone: 'warning',
  },
  {
    id: 'remaining',
    label: 'Remaining',
    value: 3984000,
    delta: -1.2,
    icon: PiggyBank,
    iconTone: 'violet',
  },
]

/**
 * Budget Consumption Trend — monthly spend trajectory. Values are in rupees
 * and rise to the ₹8,466,000 consumed figure by August.
 */
export const budgetTrend = [
  { month: 'JAN', value: 1180000 },
  { month: 'FEB', value: 1420000 },
  { month: 'MAR', value: 1390000 },
  { month: 'APR', value: 2650000 },
  { month: 'MAY', value: 2610000 },
  { month: 'JUN', value: 4180000 },
  { month: 'JUL', value: 3960000 },
  { month: 'AUG', value: 5720000 },
]

export const trendRanges = ['Last 6 Months', 'Last 12 Months', 'Year to Date']

/**
 * Category Breakdown donut. NOTE: these are the mockup's own figures and they
 * sum to 108%, not 100% — see design_system.md section 7 item 1. Kept verbatim
 * so the prototype matches the screenshot exactly.
 */
export const categoryBreakdown = [
  { label: 'Construction Materials', value: 45, tone: 'success' },
  { label: 'Permits & Legal', value: 25, tone: 'warning' },
  { label: 'Labor & Subcontracting', value: 38, tone: 'brand' },
]

/** Upcoming Milestone Payments table. */
export const milestonePayments = [
  {
    id: 'ms-foundation-inspection',
    milestone: 'Foundation Inspection Approval',
    contractor: 'SteelWorks Co.',
    dueDate: '2026-10-12',
    amount: 450000,
    status: { label: 'Pending Verification', tone: 'warning' },
  },
  {
    id: 'ms-ground-slab',
    milestone: 'Ground Floor Slab Cast',
    contractor: 'Apex Masonry Ltd.',
    dueDate: '2026-10-28',
    amount: 2739000,
    status: { label: 'Scheduled', tone: 'neutral' },
  },
  {
    id: 'ms-structural-framing',
    milestone: 'Structural Framing Complete',
    contractor: 'Skyline Technologies',
    dueDate: '2026-11-15',
    amount: 1867500,
    status: { label: 'Scheduled', tone: 'neutral' },
  },
  {
    id: 'ms-brick-plaster',
    milestone: 'Brick & Plaster Complete',
    contractor: 'Apex Masonry Ltd.',
    dueDate: '2026-12-06',
    amount: 1494000,
    status: { label: 'Approved', tone: 'success' },
  },
]
