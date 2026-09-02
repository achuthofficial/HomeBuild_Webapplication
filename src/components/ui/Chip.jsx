import { cn } from '@/lib/cn'

/**
 * Pill badge. Each tone is a sampled tint/text pair:
 * success #E7F8F2/#10B981 · warning #FEF6E7/#F59E0B · danger #FFDAD6/#BA1A1A
 * violet #F3EFFE/#8B5CF6 · info #DBEAFE/#0058BE · orange #FFEDD5 · neutral #EEEFF2
 */
const tones = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  violet: 'bg-violet-bg text-violet',
  info: 'bg-info-bg text-brand-ink',
  orange: 'bg-orange-bg text-orange-ink',
  brand: 'bg-brand-50 text-brand-ink',
  neutral: 'bg-chip text-ink-2',
}

export default function Chip({
  tone = 'neutral',
  dot = false,
  uppercase = true,
  className,
  children,
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10px] font-semibold tracking-[0.05em]',
        uppercase && 'uppercase',
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  )
}
