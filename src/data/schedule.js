/**
 * Master Construction Schedule — Sky Villa 42.
 *
 * Bar positions are expressed in *week offsets* from the first visible column
 * (W40). The Gantt renders them as percentages of the 12-column track, so the
 * chart stays fluid at any width.
 */

export const scheduleMonths = [
  { label: 'OCTOBER 2026', weeks: ['W40', 'W41', 'W42', 'W43'] },
  { label: 'NOVEMBER 2026', weeks: ['W44', 'W45', 'W46', 'W47'] },
  { label: 'DECEMBER 2026', weeks: ['W48', 'W49', 'W50', 'W51'] },
]

export const TOTAL_WEEKS = 12

/** Vertical "TODAY: OCT 18" marker, in week offsets. */
export const todayMarker = { offset: 2.45, label: 'TODAY: OCT 18' }

export const scheduleGroups = [
  {
    id: 'grp-foundations',
    name: '1. Foundations',
    defaultOpen: true,
    baseline: { start: 0, end: 2.7 },
    tasks: [
      {
        id: 'task-excavation',
        name: 'Excavation Site A',
        badge: { label: 'DONE', tone: 'success' },
        bar: { start: 0.15, end: 1.6, tone: 'success' },
      },
      {
        id: 'task-concrete-pouring',
        name: 'Concrete Pouring',
        badge: { label: 'CRITICAL', tone: 'warning' },
        bar: { start: 1.55, end: 2.4, tone: 'violet' },
      },
      {
        id: 'task-rebar',
        name: 'Rebar Reinforcement',
        badge: { label: 'DELAYED', tone: 'danger' },
        bar: { start: 2.5, end: 3.4, tone: 'danger' },
        forecast: { start: 3.4, end: 4.25 },
        flag: '+4 Days',
      },
    ],
  },
  {
    id: 'grp-structural-framing',
    name: '2. Structural Framing',
    defaultOpen: false,
    baseline: { start: 2.8, end: 6.2 },
    tasks: [
      {
        id: 'task-column-casting',
        name: 'Column Casting L1-L3',
        badge: { label: 'IN PROGRESS', tone: 'violet' },
        bar: { start: 2.9, end: 4.6, tone: 'violet' },
      },
      {
        id: 'task-slab-l4',
        name: 'Slab Casting Level 4',
        badge: { label: 'QUEUED', tone: 'neutral' },
        bar: { start: 4.6, end: 6.1, tone: 'neutral' },
      },
    ],
  },
  {
    id: 'grp-mep',
    name: '3. MEP Installation',
    defaultOpen: false,
    baseline: { start: 5.4, end: 9.1 },
    tasks: [
      {
        id: 'task-hvac-ducting',
        name: 'HVAC Ducting - Level 2',
        badge: { label: 'ON HOLD', tone: 'neutral' },
        bar: { start: 5.5, end: 7.0, tone: 'neutral' },
      },
      {
        id: 'task-electrical-conduit',
        name: 'Electrical Conduit Runs',
        badge: { label: 'QUEUED', tone: 'neutral' },
        bar: { start: 7.0, end: 9.0, tone: 'neutral' },
      },
    ],
  },
  {
    id: 'grp-interior-finishes',
    name: '4. Interior Finishes',
    defaultOpen: false,
    baseline: { start: 8.6, end: 11.8 },
    tasks: [
      {
        id: 'task-plaster',
        name: 'Brick & Plaster',
        badge: { label: 'QUEUED', tone: 'neutral' },
        bar: { start: 8.7, end: 10.4, tone: 'neutral' },
      },
      {
        id: 'task-flooring',
        name: 'Flooring & Paint',
        badge: { label: 'QUEUED', tone: 'neutral' },
        bar: { start: 10.4, end: 11.7, tone: 'neutral' },
      },
    ],
  },
]

export const ganttLegend = [
  { label: 'Completed', tone: 'success', kind: 'block' },
  { label: 'In Progress', tone: 'violet', kind: 'block' },
  { label: 'Baseline Plan', tone: 'baseline', kind: 'rule' },
  { label: 'Forecasted', tone: 'forecast', kind: 'dashed' },
]

export const scheduleViews = ['Gantt', 'List', 'Board']

/** Schedule Health card. */
export const scheduleHealth = {
  value: 92,
  caption: 'Overall progress on track',
  delta: 2.4,
  nextMilestone: 'Framing Completion',
  daysRemaining: 12,
  progress: 78,
}

/** Workforce Distribution card. */
export const workforce = {
  groups: [
    { label: 'Carpenters', value: 24 },
    { label: 'MEP Staff', value: 12 },
    { label: 'Excavation', value: 8 },
  ],
  optimization: {
    title: 'Optimization Active',
    body: 'Shifting 4 staff to framing next week',
    action: 'Apply',
  },
}

/** Timeline Pulse audit rail. */
export const timelinePulse = [
  {
    id: 'pulse-1',
    tone: 'success',
    title: 'Foundation Site A Poured',
    meta: '2 hours ago • Manish',
  },
  {
    id: 'pulse-2',
    tone: 'warning',
    title: 'Schedule Shift: Concrete',
    meta: '5 hours ago • System',
  },
  {
    id: 'pulse-3',
    tone: 'danger',
    title: 'Delay logged: Rebar',
    meta: 'Yesterday • Rohan',
  },
]
