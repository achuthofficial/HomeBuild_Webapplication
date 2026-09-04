import { useId, useState } from 'react'
import { cn } from '@/lib/cn'

const fills = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  brand: 'var(--color-brand-600)',
  violet: 'var(--color-violet)',
  neutral: 'var(--color-ink-4)',
}

/**
 * Category Breakdown ring.
 *
 * The mockup's own segment values sum to 108%, not 100% (see design_system.md
 * section 7 item 1). Arc lengths are normalised against the actual sum so the
 * ring still closes, while the legend prints the source figures verbatim.
 */
export default function DonutChart({
  data,
  centerValue = '100%',
  centerLabel = 'Total Costs',
  size = 156,
  thickness = 22,
  className,
}) {
  const [active, setActive] = useState(null)
  const uid = useId().replace(/:/g, '')

  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1


  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label={`${centerLabel}: ${data
            .map((d) => `${d.label} ${d.value}%`)
            .join(', ')}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth={thickness}
          />
          {data.map((segment, i) => {
            const fraction = segment.value / total
            const dash = fraction * circumference
            /* Cumulative start of this arc, summed from the segments before
               it. This used to mutate a `let offset` while mapping — an
               accumulator carried across a render, which breaks the moment
               React memoises or re-orders any part of it. */
            const startFraction =
              data.slice(0, i).reduce((sum, s) => sum + s.value, 0) / total
            const dashOffset = -startFraction * circumference
            const isActive = active === segment.label

            return (
              <circle
                key={segment.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={fills[segment.tone]}
                strokeWidth={isActive ? thickness + 4 : thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={dashOffset}
                className="cursor-pointer transition-[stroke-width] duration-150"
                onMouseEnter={() => setActive(segment.label)}
                onMouseLeave={() => setActive(null)}
              />
            )
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-[22px] font-bold leading-none text-ink">
            {active
              ? `${data.find((d) => d.label === active)?.value}%`
              : centerValue}
          </span>
          <span className="mt-1 max-w-[7rem] text-center text-[10px] leading-tight text-ink-3">
            {active ?? centerLabel}
          </span>
        </div>
      </div>

      <ul className="mt-5 w-full space-y-2">
        {data.map((segment) => (
          <li
            key={segment.label}
            onMouseEnter={() => setActive(segment.label)}
            onMouseLeave={() => setActive(null)}
            className="flex cursor-pointer items-center gap-2 text-[12px]"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: fills[segment.tone] }}
            />
            <span className="flex-1 truncate text-ink-2">{segment.label}</span>
            <span className="tnum font-semibold text-ink">{segment.value}%</span>
          </li>
        ))}
      </ul>
      <span id={`donut-${uid}`} className="sr-only" />
    </div>
  )
}
