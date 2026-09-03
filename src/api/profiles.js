import { supabase, unwrap, requireConfigured } from '@/api/client'

/**
 * Profiles.
 *
 * Firebase owns identity (name, email, photo). This table holds what Firebase
 * has nowhere to put — role, phone, job title — which is what makes those
 * fields on the Settings screen editable rather than decorative.
 */

export async function getProfile(uid) {
  requireConfigured()
  if (!uid) return null

  /* maybeSingle: a first-time user has no row yet, and that is not an error. */
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('firebase_uid', uid)
    .maybeSingle()

  unwrap({ data, error })
  return data
}

/**
 * Creates the row on first sign-in, or refreshes the mirrored identity fields.
 * Called after auth resolves so a new account immediately has somewhere to
 * store its phone and job title.
 */
export async function ensureProfile({ uid, fullName, email, avatarUrl }) {
  requireConfigured()
  if (!uid) return null

  const existing = await getProfile(uid)

  if (!existing) {
    return unwrap(
      await supabase
        .from('profiles')
        .insert({
          firebase_uid: uid,
          full_name: fullName ?? null,
          email: email ?? null,
          avatar_url: avatarUrl ?? null,
        })
        .select('*')
        .single(),
    )
  }

  /* Only write when Firebase's copy has actually drifted, so an ordinary page
     load is a read rather than a read plus a pointless write. */
  const drifted =
    (fullName && existing.full_name !== fullName) ||
    (email && existing.email !== email) ||
    (avatarUrl && existing.avatar_url !== avatarUrl)

  if (!drifted) return existing

  return unwrap(
    await supabase
      .from('profiles')
      .update({
        full_name: fullName ?? existing.full_name,
        email: email ?? existing.email,
        avatar_url: avatarUrl ?? existing.avatar_url,
      })
      .eq('firebase_uid', uid)
      .select('*')
      .single(),
  )
}

/** Fields the Edit Profile dialog owns. */
export async function updateProfileDetails(uid, { phone, jobTitle }) {
  requireConfigured()
  return unwrap(
    await supabase
      .from('profiles')
      .update({ phone: phone ?? null, job_title: jobTitle ?? null })
      .eq('firebase_uid', uid)
      .select('*')
      .single(),
  )
}

/** Team Management list on Settings. */
export async function listTeamMembers(excludeUid) {
  requireConfigured()
  let query = supabase
    .from('profiles')
    .select('firebase_uid, full_name, job_title, role, avatar_url')
    .order('full_name', { ascending: true })

  if (excludeUid) query = query.neq('firebase_uid', excludeUid)

  const rows = unwrap(await query.limit(20))

  return rows.map((r) => ({
    id: r.firebase_uid,
    name: r.full_name ?? '—',
    role: r.job_title ?? r.role,
    status: 'ACTIVE',
    avatar: r.avatar_url,
    initials: (r.full_name ?? '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join(''),
  }))
}
