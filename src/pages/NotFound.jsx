import { Link, useLocation } from 'react-router-dom'
import { Compass } from 'lucide-react'

import Logo from '@/components/layout/Logo'
import Button from '@/components/ui/Button'
import { primaryNav } from '@/data/navigation'

/**
 * In-app 404. Because vercel.json rewrites every unknown path to index.html,
 * a deep link like /finnance lands here rather than on Vercel's own 404 page.
 */
export default function NotFound() {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-16">
      <Logo size={38} />

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4">
        Error 404
      </p>
      <h1 className="mt-2 text-center text-[26px] font-bold tracking-[-0.01em] text-ink">
        This page isn’t on the site plan
      </h1>
      <p className="mt-2 max-w-md text-center text-[13px] leading-relaxed text-ink-2">
        Nothing is routed at{' '}
        <code className="rounded bg-subtle px-1.5 py-0.5 text-[12px] text-ink">
          {pathname}
        </code>
        . Pick a module below, or head back to the overview.
      </p>

      <Button
        as={Link}
        to="/dashboard"
        variant="primary"
        size="lg"
        className="mt-6"
      >
        Back to Overview
      </Button>

      <div className="mt-10 w-full max-w-md">
        <div className="mb-3 flex items-center gap-2">
          <Compass className="size-3.5 text-ink-4" strokeWidth={1.75} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-4">
            Jump to a module
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {primaryNav.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="focus-ring flex items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-brand-200 hover:text-brand-ink"
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
