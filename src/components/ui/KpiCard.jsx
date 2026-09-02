import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import Card from './Card'
import ProgressBar from './ProgressBar'

/**
 * Executive Dashboard KPI card.
 *
 * The icon is a BARE coloured glyph on white — sampling the mockup at the icon
 * position returns #0058BE strokes directly on #FFFFFF with no tinted tile
 * behind them. (Finance and Alerts cards DO use a tinted tile; those are built
 * in their own pages.)
 */
const iconTones = {
  brand: 'text-brand-600',
  success: 'text-success',
  warning: 'text-warning',
  violet: 'text-violet',
  danger: 'text-danger',
}

const valueTones = {
  ink: 'text-ink',
  success: 'text-success',
  warning: 'text-warning',
  violet: 'text-violet',
  danger: 'text-danger',
  brand: 'text-brand-600',
}

const subTones = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  'ink-3': 'text-ink-3',
}

export default function KpiCard({
  label,
  value,
  sub,
  subTone,
  subIcon,
  icon: Icon,
  iconTone = 'brand',
  valueTone = 'ink',
  progress,
  badge,
  className,
}) {
  return (
    <Card className={cn('relative overflow-hidden p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow max-w-[8.5rem] leading-[1.4]">{label}</p>
        {Icon ? (
          <Icon
            className={cn('size-[18px] shrink-0', iconTones[iconTone])}
            strokeWidth={1.75}
          />
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={cn(
            'tnum text-[28px] font-bold leading-none tracking-[-0.01em]',
            valueTones[valueTone],
          )}
        >
          {value}
        </span>
        {badge ? (
          <span
            className={cn(
              'text-[11px] font-semibold',
              subTones[badge.tone] ?? 'text-ink-3',
            )}
          >
            {badge.label}
          </span>
        ) : null}
      </div>

      {progress !== undefined ? (
        <ProgressBar value={progress} tone="brand" className="mt-3.5" label={label} />
      ) : sub ? (
        <p
          className={cn(
            'mt-2 flex items-center gap-1 text-[11px] leading-tight',
            subTones[subTone] ?? 'text-ink-3',
          )}
        >
          {subIcon === 'trend' ? (
            <TrendingUp className="size-3 shrink-0" strokeWidth={2} />
          ) : null}
          {sub}
        </p>
      ) : null}
    </Card>
  )
}
