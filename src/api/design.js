import { supabase, unwrap, requireConfigured } from '@/api/client'

/** Design module (PRD 5.1) — floor plan storage and selection. */

/** Row → the plan shape the UI and the validators use. */
function toPlan(row) {
  const layout = row.room_layout ?? {}
  return {
    id: row.id,
    projectId: row.project_id,
    variant: row.variant,
    name: row.name,
    vastuScore: Number(row.vastu_score) || 0,
    efficiencyScore: Number(row.efficiency_score) || 0,
    totalSqft: row.total_sqft ?? 0,
    costPerSqft: row.cost_per_sqft ?? 0,
    totalCost: Number(row.total_cost) || 0,
    highlights: row.highlights ?? [],
    vastuNotes: row.vastu_notes ?? '',
    floors: layout.floors ?? [],
    vastuFindings: layout.vastuFindings ?? [],
    validation: row.validation ?? null,
    isSelected: row.is_selected,
    budgetTier: row.budget_tier,
    architecturalStyle: row.architectural_style,
    vastuRequired: row.vastu_required,
    extraSpaces: row.extra_spaces ?? [],
    parkingSpots: row.parking_spots,
    createdAt: row.created_at,
  }
}

export async function listFloorPlans(projectId) {
  requireConfigured()
  if (!projectId) return []
  const rows = unwrap(
    await supabase
      .from('floor_plans')
      .select('*')
      .eq('project_id', projectId)
      .order('variant', { ascending: true }),
  )
  return rows.map(toPlan)
}

/**
 * Persists a generated set, replacing any previous unselected plans.
 *
 * A selected plan is never deleted — the project is being built to it, so
 * losing it to a regeneration would orphan the construction record.
 */
export async function saveFloorPlans(projectId, plans, brief) {
  requireConfigured()

  unwrap(
    await supabase
      .from('floor_plans')
      .delete()
      .eq('project_id', projectId)
      .eq('is_selected', false)
      .select('id'),
  )

  const rows = plans.map((plan) => ({
    project_id: projectId,
    variant: plan.variant,
    name: plan.name,
    vastu_score: plan.vastuScore,
    efficiency_score: plan.efficiencyScore,
    total_sqft: plan.totalSqft,
    cost_per_sqft: plan.costPerSqft,
    total_cost: plan.totalCost,
    highlights: plan.highlights,
    vastu_notes: plan.vastuNotes,
    /* Floors and findings ride in the jsonb column together — they are always
       read as a unit and never queried by field. */
    room_layout: { floors: plan.floors, vastuFindings: plan.vastuFindings },
    validation: plan.validation,
    parking_spots: brief.parkingSpots ? Number(brief.parkingSpots) : null,
    architectural_style: brief.architecturalStyle ?? null,
    budget_tier: brief.budgetTier ?? null,
    vastu_required: Boolean(brief.vastuRequired),
    extra_spaces: brief.extraSpaces ?? [],
    is_selected: false,
  }))

  const saved = unwrap(
    await supabase.from('floor_plans').insert(rows).select('*'),
  )
  return saved.map(toPlan)
}

/** Marks one plan chosen; the database clears the others in the same call. */
export async function selectFloorPlan(planId) {
  requireConfigured()
  const rows = unwrap(
    await supabase.rpc('select_floor_plan', { p_plan_id: planId }),
  )
  const row = Array.isArray(rows) ? rows[0] : rows
  return row ? toPlan(row) : null
}
