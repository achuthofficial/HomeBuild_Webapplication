import { useId, useState } from 'react'
import { Eye, EyeOff, TriangleAlert, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Shared input chrome for every auth field. */
const inputBase =
  'focus-ring h-11 w-full rounded-[8px] border border-line bg-surface pr-3 text-[13px] text-ink placeholder:text-ink-4 disabled:opacity-60'

/** Labelled text input with a leading icon. */
export function Field({
  label,
  icon: Icon,
  type = 'text',
  hint,
  className,
  ...props
}) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-ink-2">
        {label}
      </label>
      <div className="relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
        ) : null}
        <input
          id={id}
          type={type}
          className={cn(inputBase, Icon ? 'pl-9' : 'pl-3')}
          {...props}
        />
      </div>
      {hint ? <p className="mt-1.5 text-[11.5px] text-ink-3">{hint}</p> : null}
    </div>
  )
}

/** Password field with a reveal toggle and an optional right-hand action. */
export function PasswordField({ label, icon: Icon, action, hint, ...props }) {
  const id = useId()
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-[12px] font-medium text-ink-2">
          {label}
        </label>
        {action}
      </div>
      <div className="relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
        ) : null}
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={cn(inputBase, Icon ? 'pl-9 pr-10' : 'pl-3 pr-10')}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-4 transition hover:text-ink-2"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {hint ? <p className="mt-1.5 text-[11.5px] text-ink-3">{hint}</p> : null}
    </div>
  )
}

/**
 * Inline form feedback. Errors use role="alert" so a screen reader announces
 * a failed sign-in without the user having to hunt for what changed.
 */
export function FormMessage({ tone = 'error', children }) {
  if (!children) return null
  const error = tone === 'error'

  return (
    <div
      role={error ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-[8px] border px-3 py-2.5 text-[12.5px] leading-snug',
        error
          ? 'border-danger/25 bg-danger-bg/60 text-danger'
          : 'border-success/25 bg-success-bg text-success',
      )}
    >
      {error ? (
        <TriangleAlert className="mt-px size-4 shrink-0" strokeWidth={2} />
      ) : (
        <CheckCircle2 className="mt-px size-4 shrink-0" strokeWidth={2} />
      )}
      <p className="flex-1">{children}</p>
    </div>
  )
}

/** "or continue with email" rule. */
export function Divider({ children }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-4">
        {children}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}
