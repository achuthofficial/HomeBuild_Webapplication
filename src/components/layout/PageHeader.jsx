import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * H1 + one-line subtitle with right-aligned actions, plus the optional
 * breadcrumb and uppercase eyebrow seen on Portfolio, Schedule and
 * Contractors.
 */
export default function PageHeader({
  eyebrow,
  breadcrumbs,
  title,
  subtitle,
  actions,
  className,
}) {
  return (
    <div className={cn('mb-5', className)}>
      {breadcrumbs?.length ? (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-[11px] font-medium uppercase tracking-[0.05em]">
            {breadcrumbs.map((crumb, i) => {
              const last = i === breadcrumbs.length - 1
              return (
                <li key={crumb.label} className="flex items-center gap-1">
                  {crumb.to && !last ? (
                    <Link
                      to={crumb.to}
                      className="text-ink-4 transition-colors hover:text-ink-2"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={last ? 'text-brand-ink' : 'text-ink-4'}>
                      {crumb.label}
                    </span>
                  )}
                  {!last ? (
                    <ChevronRight className="size-3 text-ink-4" strokeWidth={2} />
                  ) : null}
                </li>
              )
            })}
          </ol>
        </nav>
      ) : null}

      {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.01em] text-ink">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-[13px] text-ink-2">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  )
}
