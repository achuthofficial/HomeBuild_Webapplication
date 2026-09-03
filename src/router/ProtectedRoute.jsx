import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, AUTH_STATUS } from '@/context/AuthContext'
import SetupRequired from '@/pages/SetupRequired'

/**
 * Gates the workspace behind a real Firebase session.
 *
 * The `loading` branch matters more than it looks: reading a persisted session
 * out of storage is asynchronous, so for the first tick after a hard refresh
 * there is no session yet. Treating that as signed-out is the classic bug that
 * bounces a signed-in user to /sign-in on every F5. We hold instead.
 */
export default function ProtectedRoute({ children }) {
  const { status, isConfigured } = useAuth()
  const location = useLocation()

  if (!isConfigured) return <SetupRequired />

  if (status === AUTH_STATUS.loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-canvas"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Restoring your session</span>
        <span className="size-6 animate-spin rounded-full border-2 border-line border-t-brand-600" />
      </div>
    )
  }

  if (status !== AUTH_STATUS.authed) {
    /* Carry the attempted path so sign-in can return the user to it. */
    return <Navigate to="/sign-in" replace state={{ from: location }} />
  }

  return children
}
