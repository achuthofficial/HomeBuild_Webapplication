import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import Logo from '@/components/layout/Logo'

/**
 * Public privacy note.
 *
 * Reachable without a session because the auth screens link to it — a
 * protected privacy policy is a redirect loop for the people most likely to
 * want it. Deliberately short and accurate about what this prototype does;
 * it is not a substitute for a reviewed policy before launch.
 */
export default function Privacy() {
  return (
    <div className="min-h-screen bg-canvas px-6 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <Link to="/sign-in" className="focus-ring flex w-fit items-center gap-2.5 rounded">
          <Logo size={30} />
          <span className="text-[17px] font-bold text-ink">HomeBuild</span>
        </Link>

        <h1 className="mt-8 text-[26px] font-bold tracking-[-0.01em] text-ink">
          Privacy
        </h1>
        <p className="mt-2 text-[13px] text-ink-3">
          What this application stores, and where.
        </p>

        <div className="card mt-6 space-y-5 p-6 text-[13px] leading-relaxed text-ink-2">
          <section>
            <h2 className="text-[15px] font-semibold text-ink">Accounts</h2>
            <p className="mt-1.5">
              Authentication is handled by Firebase Authentication, a Google
              service. Creating an account stores your email address and, if you
              sign in with Google or Apple, the name and profile picture that
              provider returns. Passwords are never stored by this application
              — Firebase holds a hash.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-ink">Sessions</h2>
            <p className="mt-1.5">
              A session token is kept in your browser’s local storage so you
              stay signed in across reloads. Signing out removes it. Clearing
              site data has the same effect.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-ink">Project data</h2>
            <p className="mt-1.5">
              Every project, invoice, schedule and alert in this build is
              fixture data compiled into the application. Nothing you see is
              stored on a server, and nothing you type into those screens is
              transmitted anywhere.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-ink">Contact</h2>
            <p className="mt-1.5">
              Questions about this notice can go to{' '}
              <a
                href="mailto:privacy@homebuild.example"
                className="focus-ring rounded font-medium text-brand-ink hover:underline"
              >
                privacy@homebuild.example
              </a>
              .
            </p>
          </section>
        </div>

        <Link
          to="/sign-in"
          className="focus-ring mt-6 flex w-fit items-center gap-1.5 rounded text-[12.5px] font-medium text-ink-2 hover:text-ink"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2} />
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}
