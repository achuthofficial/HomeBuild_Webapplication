import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Mail, Lock } from 'lucide-react'

import AuthShell from '@/components/auth/AuthShell'
import OAuthButtons from '@/components/auth/OAuthButtons'
import { Field, PasswordField, FormMessage, Divider } from '@/components/auth/AuthForm'
import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { hasOAuthProviders } from '@/lib/firebase'

export default function SignIn() {
  const { signInWithPassword, signInWithOAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  /* Set by ProtectedRoute when it bounced an unauthenticated visitor, and by
     Sign Up after a confirmation email goes out. */
  const notice = location.state?.notice ?? null
  const from = location.state?.from?.pathname

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)

    const { error: failure } = await signInWithPassword(email, password)

    if (failure) {
      setError(failure)
      setBusy(false)
      return
    }
    /* Land back on whatever was originally requested, defaulting to the app. */
    navigate(from ?? '/dashboard', { replace: true })
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your construction projects and schedules."
      footer={
        <>
          <a
            href="mailto:support@homebuild.example"
            className="focus-ring rounded hover:text-ink-2"
          >
            Support
          </a>
          <Link to="/privacy" className="focus-ring rounded hover:text-ink-2">
            Privacy
          </Link>
        </>
      }
    >
      {/* Both vanish together when every OAuth provider is disabled — a
          lone "or continue with email" rule above nothing reads as a bug. */}
      {hasOAuthProviders ? (
        <>
          <div className="mt-6">
            <OAuthButtons onSignIn={signInWithOAuth} disabled={busy} />
          </div>
          <Divider>or continue with email</Divider>
        </>
      ) : (
        <div className="mt-6" />
      )}

      <form onSubmit={submit} className="space-y-4">
        {notice ? <FormMessage tone="info">{notice}</FormMessage> : null}
        <FormMessage>{error}</FormMessage>

        <Field
          label="Email Address"
          icon={Mail}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          required
          disabled={busy}
        />

        <PasswordField
          label="Password"
          icon={Lock}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={busy}
          action={
            <Link
              to="/forgot-password"
              className="focus-ring rounded text-[12px] font-medium text-brand-ink hover:underline"
            >
              Forgot Password?
            </Link>
          }
        />

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign In to Workspace'}
        </Button>
      </form>

      <p className="mt-6 text-center text-[12.5px] text-ink-2">
        Don’t have an account?{' '}
        <Link to="/sign-up" className="focus-ring rounded font-semibold text-brand-ink hover:underline">
          Create one
        </Link>
      </p>
    </AuthShell>
  )
}
