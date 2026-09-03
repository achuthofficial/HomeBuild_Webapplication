import { scoreLayout, describeCompliance } from '@/lib/vastu'
import { COST_BANDS, FLOOR_COUNT, validatePlan } from '@/lib/planValidation'

/**
 * Floor plan generation (PRD 5.1.4 / 5.1.5).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHERE THE MODEL CALL GOES
 *
 * The PRD specifies an LLM producing the three variants. That call is NOT
 * implemented here — AI work is deliberately out of scope for this build —
 * but `generatePlans` is the seam it drops into, and nothing above this file
 * knows which implementation answered.
 *
 * To swap in the real generator, replace the body of `generatePlans` with a
 * request whose JSON matches `PLAN_SCHEMA` below, and leave everything after
 * it alone: the returned plans still go through `scoreLayout` and
 * `validatePlan`, so a model that hallucinates overlapping rooms or a
 * non-compliant FAR is caught rather than shown to a customer.
 *
 * Notes for whoever writes it:
 *   · The PRD names "Claude Sonnet or equivalent". That line predates the
 *     current model list — use `claude-opus-5`, and adaptive thinking
 *     (`thinking: { type: 'adaptive' }`) for a task with this much spatial
 *     constraint-solving in it.
 *   · Ask for the array via structured outputs — `output_config.format` with
 *     PLAN_SCHEMA, not the deprecated `output_format` — or `messages.parse()`,
 *     so the response validates against the schema rather than being parsed
 *     hopefully.
 *   · It must run server-side. The anon-key client in this app is a browser
 *     client; an Anthropic key cannot ship to a browser. A Vercel function or
 *     a Supabase Edge Function is the right home.
 *   · PRD 5.1.8 gives it 8 seconds. Stream, and keep the deterministic
 *     generator below as the fallback when it times out.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Until then, the generator below is deterministic: it partitions the plot
 * into non-overlapping rectangles and assigns rooms to Vastu zones. That is
 * a weaker designer than a model, but it is a *correct* one — overlap and
 * out-of-bounds are impossible by construction rather than checked for.
 */

