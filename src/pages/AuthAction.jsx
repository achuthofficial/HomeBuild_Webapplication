import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { applyActionCode } from 'firebase/auth'

import AuthShell from '@/components/auth/AuthShell'
import { FormMessage } from '@/components/auth/AuthForm'
import Button from '@/components/ui/Button'
import { auth } from '@/lib/firebase'

/**
 * Single landing page for every Firebase email action link.
 *
 * Firebase sends one URL shape for all of them — ?mode=<action>&oobCode=<code>
 * — so this route reads the mode and dispatches. Password resets are handed
 * off to /reset-password, which needs a form; the rest are one-shot code
 * redemptions handled here.
 *
 * Requires "Customise action URL" to point at this route in the console; see
 * AUTH_SETUP.md. Without it these links land on Firebase's own hosted page
 * instead, which works but looks nothing like the product.
 */
export default function AuthAction() {
  const [params] = useSearchParams()
  const mode = params.get('mode')
  const oobCode = params.get('oobCode')

  const [state, setState] = useState('working')
  const [error, setError] = useState(null)

  /* React 18 StrictMode double-invokes effects in development. An action code
     is single-use, so a second redemption fails — guard it. */
  const redeemed = useRef(false)

  useEffect(() => {
    if (mode === 'resetPassword' || !oobCode) return
    if (mode !== 'verifyEmail' && mode !== 'recoverEmail') return
    if (redeemed.current) return
    redeemed.current = true

    applyActionCode(auth, oobCode)
      .then(() => setState('done'))
      .catch((failure) => {
        /* A connection failure is not a dead link — saying so would send the
           user off requesting replacements for a link that is still good. */
        if (failure.code === 'auth/network-request-failed') {
          setError(
            'Could not reach the authentication server. Check your connection and reload this page.',
          )
        } else if (failure.code === 'auth/expired-action-code') {
          setError('This link has expired. Request a new one from Settings.')
        } else {
          setError('This link is no longer valid. It may have been used already.')
        }
        setState('failed')
      })
  }, [mode, oobCode])

  /* Resets need a form, so they get their own screen. */
  if (mode === 'resetPassword' && oobCode) {
    return <Navigate to={`/reset-password?oobCode=${encodeURIComponent(oobCode)}`} replace />
  }

  if (!mode || !oobCode) {
    return (
      <AuthShell title="Nothing to do here" subtitle="This link is incomplete.">
        <div className="mt-6 space-y-4">
          <FormMessage>
            The link is missing the information needed to identify the request.
            Open the most recent email and try again.
          </FormMessage>
          <Button as={Link} to="/sign-in" variant="primary" size="lg" className="w-full">
            Back to Sign In
          </Button>
        </div>
      </AuthShell>
    )
  }

  if (state === 'working') {
    return (
      <AuthShell title="One moment…" subtitle="Confirming your request.">
        <div
          className="mt-8 flex items-center gap-3 text-[13px] text-ink-2"
          role="status"
          aria-live="polite"
        >
          <span className="size-4 animate-spin rounded-full border-2 border-line border-t-brand-600" />
          Working.
        </div>
      </AuthShell>
    )
  }

  if (state === 'failed') {
    return (
      <AuthShell title="That link didn’t work">
        <div className="mt-6 space-y-4">
          <FormMessage>{error}</FormMessage>
          <Button as={Link} to="/sign-in" variant="primary" size="lg" className="w-full">
            Back to Sign In
          </Button>
        </div>
      </AuthShell>
    )
  }

  const verified = mode === 'verifyEmail'

  return (
    <AuthShell
      title={verified ? 'Email confirmed' : 'Email address restored'}
      subtitle={
        verified
          ? 'Your address is verified — nothing else to do.'
          : 'The change has been reverted and your old address is active again.'
      }
    >
      <div className="mt-6 space-y-4">
        <FormMessage tone="info">
          {verified
            ? 'Thanks — you can close this tab, or head into the workspace.'
            : 'We recommend resetting your password, in case someone else initiated that change.'}
        </FormMessage>
        <Button as={Link} to="/dashboard" variant="primary" size="lg" className="w-full">
          Go to Overview
        </Button>
        {!verified ? (
          <Button as={Link} to="/forgot-password" variant="outline" size="lg" className="w-full">
            Reset My Password
          </Button>
        ) : null}
      </div>
    </AuthShell>
  )
}
