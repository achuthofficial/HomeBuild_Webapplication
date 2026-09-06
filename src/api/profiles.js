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

/**
 * Initials for an avatar fallback: "Manish Kumar" -> "MK".
 *
 * Exported because the team list is built from invitations rather than from
 * profiles, and still has to render the same avatar.
 */
export function initialsOf(name) {
  return (name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * People selectable as a project's Customer or Project Manager (PRD 8.1).
 *
 * Both are *links* to a profile in the PRD, not free text — a project has to
 * resolve to a real homeowner and a real PM for the persona-scoped views in
 * section 4 to mean anything.
 */
export async function listProfilesByRole(role) {
  requireConfigured()

  let query = supabase
    .from('profiles')
    .select('firebase_uid, full_name, email, role')
    .order('full_name', { ascending: true })

  if (role) query = query.eq('role', role)

  const rows = unwrap(await query.limit(100))

  return rows.map((r) => ({
    uid: r.firebase_uid,
    name: r.full_name ?? r.email ?? r.firebase_uid,
    email: r.email,
    role: r.role,
  }))
}

/**
 * The two counters on the Settings profile card.
 *
 * They used to be `activeProjects: 12` and `teamsLed: '04'` from a fixture,
 * shown under the signed-in user's own name and photo — the most personal
 * place in the app to put someone else's numbers.
 *
 * "Teams led" is projects where you are the MANAGER, which is what leading a
 * team means here; membership alone is not.
 */
export async function getProfileStats(uid) {
  requireConfigured()
  if (!uid) return { activeProjects: 0, teamsLed: 0 }

  const [active, led] = await Promise.all([
    /* RLS already limits this to projects you can reach, so no filter on the
       viewer is needed — or possible to get wrong. */
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('manager_uid', uid),
  ])

  return {
    activeProjects: active.count ?? 0,
    teamsLed: led.count ?? 0,
  }
}
