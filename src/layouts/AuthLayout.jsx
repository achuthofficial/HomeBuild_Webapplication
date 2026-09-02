import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

/** Signed-in visitors never see the auth screens — bounce them to the app. */
export default function AuthLayout() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (isAuthenticated) {
    const target = location.state?.from?.pathname ?? '/dashboard'
    return <Navigate to={target} replace />
  }

  return <Outlet />
}
