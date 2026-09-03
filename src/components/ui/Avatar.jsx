import { cn } from '@/lib/cn'
import { onAvatarError } from '@/lib/imageFallback'

/**
 * Round user avatar with an initials fallback.
 *
 * Google and Apple return a profile picture; an email signup has none. Rather
 * than showing a stock face for those accounts, fall back to initials on a
 * brand tint — the same treatment the Contractors table already uses.
 */
export default function Avatar({ user, size = 32, className }) {
  const initials = user?.initials || user?.name?.[0]?.toUpperCase() || '?'

  if (!user?.avatar) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-ink',
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
        aria-hidden="true"
      >
        {initials}
      </span>
    )
  }

  return (
    <img
      src={user.avatar}
      onError={onAvatarError}
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0 rounded-full object-cover', className)}
      style={{ width: size, height: size }}
    />
  )
}
