import { cn } from '@/lib/cn'

const strokes = {
  success: '#10B981',
  brand: '#0058BE',
  danger: '#C84848',
  warning: '#F59E0B',
}

/**
 * Inline performance-history trend line used in the contractor table.
 * Renders a smooth polyline scaled to the series' own min/max.
 */
export default function Sparkline({
  data = [],
  tone = 'success',
  width = 68,
  height = 22,
  className,
}) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const stepX = width / (data.length - 1)

  const points = data.map((value, i) => {
    const x = i * stepX
    const y = height - ((value - min) / span) * (height - 4) - 2
    return [x, y]
  })

  // Catmull-Rom-ish smoothing: midpoint quadratic curves keep the line organic
  // without pulling it off the data.
  const d = points.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`
    const [px, py] = points[i - 1]
    const cx = (px + x) / 2
    return `${acc} Q ${px} ${py} ${cx} ${(py + y) / 2} T ${x} ${y}`
  }, '')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn('overflow-visible', className)}
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke={strokes[tone]}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
