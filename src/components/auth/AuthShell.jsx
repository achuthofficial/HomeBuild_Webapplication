import { Link } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'

import Logo from '@/components/layout/Logo'
import { media, avatar } from '@/data/media'
import { onAvatarError, onImageError } from '@/lib/imageFallback'

const socialProof = [avatar(33), avatar(45), avatar(12)]

/**
 * Two-panel frame shared by every auth screen: form on the left, photographic
 * hero on the right (hidden below lg). Extracted from the original Sign In
 * page so Sign Up, Forgot Password and Reset Password sit in the same chrome
 * rather than each re-implementing it.
 */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,440px)_1fr]">
      <div className="flex flex-col justify-between bg-surface px-6 py-8 sm:px-10">
        <Link to="/sign-in" className="focus-ring flex w-fit items-center gap-2.5 rounded">
          <Logo size={30} />
          <span className="text-[17px] font-bold text-ink">HomeBuild</span>
        </Link>

        <div className="mx-auto w-full max-w-[320px] py-10">
          <h1 className="text-[26px] font-bold leading-tight text-ink">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{subtitle}</p>
          ) : null}
          {children}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-ink-3">
          <span>© 2026 HomeBuild Inc.</span>
          <div className="flex gap-4">{footer}</div>
        </div>
      </div>

      <div className="relative hidden lg:block">
        <img
          src={media.authHero}
          onError={onImageError}
          alt="Contemporary home at dusk with a reflecting pool"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-black/50 via-black/15 to-transparent" />

        <figure className="absolute bottom-10 left-8 right-8 max-w-[340px] rounded-[14px] bg-surface/92 p-5 backdrop-blur-sm xl:left-14">
          <div className="flex items-center gap-2.5">
            <div className="flex">
              {socialProof.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  onError={onAvatarError}
                  alt=""
                  className="size-6 rounded-full object-cover ring-2 ring-surface"
                  style={{ marginLeft: i === 0 ? 0 : -8 }}
                />
              ))}
            </div>
            <span className="text-[11px] font-medium text-ink-2">
              +1,200 project managers already joined
            </span>
          </div>

          <p className="mt-3.5 text-[17px] font-bold leading-snug text-ink">
            Architecting the future of project management.
          </p>

          <blockquote className="mt-2.5 text-[12px] italic leading-relaxed text-ink-2">
            “HomeBuild has transformed how we handle site inspections and
            financial tracking. The precision is unmatched in the industry.”
          </blockquote>

          <figcaption className="mt-4 flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-brand-600">
              <BadgeCheck className="size-4 text-white" strokeWidth={2} />
            </span>
            <span>
              <span className="block text-[12px] font-semibold text-ink">
                Yashraj Kumar
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">
                Lead Architect
              </span>
            </span>
          </figcaption>
        </figure>
      </div>
    </div>
  )
}
