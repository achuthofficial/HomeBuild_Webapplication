import { cn } from '@/lib/cn'

/**
 * Button variants sampled from the mockups — see design_system.md section 3.
 * Primary #0058BE, Success #10B981, Violet #8B5CF6, Warning #F59E0B.
 */
const variants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700',
  success: 'bg-success text-white hover:brightness-95 active:brightness-90',
  violet: 'bg-violet text-white hover:brightness-95 active:brightness-90',
  warning: 'bg-warning text-white hover:brightness-95 active:brightness-90',
  outline:
    'bg-surface text-ink border border-line hover:bg-subtle active:bg-muted',
  ghost: 'bg-subtle text-ink-2 hover:bg-muted active:bg-line',
  danger: 'bg-subtle text-danger hover:bg-danger-bg active:bg-danger-bg',
  link: 'bg-transparent text-brand-600 hover:underline underline-offset-2 px-0',
}

const sizes = {
  sm: 'h-8 px-3 text-[12px] gap-1.5 rounded-[7px]',
  md: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-[8px]',
  lg: 'h-11 px-5 text-sm gap-2 rounded-[8px]',
}

export default function Button({
  as: Tag = 'button',
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
  ...props
}) {
  return (
    <Tag
      className={cn(
        'focus-ring inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        sizes[size],
        variants[variant],
        className,
      )}
      {...(Tag === 'button' ? { type: props.type ?? 'button' } : null)}
      {...props}
    >
      {Icon ? <Icon className="size-4 shrink-0" strokeWidth={1.75} /> : null}
      {children}
      {IconRight ? (
        <IconRight className="size-4 shrink-0" strokeWidth={1.75} />
      ) : null}
    </Tag>
  )
}
