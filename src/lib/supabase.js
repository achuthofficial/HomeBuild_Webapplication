import { createClient } from '@supabase/supabase-js'

/**
 * Supabase browser client.
 *
 * Configuration comes from Vite env vars, which are inlined at build time and
 * are PUBLIC — never put a service-role key here. The anon key is designed to
 * ship to browsers; what protects your data is Row Level Security in Supabase,
 * not secrecy of this key.
 *
 * Copy .env.example to .env.local and fill both values in. See AUTH_SETUP.md
 * for the dashboard configuration the OAuth providers need.
 */

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/**
 * Whether the app has usable credentials. The UI checks this and renders a
 * setup screen instead of auth forms, so a fresh clone explains itself rather
 * than throwing an opaque network error on first click.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

/** Which of the two is missing — surfaced on the setup screen. */
export const missingEnvVars = [
  !url && 'VITE_SUPABASE_URL',
  !anonKey && 'VITE_SUPABASE_ANON_KEY',
].filter(Boolean)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        /* PKCE is the correct flow for a browser app with no backend: the code
           returned in the callback URL is worthless without the verifier held
           in this origin's storage, so a leaked URL cannot be replayed. It is
           also what makes the emailed recovery links single-use. */
        flowType: 'pkce',

        /* Parse ?code= on load. This is what completes an OAuth round trip and
           a password-recovery link; /auth/callback just waits for it to land. */
        detectSessionInUrl: true,

        /* Keep the session across reloads and refresh the access token before
           it expires, so a long-lived tab does not silently 401. */
        persistSession: true,
        autoRefreshToken: true,

        /* localStorage, so the session survives a tab close and is shared
           across tabs of the same origin. Named to match the theme key. */
        storageKey: 'homebuild.auth',
      },
    })
  : null
