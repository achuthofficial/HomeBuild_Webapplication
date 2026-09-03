import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth'

/**
 * Firebase app and auth singletons.
 *
 * Configuration comes from Vite env vars, which are inlined at build time and
 * are PUBLIC. That is expected for Firebase: the web API key identifies the
 * project, it does not authorise anything. What protects your data is Firebase
 * Security Rules plus the Authorized Domains list — never treat these as
 * secrets, and never put a service-account key in a VITE_ variable.
 *
 * Copy .env.example to .env.local and fill all six values in. See
 * AUTH_SETUP.md for the console configuration the providers need.
 */

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
}

/* apiKey, authDomain and projectId are the three auth genuinely cannot work
   without. The rest belong to other Firebase products and are reported as
   missing but are not treated as fatal here. */
const REQUIRED = {
  VITE_FIREBASE_API_KEY: config.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
  VITE_FIREBASE_PROJECT_ID: config.projectId,
  VITE_FIREBASE_APP_ID: config.appId,
}

export const missingEnvVars = Object.entries(REQUIRED)
  .filter(([, value]) => !value)
  .map(([name]) => name)

/**
 * Whether the app has usable credentials. The UI checks this and renders a
 * setup screen instead of auth forms, so a fresh clone explains itself rather
 * than throwing an opaque error on first click.
 */
export const isFirebaseConfigured = missingEnvVars.length === 0

const app = isFirebaseConfigured ? initializeApp(config) : null

export const auth = app ? getAuth(app) : null

if (auth) {
  /* localStorage rather than session or in-memory, so a session survives a tab
     close and is shared across tabs of the same origin. This is Firebase's
     default; setting it explicitly makes the intent legible and surfaces the
     failure if storage is unavailable (private mode, blocked cookies). */
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('[auth] could not set local persistence', error)
  })
}

/** Google. `prompt: select_account` stops it silently reusing one account. */
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

/**
 * Apple. Firebase models Apple as a generic OIDC provider rather than giving
 * it a dedicated class. Name and email are only ever returned on the FIRST
 * authorisation, so the scopes must be requested up front.
 */
export const appleProvider = new OAuthProvider('apple.com')
appleProvider.addScope('email')
appleProvider.addScope('name')

/**
 * Which OAuth buttons the auth screens offer.
 *
 * Apple is opt-in because it cannot work from a toggle alone: the web flow
 * needs a Services ID, Team ID, Key ID and .p8 key, all of which require a
 * paid Apple Developer account. Showing the button before that is configured
 * gives users one that always fails, so it stays off until explicitly enabled.
 *
 * Flip it on with VITE_ENABLE_APPLE_SIGNIN=true once the Firebase console has
 * the Apple provider fully configured. Google is on unless explicitly
 * disabled the same way.
 */
const flag = (value, fallback) => {
  if (value === undefined || value === '') return fallback
  return String(value).toLowerCase() === 'true'
}

export const providerEnabled = {
  google: flag(import.meta.env.VITE_ENABLE_GOOGLE_SIGNIN, true),
  apple: flag(import.meta.env.VITE_ENABLE_APPLE_SIGNIN, false),
}

export const providers = {
  google: googleProvider,
  apple: appleProvider,
}

/** True when at least one OAuth button will render. */
export const hasOAuthProviders = Object.values(providerEnabled).some(Boolean)
