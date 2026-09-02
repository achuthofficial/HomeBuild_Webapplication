import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'

/** Router-level error boundary — keeps failures inside the product shell. */
export default function RootError() {
  const error = useRouteError()

  const title = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'Something went wrong'

  const detail = isRouteErrorResponse(error)
    ? 'The page you requested could not be loaded.'
    : error?.message || 'An unexpected error interrupted this view.'

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-[10px] bg-danger-bg">
          <TriangleAlert className="size-5 text-danger" />
        </div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{detail}</p>
        <Link
          to="/dashboard"
          className="focus-ring mt-6 inline-flex h-10 items-center justify-center rounded-[8px] bg-brand-600 px-4 text-sm font-semibold text-on-brand transition hover:bg-brand-700"
        >
          Back to Overview
        </Link>
      </div>
    </div>
  )
}
