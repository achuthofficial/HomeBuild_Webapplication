import {
  LayoutGrid,
  Folder,
  HardHat,
  Wallet,
  CalendarDays,
  Users,
  BarChart3,
  LifeBuoy,
  Settings,
} from 'lucide-react'

/**
 * Primary sidebar navigation, in mockup order.
 *
 * `labelKey` rather than `label`: the sidebar renders it through `t()`, so
 * the nav follows the language picked in Settings. The English text lives in
 * src/i18n/strings.js with everything else.
 */
export const primaryNav = [
  { labelKey: 'nav.overview', to: '/dashboard', icon: LayoutGrid },
  { labelKey: 'nav.projects', to: '/projects', icon: Folder },
  { labelKey: 'nav.construction', to: '/construction', icon: HardHat },
  { labelKey: 'nav.finance', to: '/finance', icon: Wallet },
  { labelKey: 'nav.schedule', to: '/schedule', icon: CalendarDays },
  { labelKey: 'nav.contractors', to: '/contractors', icon: Users },
  { labelKey: 'nav.analytics', to: '/analytics', icon: BarChart3 },
]

/** Pinned to the bottom of the sidebar above a hairline. */
export const secondaryNav = [
  { labelKey: 'nav.support', to: '/support', icon: LifeBuoy },
  { labelKey: 'nav.settings', to: '/settings', icon: Settings },
]

/**
 * The topbar search placeholder changes by section — Overview, Projects,
 * Construction and Finance ask about documents; Schedule, Contractors and
 * Analytics ask about tasks and people.
 */
export const searchPlaceholderKeys = {
  '/dashboard': 'topbar.searchDocuments',
  '/projects': 'topbar.searchDocuments',
  '/construction': 'topbar.searchDocuments',
  '/finance': 'topbar.searchDocuments',
  '/schedule': 'topbar.searchTasks',
  '/contractors': 'topbar.searchTasks',
  '/analytics': 'topbar.searchTasks',
  '/settings': 'topbar.searchDocuments',
  '/support': 'topbar.searchDocuments',
}
