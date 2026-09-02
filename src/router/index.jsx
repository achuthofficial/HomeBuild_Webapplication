import { createBrowserRouter, Navigate } from 'react-router-dom'

import AppLayout from '@/layouts/AppLayout'
import AuthLayout from '@/layouts/AuthLayout'
import ProtectedRoute from '@/router/ProtectedRoute'
import RootError from '@/router/RootError'

import SignIn from '@/pages/SignIn'
import Dashboard from '@/pages/Dashboard'
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
 * Browser router. Deep links such as /finance are rewritten to index.html by
 * vercel.json, so a hard refresh on any route resolves here rather than
 * hitting Vercel's 404 page.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <RootError />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },

      {
        element: <AuthLayout />,
        children: [{ path: 'sign-in', element: <SignIn /> }],
      },

      {
        element: (
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'projects', element: <Projects /> },
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
