import { supabase, unwrap, requireConfigured } from '@/api/client'

/**
 * Activity log.
 *
 * The PRD asks for audit fields on every entity. Rather than scattering
 * "who changed what" across tables, state transitions append here — which is
 * also what makes the Schedule screen's audit trail real rather than a toast.
 *
 * The SQL workflow functions write their own entries, so this module is for
 * reads plus the handful of client-initiated actions that have no RPC.
 */
export async function listActivity({ projectId, actorUid, limit = 50 } = {}) {
  requireConfigured()

  let query = supabase
    .from('activity_log')
    .select(`
      id, entity, entity_id, action, summary, created_at,
      actor:profiles!activity_log_actor_uid_fkey ( full_name, avatar_url ),
      projects ( name )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (projectId) query = query.eq('project_id', projectId)
  if (actorUid) query = query.eq('actor_uid', actorUid)

  const rows = unwrap(await query)

  return rows.map((r) => ({
    id: r.id,
    entity: r.entity,
    action: r.action,
    summary: r.summary,
    at: r.created_at,
    actor: r.actor?.full_name ?? 'System',
    actorAvatar: r.actor?.avatar_url ?? null,
    project: r.projects?.name ?? null,
  }))
}

/** Records an action that has no dedicated SQL function behind it. */
export async function logActivity({
  projectId,
  actorUid,
  entity,
  entityId,
  action,
  summary,
  detail,
}) {
  requireConfigured()
  return unwrap(
    await supabase
      .from('activity_log')
      .insert({
        project_id: projectId ?? null,
        actor_uid: actorUid,
        entity,
        entity_id: entityId ?? null,
        action,
        summary,
        detail: detail ?? null,
      })
      .select('id')
      .single(),
  )
}
