import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { PlusCircle, SlidersHorizontal } from 'lucide-react'

import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import FilterSelect from '@/components/ui/FilterSelect'
import StatusDot from '@/components/ui/StatusDot'
import AvatarStack from '@/components/ui/AvatarStack'
import Pagination from '@/components/ui/Pagination'
import QueryBoundary, { Skeleton, RowSkeleton } from '@/components/ui/QueryBoundary'
import { estDate } from '@/lib/format'
import { useToast } from '@/context/ToastContext'
import { useQuery } from '@/hooks/useQuery'
import { useAuth } from '@/context/AuthContext'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import {
  listProjects,
  listProjectFilters,
  updateProjectProgress,
  claimDemoProjects,
  listProjectMembers,
  addProjectMember,
  removeProjectMember,
} from '@/api/projects'
import { listProfilesByRole } from '@/api/profiles'

const PROJECTS_PER_PAGE = 6

/* Portfolio filter labels map onto the timeline_status column. */
/** PRD 8.1 lifecycle states, for the advanced filter. */
const LIFECYCLE = {
  Lead: 'lead',
  'In Design': 'in_design',
  Active: 'active',
  Paused: 'paused',
  Completed: 'completed',
  Cancelled: 'cancelled',
}

const statusMatch = {
  'On Track': 'on_track',
  Delayed: 'delayed',
  'At Risk': 'at_risk',
  Ahead: 'ahead',
}

