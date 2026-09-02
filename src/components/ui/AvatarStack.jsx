import { cn } from '@/lib/cn'
import { onAvatarError } from '@/lib/imageFallback'

/**
 * Overlapping circular avatars with a 2px white ring, plus an optional "+N"
 * counter tile — the cluster used on project cards and feed entries.
 */
export default function AvatarStack({
  avatars = [],
  extra = 0,
  size = 26,
  className,
}) {
  if (!avatars.length && !extra) return null

  return (
    <div className={cn('flex items-center', className)}>
      {avatars.map((src, i) => (
        <img
          key={src + i}
          src={src}
          onError={onAvatarError}
          alt=""
          loading="lazy"
          width={size}
          height={size}
          className="rounded-full object-cover ring-2 ring-surface"
          style={{ width: size, height: size, marginLeft: i === 0 ? 0 : -8 }}
        />
      ))}
      {extra > 0 ? (
        <span
          className="flex items-center justify-center rounded-full bg-subtle text-[10px] font-semibold text-ink-2 ring-2 ring-surface"
          style={{
            width: size,
            height: size,
            marginLeft: avatars.length ? -8 : 0,
          }}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  )
}
