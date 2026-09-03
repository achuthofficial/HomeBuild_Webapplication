import {
  LayoutGrid,
  Folder,
  Compass,
  HardHat,
  Wallet,
  CalendarDays,
  Users,
  BarChart3,
  LifeBuoy,
  Settings,
} from 'lucide-react'

/** Primary sidebar navigation, in mockup order. */
export const primaryNav = [
  { label: 'Overview', to: '/dashboard', icon: LayoutGrid },
  { label: 'Projects', to: '/projects', icon: Folder },
  /* PRD's BUILD order puts Blueprint (Design) first among the four
     modules, ahead of Construction. */
  { label: 'Design', to: '/design', icon: Compass },
  { label: 'Construction', to: '/construction', icon: HardHat },
  { label: 'Finance', to: '/finance', icon: Wallet },
  { label: 'Schedule', to: '/schedule', icon: CalendarDays },
  { label: 'Contractors', to: '/contractors', icon: Users },
  { label: 'Analytics', to: '/analytics', icon: BarChart3 },
]

/** Pinned to the bottom of the sidebar above a hairline. */
export const secondaryNav = [
  { label: 'Support', to: '/support', icon: LifeBuoy },
  { label: 'Settings', to: '/settings', icon: Settings },
]

/**
 * The topbar search placeholder changes by section — Overview, Projects,
 * Construction and Finance ask about documents; Schedule, Contractors and
 * Analytics ask about tasks and people.
 */
export const searchPlaceholders = {
  '/dashboard': 'Search projects, documents, or alerts...',
  '/projects': 'Search projects, documents, or alerts...',
  '/design': 'Search plans, rooms, or Vastu zones...',
  '/construction': 'Search projects, documents, or alerts...',
  '/finance': 'Search projects, documents, or alerts...',
  '/schedule': 'Search tasks, milestones, or people...',
  '/contractors': 'Search tasks, milestones, or people...',
  '/analytics': 'Search tasks, milestones, or people...',
  '/settings': 'Search projects, documents, or alerts...',
  '/support': 'Search projects, documents, or alerts...',
}
