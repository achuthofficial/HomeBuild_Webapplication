import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, AUTH_STATUS } from '@/context/AuthContext'
import SetupRequired from '@/pages/SetupRequired'

/**
 * Wraps the unauthenticated screens.
 *
 * Signed-in visitors are bounced into the app so /sign-in is never a dead end
 * — but only from the screens where that makes sense. /reset-password and
 * /auth/callback are exempt: both legitimately run WITH a session, and
 * redirecting them away would make the recovery link impossible to complete.
 */
const SESSION_ALLOWED = ['/reset-password', '/auth/callback']

export default function AuthLayout() {
  const { status, isConfigured } = useAuth()
  const location = useLocation()

  if (!isConfigured) return <SetupRequired />

  /* Hold rather than flashing the sign-in form at someone who is already
     signed in and simply hit refresh. */
  if (status === AUTH_STATUS.loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-canvas"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading</span>
        <span className="size-6 animate-spin rounded-full border-2 border-line border-t-brand-600" />
      </div>
    )
  }

  if (SESSION_ALLOWED.includes(location.pathname)) {
    return <Outlet />
  }

  if (status === AUTH_STATUS.authed) {
    const target = location.state?.from?.pathname ?? '/dashboard'
    return <Navigate to={target} replace />
  }

  /* Mid-recovery but on, say, /sign-in — finish setting the password first. */
  if (status === AUTH_STATUS.recovery) {
    return <Navigate to="/reset-password" replace />
  }

  return <Outlet />
}
