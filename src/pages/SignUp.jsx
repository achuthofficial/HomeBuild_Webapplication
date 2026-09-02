import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User } from 'lucide-react'

import AuthShell from '@/components/auth/AuthShell'
import OAuthButtons from '@/components/auth/OAuthButtons'
import { Field, PasswordField, FormMessage, Divider } from '@/components/auth/AuthForm'
import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'

/** Supabase enforces 6 characters by default; state it before they submit. */
const MIN_PASSWORD = 6

export default function SignUp() {
  const { signUpWithPassword, signInWithOAuth } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)

    /* Checked here rather than only server-side so the mismatch is caught
       before a network round trip. */
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Passwords need to be at least ${MIN_PASSWORD} characters.`)
      return
    }

    setBusy(true)
    const { error: failure, needsConfirmation } = await signUpWithPassword(
      email,
      password,
      fullName.trim(),
    )

    if (failure) {
      setError(failure)
      setBusy(false)
      return
    }

    if (needsConfirmation) {
      /* Email confirmation is on: there is no session yet, so send them back
         to sign-in with an explanation rather than into a guarded route. */
      navigate('/sign-in', {
        replace: true,
        state: {
          notice: `Almost there — confirm your address from the email we sent to ${email}, then sign in.`,
        },
      })
      return
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up a workspace to manage sites, budgets and schedules."
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
      <div className="mt-6">
        <OAuthButtons onSignIn={signInWithOAuth} disabled={busy} />
      </div>

      <Divider>or sign up with email</Divider>

      <form onSubmit={submit} className="space-y-4">
        <FormMessage>{error}</FormMessage>

        <Field
          label="Full Name"
          icon={User}
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Manish Kumar"
          required
          disabled={busy}
        />

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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={MIN_PASSWORD}
          required
          disabled={busy}
          hint={`At least ${MIN_PASSWORD} characters.`}
        />

        <PasswordField
          label="Confirm Password"
          icon={Lock}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          disabled={busy}
        />

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create Account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-[12.5px] text-ink-2">
        Already have an account?{' '}
        <Link to="/sign-in" className="focus-ring rounded font-semibold text-brand-ink hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
