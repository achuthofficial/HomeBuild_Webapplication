import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Filter dropdown with an uppercase prefix label, e.g. `STATUS: All Projects`.
 * Closes on outside click and on Escape.
 */
export default function FilterSelect({
  label,
  value,
  options,
  onChange,
  className,
  align = 'left',
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const id = useId()

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring inline-flex h-9 items-center gap-2 rounded-[8px] border border-line bg-surface px-3 text-[12px] transition-colors hover:bg-subtle"
      >
        {label ? (
          <span className="font-semibold uppercase tracking-[0.05em] text-ink-4">
            {label}:
          </span>
        ) : null}
        <span className="font-semibold text-ink">{value}</span>
        <ChevronDown
          className={cn(
            'size-3.5 text-ink-4 transition-transform',
            open && 'rotate-180',
          )}
          strokeWidth={2}
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-labelledby={id}
          className={cn(
            'absolute z-30 mt-1.5 min-w-[11rem] overflow-hidden rounded-[10px] border border-line bg-surface py-1 shadow-[var(--shadow-pop)]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {options.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === value}
                onClick={() => {
                  onChange?.(option)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-subtle',
                  option === value
                    ? 'font-semibold text-brand-600'
                    : 'text-ink-2',
                )}
              >
                {option}
                {option === value ? <Check className="size-3.5" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
