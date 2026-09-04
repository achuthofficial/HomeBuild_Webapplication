import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Compass as CompassIcon,
  HardHat,
  Wallet,
  CalendarRange,
  Home,
  TriangleAlert,
} from 'lucide-react'

import Card from '@/components/ui/Card'
import Chip from '@/components/ui/Chip'
import FilterSelect from '@/components/ui/FilterSelect'
import QueryBoundary, { Skeleton } from '@/components/ui/QueryBoundary'
import { cn } from '@/lib/cn'
import { useQuery } from '@/hooks/useQuery'
import { listProjects } from '@/api/projects'
import { getCompass } from '@/api/compass'

/**
 * The four cardinal modules from PRD section 5, with the module colours the
 * document assigns each one in 5.1–5.4.
 *
 * `angle` is where the node sits on the ring, in degrees clockwise from north.
 */
const NODES = [
  {
    id: 'design',
    label: 'Design',
    caption: 'Floor plans',
    to: '/design',
    icon: Home,
    angle: 0,
    /* PRD 5.1: North, blue #3B82F6. */
    ring: 'bg-[#3B82F6]',
    tile: 'bg-[#EAF2FE] text-[#1D4ED8]',
  },
  {
    id: 'construction',
    label: 'Construction',
    caption: 'Site progress',
    to: '/construction',
    icon: HardHat,
    angle: 90,
    /* PRD 5.2: East, green #10B981. */
    ring: 'bg-[#10B981]',
    tile: 'bg-[#E7F8F2] text-[#047857]',
  },
  {
    id: 'finance',
    label: 'Finance',
    caption: 'Budget & escrow',
    to: '/finance',
    icon: Wallet,
    angle: 180,
    /* PRD 5.3: South, amber #F59E0B. */
    ring: 'bg-[#F59E0B]',
    tile: 'bg-[#FEF5E7] text-[#B45309]',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    caption: 'Timeline',
    to: '/schedule',
    icon: CalendarRange,
    angle: 270,
    /* PRD 5.4: West, violet #8B5CF6. */
    ring: 'bg-[#8B5CF6]',
    tile: 'bg-[#F3EFFE] text-[#6D28D9]',
  },
]

const STATUS_TONES = {
  active: { label: 'Active', tone: 'success' },
  lead: { label: 'Lead', tone: 'neutral' },
  in_design: { label: 'In Design', tone: 'brand' },
  paused: { label: 'Paused', tone: 'warning' },
  on_hold: { label: 'Paused', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
}

/** One KPI under the compass. */
function Kpi({ label, value, sub, tone }) {
  return (
    <div className="rounded-[12px] border border-line bg-surface px-4 py-3.5 text-center">
      <p className={cn('tnum text-[22px] font-bold leading-none', tone)}>{value}</p>
      <p className="mt-1.5 text-[11.5px] font-medium text-ink-2">{label}</p>
      {sub ? <p className="mt-0.5 text-[10.5px] text-ink-4">{sub}</p> : null}
    </div>
  )
}

/**
 * A cardinal node.
 *
 * Positioned with a CSS transform chain rather than hand-computed
 * coordinates: rotate to the compass bearing, translate outward along the
 * radius, then counter-rotate so the label stays upright. One formula covers
 * all four, and the ring resizes without any of them being recalculated.
 */
function Node({ node, badge }) {
  const Icon = node.icon

  return (
    <div
      className="absolute left-1/2 top-1/2 size-0"
      style={{
        transform: `rotate(${node.angle}deg) translateY(-50%) rotate(-${node.angle}deg)`,
        /* translateY needs a length, not a percentage of a zero-size box, so
           the radius is applied via a custom property on the wrapper below. */
        marginTop: 'calc(var(--ring) / -2)',
      }}
    >
      <Link
        to={node.to}
        className="focus-ring group absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `calc(sin(${node.angle}deg) * var(--ring) / 2)`,
          top: `calc(var(--ring) / 2 - cos(${node.angle}deg) * var(--ring) / 2)`,
        }}
      >
        <span
          className={cn(
            'relative flex size-[92px] flex-col items-center justify-center gap-1 rounded-full border-2 border-surface bg-surface text-center shadow-[0_4px_16px_rgba(15,23,42,0.10)] transition-transform group-hover:scale-105 sm:size-[104px]',
            node.tile,
          )}
        >
          <Icon className="size-[22px]" strokeWidth={1.75} />
          <span className="text-[12px] font-semibold leading-none">
            {node.label}
          </span>
          <span className="text-[9.5px] leading-none opacity-70">
            {node.caption}
          </span>

          {/* A count only appears when there is something to act on. */}
          {badge ? (
            <span className="absolute -right-1 -top-1 flex min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
              {badge}
            </span>
          ) : null}
        </span>
      </Link>
    </div>
  )
}

