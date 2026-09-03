import { useState } from 'react'
import { FileDown, ListFilter, TrendingUp, Users, Zap } from 'lucide-react'

import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import Segmented from '@/components/ui/Segmented'
import ProgressBar from '@/components/ui/ProgressBar'
import Modal from '@/components/ui/Modal'
import GanttChart from '@/components/charts/GanttChart'
import QueryBoundary, { Skeleton, RowSkeleton } from '@/components/ui/QueryBoundary'
import { cn } from '@/lib/cn'
import { useToast } from '@/context/ToastContext'
import { useQuery } from '@/hooks/useQuery'
import { getPrimaryProjectId } from '@/api/finance'
import { getSchedule } from '@/api/schedule'
import {
  scheduleViews,
  scheduleHealth,
  workforce,
  timelinePulse,
} from '@/data/schedule'

const pulseDots = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

/** List and Board fall back to a flat rendering of the same task data. */
function TaskList({ groups }) {
  return (
    <Card className="divide-y divide-line overflow-hidden">
      {groups.flatMap((group) =>
        group.tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between gap-4 px-5 py-3.5"
          >
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-ink">
                {task.name}
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink-3">{group.name}</p>
            </div>
            <Chip tone={task.badge.tone}>{task.badge.label}</Chip>
          </div>
        )),
      )}
    </Card>
  )
}

