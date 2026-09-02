import { cn } from '@/lib/cn'

/** White surface, 1px #E2E8F0 hairline, 12px radius, near-invisible shadow. */
export default function Card({ as: Tag = 'div', className, children, ...props }) {
  return (
    <Tag className={cn('card', className)} {...props}>
      {children}
    </Tag>
  )
}

/** Card title row with an optional right-hand action (usually a "View All"). */
export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold leading-tight text-ink">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-[13px] text-ink-2">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}
