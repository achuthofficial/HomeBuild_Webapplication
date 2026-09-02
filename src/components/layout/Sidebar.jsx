import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import Logo from './Logo'
import { primaryNav, secondaryNav } from '@/data/navigation'

/**
 * Active state, per design_system.md section 3: a 2px green #10B981 bar on the
 * left edge, an #F2F6FB pill, and a #0058BE label and icon. Eight of the nine
 * mockups use this; the Settings screen's blue-right-bar variant is the
 * documented outlier and is deliberately not reproduced.
 */
function NavItem({ item, onNavigate }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'focus-ring relative flex items-center gap-3 rounded-r-[8px] py-2.5 pl-4 pr-3 text-[13.5px] transition-colors',
          isActive
            ? 'bg-brand-50 font-semibold text-brand-600'
            : 'font-medium text-ink-2 hover:bg-canvas hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <span className="absolute inset-y-0 left-0 w-[2px] rounded-r bg-success" />
          ) : null}
          <Icon
            className={cn('size-[18px] shrink-0', isActive && 'text-brand-600')}
            strokeWidth={1.75}
          />
          {item.label}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Mobile scrim */}
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-ink/25 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-line bg-surface transition-transform duration-200',
          'lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-start justify-between px-4 pb-5 pt-5">
          <div>
            <Logo />
            <p className="mt-2.5 text-[16px] font-bold leading-none text-ink">
              HomeBuild
            </p>
            <p className="mt-1.5 text-[11px] text-ink-4">
              Construction Management
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="focus-ring -m-1 rounded p-1 text-ink-4 lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="scrollbar-slim flex-1 overflow-y-auto pr-3" aria-label="Primary">
          <ul className="space-y-0.5">
            {primaryNav.map((item) => (
              <li key={item.to}>
                <NavItem item={item} onNavigate={onClose} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-line py-3 pr-3">
          <ul className="space-y-0.5">
            {secondaryNav.map((item) => (
              <li key={item.to}>
                <NavItem item={item} onNavigate={onClose} />
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  )
}
