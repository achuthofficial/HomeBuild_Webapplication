import { supabase, unwrap, requireConfigured } from '@/api/client'
import { initialsOf } from '@/api/profiles'

/**
 * Team invitations.
 *
 * Sending the email needs a mail provider this build does not have, so what
 * is implemented is the part that genuinely belongs in the database: the
 * invite is recorded, survives a reload, expires, and can be revoked. The UI
 * says plainly that delivery is not wired up rather than implying an email
 * went out.
 */
/** PRD section 4's personas, as the invite dialog labels them. */
const ROLE_LABELS = {
  project_manager: 'Project Manager',
  site_supervisor: 'Site Supervisor',
  customer: 'Customer',
}

/**
 * The Team Management list on Settings.
 *
 * Derived from INVITATIONS THIS USER SENT, not from the profiles directory.
 * It used to select straight from `profiles`, so every account in the
 * database — the `seed-` placeholders included — appeared as a colleague on
 * the workspace of someone who had invited nobody. Being on a team is
 * something that gets granted, so the invite is what establishes it, and a
 * fresh account correctly sees an empty list until it sends one.
 *
 * There is no accept flow to flip `status` to 'accepted', so whether an
 * invitee has actually joined is answered by matching the invited address
 * against `profiles`. Both sides are stored lower-cased — `createInvitation`
 * normalises, and Firebase hands back normalised addresses — so the lookup
 * below matches on equality rather than needing a case-insensitive scan.
 */
export async function listTeamMembers(ownerUid) {
  requireConfigured()
  if (!ownerUid) return []

  const invites = unwrap(
    await supabase
      .from('invitations')
      .select('id, email, role, status, expires_at, created_at')
      .eq('invited_by', ownerUid)
      /* Revoked and expired invites are audit history, not team members. */
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(50),
  )

  if (!invites.length) return []

  const emails = [...new Set(invites.map((i) => i.email.toLowerCase()))]

  /* One lookup for the whole list rather than one request per invitation. */
  const profiles = unwrap(
    await supabase
      .from('profiles')
      .select('firebase_uid, full_name, email, job_title, role, avatar_url')
      .in('email', emails),
  )

  const byEmail = new Map(
    profiles.filter((p) => p.email).map((p) => [p.email.toLowerCase(), p]),
  )

  const now = Date.now()

  return invites.map((invite) => {
    const profile = byEmail.get(invite.email.toLowerCase())
    /* Expiry only decides whether an invitation can still be taken up, so it
       is irrelevant once someone has: a lapsed link cannot un-join a person
       who already signed up on it. */
    const expired = !profile && new Date(invite.expires_at).getTime() < now
    /* Falls back to the address, which is all that is known about someone
       who has not signed up yet. */
    const name = profile?.full_name ?? invite.email

    return {
      inviteId: invite.id,
      /* Null until they sign up. The member sheet keys its activity lookup
         on this, so a pending invite cannot query for a uid that has no
         rows — or, worse, no uid at all. */
      id: profile?.firebase_uid ?? null,
      name,
      email: invite.email,
      role: profile?.job_title ?? ROLE_LABELS[invite.role] ?? invite.role,
      status: profile ? 'ACTIVE' : expired ? 'EXPIRED' : 'PENDING',
      joined: Boolean(profile),
      avatar: profile?.avatar_url ?? null,
      initials: initialsOf(profile?.full_name ?? invite.email),
    }
  })
}

export async function createInvitation({ email, role, invitedBy, projectId }) {
  requireConfigured()

  const { data, error } = await supabase
    .from('invitations')
    .insert({
      email: email.trim().toLowerCase(),
      role,
      invited_by: invitedBy,
      project_id: projectId ?? null,
    })
    .select('id, email, role, expires_at')
    .single()

  /* A unique index blocks a second pending invite for the same address. */
  if (error?.code === '23505') {
    throw new Error('There is already a pending invitation for that address.')
  }

  return unwrap({ data, error })
}

export async function revokeInvitation(id) {
  requireConfigured()
  return unwrap(
    await supabase
      .from('invitations')
      .update({ status: 'revoked' })
      .eq('id', id)
      .select('id, status')
      .single(),
  )
}