function TaskBoard({ groups }) {
  const columns = [
    { label: 'Done', tone: 'success', match: 'DONE' },
    { label: 'In Progress', tone: 'violet', match: 'IN PROGRESS' },
    { label: 'Blocked', tone: 'danger', match: 'DELAYED' },
    { label: 'Queued', tone: 'neutral', match: 'QUEUED' },
  ]
  const allTasks = groups.flatMap((g) =>
    g.tasks.map((t) => ({ ...t, group: g.name })),
  )

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {columns.map((col) => {
        const items = allTasks.filter((t) =>
          col.match === 'QUEUED'
            ? !['DONE', 'IN PROGRESS', 'DELAYED', 'CRITICAL'].includes(
                t.badge.label,
              )
            : t.badge.label === col.match ||
              (col.match === 'IN PROGRESS' && t.badge.label === 'CRITICAL'),
        )
        return (
          <div key={col.label}>
            <div className="mb-2.5 flex items-center gap-2">
              <Chip tone={col.tone}>{col.label}</Chip>
              <span className="tnum text-[11px] text-ink-4">{items.length}</span>
            </div>
            <div className="space-y-2.5">
              {items.map((task) => (
                <Card key={task.id} className="p-3.5">
                  <p className="text-[13px] font-medium text-ink">{task.name}</p>
                  <p className="mt-1 text-[11px] text-ink-3">{task.group}</p>
                </Card>
              ))}
              {items.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-line-strong px-3 py-6 text-center text-[11.5px] text-ink-4">
                  Nothing here
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Schedule() {
  const { toast } = useToast()
  const [view, setView] = useState('Gantt')
  const [task, setTask] = useState(null)

  const projectQuery = useQuery(() => getPrimaryProjectId(), [])
  const projectId = projectQuery.data?.id ?? null

  const schedule = useQuery(
    () => getSchedule(projectId),
    [projectId],
    { enabled: Boolean(projectId) },
  )
  const groups = schedule.data?.groups ?? []

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Projects', to: '/projects' },
          { label: 'Sky Villa 42', to: '/projects' },
          { label: 'Schedule' },
        ]}
        title="Master Construction Schedule"
        actions={
          <>
            <Segmented
              options={scheduleViews}
              value={view}
              onChange={setView}
              ariaLabel="Schedule view"
            />
            <Button
              variant="outline"
              icon={ListFilter}
              onClick={() =>
                toast('Schedule filters are not available in this prototype.', {
                  tone: 'info',
                })
              }
            >
              Filters
            </Button>
            <Button
              variant="violet"
              icon={FileDown}
              onClick={() => toast('Schedule exported as PDF.')}
            >
              Export PDF
            </Button>
          </>
        }
      />

      <QueryBoundary
        isLoading={projectQuery.isLoading || schedule.isLoading}
        error={projectQuery.error ?? schedule.error}
        data={groups}
        onRetry={schedule.refetch}
        emptyTitle="No phases scheduled"
        emptyBody="Add schedule phases for this project to see the Gantt."
        skeleton={<Skeleton className="h-[320px] w-full rounded-[12px]" />}
      >
        {view === 'Gantt' ? (
          <GanttChart groups={groups} months={schedule.data?.months ?? []} onTaskClick={setTask} />
        ) : null}
        {view === 'List' ? <TaskList groups={groups} /> : null}
        {view === 'Board' ? <TaskBoard groups={groups} /> : null}
      </QueryBoundary>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* ---------------- schedule health ---------------- */}
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-ink">Schedule Health</h2>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="tnum text-[34px] font-bold leading-none text-success">
                {scheduleHealth.value}%
              </p>
              <p className="mt-2 text-[12px] text-ink-2">
                {scheduleHealth.caption}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-1 text-[11px] font-semibold text-success">
              <TrendingUp className="size-3" strokeWidth={2} />+
              {scheduleHealth.delta}%
            </span>
          </div>

          <div className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <p className="text-[12px] text-ink-2">
                Next Milestone: {scheduleHealth.nextMilestone}
              </p>
              <p className="tnum shrink-0 text-right text-[12px] font-semibold text-ink">
                {scheduleHealth.daysRemaining}
                <span className="block text-[10px] font-normal text-ink-3">
                  Days
                </span>
              </p>
            </div>
            <ProgressBar
              value={scheduleHealth.progress}
              tone="success"
              size="lg"
              className="mt-2.5"
              label="Milestone progress"
            />
          </div>
        </Card>

        {/* ---------------- workforce ---------------- */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">
              Workforce Distribution
            </h2>
            <Users className="size-4 text-ink-4" strokeWidth={1.75} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {workforce.groups.map((group) => (
              <div
                key={group.label}
                className="rounded-[10px] border border-line bg-canvas px-2 py-3 text-center"
              >
                <p className="tnum text-[20px] font-bold leading-none text-violet">
                  {group.value}
                </p>
                <p className="mt-1.5 text-[10.5px] leading-tight text-ink-3">
                  {group.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2.5 rounded-[10px] bg-violet-bg px-3.5 py-3">
            <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-surface">
              <Zap className="size-3.5 text-violet" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-ink">
                {workforce.optimization.title}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-2">
                {workforce.optimization.body}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toast('Workforce reallocation applied.')}
              className="focus-ring shrink-0 rounded text-[11.5px] font-semibold text-brand-ink hover:underline"
            >
              {workforce.optimization.action}
            </button>
          </div>
        </Card>

        {/* ---------------- timeline pulse ---------------- */}
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-ink">Timeline Pulse</h2>

          <ol className="mt-4 space-y-3.5">
            {timelinePulse.map((item) => (
              <li key={item.id} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'mt-1 size-2 shrink-0 rounded-full',
                    pulseDots[item.tone],
                  )}
                />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium leading-snug text-ink">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-3">{item.meta}</p>
                </div>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={() =>
              toast('Audit log is not available in this prototype.', {
                tone: 'info',
              })
            }
            className="focus-ring mt-5 rounded text-[12px] font-semibold text-brand-ink hover:underline"
          >
            View Full Audit Log
          </button>
        </Card>
      </div>

      {/* ---------------- task detail ---------------- */}
      <Modal
        open={!!task}
        onClose={() => setTask(null)}
        title={task?.name ?? ''}
        size="sm"
      >
        {task ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="eyebrow">Status</span>
              <Chip tone={task.badge.tone}>{task.badge.label}</Chip>
            </div>
            <div>
              <p className="eyebrow mb-1">Planned Window</p>
              <p className="tnum text-[13px] text-ink-2">
                Week {(40 + task.bar.start).toFixed(1)} → Week{' '}
                {(40 + task.bar.end).toFixed(1)}
              </p>
            </div>
            {task.flag ? (
              <div className="rounded-[8px] bg-danger-bg px-3 py-2.5">
                <p className="text-[12px] font-semibold text-danger">
                  Slipping by {task.flag.replace('+', '')}
                </p>
                <p className="mt-0.5 text-[11.5px] text-ink-2">
                  A dashed forecast bar shows the projected finish.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  )
}
