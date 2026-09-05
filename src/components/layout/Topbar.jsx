import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Search,
  Bell,
  MessageSquare,
  Plus,
  Menu,
  LogOut,
  User,
  Sun,
  Moon,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { searchPlaceholders } from '@/data/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useTheme } from '@/context/ThemeContext'
import { useQuery } from '@/hooks/useQuery'
import { getOpenAlertCount } from '@/api/alerts'
import { globalSearch } from '@/api/search'

export default function Topbar({ onMenuClick, onCreateProject }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const { resolvedTheme, toggleTheme } = useTheme()

  /* The bell's badge. Refetched on navigation rather than polled: acting on
     an alert always ends in a route change, and a timer here would fire on
     every screen forever for a number that rarely moves. */
  const alertCount = useQuery(() => getOpenAlertCount(), [pathname])
  const openAlerts = alertCount.data ?? 0

  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  /* Visibility is separate from the data. Dismissing used to throw the results
     away, which meant re-focusing the box showed nothing until you retyped —
     and a fresh request for a term already answered. */
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchRef = useRef(null)
  /* The term the newest request was issued for, so a slow one cannot land
     after a newer one and show stale results. */
  const latest = useRef('')
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

  /* Debounced so a four-letter word is one request, not four. 200ms is under
     the threshold where typing feels laggy and well above a keystroke. */
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults(null)
      setOpen(false)
      setSearching(false)
      return undefined
    }

    setSearching(true)
    const timer = setTimeout(async () => {
      /* Only commit if the box still holds what this request was for —
         otherwise a slow response, success or failure, overwrites a newer
         one. Checked at resolution time rather than in the setter so the
         error branch is guarded too. */
      try {
        const found = await globalSearch(term)
        if (latest.current !== term) return
        setResults(found)
        setOpen(true)
      } catch (error) {
        console.error('[search] failed', error)
        if (latest.current !== term) return
        setResults({ term, groups: [], total: 0, error: error.message })
        setOpen(true)
      } finally {
        if (latest.current === term) setSearching(false)
      }
    }, 200)

    latest.current = term
    return () => clearTimeout(timer)
  }, [query])

  /* Dismiss on a click outside, and on Escape. */
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (e) => {
      if (!searchRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      /* Chromium also clears an `input[type=search]` on Escape, so the term
         goes with the panel there. Firefox keeps it and only the panel
         closes. Both are fine; neither loses anything the user still wants. */
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openResult = (item) => {
    setOpen(false)
    setResults(null)
    setQuery('')
    navigate(item.to)
  }

  const onSearch = (e) => {
    e.preventDefault()
    /* Enter opens the first result — the fastest path when you typed a name
       you already know. */
    const first = results?.groups[0]?.items[0]
    if (first) openResult(first)
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

      <div ref={searchRef} className="relative min-w-0 flex-1 sm:max-w-sm">
        <form onSubmit={onSearch}>
          <label className="relative block">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-4" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results && setOpen(true)}
              placeholder={placeholder}
              role="combobox"
              aria-expanded={open}
              aria-controls="global-search-results"
              className="focus-ring h-9 w-full rounded-full bg-canvas pl-9 pr-3 text-[12.5px] text-ink placeholder:text-ink-4"
            />
          </label>
        </form>

        {/* Results. The box is in every mockup with nothing behind it; this is
            what it does now. Anchored to the input rather than rendered inline
            so it overlays the page instead of pushing it down. */}
        {open && results ? (
          <div
            id="global-search-results"
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-[70vh] overflow-y-auto rounded-[12px] border border-line bg-surface py-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.14)]"
          >
            {results.error ? (
              <p className="px-4 py-3 text-[12.5px] text-danger">{results.error}</p>
            ) : results.total === 0 ? (
              <p className="px-4 py-3 text-[12.5px] text-ink-2">
                Nothing matches “{results.term}”.
              </p>
            ) : (
              results.groups.map((group) => (
                <div key={group.key} className="py-1">
                  <p className="eyebrow px-4 pb-1 pt-1.5">{group.label}</p>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected="false"
                      onClick={() => openResult(item)}
                      className="focus-ring block w-full px-4 py-2 text-left transition-colors hover:bg-canvas"
                    >
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {item.title}
                      </span>
                      <span className="block truncate text-[11.5px] text-ink-3">
                        {item.detail}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        ) : null}

        {/* Only shown before the first result set, so the panel does not flash
            "Searching…" over results that are already useful. */}
        {searching && !open ? (
          <p className="absolute left-4 top-[calc(100%+12px)] text-[11.5px] text-ink-4">
            Searching…
          </p>
        ) : null}
      </div>

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
          onClick={() => {
            if (openAlerts > 0) navigate('/analytics')
            else toast('No open alerts.', { tone: 'info' })
          }}
          aria-label={
            openAlerts > 0
              ? `${openAlerts} open alert${openAlerts === 1 ? '' : 's'}`
              : 'Notifications — none open'
          }
          className="focus-ring relative rounded-[8px] p-2 text-ink-2 transition-colors hover:bg-subtle"
        >
          <Bell className="size-[18px]" strokeWidth={1.75} />
          {/* The dot used to be painted unconditionally, so it claimed unread
              news on a completely quiet account. */}
          {openAlerts > 0 ? (
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-danger" />
          ) : null}
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
            <Avatar user={user} size={32} />
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
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  document.body.classList.add('theme-transition')
                  toggleTheme()
                  window.setTimeout(
                    () => document.body.classList.remove('theme-transition'),
                    260,
                  )
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink-2 transition-colors hover:bg-subtle"
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="size-4" strokeWidth={1.75} />
                ) : (
                  <Moon className="size-4" strokeWidth={1.75} />
                )}
                Switch to {resolvedTheme === 'dark' ? 'light' : 'dark'} mode
              </button>
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
                onClick={async () => {
                  setMenuOpen(false)
                  await signOut()
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
