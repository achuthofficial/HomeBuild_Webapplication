import { createClient } from '@supabase/supabase-js'
import { auth } from '@/lib/firebase'

/**
 * Supabase client used for Storage only — authentication stays with Firebase.
 *
 * The bridge is the `accessToken` hook. Instead of Supabase minting and
 * managing its own session, every request asks Firebase for the current user's
 * ID token and sends that. Supabase validates it against the Firebase project
 * registered as a third-party auth provider, which makes the Firebase UID
 * available to Row Level Security as `auth.jwt() ->> 'sub'`.
 *
 * That is what lets a storage policy say "this user may only write under their
 * own prefix" while the user has never had a Supabase account.
 *
 * Consequences of using this hook, both deliberate:
 *   · supabase.auth.* is unavailable on this client. Sessions belong to
 *     Firebase; calling signIn here would be a second, conflicting identity.
 *   · Signed-out users send no token, so every policy that requires a UID
 *     correctly rejects them.
 *
 * See STORAGE_SETUP.md for the dashboard configuration and the SQL policies.
 */

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const missingStorageEnvVars = [
  !url && 'VITE_SUPABASE_URL',
  !anonKey && 'VITE_SUPABASE_ANON_KEY',
].filter(Boolean)

/**
 * Whether uploads are available. The UI checks this and keeps the previous
 * "not wired up" behaviour when storage is absent, so the app stays usable as
 * a pure prototype without a Supabase project.
 */
export const isStorageConfigured = missingStorageEnvVars.length === 0

export const supabase = isStorageConfigured
  ? createClient(url, anonKey, {
      accessToken: async () => {
        const user = auth?.currentUser
        if (!user) return null
        /* Returns the cached token, refreshing only when it is close to
           expiry, so this is cheap to call on every request. */
        return user.getIdToken()
      },
    })
  : null

/** Bucket names. Both must exist in the Supabase project. */
export const BUCKETS = {
  /** Public: profile pictures, referenced directly by Firebase photoURL. */
  avatars: 'avatars',
  /** Private: client project photography, read through signed URLs. */
  sitePhotos: 'site-photos',
}
