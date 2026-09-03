import { useEffect, useState } from 'react'
import { Compass, Sparkles, Check, TriangleAlert, RefreshCw } from 'lucide-react'

import PageHeader from '@/components/layout/PageHeader'
import Card, { CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import Segmented from '@/components/ui/Segmented'
import Modal from '@/components/ui/Modal'
import FilterSelect from '@/components/ui/FilterSelect'
import QueryBoundary, { Skeleton, RowSkeleton } from '@/components/ui/QueryBoundary'
import { FormMessage } from '@/components/auth/AuthForm'
import FloorPlanSvg from '@/components/design/FloorPlanSvg'
import { cn } from '@/lib/cn'
import { rupees, lakh } from '@/lib/format'
import { useToast } from '@/context/ToastContext'
import { useQuery } from '@/hooks/useQuery'
import { listProjects } from '@/api/projects'
import { listFloorPlans, saveFloorPlans, selectFloorPlan } from '@/api/design'
import { generatePlans } from '@/lib/planGenerator'
import { validateBrief, COST_BANDS } from '@/lib/planValidation'

/** PRD 5.1.3 enumerations. */
const STYLES = ['Modern', 'Traditional', 'Contemporary', 'Minimal']
const TIERS = Object.keys(COST_BANDS)
const EXTRAS = ['Balcony', 'Puja Room', 'Study', 'Utility']
const PARKING = [0, 1, 2, 3]

const field =
  'focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink disabled:opacity-60'

function Score({ label, value, tone }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={cn('tnum mt-1 text-[19px] font-bold leading-none', tone)}>
        {value}
        <span className="text-[12px] font-medium text-ink-4">/10</span>
      </p>
    </div>
  )
}

/**
 * Design module — PRD 5.1.
 *
 * The non-AI half: the plot brief (5.1.3), the deterministic Vastu engine
 * (5.1.6), the SVG renderer (5.1.7), the acceptance-criteria checks (5.1.8),
 * plan comparison and customer selection.
 *
 * Generation itself goes through `generatePlans`, which is the seam a model
 * call drops into — see the note at the top of src/lib/planGenerator.js. The
 * plans it returns are scored and validated here either way, so a model that
 * produces an invalid layout is caught rather than shown to a customer.
 */
