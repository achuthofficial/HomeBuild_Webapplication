import { useId, useState } from 'react'
import { rupees } from '@/lib/format'
import { cn } from '@/lib/cn'

const VIEW_W = 720
const VIEW_H = 220
const PAD = { top: 16, right: 8, bottom: 8, left: 8 }

/**
 * Budget Consumption Trend — amber line over a fading area fill, with three
 * horizontal gridlines and a hover readout. Drawn as a fluid viewBox so it
 * scales with the card rather than a fixed pixel width.
 */
export default function AreaTrend({ data, className }) {
  const [hover, setHover] = useState(null)
  const uid = useId().replace(/:/g, '')

  const max = Math.max(...data.map((d) => d.value))
  const min = Math.min(...data.map((d) => d.value))
  const span = max - min || 1

  const innerW = VIEW_W - PAD.left - PAD.right
  const innerH = VIEW_H - PAD.top - PAD.bottom
  const stepX = innerW / (data.length - 1)

  const points = data.map((d, i) => ({
    ...d,
    x: PAD.left + i * stepX,
    y: PAD.top + innerH - ((d.value - min) / span) * innerH * 0.82,
  }))

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  const areaPath = `${linePath} L ${points.at(-1).x.toFixed(1)} ${VIEW_H} L ${points[0].x.toFixed(1)} ${VIEW_H} Z`

  return (
    <div className={cn('w-full', className)}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="h-[190px] w-full"
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label="Monthly budget consumption trend"
        >
          <defs>
            <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-warning)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-warning)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0.32, 0.55, 0.78].map((ratio) => (
            <line
              key={ratio}
              x1={PAD.left + innerW * 0.02}
              x2={VIEW_W - PAD.right}
              y1={VIEW_H * ratio}
              y2={VIEW_H * ratio}
              stroke="var(--color-muted)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path d={areaPath} fill={`url(#fill-${uid})`} />
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-warning)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {points.map((p, i) => (
            <g key={p.month}>
              {hover === i ? (
                <line
                  x1={p.x}
                  x2={p.x}
                  y1={0}
                  y2={VIEW_H}
                  stroke="var(--color-line-strong)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              <circle
                cx={p.x}
                cy={p.y}
                r={hover === i ? 5 : 3.5}
                fill="var(--color-surface)"
                stroke="var(--color-warning)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {/* Generous invisible hit area so hover works at any width. */}
              <rect
                x={p.x - stepX / 2}
                y={0}
                width={stepX}
                height={VIEW_H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          ))}
        </svg>

        {hover !== null ? (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-[8px] border border-line bg-surface px-2.5 py-1.5 shadow-[var(--shadow-pop)]"
            style={{
              left: `${(points[hover].x / VIEW_W) * 100}%`,
              top: `${(points[hover].y / VIEW_H) * 190 - 10}px`,
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-4">
              {points[hover].month}
            </p>
            <p className="tnum text-[13px] font-semibold text-ink">
              {rupees(points[hover].value)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex justify-between px-1">
        {data.map((d) => (
          <span
            key={d.month}
            className="text-[10px] font-medium uppercase tracking-[0.05em] text-ink-4"
          >
            {d.month}
          </span>
        ))}
      </div>
    </div>
  )
}
