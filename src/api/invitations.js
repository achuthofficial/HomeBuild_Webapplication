import { supabase, unwrap, requireConfigured } from '@/api/client'

/**
 * Team invitations.
 *
 * Sending the email needs a mail provider this build does not have, so what
 * is implemented is the part that genuinely belongs in the database: the
 * invite is recorded, survives a reload, expires, and can be revoked. The UI
 * says plainly that delivery is not wired up rather than implying an email
 * went out.
 */
export async function listInvitations() {
  requireConfigured()
  const rows = unwrap(
    await supabase
      .from('invitations')
      .select(`
        id, email, role, status, expires_at, created_at,
        inviter:profiles!invitations_invited_by_fkey ( full_name )
      `)
      .order('created_at', { ascending: false })
      .limit(25),
  )

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    status: r.status,
    expiresAt: r.expires_at,
    invitedBy: r.inviter?.full_name ?? '—',
    /* Surfaced separately from `status`: an invite can be pending in the
       database and useless in practice. */
    isExpired: new Date(r.expires_at) < new Date(),
  }))
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
