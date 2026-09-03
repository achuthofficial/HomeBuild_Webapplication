import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth'

import { auth, providers, isFirebaseConfigured } from '@/lib/firebase'
import { demoProfile } from '@/data/user'

const AuthContext = createContext(null)

/**
 * Session lifecycle, as a state machine rather than a boolean.
 *
 *   loading — Firebase has not yet reported the persisted session. Route
 *             guards MUST wait here; treating it as signed-out is what makes
 *             an app bounce you to /sign-in on every hard refresh.
 *   anon    — resolved, no user.
 *   authed  — resolved, user in hand.
 *
 * Unlike a session-based provider there is no `recovery` state: Firebase
 * password resets are a stateless one-time code in the email link, exchanged
 * on /reset-password without ever creating a session.
 */
export const AUTH_STATUS = {
  loading: 'loading',
  anon: 'anon',
  authed: 'authed',
}

/** Where email action links (reset, verify) come back to. */
const actionUrl = () => `${window.location.origin}/auth/action`

/**
 * Firebase reports failures as stable `auth/...` codes, which is what we key
 * on — the accompanying messages are aimed at developers and change between
 * SDK versions. Anything unrecognised falls through with its own message
 * rather than being swallowed.
 */
const ERROR_MESSAGES = {
  /* Modern SDKs collapse wrong-password and unknown-email into this single
     code deliberately, so an attacker cannot enumerate accounts. Keep the
     message equally uninformative. */
  'auth/invalid-credential': 'That email and password combination is not recognised.',
  'auth/wrong-password': 'That email and password combination is not recognised.',
  'auth/user-not-found': 'That email and password combination is not recognised.',
  'auth/invalid-email': 'That does not look like a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Contact your administrator.',
  'auth/email-already-in-use':
    'An account with that email already exists. Try signing in instead.',
  'auth/weak-password': 'Passwords need to be at least 6 characters.',
  'auth/missing-password': 'Enter your password.',
  'auth/too-many-requests':
    'Too many attempts. Wait a few minutes, or reset your password.',
  'auth/network-request-failed':
    'Could not reach the authentication server. Check your connection.',
  'auth/popup-closed-by-user': 'The sign-in window closed before it finished.',
  'auth/cancelled-popup-request': null,
  'auth/popup-blocked': 'Your browser blocked the sign-in window.',
  'auth/account-exists-with-different-credential':
    'That email is already registered with a different sign-in method. Use the one you signed up with.',
  'auth/unauthorized-domain':
    'This domain is not authorised for sign-in. Add it under Authentication → Settings → Authorized domains in the Firebase console.',
  'auth/operation-not-allowed':
    'That sign-in method is not enabled for this project.',
  'auth/expired-action-code': 'This link has expired. Request a new one.',
  'auth/invalid-action-code':
    'This link is no longer valid. It may have been used already.',
  'auth/requires-recent-login':
    'For security, sign in again before making this change.',
}

function readableError(error) {
  if (!error) return null
  const code = error.code ?? ''
  if (code in ERROR_MESSAGES) return ERROR_MESSAGES[code]
  if (code.startsWith('auth/')) {
    /* Turn `auth/some-failure-code` into something a person can read rather
       than showing a raw identifier. */
    return `Sign-in failed (${code.replace('auth/', '').replace(/-/g, ' ')}).`
  }
  return error.message ?? 'Something went wrong. Try again.'
}

/**
 * Builds the profile the UI renders. Real identity from Firebase wins; the
 * demo fixture supplies the fields this prototype has no database for (role,
 * phone, project counters) so the Settings screen stays populated.
 */
