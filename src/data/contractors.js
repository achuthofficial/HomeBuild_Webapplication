/** Contractor Management — four KPI cards. */
export const contractorKpis = [
  {
    id: 'active-workforce',
    label: 'Active Workforce',
    value: '48',
    badge: { label: '+12%', tone: 'success' },
    sub: 'Across 14 active project sites',
  },
  {
    id: 'avg-performance',
    label: 'Avg. Performance',
    value: '92.4%',
    badge: { label: 'Stable', tone: 'brand' },
    sub: 'Based on safety & schedule KPIs',
  },
  {
    id: 'budget-utilization',
    label: 'Budget Utilization',
    value: '74%',
    badge: { label: 'In Review', tone: 'warning' },
    sub: '₹1.2Cr allocated this quarter',
  },
  {
    id: 'compliance-rate',
    label: 'Compliance Rate',
    value: '98%',
    sub: 'Insurance & Permits valid',
    watermark: true,
  },
]

/**
 * Trade chips carry their own tint pair, sampled from the mockup:
 * ELECTRICAL violet, CIVIL green, MECHANICAL blue, CLEANING orange.
 */
export const tradeTones = {
  ELECTRICAL: 'violet',
  CIVIL: 'success',
  MECHANICAL: 'info',
  CLEANING: 'orange',
  PLUMBING: 'info',
  PAINTING: 'warning',
}

export const contractors = [
  {
    id: 'CON-8842',
    name: 'Skyline Technologies',
    initials: 'ST',
    trade: 'ELECTRICAL',
    rating: 4.5,
    activeProjects: ['PT', 'CC'],
    extraProjects: 1,
    score: 96,
    scoreTone: 'success',
    kind: 'sub',
    history: [62, 68, 65, 74, 79, 77, 86, 92, 96],
    historyTone: 'success',
  },
  {
    id: 'CON-2319',
    name: 'Apex Masonry Ltd.',
    initials: 'AM',
    trade: 'CIVIL',
    rating: 4,
    activeProjects: ['HB'],
    extraProjects: 0,
    score: 82,
    scoreTone: 'brand',
    kind: 'internal',
    history: [78, 71, 84, 69, 88, 72, 83, 76, 82],
    historyTone: 'brand',
  },
  {
    id: 'CON-9021',
    name: 'Precision Piping Co.',
    initials: 'PP',
    trade: 'MECHANICAL',
    rating: 5,
    activeProjects: ['DR', 'WF'],
    extraProjects: 0,
    score: 99,
    scoreTone: 'success',
    kind: 'sub',
    history: [70, 74, 73, 80, 84, 88, 91, 95, 99],
    historyTone: 'success',
  },
  {
    id: 'CON-1102',
    name: 'Vortex Zen Services',
    initials: 'VZ',
    trade: 'CLEANING',
    rating: 3,
    activeProjects: ['PT'],
    extraProjects: 0,
    score: 64,
    scoreTone: 'danger',
    kind: 'sub',
    history: [92, 88, 84, 81, 76, 74, 70, 67, 64],
    historyTone: 'danger',
  },
]

export const contractorTabs = ['All', 'Internal', 'Sub-Contractors']
export const tradeFilters = [
  'All Trades',
  'Electrical',
  'Civil',
  'Mechanical',
  'Cleaning',
]
export const TOTAL_CONTRACTORS = 48
