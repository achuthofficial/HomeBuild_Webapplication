import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { demoProfile } from '@/data/user'

const AuthContext = createContext(null)

/**
 * Session lifecycle, as a state machine rather than a boolean.
 *
 *   loading   — the initial getSession() has not resolved yet. Route guards
 *               MUST wait here; treating it as signed-out is what makes an
 *               app bounce you to /sign-in on every hard refresh.
 *   anon      — resolved, no session.
 *   authed    — resolved, session in hand.
 *   recovery  — arrived via a password-reset link. Supabase issues a real
 *               session for this, but it is only meant for setting a new
 *               password, so it is tracked separately from `authed`.
 */
export const AUTH_STATUS = {
  loading: 'loading',
  anon: 'anon',
  authed: 'authed',
  recovery: 'recovery',
}

/** Where OAuth and email links come back to. Must be allow-listed in Supabase. */
const callbackUrl = () => `${window.location.origin}/auth/callback`
const recoveryUrl = () => `${window.location.origin}/reset-password`

/**
 * Supabase errors are terse and occasionally leak implementation detail. Map
 * the ones users actually hit onto something readable, and let anything
 * unrecognised through rather than swallowing it.
 */
function readableError(error) {
  if (!error) return null
  const message = error.message ?? String(error)

  const map = {
    'Invalid login credentials': 'That email and password combination is not recognised.',
    'Email not confirmed': 'Check your inbox and confirm your email address before signing in.',
    'User already registered': 'An account with that email already exists. Try signing in instead.',
    'Password should be at least 6 characters':
      'Passwords need to be at least 6 characters.',
    'New password should be different from the old password':
      'Choose a password different from your current one.',
    'Email rate limit exceeded':
      'Too many emails requested. Wait a few minutes before trying again.',
  }

  if (map[message]) return map[message]
  if (/rate limit|too many requests/i.test(message))
    return 'Too many attempts. Wait a minute and try again.'
  if (/network|fetch/i.test(message))
    return 'Could not reach the authentication server. Check your connection.'
  return message
}

/**
 * Builds the profile the UI renders. Real identity from Supabase wins; the
 * demo fixture supplies the fields this prototype has no database for (role,
 * phone, project counts) so the Settings screen stays populated.
 */
function toProfile(user) {
  if (!user) return null

  const meta = user.user_metadata ?? {}
  const name =
    meta.full_name || meta.name || user.email?.split('@')[0] || 'Account'

  return {
    ...demoProfile,
    id: user.id,
    name,
    firstName: name.split(' ')[0],
    email: user.email ?? demoProfile.email,
    /* Google and Apple return a picture; email signups have none, and the UI
       falls back to initials rather than a stock face. */
    avatar: meta.avatar_url || meta.picture || null,
    initials: name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
    /* Which identity provider signed them in — shown on Settings. */
    provider: user.app_metadata?.provider ?? 'email',
    emailConfirmed: Boolean(user.email_confirmed_at ?? user.confirmed_at),
  }
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(
    isSupabaseConfigured ? AUTH_STATUS.loading : AUTH_STATUS.anon,
  )
  const [session, setSession] = useState(null)

  /* onAuthStateChange fires synchronously during signOut/refresh. Guard every
     setState behind mount state so a fast unmount cannot warn. */
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined

    /* Resolve the persisted session before rendering any guarded route. */
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted.current) return
      if (error) console.error('[auth] getSession failed', error)
      setSession(data?.session ?? null)
      setStatus(data?.session ? AUTH_STATUS.authed : AUTH_STATUS.anon)
    })

    /* The single source of truth from here on. Also fires in OTHER TABS when
       localStorage changes, which is what keeps sign-out synchronised across
       a user's open tabs. */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted.current) return

      setSession(nextSession)

      if (event === 'PASSWORD_RECOVERY') {
        setStatus(AUTH_STATUS.recovery)
        return
      }
      setStatus(nextSession ? AUTH_STATUS.authed : AUTH_STATUS.anon)
    })

    return () => subscription.unsubscribe()
  }, [])

  /* ---------------------------------------------------------------- actions
     Every action returns { error } with an already-readable message rather
     than throwing, so each form can render its own inline error state. */

  const signInWithPassword = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: readableError(error) }
  }, [])

  const signUpWithPassword = useCallback(async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: callbackUrl(),
        data: fullName ? { full_name: fullName } : undefined,
      },
    })
    if (error) return { error: readableError(error) }

    /* With email confirmation on, Supabase returns a user but no session.
       Distinguish that from an immediate sign-in so the UI can say which. */
    return { error: null, needsConfirmation: !data.session }
  }, [])

  const signInWithOAuth = useCallback(async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl() },
    })
    /* On success the browser navigates away, so only failures return here. */
    return { error: readableError(error) }
  }, [])

  const requestPasswordReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: recoveryUrl(),
    })
    return { error: readableError(error) }
  }, [])

  const updatePassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: readableError(error) }
    /* The recovery session becomes an ordinary one once the password is set. */
    if (mounted.current) setStatus(AUTH_STATUS.authed)
    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    /* A stale or already-revoked token makes signOut fail while the local
       session is still cleared. Treat that as success — the user is out. */
    if (error && !/session|token/i.test(error.message)) {
      return { error: readableError(error) }
    }
    if (mounted.current) {
      setSession(null)
      setStatus(AUTH_STATUS.anon)
    }
    return { error: null }
  }, [])

  const user = session?.user ?? null
  const profile = useMemo(() => toProfile(user), [user])

  const value = useMemo(
    () => ({
      status,
      session,
      /* `user` is the PROFILE shape the existing screens already consume
         (name, email, avatar, role), so Topbar and Settings needed no
         restructuring. The raw Supabase user is exposed as `authUser` for
         anything that needs ids, metadata or app_metadata. */
      user: profile,
      authUser: user,
      profile,
      isLoading: status === AUTH_STATUS.loading,
      isAuthenticated: status === AUTH_STATUS.authed,
      isRecovering: status === AUTH_STATUS.recovery,
      isConfigured: isSupabaseConfigured,
      signInWithPassword,
      signUpWithPassword,
      signInWithOAuth,
      requestPasswordReset,
      updatePassword,
      signOut,
    }),
    [
      status,
      session,
      user,
      profile,
      signInWithPassword,
      signUpWithPassword,
      signInWithOAuth,
      requestPasswordReset,
      updatePassword,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider')
  return ctx
}
