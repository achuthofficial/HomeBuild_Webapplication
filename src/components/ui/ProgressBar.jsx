import { cn } from '@/lib/cn'
import { pct } from '@/lib/format'

const tones = {
  brand: 'bg-brand-600',
  success: 'bg-success',
  violet: 'bg-violet',
  warning: 'bg-warning',
  danger: 'bg-danger-bar',
}

/** 4–6px rail on an #ECF0F5 track, fully rounded, semantic fill. */
export default function ProgressBar({
  value,
  tone = 'brand',
  size = 'md',
  className,
  label,
}) {
  const width = pct(value)
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-full bg-muted',
        size === 'sm' ? 'h-1' : size === 'lg' ? 'h-2' : 'h-1.5',
        className,
      )}
      role="progressbar"
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', tones[tone])}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
