import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { AUTH_STATUS, useAuth } from '@/context/AuthContext'
import { getProfile } from '@/api/profiles'

/**
 * Where signing in lands you.
 *
 * PRD section 5 is specific: "Upon login, the CUSTOMER sees a project header
 * ... and four large circular buttons arranged in cardinal positions". So a
 * customer goes to the compass.
 *
 * A project manager does not. The document's own persona runs three to five
 * sites at once, and a compass shows one project — the portfolio list is the
 * right first screen for them, and for a site supervisor.
 *
 * ── Why this holds the destination in state ───────────────────────────────
 * The obvious version — a useQuery for the profile, then redirect once it is
 * no longer loading — is wrong, and wrong in a way that always sends the
 * customer to the wrong screen.
 *
 * On the first render `authUser` is null while Firebase restores the session,
 * so the query is disabled and reports isLoading:false. The moment the user
 * arrives, there is one more render before the query's effect runs, and the
 * query still reports isLoading:false on it. "Not loading" therefore means
 * BOTH "no answer yet" and "here is the answer", and the redirect fires on
 * the first of those. Holding an explicit destination removes the ambiguity:
 * null means undecided, and nothing navigates until it is set.
 */
export default function Landing() {
  const { authUser, status } = useAuth()
  const [target, setTarget] = useState(null)

  useEffect(() => {
    if (status === AUTH_STATUS.loading) return undefined

    /* Not signed in: hand it to the portfolio route, whose guard sends them
       to sign-in with the right `from` state. Deciding that here would
       duplicate the guard and drift from it. */
    if (!authUser) {
      setTarget('/dashboard')
      return undefined
    }

    let cancelled = false
    getProfile(authUser.uid)
      .then((profile) => {
        if (!cancelled) {
          setTarget(profile?.role === 'customer' ? '/home' : '/dashboard')
        }
      })
      .catch(() => {
        /* No profile row yet, or the lookup failed. The portfolio works for
           every role; the compass needs a project the viewer can see. */
        if (!cancelled) setTarget('/dashboard')
      })

    return () => {
      cancelled = true
    }
  }, [status, authUser])

  if (!target) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-canvas"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading your home screen…</span>
        <span className="size-6 animate-spin rounded-full border-2 border-line-strong border-t-brand-600" />
      </div>
    )
  }

  return <Navigate to={target} replace />
}