export default function Design() {
  const { toast } = useToast()

  const projectsQuery = useQuery(() => listProjects(), [])
  const projects = projectsQuery.data ?? []

  const [projectId, setProjectId] = useState('')
  const [activeFloor, setActiveFloor] = useState(0)
  const [compareFor, setCompareFor] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [selecting, setSelecting] = useState(null)
  const [error, setError] = useState(null)

  /* Default to the first project the user can see, once they load. */
  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0].id)
  }, [projects, projectId])

  const project = projects.find((p) => p.id === projectId) ?? null

  const plansQuery = useQuery(
    () => listFloorPlans(projectId),
    [projectId],
    { enabled: Boolean(projectId) },
  )
  const plans = plansQuery.data ?? []

  /* The brief seeds from the project's plot data (PRD 8.1) — re-typing the
     dimensions that are already on record would be a good way to get them
     wrong. */
  const [brief, setBrief] = useState({
    plotLengthFt: '',
    plotWidthFt: '',
    plotFacing: 'East',
    totalFloors: 'G+1',
    bhkPerFloor: 2,
    parkingSpots: 1,
    architecturalStyle: 'Modern',
    budgetTier: 'Mid',
    vastuRequired: true,
    extraSpaces: ['Puja Room'],
  })

  useEffect(() => {
    if (!project) return
    setBrief((b) => ({
      ...b,
      plotLengthFt: project.plotLengthFt ?? b.plotLengthFt,
      plotWidthFt: project.plotWidthFt ?? b.plotWidthFt,
      plotFacing: project.plotFacing ?? b.plotFacing,
      totalFloors: project.totalFloors ?? b.totalFloors,
      bhkPerFloor: project.bhkPerFloor ?? b.bhkPerFloor,
    }))
  }, [project])

  const set = (key) => (e) =>
    setBrief((b) => ({ ...b, [key]: e.target.value }))

  const toggleExtra = (space) =>
    setBrief((b) => ({
      ...b,
      extraSpaces: b.extraSpaces.includes(space)
        ? b.extraSpaces.filter((s) => s !== space)
        : [...b.extraSpaces, space],
    }))

  const generate = async (e) => {
    e.preventDefault()
    setError(null)

    const problems = validateBrief(brief)
    if (problems.length) {
      setError(problems.join(' '))
      return
    }

    setGenerating(true)
    try {
      const generated = await generatePlans(brief)
      await saveFloorPlans(projectId, generated, brief)
      await plansQuery.refetch()
      setActiveFloor(0)
      toast(`${generated.length} plan options generated.`)
    } catch (failure) {
      setError(failure.message)
    } finally {
      setGenerating(false)
    }
  }

  const choose = async (plan) => {
    setSelecting(plan.id)
    try {
      await selectFloorPlan(plan.id)
      await plansQuery.refetch()
      projectsQuery.refetch()
      toast(`“${plan.name}” selected. The project is now active.`)
    } catch (failure) {
      toast(failure.message, { tone: 'info' })
    } finally {
      setSelecting(null)
    }
  }

  const floorNames = plans[0]?.floors.map((f) => f.name) ?? []

  return (
    <>
      <PageHeader
        eyebrow="Blueprint"
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Design' }]}
        title="AI Floor Plan Design"
        subtitle="Enter the plot parameters to see three layout options with Vastu and cost scoring."
        actions={
          projects.length ? (
            <FilterSelect
              label="Project"
              value={project?.name ?? 'Select'}
              options={projects.map((p) => p.name)}
              onChange={(name) => {
                const next = projects.find((p) => p.name === name)
                if (next) {
                  setProjectId(next.id)
                  setActiveFloor(0)
                }
              }}
              align="right"
            />
          ) : null
        }
      />

      {/* The brief is the input half of the module (PRD 5.1.3) and does not
          depend on the project list — hiding it behind a failed projects
          query would conceal the whole module over a missing dropdown. */}
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* ---------------- plot brief (PRD 5.1.3) ---------------- */}
          <Card className="h-fit p-5 lg:sticky lg:top-[88px]">
            <div className="flex items-center gap-2">
              <Compass className="size-4 text-brand-ink" strokeWidth={2} />
              <h2 className="text-[15px] font-semibold text-ink">Plot Configuration</h2>
            </div>

            <form onSubmit={generate} className="mt-4 space-y-3.5">
              <FormMessage>{error}</FormMessage>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="d-len" className="eyebrow mb-1.5 block">
                    Length (ft)
                  </label>
                  <input
                    id="d-len"
                    type="number"
                    min="15"
                    max="200"
                    value={brief.plotLengthFt}
                    onChange={set('plotLengthFt')}
                    className={`${field} tnum`}
                    required
                    disabled={generating}
                  />
                </div>
                <div>
                  <label htmlFor="d-wid" className="eyebrow mb-1.5 block">
                    Width (ft)
                  </label>
                  <input
                    id="d-wid"
                    type="number"
                    min="15"
                    max="200"
                    value={brief.plotWidthFt}
                    onChange={set('plotWidthFt')}
                    className={`${field} tnum`}
                    required
                    disabled={generating}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="d-face" className="eyebrow mb-1.5 block">
                    Facing
                  </label>
                  <select
                    id="d-face"
                    value={brief.plotFacing}
                    onChange={set('plotFacing')}
                    className={field}
                    disabled={generating}
                  >
                    {['North', 'South', 'East', 'West'].map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="d-floors" className="eyebrow mb-1.5 block">
                    Floors
                  </label>
                  <select
                    id="d-floors"
                    value={brief.totalFloors}
                    onChange={set('totalFloors')}
                    className={field}
                    disabled={generating}
                  >
                    {['G', 'G+1', 'G+2', 'G+3'].map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="d-bhk" className="eyebrow mb-1.5 block">
                    BHK / floor
                  </label>
                  <select
                    id="d-bhk"
                    value={brief.bhkPerFloor}
                    onChange={set('bhkPerFloor')}
                    className={field}
                    disabled={generating}
                  >
                    {[1, 2, 3, 4].map((b) => (
                      <option key={b} value={b}>
                        {b} BHK
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="d-park" className="eyebrow mb-1.5 block">
                    Parking
                  </label>
                  <select
                    id="d-park"
                    value={brief.parkingSpots}
                    onChange={set('parkingSpots')}
                    className={field}
                    disabled={generating}
                  >
                    {PARKING.map((p) => (
                      <option key={p} value={p}>
                        {p} {p === 1 ? 'spot' : 'spots'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="d-style" className="eyebrow mb-1.5 block">
                  Architectural Style
                </label>
                <select
                  id="d-style"
                  value={brief.architecturalStyle}
                  onChange={set('architecturalStyle')}
                  className={field}
                  disabled={generating}
                >
                  {STYLES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="d-tier" className="eyebrow mb-1.5 block">
                  Budget Tier
                </label>
                <select
                  id="d-tier"
                  value={brief.budgetTier}
                  onChange={set('budgetTier')}
                  className={field}
                  disabled={generating}
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t} — ₹{COST_BANDS[t][0]}–{COST_BANDS[t][1]}/sq ft
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="eyebrow mb-1.5">Extra Spaces</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXTRAS.map((space) => {
                    const on = brief.extraSpaces.includes(space)
                    return (
                      <button
                        key={space}
                        type="button"
                        disabled={generating}
                        onClick={() => toggleExtra(space)}
                        className={cn(
                          'focus-ring rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                          on
                            ? 'bg-brand-50 text-brand-ink'
                            : 'bg-subtle text-ink-3 hover:text-ink-2',
                        )}
                      >
                        {space}
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  checked={brief.vastuRequired}
                  onChange={(e) =>
                    setBrief((b) => ({ ...b, vastuRequired: e.target.checked }))
                  }
                  disabled={generating}
                  className="focus-ring size-4 rounded border-line"
                />
                <span className="text-[13px] text-ink-2">
                  Enforce Vastu compliance
                </span>
              </label>

              <Button
                type="submit"
                variant="primary"
                icon={Sparkles}
                className="w-full"
                disabled={generating || !projectId}
              >
                {generating ? 'Generating…' : 'Generate 3 Options'}
              </Button>

              {!projectId && !projectsQuery.isLoading ? (
                <p className="text-[11.5px] text-warning">
                  Choose a project before generating — plans are saved against
                  one.
                </p>
              ) : null}

              {/* The generator is deterministic today. Saying so beats letting
                  a customer believe a model drew this. */}
              <p className="text-[11px] leading-relaxed text-ink-3">
                Layouts are produced by the rule-based planner and scored
                against the Vastu placement rules. The AI generator is not
                connected in this build.
              </p>
            </form>
          </Card>

          {/* ---------------- plan options ---------------- */}
          <div className="min-w-0">
            <QueryBoundary
              isLoading={projectsQuery.isLoading || plansQuery.isLoading}
              error={projectsQuery.error ?? plansQuery.error}
              data={plans}
              onRetry={() => {
                projectsQuery.refetch()
                plansQuery.refetch()
              }}
              emptyTitle={
                projects.length ? 'No plans generated yet' : 'No projects yet'
              }
              emptyBody={
                projects.length
                  ? 'Set the plot parameters and generate three options to compare.'
                  : 'A floor plan belongs to a project — create one first.'
              }
              skeleton={<Skeleton className="h-[420px] w-full rounded-[12px]" />}
            >
              {floorNames.length > 1 ? (
                <div className="mb-4">
                  <Segmented
                    options={floorNames}
                    value={floorNames[activeFloor] ?? floorNames[0]}
                    onChange={(name) => setActiveFloor(floorNames.indexOf(name))}
                    ariaLabel="Which floor to show"
                  />
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                {plans.map((plan) => {
                  const floor = plan.floors[activeFloor] ?? plan.floors[0]
                  const invalid = plan.validation && !plan.validation.passed

                  return (
                    <Card
                      key={plan.id}
                      className={cn(
                        'overflow-hidden',
                        plan.isSelected && 'ring-2 ring-brand-600',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 p-5 pb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Chip tone="brand">Plan {plan.variant}</Chip>
                            {plan.isSelected ? (
                              <Chip tone="success" dot>
                                Selected
                              </Chip>
                            ) : null}
                            {invalid ? (
                              <Chip tone="danger" dot>
                                Check failed
                              </Chip>
                            ) : null}
                          </div>
                          <h3 className="mt-2 truncate text-[16px] font-semibold text-ink">
                            {plan.name}
                          </h3>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tnum text-[15px] font-bold text-ink">
                            {lakh(plan.totalCost)}
                          </p>
                          <p className="tnum text-[11px] text-ink-3">
                            ₹{plan.costPerSqft}/sq ft
                          </p>
                        </div>
                      </div>

                      {floor ? (
                        <div className="bg-canvas px-4 py-3">
                          <FloorPlanSvg
                            floor={floor}
                            plotLengthFt={brief.plotLengthFt}
                            plotWidthFt={brief.plotWidthFt}
                            className="max-h-[300px]"
                          />
                        </div>
                      ) : null}

                      <div className="grid grid-cols-3 gap-3 border-t border-line px-5 py-4">
                        <Score
                          label="Vastu"
                          value={plan.vastuScore}
                          tone={
                            plan.vastuScore >= 7 ? 'text-success' : 'text-warning'
                          }
                        />
                        <Score
                          label="Efficiency"
                          value={plan.efficiencyScore}
                          tone="text-ink"
                        />
                        <div>
                          <p className="eyebrow">Built-up</p>
                          <p className="tnum mt-1 text-[19px] font-bold leading-none text-ink">
                            {plan.totalSqft}
                            <span className="text-[12px] font-medium text-ink-4">
                              {' '}
                              sq ft
                            </span>
                          </p>
                        </div>
                      </div>

                      <ul className="space-y-1.5 border-t border-line px-5 py-4">
                        {plan.highlights.map((h) => (
                          <li
                            key={h}
                            className="flex items-start gap-2 text-[12.5px] text-ink-2"
                          >
                            <Check
                              className="mt-0.5 size-3.5 shrink-0 text-success"
                              strokeWidth={2.5}
                            />
                            {h}
                          </li>
                        ))}
                      </ul>

                      <div className="flex items-center gap-2 border-t border-line bg-canvas px-5 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCompareFor(plan)}
                        >
                          Details
                        </Button>
                        <Button
                          variant={plan.isSelected ? 'ghost' : 'primary'}
                          size="sm"
                          className="ml-auto"
                          disabled={plan.isSelected || selecting === plan.id}
                          onClick={() => choose(plan)}
                        >
                          {plan.isSelected
                            ? 'Chosen'
                            : selecting === plan.id
                              ? 'Selecting…'
                              : 'Select this plan'}
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </QueryBoundary>
          </div>
      </div>

      {/* ---------------- plan detail ---------------- */}
      <Modal
        open={!!compareFor}
        onClose={() => setCompareFor(null)}
        title={compareFor?.name ?? ''}
        description={`Plan ${compareFor?.variant} · ${compareFor?.totalSqft} sq ft · ${
          compareFor ? rupees(compareFor.totalCost) : ''
        }`}
        size="lg"
      >
        {compareFor ? (
          <div className="space-y-5">
            <div>
              <p className="eyebrow mb-2">Acceptance checks</p>
              <ul className="space-y-1.5">
                {(compareFor.validation?.checks ?? []).map((check) => (
                  <li key={check.id} className="flex items-start gap-2 text-[12.5px]">
                    {check.passed ? (
                      <Check className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={2.5} />
                    ) : (
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-danger" strokeWidth={2} />
                    )}
                    <span className="flex-1">
                      <span className={check.passed ? 'text-ink-2' : 'text-danger'}>
                        {check.label}
                      </span>
                      {check.detail ? (
                        <span className="ml-1 text-ink-4">— {check.detail}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="eyebrow mb-2">Vastu placement</p>
              <ul className="space-y-1.5">
                {(compareFor.vastuFindings ?? []).map((f) => (
                  <li key={f.room} className="flex items-start gap-2 text-[12.5px]">
                    <span
                      className={cn(
                        'mt-1.5 size-1.5 shrink-0 rounded-full',
                        f.compliant ? 'bg-success' : 'bg-warning',
                      )}
                    />
                    <span className="flex-1 text-ink-2">
                      <span className="font-medium text-ink">{f.room}</span> in the{' '}
                      {f.zoneName}
                      {f.compliant ? null : (
                        <span className="text-warning"> — expected {f.expected}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="eyebrow mb-2">Vastu notes</p>
              <p className="text-[12.5px] leading-relaxed text-ink-2">
                {compareFor.vastuNotes}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
