/**
 * Vastu compliance engine (PRD 5.1.6).
 *
 * Entirely deterministic. The PRD frames Vastu as something "the AI prompt
 * enforces", but the rules themselves are a fixed table of room-to-zone
 * placements — so scoring a layout against them is arithmetic, not inference.
 * Keeping it here means a plan's Vastu score can be recomputed and audited
 * without another model call, and a generated plan can be checked rather
 * than trusted.
 */

/**
 * The nine Vastu zones, as a 3x3 grid over the plot with NORTH AT THE TOP.
 *
 * Zones are absolute compass directions, not relative to the plot's facing —
 * a south-facing plot still has its Agni corner in the south-east. Facing
 * affects only where the main door belongs.
 */
export const ZONES = [
  ['NW', 'N', 'NE'],
  ['W', 'C', 'E'],
  ['SW', 'S', 'SE'],
]

export const ZONE_NAMES = {
  N: 'North',
  NE: 'North-East (Ishanya)',
  E: 'East',
  SE: 'South-East (Agni)',
  S: 'South',
  SW: 'South-West',
  W: 'West',
  NW: 'North-West',
  C: 'Centre (Brahmasthan)',
}

/**
 * PRD 5.1.6's placement rules.
 *
 * `weight` reflects how strongly tradition holds the rule — the kitchen and
 * master bedroom are the two placements a Vastu-conscious customer will look
 * for first, so getting them wrong should cost more than a misplaced study.
 */
export const PLACEMENT_RULES = [
  { room: 'Kitchen', zones: ['SE'], weight: 3, note: 'Agni (fire) corner' },
  { room: 'Master Bedroom', zones: ['SW'], weight: 3, note: 'Earth element' },
  { room: 'Puja Room', zones: ['NE'], weight: 3, note: 'Ishanya, the sacred corner' },
  { room: 'Living Room', zones: ['N', 'NE'], weight: 2, note: 'Morning light' },
  { room: 'Toilet', zones: ['NW', 'W'], weight: 2, note: 'Away from the sacred corners' },
  { room: 'Staircase', zones: ['S', 'SW'], weight: 2, note: 'Heavy mass to the south-west' },
  { room: 'Bedroom', zones: ['S', 'W', 'SW'], weight: 1, note: 'Restful quadrants' },
  { room: 'Study', zones: ['NE', 'E', 'N'], weight: 1, note: 'Clarity and light' },
  { room: 'Dining', zones: ['W', 'E'], weight: 1, note: 'Adjacent to the kitchen' },
  { room: 'Balcony', zones: ['N', 'E', 'NE'], weight: 1, note: 'Open to morning sun' },
  { room: 'Utility', zones: ['NW', 'W'], weight: 1, note: 'Service zone' },
  { room: 'Parking', zones: ['NW', 'N', 'E'], weight: 1, note: 'Entry side' },
]

/** Main door preference, per PRD 5.1.6. */
export const DOOR_ZONES = ['N', 'E', 'NE']

/**
 * Which zone a rectangle sits in, by its centre point.
 *
 * `y` grows downward in the layout coordinate system (top-left origin), and
 * the top of the plot is north — so a room low on the canvas is southern.
 */
export function zoneOf(room, plotLength, plotWidth) {
  const cx = room.x + room.width / 2
  const cy = room.y + room.height / 2

  const col = Math.min(2, Math.max(0, Math.floor((cx / plotLength) * 3)))
  const row = Math.min(2, Math.max(0, Math.floor((cy / plotWidth) * 3)))

  return ZONES[row][col]
}

/** The rule governing a room, matched on the room's type keyword. */
function ruleFor(roomName) {
  const name = roomName.toLowerCase()
  /* Longest match first: "Master Bedroom" must not be caught by "Bedroom". */
  return (
    PLACEMENT_RULES.slice()
      .sort((a, b) => b.room.length - a.room.length)
      .find((rule) => name.includes(rule.room.toLowerCase())) ?? null
  )
}

/**
 * Scores a floor's layout out of 10 (PRD 8.2 "Vastu Score").
 *
 * Weighted: each governed room contributes its weight, earned in full when it
 * sits in a prescribed zone. Rooms with no rule are ignored rather than
 * counted as failures — a corridor has no Vastu opinion.
 */
export function scoreLayout(rooms, plotLength, plotWidth, { facing } = {}) {
  let earned = 0
  let possible = 0
  const findings = []

  for (const room of rooms) {
    const rule = ruleFor(room.name)
    if (!rule) continue

    const zone = zoneOf(room, plotLength, plotWidth)
    const ok = rule.zones.includes(zone)

    possible += rule.weight
    if (ok) earned += rule.weight

    findings.push({
      room: room.name,
      zone,
      zoneName: ZONE_NAMES[zone],
      compliant: ok,
      expected: rule.zones.map((z) => ZONE_NAMES[z]).join(' or '),
      note: rule.note,
      weight: rule.weight,
    })
  }

  /* The main door follows the plot's facing rather than a room position. */
  if (facing) {
    const doorOk = DOOR_ZONES.includes(facing[0].toUpperCase())
    possible += 2
    if (doorOk) earned += 2
    findings.push({
      room: 'Main Door',
      zone: facing[0].toUpperCase(),
      zoneName: `${facing}-facing entrance`,
      compliant: doorOk,
      expected: 'North, East or North-East',
      note: 'Entry direction',
      weight: 2,
    })
  }

  /* A layout with nothing to judge scores neutrally rather than 0/10, which
     would read as a failing plan when it is simply an unscoreable one. */
  const score = possible === 0 ? 5 : (earned / possible) * 10

  return {
    score: Math.round(score * 10) / 10,
    earned,
    possible,
    findings,
    compliantCount: findings.filter((f) => f.compliant).length,
    totalCount: findings.length,
  }
}

/** Plain-text summary for PRD 8.2's "Vastu Notes" field. */
export function describeCompliance(result) {
  const good = result.findings.filter((f) => f.compliant)
  const bad = result.findings.filter((f) => !f.compliant)

  const parts = []
  if (good.length) {
    parts.push(
      `Placed per Vastu: ${good.map((f) => `${f.room} in the ${f.zoneName}`).join('; ')}.`,
    )
  }
  if (bad.length) {
    parts.push(
      `Deviations: ${bad
        .map((f) => `${f.room} sits in the ${f.zoneName}, traditionally ${f.expected}`)
        .join('; ')}.`,
    )
  }
  return parts.join(' ') || 'No Vastu-governed rooms in this layout.'
}