/** The response shape the model must return — PRD 5.1.5. */
export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['plans'],
  properties: {
    plans: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'variant',
          'name',
          'highlights',
          'vastuNotes',
          'floors',
        ],
        properties: {
          variant: { type: 'string', enum: ['A', 'B', 'C'] },
          name: { type: 'string' },
          highlights: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: { type: 'string' },
          },
          vastuNotes: { type: 'string' },
          floors: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'rooms'],
              properties: {
                name: { type: 'string' },
                rooms: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['name', 'x', 'y', 'width', 'height'],
                    properties: {
                      name: { type: 'string' },
                      /* Feet from the plot's top-left corner (PRD 5.1.5). */
                      x: { type: 'number' },
                      y: { type: 'number' },
                      width: { type: 'number' },
                      height: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

/**
 * The three design philosophies from PRD 5.1.4.
 *
 * `setback` is the unbuilt margin as a fraction of each dimension, which is
 * what tunes FAR into the 60–80% band: Compact builds tighter than
 * Symmetrical, exactly as the philosophies describe.
 */
const VARIANTS = [
  {
    variant: 'A',
    name: 'Symmetrical Vastu',
    /* Setback is what tunes FAR: with the grid fully tiled, built-up area is
       exactly (1 - 2·setback)² of the plot, so 0.10 → 64%. PRD 5.1.8 wants
       60–80%. */
    setback: 0.1,
    /* Zone-first placement: every room goes where tradition says. */
    strategy: 'vastu',
    highlights: [
      'Maximum Vastu compliance across every zone',
      'Central circulation with equal light on all sides',
      'Puja room in the north-east corner',
    ],
  },
  {
    variant: 'B',
    name: 'Open Plan Contemporary',
    setback: 0.08, // → 70.6% FAR
    /* Merges kitchen, living and dining into one volume. */
    strategy: 'open',
    highlights: [
      'Open kitchen-living-dining volume',
      'Larger glazing to the north and east',
      'Fewer internal load-bearing walls',
    ],
  },
  {
    variant: 'C',
    name: 'Compact Efficient',
    setback: 0.065, // → 76.6% FAR, the densest of the three
    strategy: 'compact',
    highlights: [
      'Lowest total cost of the three',
      'Minimal circulation waste',
      'Consolidated service core',
    ],
  },
]

/** Rooms wanted on the ground floor, in priority order. */
function groundRooms(brief) {
  const rooms = ['Living Room', 'Kitchen', 'Dining', 'Toilet', 'Staircase']
  if (brief.extraSpaces?.includes('Puja Room')) rooms.splice(1, 0, 'Puja Room')
  if (brief.extraSpaces?.includes('Utility')) rooms.push('Utility')
  if (Number(brief.parkingSpots) > 0) rooms.push('Parking')
  return rooms
}

/** Rooms wanted on an upper floor, driven by the BHK count. */
function upperRooms(brief, floorIndex) {
  const bhk = Number(brief.bhkPerFloor) || 2
  const rooms = ['Master Bedroom']
  for (let i = 2; i <= bhk; i++) rooms.push(`Bedroom ${i}`)
  rooms.push('Toilet', 'Staircase')
  if (brief.extraSpaces?.includes('Study') && floorIndex === 1) rooms.push('Study')
  if (brief.extraSpaces?.includes('Balcony')) rooms.push('Balcony')
  return rooms
}

/**
 * Preferred grid cell for a room, as [row, col] in the 3x3 Vastu grid with
 * north at the top. Mirrors the rules in vastu.js so the generator aims at
 * the same target the scorer measures.
 */
const PREFERRED_CELL = {
  Kitchen: [2, 2],
  'Puja Room': [0, 2],
  'Living Room': [0, 1],
  'Master Bedroom': [2, 0],
  Toilet: [1, 0],
  Staircase: [2, 1],
  Dining: [1, 2],
  Study: [0, 2],
  Balcony: [0, 1],
  Utility: [1, 0],
  Parking: [0, 0],
}

function cellFor(roomName) {
  const key = Object.keys(PREFERRED_CELL)
    .sort((a, b) => b.length - a.length)
    .find((k) => roomName.toLowerCase().includes(k.toLowerCase()))
  /* Unlisted rooms (Bedroom 2, 3…) fill the remaining southern/western band,
     which is where the rules put ordinary bedrooms anyway. */
  return key ? PREFERRED_CELL[key] : null
}

/**
 * Lays out one floor.
 *
 * Rooms are first assigned to cells of the 3x3 Vastu grid by preference, then
 * stretched so the occupied cells TILE the buildable rectangle exactly —
 * empty cells would otherwise be unbuilt plot, which is what put FAR near 40%
 * against PRD 5.1.8's 60% floor.
 *
 * Because the result is still a tiling, rooms can neither overlap nor escape
 * the plot: the two hardest acceptance criteria hold by construction rather
 * than by checking.
 */
function layoutFloor(names, brief, variant, floorName) {
  const L = Number(brief.plotLengthFt)
  const W = Number(brief.plotWidthFt)

  const insetX = L * variant.setback
  const insetY = W * variant.setback
  const usableL = L - insetX * 2
  const usableW = W - insetY * 2

  /* Claim preferred cells first, then fill what is left in order. */
  const grid = Array.from({ length: 3 }, () => Array(3).fill(null))
  const unplaced = []

  for (const name of names) {
    const pref = cellFor(name)
    if (pref && !grid[pref[0]][pref[1]]) {
      grid[pref[0]][pref[1]] = name
    } else {
      unplaced.push(name)
    }
  }

  for (const name of unplaced) {
    let placed = false
    /* Fill from the south-west, the traditional home for extra bedrooms. */
    for (let row = 2; row >= 0 && !placed; row--) {
      for (let col = 0; col < 3 && !placed; col++) {
        if (!grid[row][col]) {
          grid[row][col] = name
          placed = true
        }
      }
    }
    /* Nine cells; a 4BHK ground+upper never exceeds that, but if a brief ever
       did, the room is dropped rather than stacked on top of another. */
  }

  /* Empty cells are wasted plot. A 3x3 grid holding six rooms would leave a
     third of the buildable area unbuilt, which put FAR around 40% — well
     under the 60% floor PRD 5.1.8 sets. So the occupied cells are stretched
     to tile the rectangle exactly: rows without rooms collapse, and each
     row's width is shared by the rooms actually in it.

     Tiling also means overlap and out-of-bounds remain impossible by
     construction, which is the property worth protecting. */
  const occupiedRows = [0, 1, 2].filter((row) => grid[row].some(Boolean))
  const rowCount = occupiedRows.length || 1

  /**
   * Round the GRID LINES, then derive each room's size from the gap between
   * them — never round position and size independently.
   *
   * Rounding both separately lets adjacent edges drift apart: at 15 ft with
   * three columns the boundary lands on 5.325, and a room rounded to x=5.3
   * with width 4.4 ends at 9.7 while its neighbour starts at 9.6. That is a
   * 0.1 ft overlap the tiling was supposed to make impossible.
   */
  const edges = (start, span, count) =>
    Array.from({ length: count + 1 }, (_, i) => round1(start + (span * i) / count))

  const rowEdges = edges(insetY, usableW, rowCount)

  const rooms = []
  occupiedRows.forEach((row, rowIndex) => {
    const inRow = [0, 1, 2].filter((col) => grid[row][col])
    const colEdges = edges(insetX, usableL, inRow.length)

    inRow.forEach((col, colIndex) => {
      rooms.push({
        name: grid[row][col],
        x: colEdges[colIndex],
        y: rowEdges[rowIndex],
        width: round1(colEdges[colIndex + 1] - colEdges[colIndex]),
        height: round1(rowEdges[rowIndex + 1] - rowEdges[rowIndex]),
      })
    })
  })

  return { name: floorName, rooms }
}

const round1 = (n) => Math.round(n * 10) / 10

/** Rate within the tier band — the strategy picks where in the band it sits. */
function rateFor(tier, strategy) {
  const [low, high] = COST_BANDS[tier] ?? COST_BANDS.Mid
  const position = strategy === 'compact' ? 0.15 : strategy === 'open' ? 0.75 : 0.45
  return Math.round(low + (high - low) * position)
}

/**
 * Produces the three plans for a brief.
 *
 * THIS IS THE SEAM. Replace the body with the model call described at the top
 * of this file; the signature, the return shape and everything downstream
 * stay as they are.
 */
export async function generatePlans(brief) {
  const storeys = FLOOR_COUNT[brief.totalFloors] ?? 1
  const floorNames = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor']

  return VARIANTS.map((variant) => {
    const floors = []
    for (let i = 0; i < storeys; i++) {
      const names = i === 0 ? groundRooms(brief) : upperRooms(brief, i)
      floors.push(layoutFloor(names, brief, variant, floorNames[i]))
    }

    return finalisePlan({ ...variant, floors }, brief)
  })
}

/**
 * Scores, costs and validates a plan.
 *
 * Deliberately separate from generation, and applied to whatever `generatePlans`
 * returns — so when a model produces the layouts, its output is measured by
 * the same deterministic rules rather than being taken at its word. A model
 * that claims a Vastu score of 9 gets the score its geometry actually earns.
 */
export function finalisePlan(raw, brief) {
  const L = Number(brief.plotLengthFt)
  const W = Number(brief.plotWidthFt)

  /* Score against the ground floor: it holds the kitchen, puja and living
     rooms, which are where the Vastu rules concentrate. */
  const ground = raw.floors[0]
  const vastu = scoreLayout(ground.rooms, L, W, { facing: brief.plotFacing })

  const builtUp = raw.floors.reduce(
    (sum, f) => sum + f.rooms.reduce((s, r) => s + r.width * r.height, 0),
    0,
  )

  const storeys = FLOOR_COUNT[brief.totalFloors] ?? 1
  const plotArea = L * W * storeys
  /* Efficiency is usable area against what could have been built, expressed
     on the PRD's 1–10 scale. */
  const efficiency = plotArea
    ? Math.min(10, Math.round((builtUp / plotArea) * 12.5 * 10) / 10)
    : 0

  const costPerSqft = rateFor(brief.budgetTier, raw.strategy ?? 'vastu')

  const plan = {
    variant: raw.variant,
    name: raw.name,
    highlights: raw.highlights,
    floors: raw.floors,
    vastuScore: vastu.score,
    vastuFindings: vastu.findings,
    vastuNotes: raw.vastuNotes ?? describeCompliance(vastu),
    efficiencyScore: efficiency,
    totalSqft: Math.round(builtUp),
    costPerSqft,
    totalCost: Math.round(builtUp * costPerSqft),
  }

  plan.validation = validatePlan(plan, brief)
  return plan
}
