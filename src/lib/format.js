/**
 * Formatting helpers, matching the eight mockups in `scripts/`.
 */

/**
 * ₹12,450,000 — grouped in thousands, no decimals, exactly as the mockups
 * render it (scripts/ddddd.png).
 *
 * Note this is NOT Indian digit grouping. `en-IN` would give ₹1,24,50,000,
 * which is how the number actually reads to an Indian audience and is
 * arguably the better choice for this product — the mockup was followed
 * deliberately. Switching the locale below is the whole change.
 */
export function rupees(value) {
  return `₹${Number(value).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

/** Large aggregates use crore shorthand: ₹1.2Cr */
export function crore(value) {
  return `₹${(Number(value) / 1e7).toFixed(1)}Cr`
}

/** The PRD talks in lakh; 1 lakh = 100000. */
export function lakh(value) {
  return `₹${(Number(value) / 1e5).toFixed(1)}L`
}

/** "Oct 24, 2026" — used in feeds and tables. */
export function longDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "SEP 2026" — uppercase, used on project cards as EST: */
export function estDate(iso) {
  return new Date(iso)
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    .toUpperCase()
}

/** "09:15 AM" — 12-hour with meridiem. */
export function clockTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/** Signed delta with an arrow glyph: "+2.4% ↗" */
export function delta(value, { suffix = '%' } = {}) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  const arrow = value > 0 ? '↗' : value < 0 ? '↘' : ''
  return `${sign}${Math.abs(value)}${suffix} ${arrow}`.trim()
}

/** Clamp a percentage into the 0–100 range for progress bars. */
export function pct(value) {
  return Math.max(0, Math.min(100, Number(value) || 0))
}

/**
 * "2 mins ago", "3 hours ago", "Yesterday" — how the alerts table reads in
 * the mockup (scripts/gggggg.png). An alert's age is what makes it urgent;
 * a date does not convey that at a glance.
 *
 * Falls back to the date past a week, where "9 days ago" stops being more
 * useful than the day itself.
 */
export function timeAgo(iso) {
  if (!iso) return '—'
  const then = new Date(iso)
  const mins = Math.round((Date.now() - then.getTime()) / 60000)

  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`

  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`

  return longDate(iso)
}
