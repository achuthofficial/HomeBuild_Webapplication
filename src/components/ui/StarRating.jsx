import { useId } from 'react'
import { cn } from '@/lib/cn'

function Star({ fill, gradientId }) {
  return (
    <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden="true">
      {fill > 0 && fill < 1 ? (
        <defs>
          <linearGradient id={gradientId}>
            <stop offset={`${fill * 100}%`} stopColor="#F59E0B" />
            <stop offset={`${fill * 100}%`} stopColor="#D3D7DD" />
          </linearGradient>
        </defs>
      ) : null}
      <path
        d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.21l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.6z"
        fill={
          fill >= 1
            ? '#F59E0B'
            : fill <= 0
              ? '#D3D7DD'
              : `url(#${gradientId})`
        }
      />
    </svg>
  )
}

/** Amber #F59E0B stars on a #D3D7DD empty track, with half-star support. */
export default function StarRating({ value = 0, max = 5, className }) {
  const uid = useId()

  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={`${value} out of ${max} stars`}
    >
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          fill={Math.max(0, Math.min(1, value - i))}
          gradientId={`star-${uid}-${i}`.replace(/:/g, '')}
        />
      ))}
    </span>
  )
}
