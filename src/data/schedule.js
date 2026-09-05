/**
 * Master Construction Schedule — Sky Villa 42.
 *
 * Bar positions are expressed in *week offsets* from the first visible column
 * (W40). The Gantt renders them as percentages of the 12-column track, so the
 * chart stays fluid at any width.
 */

export const TOTAL_WEEKS = 12

/* Verbatim from the mockup (scripts/eeeee.png). */
export const ganttLegend = [
  { label: 'Completed', tone: 'success', kind: 'block' },
  { label: 'In Progress', tone: 'violet', kind: 'block' },
  { label: 'Baseline Plan', tone: 'baseline', kind: 'rule' },
  { label: 'Forecasted', tone: 'forecast', kind: 'dashed' },
]

export const scheduleViews = ['Gantt', 'List', 'Board']

