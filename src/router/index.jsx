import { createBrowserRouter } from 'react-router-dom'

import AppLayout from '@/layouts/AppLayout'
import AuthLayout from '@/layouts/AuthLayout'
import ProtectedRoute from '@/router/ProtectedRoute'
import RootError from '@/router/RootError'

import SignIn from '@/pages/SignIn'
import SignUp from '@/pages/SignUp'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import AuthAction from '@/pages/AuthAction'
import Privacy from '@/pages/Privacy'

import Landing from '@/router/Landing'
import Compass from '@/pages/Compass'
import Dashboard from '@/pages/Dashboard'
import Design from '@/pages/Design'
import Projects from '@/pages/Projects'
import Construction from '@/pages/Construction'
import Finance from '@/pages/Finance'
import Schedule from '@/pages/Schedule'
import Contractors from '@/pages/Contractors'
import Analytics from '@/pages/Analytics'
import SettingsPage from '@/pages/Settings'
import Support from '@/pages/Support'
import NotFound from '@/pages/NotFound'

/**
 * Browser router.
 *
 * Deep links such as /finance and /auth/action are rewritten to index.html by
 * vercel.json, so a hard refresh or an emailed link resolves here rather than
 * hitting Vercel's 404 page.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <RootError />,
    children: [
      { index: true, element: <Landing /> },

      /* ---------------------------------------------------- unauthenticated
         AuthLayout bounces signed-in visitors out of these, except for the
         email-link routes, which a signed-in user can still legitimately be
         completing. There is no OAuth callback route: popup sign-in never
         leaves the page, and the redirect fallback returns to whichever
         screen started it. */
      {
        element: <AuthLayout />,
        children: [
          { path: 'sign-in', element: <SignIn /> },
          { path: 'sign-up', element: <SignUp /> },
          { path: 'forgot-password', element: <ForgotPassword /> },
          { path: 'reset-password', element: <ResetPassword /> },
          { path: 'auth/action', element: <AuthAction /> },
        ],
      },

      /* Reachable either way — the sign-in footer links here before a session
         exists, and the sidebar links here after. */
      { path: 'privacy', element: <Privacy /> },

      /* ---------------------------------------------------------- workspace */
      {
        element: (
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: 'home', element: <Compass /> },
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'projects', element: <Projects /> },
          { path: 'design', element: <Design /> },
          { path: 'construction', element: <Construction /> },
          { path: 'finance', element: <Finance /> },
          { path: 'schedule', element: <Schedule /> },
          { path: 'contractors', element: <Contractors /> },
          { path: 'analytics', element: <Analytics /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'support', element: <Support /> },
        ],
      },

      // Catch-all: renders in-app rather than surfacing a platform 404.
      { path: '*', element: <NotFound /> },
    ],
  },
])