function toProfile(user) {
  if (!user) return null

  const name =
    user.displayName || user.email?.split('@')[0] || 'Account'

  return {
    ...demoProfile,
    id: user.uid,
    name,
    firstName: name.split(' ')[0],
    email: user.email ?? demoProfile.email,
    /* Google returns a photo; Apple and email signups usually do not, and the
       UI falls back to initials rather than a stock face. */
    avatar: user.photoURL || null,
    initials: name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
    /* Which identity provider signed them in — shown on Settings. */
    provider: user.providerData?.[0]?.providerId ?? 'password',
    emailVerified: Boolean(user.emailVerified),
  }
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(
    isFirebaseConfigured ? AUTH_STATUS.loading : AUTH_STATUS.anon,
  )
  const [user, setUser] = useState(null)

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured) return undefined

    /* Collect the result of a redirect-based OAuth sign-in. This resolves to
       null on an ordinary page load, so it is safe to call unconditionally;
       onAuthStateChanged reports the user either way. We call it only to
       surface an error that would otherwise vanish silently. */
    getRedirectResult(auth).catch((error) => {
      console.error('[auth] redirect sign-in failed', error)
    })

    /* The single source of truth. Fires once with the persisted user (or
       null) after Firebase finishes initialising, then on every change —
       including in OTHER TABS, which is what keeps sign-out synchronised
       across a user's open tabs. Firebase refreshes ID tokens on its own. */
    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        if (!mounted.current) return
        setUser(nextUser)
        setStatus(nextUser ? AUTH_STATUS.authed : AUTH_STATUS.anon)
      },
      (error) => {
        console.error('[auth] state listener failed', error)
        if (mounted.current) setStatus(AUTH_STATUS.anon)
      },
    )

    return unsubscribe
  }, [])

  /* ---------------------------------------------------------------- actions
     Every action returns { error } with an already-readable message rather
     than throwing, so each form can render its own inline error state. */

  const signInWithPassword = useCallback(async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return { error: null }
    } catch (error) {
      return { error: readableError(error) }
    }
  }, [])

  const signUpWithPassword = useCallback(async (email, password, fullName) => {
    try {
      const { user: created } = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      )

      /* Firebase has no "full name" field at creation, so set it immediately.
         Done before the verification email so the template can use it. */
      if (fullName) {
        await updateProfile(created, { displayName: fullName })
      }

      /* Firebase does not block unverified accounts by default, and this app
         keeps that behaviour: the user is signed in now and nudged to verify
         from Settings. Send the mail but do not fail the signup over it. */
      try {
        await sendEmailVerification(created, { url: actionUrl() })
      } catch (error) {
        console.error('[auth] verification email failed to send', error)
      }

      return { error: null, needsConfirmation: false }
    } catch (error) {
      return { error: readableError(error) }
    }
  }, [])

  /**
   * Popup first — it keeps the user on the page and preserves app state.
   * Popups are blocked or unsupported often enough (in-app browsers, some
   * mobile configurations, strict blockers) that a redirect fallback is not
   * optional; without it those users simply cannot sign in.
   */
  const signInWithOAuth = useCallback(async (providerId) => {
    const provider = providers[providerId]
    if (!provider) return { error: `Unknown sign-in provider: ${providerId}` }

    try {
      await signInWithPopup(auth, provider)
      return { error: null }
    } catch (error) {
      const code = error.code ?? ''

      /* The user dismissed the popup, or a second one superseded this call.
         Neither is an error worth showing. */
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        return { error: null, cancelled: true }
      }

      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          /* Navigates away; getRedirectResult picks it up on return. */
          await signInWithRedirect(auth, provider)
          return { error: null }
        } catch (redirectError) {
          return { error: readableError(redirectError) }
        }
      }

      return { error: readableError(error) }
    }
  }, [])

  const requestPasswordReset = useCallback(async (email) => {
    try {
      await sendPasswordResetEmail(auth, email, { url: actionUrl() })
      return { error: null }
    } catch (error) {
      /* Do not leak whether an address is registered — the UI says "if an
         account exists" either way, so a user-not-found is reported as
         success. Everything else is a real failure. */
      if (error.code === 'auth/user-not-found') return { error: null }
      return { error: readableError(error) }
    }
  }, [])

  const resendVerification = useCallback(async () => {
    if (!auth.currentUser) return { error: 'You are not signed in.' }
    try {
      await sendEmailVerification(auth.currentUser, { url: actionUrl() })
      return { error: null }
    } catch (error) {
      return { error: readableError(error) }
    }
  }, [])

  /**
   * Re-reads the user from Firebase's servers. Needed after a verification
   * link is clicked in another tab: the local user object caches
   * emailVerified and will not notice on its own.
   */
  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return
    await auth.currentUser.reload()
    if (mounted.current) setUser({ ...auth.currentUser })
  }, [])

  const signOut = useCallback(async () => {
    try {
      await fbSignOut(auth)
    } catch (error) {
      return { error: readableError(error) }
    }
    if (mounted.current) {
      setUser(null)
      setStatus(AUTH_STATUS.anon)
    }
    return { error: null }
  }, [])

  const profile = useMemo(() => toProfile(user), [user])

  const value = useMemo(
    () => ({
      status,
      /* `user` is the PROFILE shape the screens consume (name, email, avatar,
         role). The raw Firebase user is exposed as `authUser` for anything
         needing uid, tokens or provider data. */
      user: profile,
      authUser: user,
      profile,
      isLoading: status === AUTH_STATUS.loading,
      isAuthenticated: status === AUTH_STATUS.authed,
      isConfigured: isFirebaseConfigured,
      signInWithPassword,
      signUpWithPassword,
      signInWithOAuth,
      requestPasswordReset,
      resendVerification,
      refreshUser,
      signOut,
    }),
    [
      status,
      user,
      profile,
      signInWithPassword,
      signUpWithPassword,
      signInWithOAuth,
      requestPasswordReset,
      resendVerification,
      refreshUser,
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
