import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import AuthShell from '@/components/auth/AuthShell'
import { FormMessage } from '@/components/auth/AuthForm'
import Button from '@/components/ui/Button'
import { useAuth, AUTH_STATUS } from '@/context/AuthContext'

/**
 * Where Google, Apple and the email-confirmation link return to.
 *
 * The client is configured with detectSessionInUrl, so supabase-js has already
 * exchanged the ?code= for a session by the time getSession() resolves. This
 * screen's only job is to hold the user while that settles and then route
 * them, or explain what went wrong.
 *
 * vercel.json rewrites every non-/api path to index.html, so this deep link
 * resolves on a cold load rather than 404ing at the edge.
 */

/* If the exchange has not resolved by now, something is wrong — a stale code,
   a blocked third-party cookie, a mismatched redirect URL. */
const TIMEOUT_MS = 12_000

export default function AuthCallback() {
  const { status } = useAuth()
  const [params] = useSearchParams()
  const [timedOut, setTimedOut] = useState(false)

  /* The provider reports a refusal in the query string rather than by failing
     the redirect, so read it before supabase-js strips the params. */
  const providerError =
    params.get('error_description') ?? params.get('error') ?? null

  useEffect(() => {
    if (providerError) return undefined
    const timer = setTimeout(() => setTimedOut(true), TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [providerError])

  if (status === AUTH_STATUS.recovery) {
    return <Navigate to="/reset-password" replace />
  }

  if (status === AUTH_STATUS.authed) {
    return <Navigate to="/dashboard" replace />
  }

  const failed = providerError || (status === AUTH_STATUS.anon && timedOut)

  if (failed) {
    return (
      <AuthShell
        title="Sign-in didn’t complete"
        subtitle="No session was created, so nothing has changed on your account."
      >
        <div className="mt-6 space-y-4">
          <FormMessage>
            {providerError
              ? decodeURIComponent(providerError)
              : 'The provider did not return a valid session in time. This usually means the redirect URL is not allow-listed in Supabase, or the link was already used.'}
          </FormMessage>
          <Button as={Link} to="/sign-in" variant="primary" size="lg" className="w-full">
            Back to Sign In
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Completing sign-in…" subtitle="Verifying your identity.">
      <div
        className="mt-8 flex items-center gap-3 text-[13px] text-ink-2"
        role="status"
        aria-live="polite"
      >
        <span className="size-4 animate-spin rounded-full border-2 border-line border-t-brand-600" />
        One moment.
      </div>
    </AuthShell>
  )
}
