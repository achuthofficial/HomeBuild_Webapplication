import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import CreateProjectModal from '@/components/shared/CreateProjectModal'

/**
 * Workspace shell: fixed 240px sidebar, sticky 64px topbar, fluid content on
 * the #F7F9FB canvas.
 */
export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const { pathname } = useLocation()

  // Close the mobile drawer and reset scroll whenever the route changes.
  useEffect(() => {
    setNavOpen(false)
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="lg:pl-[240px]">
        <Topbar
          onMenuClick={() => setNavOpen(true)}
          onCreateProject={() => setCreateOpen(true)}
        />

        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 lg:px-8">
          <Outlet context={{ openCreateProject: () => setCreateOpen(true) }} />
        </main>
      </div>

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  )
}
