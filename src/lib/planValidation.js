/**
 * Floor plan validators — PRD 5.1.8 acceptance criteria.
 *
 * These are the document's own pass/fail conditions, and every one of them is
 * deterministic geometry or arithmetic. Written as checks rather than as
 * prompt instructions so a generated plan can be *verified* rather than
 * trusted: a model asked for non-overlapping rooms will sometimes produce
 * overlapping ones, and this is what catches that.
 */

/** PRD 5.1.3 input ranges. */
export const PLOT_MIN_FT = 15
export const PLOT_MAX_FT = 200

/** PRD 5.1.8 cost bands, ₹ per square foot, by budget tier. */
export const COST_BANDS = {
  Economy: [1400, 1700],
  Mid: [1800, 2100],
  Premium: [2200, 2600],
  Luxury: [2700, 3400],
}

/** PRD 5.1.8: built-up area must land between 60% and 80% of plot × floors. */
export const FAR_MIN = 0.6
export const FAR_MAX = 0.8

/** How many storeys each floors option represents. */
export const FLOOR_COUNT = { G: 1, 'G+1': 2, 'G+2': 3, 'G+3': 4 }

/** Validates the 5.1.3 input parameters before anything is generated. */
export function validateBrief(brief) {
  const errors = []

  const length = Number(brief.plotLengthFt)
  const width = Number(brief.plotWidthFt)

  if (!Number.isFinite(length) || length < PLOT_MIN_FT || length > PLOT_MAX_FT) {
    errors.push(`Plot length must be between ${PLOT_MIN_FT} and ${PLOT_MAX_FT} ft.`)
  }
  if (!Number.isFinite(width) || width < PLOT_MIN_FT || width > PLOT_MAX_FT) {
    errors.push(`Plot width must be between ${PLOT_MIN_FT} and ${PLOT_MAX_FT} ft.`)
  }
  if (!FLOOR_COUNT[brief.totalFloors]) {
    errors.push('Choose how many floors the home has.')
  }
  if (![1, 2, 3, 4].includes(Number(brief.bhkPerFloor))) {
    errors.push('BHK per floor must be 1, 2, 3 or 4.')
  }
  if (!COST_BANDS[brief.budgetTier]) {
    errors.push('Choose a budget tier.')
  }

  return errors
}

/**
 * Rooms that merely share a wall are adjacent, not overlapping — and floating
 * point makes that distinction fragile: 5.4 + 4.2 is 9.600000000000001, so a
 * room ending exactly where the next begins reads as a 1e-15 ft intersection.
 *
 * EPSILON is 0.01 ft (~3 mm) — far below any real construction tolerance, and
 * comfortably above the error.
 */
const EPSILON = 0.01

function overlaps(a, b) {
  return (
    a.x < b.x + b.width - EPSILON &&
    a.x + a.width > b.x + EPSILON &&
    a.y < b.y + b.height - EPSILON &&
    a.y + a.height > b.y + EPSILON
  )
}

/**
 * Runs every 5.1.8 criterion against a generated plan.
 *
 * Returns individual checks rather than a single boolean so the UI can show
 * *which* rule a plan failed — "this plan is invalid" is not actionable.
 */
export function validatePlan(plan, brief) {
  const length = Number(brief.plotLengthFt)
  const width = Number(brief.plotWidthFt)
  const storeys = FLOOR_COUNT[brief.totalFloors] ?? 1
  const checks = []

  /* --- every room inside the plot boundary ---------------------------- */
  const outOfBounds = []
  for (const floor of plan.floors) {
    for (const room of floor.rooms) {
      if (
        room.x < 0 ||
        room.y < 0 ||
        room.x + room.width > length + 0.01 ||
        room.y + room.height > width + 0.01
      ) {
        outOfBounds.push(`${floor.name}: ${room.name}`)
      }
    }
  }
  checks.push({
    id: 'boundary',
    label: 'Every room fits inside the plot',
    passed: outOfBounds.length === 0,
    detail: outOfBounds.length ? `Outside: ${outOfBounds.join(', ')}` : null,
  })

  /* --- no two rooms on the same floor overlap ------------------------- */
  const collisions = []
  for (const floor of plan.floors) {
    for (let i = 0; i < floor.rooms.length; i++) {
      for (let j = i + 1; j < floor.rooms.length; j++) {
        if (overlaps(floor.rooms[i], floor.rooms[j])) {
          collisions.push(
            `${floor.name}: ${floor.rooms[i].name} ∩ ${floor.rooms[j].name}`,
          )
        }
      }
    }
  }
  checks.push({
    id: 'overlap',
    label: 'No two rooms overlap',
    passed: collisions.length === 0,
    detail: collisions.length ? collisions.slice(0, 3).join(', ') : null,
  })

  /* --- FAR between 60% and 80% --------------------------------------- */
  const builtUp = plan.floors.reduce(
    (sum, floor) =>
      sum + floor.rooms.reduce((s, r) => s + r.width * r.height, 0),
    0,
  )
  const plotArea = length * width * storeys
  const far = plotArea ? builtUp / plotArea : 0
  checks.push({
    id: 'far',
    label: `Built-up area is ${Math.round(FAR_MIN * 100)}–${Math.round(FAR_MAX * 100)}% of plot × floors`,
    passed: far >= FAR_MIN - 0.005 && far <= FAR_MAX + 0.005,
    detail: `${Math.round(far * 100)}% (${Math.round(builtUp)} of ${Math.round(plotArea)} sq ft)`,
  })

  /* --- cost per sq ft inside the tier's band -------------------------- */
  const band = COST_BANDS[brief.budgetTier]
  const rateOk =
    band && plan.costPerSqft >= band[0] && plan.costPerSqft <= band[1]
  checks.push({
    id: 'cost',
    label: `Rate is within the ${brief.budgetTier} band`,
    passed: Boolean(rateOk),
    detail: band
      ? `₹${plan.costPerSqft}/sq ft against ₹${band[0]}–${band[1]}`
      : 'Unknown tier',
  })

  /* --- Vastu floor, only when the customer asked for it --------------- */
  if (brief.vastuRequired) {
    checks.push({
      id: 'vastu',
      label: 'Vastu score is at least 7/10',
      passed: plan.vastuScore >= 7,
      detail: `${plan.vastuScore}/10`,
    })
  }

  return {
    checks,
    passed: checks.every((c) => c.passed),
    builtUpArea: Math.round(builtUp),
    far,
  }
}
