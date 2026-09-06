import { useId } from 'react'
import { cn } from '@/lib/cn'

/**
 * Floor plan renderer — PRD 5.1.7's visual conventions.
 *
 * Draws in FEET and lets the viewBox scale, so the same component renders a
 * 20ft plot and a 200ft one without per-plot maths. Room coordinates come
 * straight from the plan data (feet from the top-left corner, PRD 5.1.5).
 *
 * North is up, always. Vastu zones are absolute compass directions, so
 * rotating the drawing to match the plot's facing would silently move every
 * room into the wrong zone.
 */

/* PRD 5.1.7: "rooms colour-coded by type (bedrooms blue, kitchen purple,
   living orange, etc.)". Tokens rather than literals so the plan inverts
   correctly in dark mode along with everything else. */
const ROOM_FILLS = {
  Kitchen: 'var(--color-violet-bg)',
  'Puja Room': 'var(--color-warning-bg)',
  'Living Room': 'var(--color-orange-bg)',
  Dining: 'var(--color-orange-bg)',
  'Master Bedroom': 'var(--color-info-bg)',
  Bedroom: 'var(--color-info-bg)',
  Toilet: 'var(--color-subtle)',
  Staircase: 'var(--color-muted)',
  Study: 'var(--color-success-bg)',
  Balcony: 'var(--color-success-bg)',
  Utility: 'var(--color-subtle)',
  Parking: 'var(--color-muted)',
}

const ROOM_STROKES = {
  Kitchen: 'var(--color-violet)',
  'Puja Room': 'var(--color-warning)',
  'Living Room': 'var(--color-orange-ink)',
  Dining: 'var(--color-orange-ink)',
  'Master Bedroom': 'var(--color-brand-ink)',
  Bedroom: 'var(--color-brand-ink)',
  Study: 'var(--color-success)',
  Balcony: 'var(--color-success)',
}

function paletteFor(name, map, fallback) {
  const key = Object.keys(map)
    .sort((a, b) => b.length - a.length)
    .find((k) => name.toLowerCase().includes(k.toLowerCase()))
  return key ? map[key] : fallback
}

export default function FloorPlanSvg({
  floor,
  plotLengthFt,
  plotWidthFt,
  className,
}) {
  const uid = useId().replace(/:/g, '')
  const L = Number(plotLengthFt) || 1
  const W = Number(plotWidthFt) || 1

  /* Margin in feet, so the boundary label and north arrow have room without
     being clipped at small plot sizes. */
  const pad = Math.max(4, Math.min(L, W) * 0.12)

  /* Font sizes are in feet too — scaled off the plot so labels stay legible
     on a 20ft plot and don't become billboards on a 200ft one. */
  const labelSize = Math.max(1.4, Math.min(L, W) * 0.035)
  const dimSize = labelSize * 0.78

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${L + pad * 2} ${W + pad * 2}`}
      className={cn('w-full', className)}
      role="img"
      aria-label={`${floor.name} layout, ${L} by ${W} feet, ${floor.rooms.length} rooms`}
    >
      <defs>
        {/* PRD 5.1.7: grid background at 1-foot resolution. */}
        <pattern
          id={`grid-${uid}`}
          width="1"
          height="1"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 1 0 L 0 0 0 1"
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="0.06"
            opacity="0.55"
          />
        </pattern>
      </defs>

      <rect x="0" y="0" width={L} height={W} fill={`url(#grid-${uid})`} />

      {/* Plot boundary: dashed orange, per 5.1.7. */}
      <rect
        x="0"
        y="0"
        width={L}
        height={W}
        fill="none"
        stroke="var(--color-warning)"
        strokeWidth={Math.max(0.15, L * 0.004)}
        strokeDasharray={`${L * 0.02} ${L * 0.012}`}
      />

      {floor.rooms.map((room, i) => {
        const fill = paletteFor(room.name, ROOM_FILLS, 'var(--color-subtle)')
        const stroke = paletteFor(room.name, ROOM_STROKES, 'var(--color-line-strong)')
        /* Hairline inset so adjacent rooms read as two rooms sharing a wall
           rather than one merged block. */
        const inset = Math.min(L, W) * 0.004

        return (
          <g key={`${room.name}-${i}`}>
            <rect
              x={room.x + inset}
              y={room.y + inset}
              width={Math.max(0, room.width - inset * 2)}
              height={Math.max(0, room.height - inset * 2)}
              fill={fill}
              stroke={stroke}
              strokeWidth={Math.max(0.08, L * 0.002)}
              rx={Math.min(L, W) * 0.006}
            />
            <text
              x={room.x + room.width / 2}
              y={room.y + room.height / 2 - dimSize * 0.15}
              textAnchor="middle"
              fontSize={labelSize}
              fontWeight="600"
              fill="var(--color-ink)"
            >
              {room.name}
            </text>
            {/* PRD 5.1.7: dimensions overlaid, e.g. "14×12 ft". */}
            <text
              x={room.x + room.width / 2}
              y={room.y + room.height / 2 + dimSize * 1.25}
              textAnchor="middle"
              fontSize={dimSize}
              fill="var(--color-ink-3)"
            >
              {Math.round(room.width)}×{Math.round(room.height)} ft
            </text>
          </g>
        )
      })}

      {/* Overall dimensions on the boundary. */}
      <text
        x={L / 2}
        y={-pad * 0.3}
        textAnchor="middle"
        fontSize={dimSize}
        fill="var(--color-warning)"
        fontWeight="600"
      >
        {L} ft
      </text>
      <text
        x={-pad * 0.35}
        y={W / 2}
        textAnchor="middle"
        fontSize={dimSize}
        fill="var(--color-warning)"
        fontWeight="600"
        transform={`rotate(-90 ${-pad * 0.35} ${W / 2})`}
      >
        {W} ft
      </text>

      {/* North arrow, top-right (5.1.7). North is up because Vastu zones are
          absolute — see the note at the top of this file. */}
      <g transform={`translate(${L + pad * 0.45} ${-pad * 0.15})`}>
        <path
          d={`M 0 ${-pad * 0.42} L ${pad * 0.16} ${pad * 0.1} L 0 ${pad * 0.01} L ${-pad * 0.16} ${pad * 0.1} Z`}
          fill="var(--color-ink-2)"
        />
        <text
          x="0"
          y={pad * 0.4}
          textAnchor="middle"
          fontSize={dimSize}
          fontWeight="700"
          fill="var(--color-ink-2)"
        >
          N
        </text>
      </g>
    </svg>
  )
}
