import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Builds a 1 … n page list with ellipses once the count grows past 5. */
function pageList(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 3) return [1, 2, 3, '…', total]
  if (current >= total - 2) return [1, '…', total - 2, total - 1, total]
  return [1, '…', current, '…', total]
}

export default function Pagination({ page, totalPages, onChange, className }) {
  if (totalPages <= 1) return null

  const go = (next) => onChange?.(Math.min(Math.max(next, 1), totalPages))

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex items-center gap-1', className)}
    >
      <button
        type="button"
        onClick={() => go(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="focus-ring flex size-7 items-center justify-center rounded-[6px] text-ink-3 transition-colors hover:bg-subtle disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft className="size-4" strokeWidth={2} />
      </button>

      {pageList(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span
            key={`gap-${i}`}
            className="px-1 text-[12px] text-ink-4"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'focus-ring tnum flex size-7 items-center justify-center rounded-[6px] text-[12px] font-semibold transition-colors',
              p === page
                ? 'bg-brand-600 text-on-brand'
                : 'text-ink-2 hover:bg-subtle',
            )}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => go(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className="focus-ring flex size-7 items-center justify-center rounded-[6px] text-ink-3 transition-colors hover:bg-subtle disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRight className="size-4" strokeWidth={2} />
      </button>
    </nav>
  )
}
