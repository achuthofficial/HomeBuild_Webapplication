import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'

import AuthShell from '@/components/auth/AuthShell'
import { PasswordField, FormMessage } from '@/components/auth/AuthForm'
import Button from '@/components/ui/Button'
import { useAuth, AUTH_STATUS } from '@/context/AuthContext'

const MIN_PASSWORD = 6

/**
 * Landing page for the emailed recovery link.
 *
 * Supabase exchanges the link's code for a real session before this renders,
 * which is why the route sits outside ProtectedRoute but still requires a
 * session: without one, the visitor typed the URL directly or the link has
 * already been used, and there is nothing to update.
 */
export default function ResetPassword() {
  const { updatePassword, status } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const hasRecoverySession =
    status === AUTH_STATUS.recovery || status === AUTH_STATUS.authed

  const submit = async (e) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Passwords need to be at least ${MIN_PASSWORD} characters.`)
      return
    }

    setBusy(true)
    const { error: failure } = await updatePassword(password)

    if (failure) {
      setError(failure)
      setBusy(false)
      return
    }
    navigate('/dashboard', { replace: true })
  }

  if (status === AUTH_STATUS.loading) {
    return (
      <AuthShell title="Checking your link…">
        <p className="mt-6 text-[13px] text-ink-2">One moment.</p>
      </AuthShell>
    )
  }

  if (!hasRecoverySession) {
    return (
      <AuthShell
        title="This link has expired"
        subtitle="Reset links are single-use and valid for one hour."
      >
        <div className="mt-6 space-y-4">
          <FormMessage>
            We couldn’t verify this reset link. Request a fresh one and use the
            most recent email.
          </FormMessage>
          <Button as={Link} to="/forgot-password" variant="primary" size="lg" className="w-full">
            Request a New Link
          </Button>
          <Button as={Link} to="/sign-in" variant="outline" size="lg" className="w-full">
            Back to Sign In
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose something you haven’t used on this account before."
    >
      <form onSubmit={submit} className="mt-6 space-y-4">
        <FormMessage>{error}</FormMessage>

        <PasswordField
          label="New Password"
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
          label="Confirm New Password"
          icon={Lock}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          disabled={busy}
        />

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Updating…' : 'Update Password'}
        </Button>
      </form>
    </AuthShell>
  )
}
