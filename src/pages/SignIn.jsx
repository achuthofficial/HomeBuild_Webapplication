import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, BadgeCheck } from 'lucide-react'

import Logo from '@/components/layout/Logo'
import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { media, avatar } from '@/data/media'

const socialProof = [avatar(33), avatar(45), avatar(12)]

export default function SignIn() {
  const { signIn } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('manish@homebuild.com')
  const [password, setPassword] = useState('homebuild')
  const [showPassword, setShowPassword] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    signIn()
    navigate(location.state?.from?.pathname ?? '/dashboard', { replace: true })
  }

  const oauth = (provider) =>
    toast(`${provider} sign-in is not wired up in this prototype.`, {
      tone: 'info',
    })

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,440px)_1fr]">
      {/* ---------------- auth panel ---------------- */}
      <div className="flex flex-col justify-between bg-surface px-6 py-8 sm:px-10">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="text-[17px] font-bold text-ink">HomeBuild</span>
        </div>

        <div className="mx-auto w-full max-w-[320px] py-10">
          <h1 className="text-[26px] font-bold leading-tight text-ink">
            Welcome back
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            Sign in to manage your construction projects and schedules.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" onClick={() => oauth('Google')}>
              Google
            </Button>
            <Button variant="outline" size="lg" onClick={() => oauth('Apple')}>
              Apple
            </Button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-4">
              or continue with email
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-[12px] font-medium text-ink-2"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="focus-ring h-11 w-full rounded-[8px] border border-line bg-surface pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-4"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-[12px] font-medium text-ink-2"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() =>
                    toast('Password reset is not available in this prototype.', {
                      tone: 'info',
                    })
                  }
                  className="focus-ring rounded text-[12px] font-medium text-brand-600 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="focus-ring h-11 w-full rounded-[8px] border border-line bg-surface pl-9 pr-10 text-[13px] text-ink"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-4 transition hover:text-ink-2"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
            >
              Sign In to Workspace
            </Button>
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-ink-3">
          <span>© 2026 HomeBuild Inc.</span>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/support')}
              className="focus-ring rounded transition-colors hover:text-ink-2"
            >
              Support
            </button>
            <button
              type="button"
              onClick={() =>
                toast('Privacy policy is not included in this prototype.', {
                  tone: 'info',
                })
              }
              className="focus-ring rounded transition-colors hover:text-ink-2"
            >
              Privacy
            </button>
          </div>
        </div>
      </div>

      {/* ---------------- hero panel ---------------- */}
      <div className="relative hidden lg:block">
        <img
          src={media.authHero}
          alt="Contemporary home at dusk with a reflecting pool"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-ink/45 via-ink/10 to-transparent" />

        <figure className="absolute bottom-10 left-8 right-8 max-w-[340px] rounded-[14px] bg-surface/92 p-5 backdrop-blur-sm xl:left-14">
          <div className="flex items-center gap-2.5">
            <div className="flex">
              {socialProof.map((src, i) => (
                <img
                  key={src}
                  src={src}
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
