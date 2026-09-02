import { cn } from '@/lib/cn'

/**
 * Segmented control. Two looks appear in the mockups:
 *  - `raised`  — #F2F4F6 track with a white active pill (Schedule views)
 *  - `filled`  — blue-filled active segment (Contractors All/Internal/Sub)
 */
export default function Segmented({
  options,
  value,
  onChange,
  variant = 'raised',
  size = 'md',
  className,
  ariaLabel,
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-[8px] bg-subtle p-1',
        className,
      )}
    >
      {options.map((option) => {
        const active = option === value
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(option)}
            className={cn(
              'focus-ring rounded-[6px] font-semibold transition-colors',
              size === 'sm' ? 'h-6 px-2.5 text-[11px]' : 'h-7 px-3 text-[12px]',
              active
                ? variant === 'filled'
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface text-ink shadow-[var(--shadow-raised)]'
                : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
