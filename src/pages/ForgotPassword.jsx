import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft } from 'lucide-react'

import AuthShell from '@/components/auth/AuthShell'
import { Field, FormMessage } from '@/components/auth/AuthForm'
import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()

  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)

    const { error: failure } = await requestPasswordReset(email)
    setBusy(false)

    if (failure) {
      setError(failure)
      return
    }
    setSent(true)
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle={
        sent
          ? undefined
          : 'Enter the email on your account and we’ll send a link to set a new password.'
      }
      footer={
        <a
          href="mailto:support@homebuild.example"
          className="focus-ring rounded hover:text-ink-2"
        >
          Support
        </a>
      }
    >
      {sent ? (
        <div className="mt-6 space-y-4">
          <FormMessage tone="info">
            If an account exists for {email}, a reset link is on its way. The
            link expires in one hour and can only be used once.
          </FormMessage>
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            Nothing arrived? Check spam, then{' '}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="focus-ring rounded font-semibold text-brand-ink hover:underline"
            >
              try a different address
            </button>
            .
          </p>
          <Button as={Link} to="/sign-in" variant="outline" size="lg" className="w-full">
            Back to Sign In
          </Button>
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="mt-6 space-y-4">
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

            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              {busy ? 'Sending…' : 'Send Reset Link'}
            </Button>
          </form>

          <Link
            to="/sign-in"
            className="focus-ring mt-6 flex items-center justify-center gap-1.5 rounded text-[12.5px] font-medium text-ink-2 hover:text-ink"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Back to Sign In
          </Link>
        </>
      )}
    </AuthShell>
  )
}
