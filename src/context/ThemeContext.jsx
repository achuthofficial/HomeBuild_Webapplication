import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'homebuild.theme'
const MEDIA = '(prefers-color-scheme: dark)'

/** The three options offered by the Settings mockup's Display Theme picker. */
export const THEMES = ['light', 'dark', 'system']

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return THEMES.includes(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia(MEDIA).matches
    : false
}

/**
 * Theme provider.
 *
 * `theme` is the user's *choice* — light, dark or system. `resolvedTheme` is
 * what is actually painted, so `system` collapses to light or dark by reading
 * the OS preference. Only the resolved value is stamped onto <html> as
 * `data-theme`, which keeps index.css to a single `[data-theme='dark']` block
 * rather than duplicating every token inside a media query.
 *
 * The matching pre-paint script in index.html applies the same attribute
 * before React mounts, so there is no flash of the wrong theme on load.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  // Track the OS preference so `system` stays live if the user flips it.
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const query = window.matchMedia(MEDIA)
    const onChange = (e) => setSystemDark(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  // Paint it.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolvedTheme
    root.style.colorScheme = resolvedTheme

    // Keep the browser UI (address bar on mobile) in step with the canvas.
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', resolvedTheme === 'dark' ? '#0B1017' : '#0058BE')
    }
  }, [resolvedTheme])

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage unavailable — the choice lives in memory for this session */
    }
  }, [])

  /** Convenience for a keyboard shortcut or a topbar toggle. */
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  const value = useMemo(
    () => ({ theme, resolvedTheme, systemDark, setTheme, toggleTheme }),
    [theme, resolvedTheme, systemDark, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside a ThemeProvider')
  return ctx
}
