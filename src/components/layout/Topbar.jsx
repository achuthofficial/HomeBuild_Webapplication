import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search, Bell, MessageSquare, Plus, Menu, LogOut, User } from 'lucide-react'
import { cn } from '@/lib/cn'
import Button from '@/components/ui/Button'
import { searchPlaceholders } from '@/data/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'

export default function Topbar({ onMenuClick, onCreateProject }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { toast } = useToast()

  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const placeholder =
    searchPlaceholders[pathname] ?? 'Search projects, documents, or alerts...'

  useEffect(() => {
    if (!menuOpen) return undefined
    const onPointerDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [menuOpen])

  const onSearch = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    toast(`No results for “${query.trim()}” in this prototype.`, { tone: 'info' })
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface px-4 lg:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="focus-ring -ml-1 rounded-[8px] p-2 text-ink-2 transition-colors hover:bg-subtle lg:hidden"
      >
        <Menu className="size-5" strokeWidth={1.75} />
      </button>

      <form onSubmit={onSearch} className="min-w-0 flex-1 sm:max-w-sm">
        <label className="relative block">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-4" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="focus-ring h-9 w-full rounded-full bg-canvas pl-9 pr-3 text-[12.5px] text-ink placeholder:text-ink-4"
          />
        </label>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="primary"
          icon={Plus}
          onClick={onCreateProject}
          className="hidden sm:inline-flex"
        >
          Create New Project
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onCreateProject}
          aria-label="Create new project"
          className="px-2.5 sm:hidden"
        >
          <Plus className="size-4" />
        </Button>

        <button
          type="button"
          onClick={() => toast('You have 3 unread notifications.', { tone: 'info' })}
          aria-label="Notifications"
          className="focus-ring relative rounded-[8px] p-2 text-ink-2 transition-colors hover:bg-subtle"
        >
          <Bell className="size-[18px]" strokeWidth={1.75} />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-danger" />
        </button>

        <button
          type="button"
          onClick={() => toast('Messages are not wired up in this prototype.', { tone: 'info' })}
          aria-label="Messages"
          className="focus-ring rounded-[8px] p-2 text-ink-2 transition-colors hover:bg-subtle"
        >
          <MessageSquare className="size-[18px]" strokeWidth={1.75} />
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={cn(
              'focus-ring block rounded-full ring-2 ring-transparent transition',
              menuOpen && 'ring-brand-200',
            )}
          >
            <img
              src={user.avatar}
              alt={user.name}
              className="size-8 rounded-full object-cover"
            />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-[10px] border border-line bg-surface py-1 shadow-[var(--shadow-pop)]"
            >
              <div className="border-b border-line px-3 py-2.5">
                <p className="truncate text-[13px] font-semibold text-ink">
                  {user.name}
                </p>
                <p className="truncate text-[11px] text-ink-3">{user.email}</p>
              </div>
              <Link
                to="/settings"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-ink-2 transition-colors hover:bg-subtle"
              >
                <User className="size-4" strokeWidth={1.75} />
                Profile & Settings
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  signOut()
                  navigate('/sign-in', { replace: true })
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-danger transition-colors hover:bg-danger-bg/50"
              >
                <LogOut className="size-4" strokeWidth={1.75} />
                Log Out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
