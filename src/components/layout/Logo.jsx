import { cn } from '@/lib/cn'

/** Rounded blue tile with a white house glyph — the HomeBuild brand mark. */
export default function Logo({ size = 32, className }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[9px] bg-brand-600',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-[58%]" fill="none">
        <path
          d="M12 3.5 20 10v10h-5v-6H9v6H4V10l8-6.5Z"
          fill="#fff"
          fillOpacity="0.95"
        />
        {/* Door notch: a neutral darkening so it reads on any tile shade,
            since --brand-600 shifts between themes. */}
        <path d="M9 14h6v6H9z" fill="#000" fillOpacity="0.22" />
      </svg>
    </span>
  )
}