/**
 * Compass home — PRD section 5.
 *
 * The document describes this as what a CUSTOMER sees on login: their project,
 * its status, four cardinal module nodes around a branded orb, and three
 * summary KPIs. The Executive Dashboard stays as the project manager's
 * portfolio view — a PM running five sites needs a list, not one project's
 * compass.
 */
export default function Compass() {
  const projectsQuery = useQuery(() => listProjects(), [])
  const projects = projectsQuery.data ?? []

  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0].id)
  }, [projects, projectId])

  const project = projects.find((p) => p.id === projectId) ?? null

  const compass = useQuery(() => getCompass(projectId), [projectId], {
    enabled: Boolean(projectId),
  })
  const data = compass.data

  const status = STATUS_TONES[data?.status] ?? STATUS_TONES.lead

  const badges = {
    construction: data?.openAlerts || 0,
  }

  return (
    <>
      {/* ---------------- project header (PRD section 5) ---------------- */}
      <QueryBoundary
        isLoading={projectsQuery.isLoading}
        error={projectsQuery.error}
        data={projects}
        onRetry={projectsQuery.refetch}
        emptyTitle="No project yet"
        emptyBody="Once a project is created it appears here with its four modules."
        skeleton={<Skeleton className="h-[120px] w-full rounded-[14px]" />}
      >
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[22px] font-bold leading-tight text-ink sm:text-[26px]">
                  {data?.name ?? project?.name ?? '—'}
                </h1>
                <Chip tone={status.tone}>{status.label}</Chip>
              </div>
              <p className="mt-1.5 text-[13px] text-ink-2">
                {data?.location ?? '—'}
              </p>

              {/* Plot size and configuration, which the PRD names explicitly. */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-2">
                {data?.plotSize ? (
                  <span className="tnum">
                    {data.plotSize}
                    {data.plotArea ? (
                      <span className="text-ink-4"> ({data.plotArea} sq ft)</span>
                    ) : null}
                  </span>
                ) : null}
                {data?.configuration ? <span>{data.configuration}</span> : null}
                {data?.facing ? <span>{data.facing} facing</span> : null}
                {data?.selectedPlan ? (
                  <span className="text-brand-ink">Plan: {data.selectedPlan}</span>
                ) : null}
              </div>
            </div>

            {projects.length > 1 ? (
              <FilterSelect
                label="Project"
                value={project?.name ?? 'Select'}
                options={projects.map((p) => p.name)}
                onChange={(name) => {
                  const next = projects.find((p) => p.name === name)
                  if (next) setProjectId(next.id)
                }}
                align="right"
              />
            ) : null}
          </div>
        </Card>
      </QueryBoundary>

      {/* ---------------- the compass ---------------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="flex items-center justify-center p-6 sm:p-10">
          {/* --ring is the diameter the nodes sit on; every node position is
              derived from it, so one value resizes the whole compass. */}
          <div
            className="relative aspect-square w-full max-w-[440px] [--ring:250px] sm:[--ring:320px]"
            role="navigation"
            aria-label="Project modules"
          >
            {/* the ring the nodes sit on */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-line-strong"
              style={{ width: 'var(--ring)', height: 'var(--ring)' }}
              aria-hidden="true"
            />

            {/* central branded orb */}
            <div className="absolute left-1/2 top-1/2 flex size-[104px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-brand-600 text-on-brand shadow-[0_8px_28px_rgba(0,88,190,0.30)] sm:size-[120px]">
              <CompassIcon className="size-6" strokeWidth={1.75} />
              <p className="mt-1 text-[12px] font-bold leading-none">HomeBuild</p>
              <p className="tnum mt-1.5 text-[19px] font-bold leading-none">
                {data?.progress ?? 0}%
              </p>
            </div>

            {/* the four cardinal nodes */}
            <div className="absolute inset-0">
              {NODES.map((node) => (
                <Node key={node.id} node={node} badge={badges[node.id]} />
              ))}
            </div>

            {/* Compass bearings, so the cardinal arrangement reads as one. */}
            {[
              ['N', 'left-1/2 top-0 -translate-x-1/2'],
              ['E', 'right-0 top-1/2 -translate-y-1/2'],
              ['S', 'bottom-0 left-1/2 -translate-x-1/2'],
              ['W', 'left-0 top-1/2 -translate-y-1/2'],
            ].map(([letter, position]) => (
              <span
                key={letter}
                className={cn(
                  'absolute text-[10px] font-bold tracking-[0.08em] text-ink-4',
                  position,
                )}
                aria-hidden="true"
              >
                {letter}
              </span>
            ))}
          </div>
        </Card>

        {/* ---------------- summary KPIs ---------------- */}
        <div className="space-y-4">
          <Card className="p-5">
            <p className="eyebrow">Project Summary</p>

            {compass.isLoading ? (
              <div className="mt-4 space-y-3">
                <Skeleton className="h-[74px] w-full rounded-[12px]" />
                <Skeleton className="h-[74px] w-full rounded-[12px]" />
              </div>
            ) : compass.error ? (
              <p className="mt-4 text-[13px] text-danger">{compass.error}</p>
            ) : (
              <div className="mt-4 space-y-3">
                <Kpi
                  label="Overall completion"
                  value={`${data?.progress ?? 0}%`}
                  sub={
                    data?.phaseCount
                      ? `${data.phasesDone} of ${data.phaseCount} phases done`
                      : null
                  }
                  tone="text-brand-ink"
                />
                <Kpi
                  label={data?.daysRemaining < 0 ? 'Days overdue' : 'Days remaining'}
                  value={
                    data?.daysRemaining == null
                      ? '—'
                      : Math.abs(data.daysRemaining)
                  }
                  sub={data?.expectedCompletion ? 'To handover' : 'No date set'}
                  tone={data?.daysRemaining < 0 ? 'text-danger' : 'text-ink'}
                />
                <Kpi
                  label="Current phase"
                  value={data?.currentPhase ?? '—'}
                  tone="text-[15px] text-ink"
                />
              </div>
            )}
          </Card>

          {data?.openAlerts > 0 ? (
            <Link
              to="/analytics"
              className="focus-ring flex items-start gap-2.5 rounded-[12px] border border-danger/30 bg-danger-bg/60 p-4 transition-colors hover:bg-danger-bg"
            >
              <TriangleAlert
                className="mt-px size-4 shrink-0 text-danger"
                strokeWidth={2}
              />
              <p className="text-[12.5px] leading-snug text-ink">
                <span className="font-semibold">
                  {data.openAlerts} open alert
                  {data.openAlerts === 1 ? '' : 's'}
                </span>{' '}
                on this project. Review them before the next milestone release.
              </p>
            </Link>
          ) : null}
        </div>
      </div>
    </>
  )
}
