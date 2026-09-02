/**
 * Formatting helpers matching the conventions observed in the mockups.
 * See POTIIP/design/design_system.md section 6.
 */

/** ₹12,450,000 — grouped thousands, no decimals. */
export function rupees(value) {
  return `₹${Number(value).toLocaleString('en-IN', {
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
