/**
 * Master Construction Schedule — Sky Villa 42.
 *
 * Bar positions are expressed in *week offsets* from the first visible column
 * (W40). The Gantt renders them as percentages of the 12-column track, so the
 * chart stays fluid at any width.
 */

export const TOTAL_WEEKS = 12

/* The three overlays PRD 5.4.5 asks for, plus the delayed state — a red bar
   on the chart needs a key entry or it reads as an unexplained colour. */
export const ganttLegend = [
  { label: 'Actual', tone: 'success', kind: 'block' },
  { label: 'Delayed', tone: 'danger', kind: 'block' },
  { label: 'Baseline Plan', tone: 'baseline', kind: 'rule' },
  { label: 'Forecast', tone: 'forecast', kind: 'dashed' },
]

export const scheduleViews = ['Gantt', 'List', 'Board']

