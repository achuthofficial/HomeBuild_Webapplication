import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { currentUser } from '@/data/user'

const AuthContext = createContext(null)

const STORAGE_KEY = 'homebuild.session'

/** Read the persisted demo session, tolerating blocked/absent storage. */
function readSession() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'active'
  } catch {
    return false
  }
}

function writeSession(active) {
  try {
    if (active) sessionStorage.setItem(STORAGE_KEY, 'active')
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable — session stays in memory only */
  }
}

/**
 * Prototype auth. There is no backend: any credentials are accepted and the
 * session is a single sessionStorage flag, purely so the sign-in and log-out
 * buttons in the mockups actually do something.
 */
export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(readSession)

  const signIn = useCallback(() => {
    writeSession(true)
    setIsAuthenticated(true)
  }, [])

  const signOut = useCallback(() => {
    writeSession(false)
    setIsAuthenticated(false)
  }, [])

  const value = useMemo(
    () => ({ isAuthenticated, user: currentUser, signIn, signOut }),
    [isAuthenticated, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider')
  return ctx
}
