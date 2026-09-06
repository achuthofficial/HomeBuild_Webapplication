import { TriangleAlert, Inbox, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

/**
 * Skeleton block. Sized by the caller so a loading card occupies the same
 * space its content will, which stops the page reflowing when data lands.
 */
export function Skeleton({ className }) {
  return (
    <div
      className={cn('animate-pulse rounded-[6px] bg-muted', className)}
      aria-hidden="true"
    />
  )
}

/** Placeholder matching the KPI card's shape. */
export function KpiSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-7 w-16" />
      <Skeleton className="mt-3 h-2.5 w-28" />
    </Card>
  )
}

/** Placeholder rows for a table or list. */
export function RowSkeleton({ rows = 4, className }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-[9px]" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Wraps a query's three failure-adjacent states so every screen handles them
 * the same way, rather than each page inventing its own spinner and error text.
 *
 * `isEmpty` is a predicate rather than a boolean so the caller decides what
 * counts as empty — an empty array for a list, a zero count for a summary.
 */
export default function QueryBoundary({
  isLoading,
  error,
  data,
  onRetry,
  skeleton,
  isEmpty,
  emptyTitle = 'Nothing here yet',
  emptyBody,
  children,
}) {
  if (isLoading) {
    return skeleton ?? <RowSkeleton />
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-[10px] bg-danger-bg">
          <TriangleAlert className="size-5 text-danger" />
        </div>
        <p className="text-[14px] font-semibold text-ink">Couldn’t load this</p>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-2">
          {error}
        </p>
        {onRetry ? (
          <Button
            variant="outline"
            icon={RefreshCw}
            className="mt-5"
            onClick={onRetry}
          >
            Try Again
          </Button>
        ) : null}
      </Card>
    )
  }

  const empty =
    typeof isEmpty === 'function'
      ? isEmpty(data)
      : Array.isArray(data) && data.length === 0

  if (empty) {
    return (
      <Card className="p-10 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-[10px] bg-subtle">
          <Inbox className="size-5 text-ink-4" />
        </div>
        <p className="text-[14px] font-semibold text-ink">{emptyTitle}</p>
        {emptyBody ? (
          <p className="mx-auto mt-1.5 max-w-md text-[13px] text-ink-2">{emptyBody}</p>
        ) : null}
      </Card>
    )
  }

  return children
}
