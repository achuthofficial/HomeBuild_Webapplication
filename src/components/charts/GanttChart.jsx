import { useState } from 'react'
import { ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/cn'
import Chip from '@/components/ui/Chip'
import {
  scheduleGroups,
  scheduleMonths,
  ganttLegend,
  todayMarker,
  TOTAL_WEEKS,
} from '@/data/schedule'

const barTones = {
  success: 'bg-success',
  violet: 'bg-violet-bar',
  danger: 'bg-danger-bar',
  neutral: 'bg-line-strong',
}

const legendSwatch = {
  success: 'bg-success',
  violet: 'bg-violet-bar',
  baseline: 'bg-ink-2',
  forecast: 'border border-dashed border-ink-4 bg-transparent',
}

/** Convert a week offset into a percentage of the 12-column track. */
const toPct = (weeks) => `${(weeks / TOTAL_WEEKS) * 100}%`

function Bar({ bar, forecast, flag }) {
  return (
    <>
      <div
        className={cn(
          'absolute top-1/2 h-[9px] -translate-y-1/2 rounded-[3px]',
          barTones[bar.tone],
        )}
        style={{ left: toPct(bar.start), width: toPct(bar.end - bar.start) }}
      />

      {forecast ? (
        <div
          className="absolute top-1/2 h-[11px] -translate-y-1/2 rounded-[3px] border border-dashed border-ink-4"
          style={{
            left: toPct(forecast.start),
            width: toPct(forecast.end - forecast.start),
          }}
        />
      ) : null}

      {flag ? (
        <span
          className="tnum absolute -top-0.5 rounded-[4px] bg-danger-bar px-1.5 py-px text-[9px] font-bold text-white"
          style={{ left: toPct((forecast?.end ?? bar.end) - 0.55) }}
        >
          {flag}
        </span>
      ) : null}
    </>
  )
}

export default function GanttChart({ onTaskClick }) {
  const [open, setOpen] = useState(() =>
    Object.fromEntries(scheduleGroups.map((g) => [g.id, g.defaultOpen])),
  )
  const [zoom, setZoom] = useState(1)

  const toggle = (id) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="overflow-hidden rounded-[12px] border border-line bg-surface">
      <div className="scrollbar-slim overflow-x-auto">
        <div style={{ minWidth: `${760 * zoom}px` }}>
          {/* ---------- header ------------------------------------------- */}
          <div className="flex border-b border-line">
            <div className="flex w-[230px] shrink-0 items-center justify-between border-r border-line px-4 py-3">
              <span className="eyebrow">Task Hierarchy</span>
              <ChevronRight className="size-3.5 rotate-90 text-ink-4" />
            </div>

            <div className="relative flex-1">
              <div className="flex">
                {scheduleMonths.map((month) => (
                  <div
                    key={month.label}
                    className="flex-1 border-r border-line py-2 text-center last:border-r-0"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-2">
                      {month.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex border-t border-line">
                {scheduleMonths.flatMap((m) => m.weeks).map((week) => (
                  <div
                    key={week}
                    className="flex-1 border-r border-line py-1.5 text-center last:border-r-0"
                  >
                    <span className="tnum text-[10px] font-medium text-ink-4">
                      {week}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ---------- rows --------------------------------------------- */}
          <div className="relative">
            {/* today marker spans every row */}
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-ink/70"
              style={{
                left: `calc(230px + (100% - 230px) * ${
                  todayMarker.offset / TOTAL_WEEKS
                })`,
              }}
            >
              <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[4px] bg-ink px-1.5 py-[3px] text-[9px] font-bold uppercase tracking-[0.05em] text-white">
                {todayMarker.label}
              </span>
            </div>

            {scheduleGroups.map((group) => (
              <div key={group.id}>
                {/* group row */}
                <div className="flex border-b border-line">
                  <button
                    type="button"
                    onClick={() => toggle(group.id)}
                    aria-expanded={!!open[group.id]}
                    className="focus-ring flex w-[230px] shrink-0 items-center gap-1.5 border-r border-line px-4 py-3 text-left transition-colors hover:bg-canvas"
                  >
                    <ChevronRight
                      className={cn(
                        'size-3.5 shrink-0 text-ink-3 transition-transform',
                        open[group.id] && 'rotate-90',
                      )}
                      strokeWidth={2.5}
                    />
                    <span className="text-[13px] font-semibold text-ink">
                      {group.name}
                    </span>
                  </button>

                  <div className="relative min-h-[44px] flex-1">
                    <GridLines />
                    <div
                      className="absolute top-1/2 h-[7px] -translate-y-1/2 rounded-[2px] bg-ink-2"
                      style={{
                        left: toPct(group.baseline.start),
                        width: toPct(group.baseline.end - group.baseline.start),
                      }}
                    />
                  </div>
                </div>

                {/* task rows */}
                {open[group.id]
                  ? group.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="group flex border-b border-line last:border-b-0"
                      >
                        <button
                          type="button"
                          onClick={() => onTaskClick?.(task)}
                          className="focus-ring flex w-[230px] shrink-0 items-center justify-between gap-2 border-r border-line py-3 pl-9 pr-3 text-left transition-colors hover:bg-canvas"
                        >
                          <span className="truncate text-[13px] text-ink-2">
                            {task.name}
                          </span>
                          <Chip tone={task.badge.tone} className="shrink-0">
                            {task.badge.label}
                          </Chip>
                        </button>

                        <div className="relative min-h-[44px] flex-1 transition-colors group-hover:bg-canvas/60">
                          <GridLines />
                          <Bar
                            bar={task.bar}
                            forecast={task.forecast}
                            flag={task.flag}
                          />
                        </div>
                      </div>
                    ))
                  : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- legend --------------------------------------------- */}
      <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-2.5">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {ganttLegend.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'shrink-0',
                  item.kind === 'rule'
                    ? 'h-[3px] w-3.5 rounded-full'
                    : 'size-2.5 rounded-[3px]',
                  legendSwatch[item.tone],
                )}
              />
              <span className="text-[11px] text-ink-2">{item.label}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.85, +(z - 0.15).toFixed(2)))}
            aria-label="Zoom out"
            className="focus-ring rounded-[6px] p-1.5 text-ink-3 transition-colors hover:bg-subtle"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)))}
            aria-label="Zoom in"
            className="focus-ring rounded-[6px] p-1.5 text-ink-3 transition-colors hover:bg-subtle"
          >
            <ZoomIn className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Faint week separators behind every bar row. */
function GridLines() {
  return (
    <div className="pointer-events-none absolute inset-0 flex" aria-hidden="true">
      {Array.from({ length: TOTAL_WEEKS }, (_, i) => (
        <div key={i} className="flex-1 border-r border-line/60 last:border-r-0" />
      ))}
    </div>
  )
}
