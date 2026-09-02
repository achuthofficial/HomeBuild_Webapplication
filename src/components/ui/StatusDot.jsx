import { cn } from '@/lib/cn'

const tones = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  violet: 'bg-violet',
  brand: 'bg-brand-600',
  neutral: 'bg-ink-4',
}

const textTones = {
  success: 'text-ink-2',
  warning: 'text-warning',
  danger: 'text-danger',
  violet: 'text-violet',
  brand: 'text-brand-ink',
  neutral: 'text-ink-2',
  none: 'text-ink-2',
}

/**
 * 6px semantic dot followed by a label. `tone: 'none'` renders the label with
 * no dot at all — the mockup's "Delayed" timeline value on Harbor Heights.
 */
export default function StatusDot({ tone = 'neutral', children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[13px] font-medium',
        textTones[tone] ?? textTones.neutral,
        className,
      )}
    >
      {tone !== 'none' ? (
        <span className={cn('size-1.5 shrink-0 rounded-full', tones[tone])} />
      ) : null}
      {children}
    </span>
  )
}
