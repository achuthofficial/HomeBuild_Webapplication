import { KeyRound } from 'lucide-react'
import { missingEnvVars } from '@/lib/supabase'

/**
 * Rendered instead of the auth screens when Supabase credentials are absent.
 *
 * Without this a fresh clone fails at the first click with an opaque network
 * error. Naming the missing variables turns that into a two-minute fix.
 */
export default function SetupRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16">
      <div className="card w-full max-w-lg p-8">
        <div className="mb-4 flex size-11 items-center justify-center rounded-[10px] bg-warning-bg">
          <KeyRound className="size-5 text-warning" />
        </div>

        <h1 className="text-xl font-semibold text-ink">Authentication not configured</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
          This build has no Supabase credentials, so sign-in is unavailable.
          {missingEnvVars.length ? ' Missing: ' : ''}
          {missingEnvVars.map((name, i) => (
            <span key={name}>
              {i > 0 ? ', ' : ''}
              <code className="rounded bg-subtle px-1.5 py-0.5 text-[12px] text-ink">
                {name}
              </code>
            </span>
          ))}
        </p>

        <ol className="mt-6 space-y-3 text-[13px] leading-relaxed text-ink-2">
          <li>
            <span className="font-semibold text-ink">1.</span> Copy{' '}
            <code className="rounded bg-subtle px-1.5 py-0.5 text-[12px] text-ink">
              .env.example
            </code>{' '}
            to{' '}
            <code className="rounded bg-subtle px-1.5 py-0.5 text-[12px] text-ink">
              .env.local
            </code>
            .
          </li>
          <li>
            <span className="font-semibold text-ink">2.</span> Fill in the project
            URL and anon key from your Supabase dashboard, under Project Settings
            → API.
          </li>
          <li>
            <span className="font-semibold text-ink">3.</span> Restart the dev
            server — Vite only reads env files at startup.
          </li>
        </ol>

        <p className="mt-6 border-t border-line pt-4 text-[12px] leading-relaxed text-ink-3">
          Deploying on Vercel? The same two variables need to be set in Project
          Settings → Environment Variables, then redeployed. See{' '}
          <code className="rounded bg-subtle px-1.5 py-0.5 text-[11.5px] text-ink">
            AUTH_SETUP.md
          </code>{' '}
          for the full provider configuration.
        </p>
      </div>
    </div>
  )
}
