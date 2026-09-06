import { supabase, isStorageConfigured } from '@/lib/supabaseStorage'

/**
 * Shared plumbing for the data layer.
 *
 * The same Supabase client serves data and Storage — it already carries the
 * Firebase ID token through the `accessToken` hook, which is what makes the
 * Row Level Security policies in supabase/schema.sql apply to these queries
 * exactly as they do to file uploads.
 *
 * `isDataConfigured` is the same flag as storage: one Supabase project backs
 * both, so either everything is wired or nothing is.
 */
export const isDataConfigured = isStorageConfigured
export { supabase }

/**
 * Unwraps a PostgREST response, turning its error into a thrown Error so the
 * query hook's catch handles it uniformly.
 */
export function unwrap({ data, error }) {
  if (error) throw asReadable(error)
  return data
}

/**
 * PostgREST errors are structured but developer-facing. Translate the ones a
 * user can actually cause or act on; pass the rest through with their code so
 * a bug report has something to go on.
 */
export function asReadable(error) {
  const message = error?.message ?? String(error)
  const code = error?.code ?? ''

  /* Table missing — schema.sql has not been run. */
  if (code === '42P01' || /relation .* does not exist/i.test(message)) {
    return new Error(
      'The database tables are missing. Run supabase/schema.sql, then seed.sql.',
    )
  }
  /* RLS rejected the read or write. */
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return new Error(
      'You do not have permission to read this. Check that Firebase is registered as a third-party auth provider in Supabase.',
    )
  }
  if (/failed to fetch|network/i.test(message)) {
    return new Error('Could not reach the database. Check your connection.')
  }
  return new Error(code ? `${message} (${code})` : message)
}

/** Guard used at the top of every API call. */
export function requireConfigured() {
  if (!isDataConfigured) {
    throw new Error(
      'The database is not configured for this build. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY — see supabase/README.md.',
    )
  }
}
