import { Link, useNavigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'

import PageHeader from '@/components/layout/PageHeader'
import Card, { CardHeader } from '@/components/ui/Card'
import KpiCard from '@/components/ui/KpiCard'
import ProgressBar from '@/components/ui/ProgressBar'
import AvatarStack from '@/components/ui/AvatarStack'
import { cn } from '@/lib/cn'
import { currentUser } from '@/data/user'
import { dashboardKpis, projectStatusRows, siteUpdates } from '@/data/dashboard'

const rowIconTones = {
  brand: 'bg-brand-50 text-brand-600',
  violet: 'bg-violet-bg text-violet',
  success: 'bg-success-bg text-success',
}

const labelTones = {
  brand: 'text-ink-3',
  violet: 'text-violet',
  success: 'text-ink-3',
}

const dotTones = {
  brand: 'bg-brand-600',
  success: 'bg-success',
  neutral: 'bg-line-strong',
}

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <>
      <PageHeader
        title="Executive Dashboard"
        subtitle={`Welcome back, ${currentUser.firstName}. Here is your portfolio status for today.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {dashboardKpis.map((kpi) => (
          <KpiCard key={kpi.id} {...kpi} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        {/* ---------------- project status ---------------- */}
        <Card className="p-5">
          <CardHeader
            title="Project Status Overview"
            action={
              <Link
                to="/projects"
                className="focus-ring rounded text-[12px] font-semibold text-brand-600 hover:underline"
              >
                View All
              </Link>
            }
          />

          <ul className="mt-5 space-y-1">
            {projectStatusRows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => navigate('/projects')}
                  className="focus-ring flex w-full items-center gap-3.5 rounded-[10px] p-2 text-left transition-colors hover:bg-canvas"
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-[9px]',
                      rowIconTones[row.tone],
                    )}
                  >
                    <Building2 className="size-4" strokeWidth={1.75} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13.5px] font-semibold text-ink">
                        {row.name}
                      </span>
                      <span
                        className={cn(
                          'tnum shrink-0 text-[11.5px] font-medium',
                          labelTones[row.tone],
                        )}
                      >
                        {row.label}
                      </span>
                    </span>
                    <ProgressBar
                      value={row.progress}
                      tone={row.tone}
                      className="mt-2"
                      label={`${row.name} progress`}
                    />
                  </span>

                  <AvatarStack avatars={row.team} className="shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* ---------------- site updates ---------------- */}
        <Card className="p-5">
          <CardHeader title="Site Updates" />

          <ol className="mt-5 space-y-5">
            {siteUpdates.map((update, i) => (
              <li key={update.id} className="relative pl-5">
                <span
                  className={cn(
                    'absolute left-0 top-[3px] size-2 rounded-full',
                    dotTones[update.dot],
                  )}
                />
                {i < siteUpdates.length - 1 ? (
                  <span className="absolute bottom-[-14px] left-[3.5px] top-4 w-px bg-line" />
                ) : null}

                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-4">
                  {update.time} • {update.site}
                </p>

                {update.title ? (
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-ink">
                    {update.title}
                  </p>
                ) : null}

                {update.photo ? (
                  <img
                    src={update.photo}
                    alt=""
                    loading="lazy"
                    className="mt-2.5 aspect-[16/9] w-full rounded-[8px] object-cover"
                  />
                ) : null}

                {update.quote ? (
                  <p className="mt-2 text-[11px] italic leading-relaxed text-ink-3">
                    “{update.quote}” — {update.author}
                  </p>
                ) : null}

                {update.body ? (
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-2">
                    {update.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>

          <Link
            to="/construction"
            className="focus-ring mt-5 block rounded text-[12px] font-semibold text-brand-600 hover:underline"
          >
            Open Daily Site Feed
          </Link>
        </Card>
      </div>
    </>
  )
}