export default function Projects() {
  const { openCreateProject, dataVersion } = useOutletContext()
  const { toast } = useToast()
  const { authUser } = useAuth()
  const [savingId, setSavingId] = useState(null)
  const [teamFor, setTeamFor] = useState(null)
  const [claiming, setClaiming] = useState(false)
  const [memberBusy, setMemberBusy] = useState(false)
  const [addUid, setAddUid] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [advanced, setAdvanced] = useState({
    lifecycle: 'Any',
    minBudget: '',
    maxBudget: '',
  })

  const [status, setStatus] = useState('All Projects')
  const [city, setCity] = useState('All Locations')
  const [manager, setManager] = useState('All Managers')
  const [page, setPage] = useState(1)

  /* dataVersion is part of the key, so creating a project refreshes this
     list rather than requiring a reload. */
  const projectsQuery = useQuery(() => listProjects(), [dataVersion])
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
          (manager === 'All Managers' || p.manager === manager) &&
          (advanced.lifecycle === 'Any' || p.status === LIFECYCLE[advanced.lifecycle]) &&
          /* Budget bounds are in rupees, matching how the column is stored. */
          (!advanced.minBudget || p.budgetTotal >= Number(advanced.minBudget)) &&
          (!advanced.maxBudget || p.budgetTotal <= Number(advanced.maxBudget)),
      ),
    [projects, status, city, manager, advanced],
  )

  /* Shown on the toggle so it is obvious the list is narrowed by filters
     that are currently collapsed out of view. */
  const advancedCount =
    (advanced.lifecycle !== 'Any' ? 1 : 0) +
    (advanced.minBudget ? 1 : 0) +
    (advanced.maxBudget ? 1 : 0)

  const totalPages = Math.max(1, Math.ceil(filtered.length / PROJECTS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PROJECTS_PER_PAGE
  const visible = filtered.slice(start, start + PROJECTS_PER_PAGE)

  const onFilter = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  /* Loaded only when the team sheet opens, keyed on which project. */
  const members = useQuery(
    () => listProjectMembers(teamFor.id),
    [teamFor?.id],
    { enabled: Boolean(teamFor?.id) },
  )
  const directory = useQuery(() => listProfilesByRole(), [], {
    enabled: Boolean(teamFor?.id),
  })

  /**
   * A fresh account sees nothing, because the seeded projects belong to
   * placeholder profiles. That is correct but indistinguishable from broken,
   * so the empty state offers a way in.
   */
  const claimDemo = async () => {
    setClaiming(true)
    try {
      const count = await claimDemoProjects()
      toast(
        count > 0
          ? `Joined ${count} demo project${count === 1 ? '' : 's'}.`
          : 'No demo projects left to join.',
      )
      projectsQuery.refetch()
      filtersQuery.refetch()
    } catch (error) {
      toast(error.message, { tone: 'info' })
    } finally {
      setClaiming(false)
    }
  }

  const addMember = async () => {
    if (!addUid) return
    setMemberBusy(true)
    try {
      await addProjectMember(teamFor.id, addUid)
      setAddUid('')
      toast('Member added to the project.')
      members.refetch()
      projectsQuery.refetch()
    } catch (error) {
      toast(error.message, { tone: 'info' })
    } finally {
      setMemberBusy(false)
    }
  }

  const removeMember = async (member) => {
    setMemberBusy(true)
    try {
      await removeProjectMember(teamFor.id, member.uid)
      toast(`${member.name} removed from the project.`)
      members.refetch()
      projectsQuery.refetch()
    } catch (error) {
      toast(error.message, { tone: 'info' })
    } finally {
      setMemberBusy(false)
    }
  }

  /**
   * Live progress tracking. Committed on blur rather than on every keystroke,
   * so dragging the number from 30 to 65 is one write, not thirty-five.
   */
  const commitProgress = async (project, value) => {
    const next = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
    if (next === project.progress) return

    setSavingId(project.id)
    try {
      await updateProjectProgress(project.id, next, authUser?.uid)
      toast(`${project.name} set to ${next}% complete.`)
      projectsQuery.refetch()
    } catch (error) {
      toast(error.message, { tone: 'info' })
    } finally {
      setSavingId(null)
    }
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
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
          className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:bg-subtle"
        >
          <SlidersHorizontal className="size-3.5" strokeWidth={1.75} />
          Advanced Filters
          {advancedCount ? (
            <span className="tnum rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-on-brand">
              {advancedCount}
            </span>
          ) : null}
        </button>
      </div>

      {advancedOpen ? (
        <Card className="mb-5 p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="af-lifecycle" className="eyebrow mb-1.5 block">
                Lifecycle Stage
              </label>
              <select
                id="af-lifecycle"
                value={advanced.lifecycle}
                onChange={(e) => {
                  setAdvanced((a) => ({ ...a, lifecycle: e.target.value }))
                  setPage(1)
                }}
                className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
              >
                <option>Any</option>
                {Object.keys(LIFECYCLE).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="af-min" className="eyebrow mb-1.5 block">
                Min Budget (₹)
              </label>
              <input
                id="af-min"
                type="number"
                min="0"
                step="100000"
                value={advanced.minBudget}
                onChange={(e) => {
                  setAdvanced((a) => ({ ...a, minBudget: e.target.value }))
                  setPage(1)
                }}
                placeholder="0"
                className="focus-ring tnum h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-ink-4"
              />
            </div>
            <div>
              <label htmlFor="af-max" className="eyebrow mb-1.5 block">
                Max Budget (₹)
              </label>
              <input
                id="af-max"
                type="number"
                min="0"
                step="100000"
                value={advanced.maxBudget}
                onChange={(e) => {
                  setAdvanced((a) => ({ ...a, maxBudget: e.target.value }))
                  setPage(1)
                }}
                placeholder="No limit"
                className="focus-ring tnum h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-ink-4"
              />
            </div>
          </div>

          {advancedCount ? (
            <button
              type="button"
              onClick={() => {
                setAdvanced({ lifecycle: 'Any', minBudget: '', maxBudget: '' })
                setPage(1)
              }}
              className="focus-ring mt-3 rounded text-[12px] font-semibold text-brand-ink hover:underline"
            >
              Clear advanced filters
            </button>
          ) : null}
        </Card>
      ) : null}

      <QueryBoundary
        isLoading={projectsQuery.isLoading}
        error={projectsQuery.error}
        data={projects}
        onRetry={projectsQuery.refetch}
        emptyTitle="No projects yet"
        emptyBody="You only see projects you manage, own, or have been added to. Create one, or join the demo set to look around."
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
                {/* Editable in place: progress is the field a PM touches
                    most, and a dialog for one number is friction. */}
                <label className="flex shrink-0 items-center gap-1">
                  <span className="sr-only">{project.name} progress percent</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={project.progress}
                    disabled={savingId === project.id}
                    onBlur={(e) => commitProgress(project, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                    className="focus-ring tnum w-11 rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 text-right text-[13px] font-bold text-ink hover:border-line focus:border-line disabled:opacity-50"
                  />
                  <span className="text-[13px] font-bold text-ink">%</span>
                </label>
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
                <button
                  type="button"
                  onClick={() => setTeamFor(project)}
                  aria-label={`Manage team on ${project.name}`}
                  className="focus-ring rounded-full p-0.5 transition-opacity hover:opacity-80"
                >
                  {project.team.length || project.extraTeam ? (
                    <AvatarStack
                      avatars={project.team}
                      extra={project.extraTeam}
                    />
                  ) : (
                    <span className="text-[11px] font-semibold text-brand-ink">
                      + Add team
                    </span>
                  )}
                </button>
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

      {/* Only when genuinely empty — not while a filter happens to match none. */}
      {!projectsQuery.isLoading &&
      !projectsQuery.error &&
      projects.length === 0 ? (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            disabled={claiming}
            onClick={claimDemo}
          >
            {claiming ? 'Joining…' : 'Join the demo projects'}
          </Button>
        </div>
      ) : null}

      {/* ---------------- team management ---------------- */}
      <Modal
        open={!!teamFor}
        onClose={() => setTeamFor(null)}
        title={teamFor ? `Team on ${teamFor.name}` : ''}
        description="Only these people can see this project."
      >
        <div className="space-y-4">
          <QueryBoundary
            isLoading={members.isLoading}
            error={members.error}
            data={members.data}
            onRetry={members.refetch}
            emptyTitle="No members yet"
            emptyBody="Add a colleague to give them access."
            skeleton={<RowSkeleton rows={2} />}
          >
            <ul className="space-y-2">
              {(members.data ?? []).map((member) => (
                <li
                  key={member.uid}
                  className="flex items-center gap-3 rounded-[10px] border border-line bg-canvas px-3 py-2.5"
                >
                  <Avatar user={member} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">
                      {member.name}
                    </p>
                    <p className="truncate text-[11.5px] capitalize text-ink-3">
                      {member.projectRole?.replace('_', ' ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={memberBusy}
                    onClick={() => removeMember(member)}
                    className="focus-ring shrink-0 rounded text-[12px] font-semibold text-danger hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </QueryBoundary>

          <div className="border-t border-line pt-4">
            <label htmlFor="pm-add" className="eyebrow mb-1.5 block">
              Add someone
            </label>
            <div className="flex gap-2">
              <select
                id="pm-add"
                value={addUid}
                onChange={(e) => setAddUid(e.target.value)}
                disabled={memberBusy}
                className="focus-ring h-9 min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
              >
                <option value="">Choose a colleague…</option>
                {(directory.data ?? [])
                  .filter(
                    (person) =>
                      !(members.data ?? []).some((m) => m.uid === person.uid),
                  )
                  .map((person) => (
                    <option key={person.uid} value={person.uid}>
                      {person.name}
                    </option>
                  ))}
              </select>
              <Button
                variant="primary"
                onClick={addMember}
                disabled={memberBusy || !addUid}
              >
                Add
              </Button>
            </div>
            {/* The policy allows this only for the manager, so say so before
                the attempt rather than after it fails. */}
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
              Only the project’s manager can change its team.
            </p>
          </div>
        </div>
      </Modal>

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
