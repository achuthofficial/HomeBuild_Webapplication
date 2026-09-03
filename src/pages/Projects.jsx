import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { PlusCircle, SlidersHorizontal } from 'lucide-react'

import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/ui/Card'
import FilterSelect from '@/components/ui/FilterSelect'
import StatusDot from '@/components/ui/StatusDot'
import AvatarStack from '@/components/ui/AvatarStack'
import Pagination from '@/components/ui/Pagination'
import QueryBoundary, { Skeleton } from '@/components/ui/QueryBoundary'
import { estDate } from '@/lib/format'
import { useToast } from '@/context/ToastContext'
import { useQuery } from '@/hooks/useQuery'
import { listProjects, listProjectFilters } from '@/api/projects'

const PROJECTS_PER_PAGE = 6

/* Portfolio filter labels map onto the timeline_status column. */
const statusMatch = {
  'On Track': 'on_track',
  Delayed: 'delayed',
  'At Risk': 'at_risk',
  Ahead: 'ahead',
}

export default function Projects() {
  const { openCreateProject } = useOutletContext()
  const { toast } = useToast()

  const [status, setStatus] = useState('All Projects')
  const [city, setCity] = useState('All Locations')
  const [manager, setManager] = useState('All Managers')
  const [page, setPage] = useState(1)

  const projectsQuery = useQuery(() => listProjects(), [])
  const filtersQuery = useQuery(() => listProjectFilters(), [])

  const projects = projectsQuery.data ?? []
  const projectFilters = filtersQuery.data ?? {
    status: ['All Projects'],
    city: ['All Locations'],
    manager: ['All Managers'],
  }

  /* Filtering stays client-side: the portfolio is small enough to hold in
     memory, and it keeps the three dropdowns instant. */
  const filtered = useMemo(
    () =>
      projects.filter(
        (p) =>
          (status === 'All Projects' || p.timelineKey === statusMatch[status]) &&
          (city === 'All Locations' || p.city === city) &&
          (manager === 'All Managers' || p.manager === manager),
      ),
    [projects, status, city, manager],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PROJECTS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PROJECTS_PER_PAGE
  const visible = filtered.slice(start, start + PROJECTS_PER_PAGE)

  const onFilter = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Active Projects' }]}
        title="Project Portfolio"
        subtitle={
          projectsQuery.isLoading
            ? 'Loading your portfolio…'
            : `Manage and track progress across ${projects.length} construction sites.`
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <FilterSelect
          label="Status"
          value={status}
          options={projectFilters.status}
          onChange={onFilter(setStatus)}
        />
        <FilterSelect
          label="City"
          value={city}
          options={projectFilters.city}
          onChange={onFilter(setCity)}
        />
        <FilterSelect
          label="PM"
          value={manager}
          options={projectFilters.manager}
          onChange={onFilter(setManager)}
        />

        <button
          type="button"
          onClick={() =>
            toast('Advanced filters are not available in this prototype.', {
              tone: 'info',
            })
          }
          className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:bg-subtle"
        >
          <SlidersHorizontal className="size-3.5" strokeWidth={1.75} />
          Advanced Filters
        </button>
      </div>

      <QueryBoundary
        isLoading={projectsQuery.isLoading}
        error={projectsQuery.error}
        data={projects}
        onRetry={projectsQuery.refetch}
        emptyTitle="No projects yet"
        emptyBody="Create your first project to start tracking it here."
        skeleton={
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/2" />
                <Skeleton className="mt-5 h-px w-full" />
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
                <Skeleton className="mt-5 h-6 w-24" />
              </Card>
            ))}
          </div>
        }
      >
      {visible.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-[14px] font-semibold text-ink">No projects match</p>
          <p className="mt-1 text-[13px] text-ink-2">
            Try widening the status, city or manager filter.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => (
            <Card key={project.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[16px] font-semibold text-ink">
                    {project.name}
                  </h2>
                  <p className="mt-0.5 truncate text-[12px] text-ink-3">
                    {project.client}
                  </p>
                </div>
                <span className="tnum shrink-0 text-[13px] font-bold text-ink">
                  {project.progress}%
                </span>
              </div>

              <div className="my-4 h-px bg-line" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="eyebrow mb-1.5">Budget Status</p>
                  <StatusDot tone={project.budgetStatus.tone}>
                    {project.budgetStatus.label}
                  </StatusDot>
                </div>
                <div>
                  <p className="eyebrow mb-1.5">Timeline</p>
                  <StatusDot tone={project.timeline.tone}>
                    {project.timeline.label}
                  </StatusDot>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 pt-1">
                <AvatarStack
                  avatars={project.team}
                  extra={project.extraTeam}
                />
                <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-4">
                  Est: {estDate(project.estimate)}
                </span>
              </div>
            </Card>
          ))}

          {safePage === 1 ? (
            <button
              type="button"
              onClick={openCreateProject}
              className="focus-ring flex min-h-[210px] flex-col items-center justify-center rounded-[12px] border border-dashed border-line-strong bg-subtle/60 p-6 text-center transition-colors hover:border-brand-200 hover:bg-brand-50/60"
            >
              <PlusCircle
                className="size-7 text-brand-ink"
                strokeWidth={1.5}
              />
              <span className="mt-3 text-[15px] font-semibold text-ink">
                Start a New Project
              </span>
              <span className="mt-1.5 max-w-[16rem] text-[12px] leading-relaxed text-ink-3">
                Initialize site plan, budget, and assign your management team.
              </span>
            </button>
          ) : null}
        </div>
      )}

      </QueryBoundary>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-ink-3">
          {projectsQuery.isLoading || projectsQuery.error ? null : (
            <>
          Showing {filtered.length === 0 ? 0 : start + 1} to{' '}
          {Math.min(start + PROJECTS_PER_PAGE, filtered.length)} of{' '}
          {filtered.length} Projects
            </>
          )}
        </p>
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onChange={setPage}
        />
      </div>
    </>
  )
}
