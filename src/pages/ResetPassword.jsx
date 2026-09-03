import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'

import AuthShell from '@/components/auth/AuthShell'
import { PasswordField, FormMessage } from '@/components/auth/AuthForm'
import Button from '@/components/ui/Button'
import { auth, isFirebaseConfigured } from '@/lib/firebase'

/** Firebase's own minimum. Kept in step with the sign-up form. */
const MIN_PASSWORD = 6

/**
 * Landing page for the emailed reset link.
 *
 * Firebase resets are stateless: the link carries a one-time `oobCode` and no
 * session is ever created. The code is verified on mount — which both proves
 * the link is live and tells us whose account it belongs to, so the form can
 * name the address being changed — and redeemed on submit.
 *
 * Because there is no session involved, this works in any browser, not only
 * the one that requested the reset.
 */
export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const oobCode = params.get('oobCode')

  /* checking -> ready | invalid | offline */
  const [state, setState] = useState('checking')
  const [accountEmail, setAccountEmail] = useState(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    if (!oobCode) {
      setState('invalid')
      return
    }

    let cancelled = false
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        if (cancelled) return
        setAccountEmail(email)
        setState('ready')
      })
      .catch((failure) => {
        if (cancelled) return
        /* Do not tell someone their link is dead when the real problem is
           that we could not reach Firebase to ask. */
        setState(
          failure.code === 'auth/network-request-failed' ? 'offline' : 'invalid',
        )
      })

    return () => {
      cancelled = true
    }
  }, [oobCode])

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
    try {
      await confirmPasswordReset(auth, oobCode, password)
    } catch (failure) {
      setError(
        failure.code === 'auth/expired-action-code' ||
          failure.code === 'auth/invalid-action-code'
          ? 'This link expired while the form was open. Request a fresh one.'
          : failure.code === 'auth/weak-password'
            ? `Passwords need to be at least ${MIN_PASSWORD} characters.`
            : 'Could not update the password. Try again.',
      )
      setBusy(false)
      return
    }

    /* Redeeming the code does NOT sign the user in — Firebase leaves them
       signed out deliberately, so send them to sign in with the new password. */
    navigate('/sign-in', {
      replace: true,
      state: { notice: 'Password updated. Sign in with your new password.' },
    })
  }

  if (state === 'checking') {
    return (
      <AuthShell title="Checking your link…">
        <div
          className="mt-8 flex items-center gap-3 text-[13px] text-ink-2"
          role="status"
          aria-live="polite"
        >
          <span className="size-4 animate-spin rounded-full border-2 border-line border-t-brand-600" />
          One moment.
        </div>
      </AuthShell>
    )
  }

  if (state === 'offline') {
    return (
      <AuthShell
        title="Can’t reach the server"
        subtitle="Your reset link is probably fine — we just couldn’t verify it."
      >
        <div className="mt-6 space-y-4">
          <FormMessage>
            Could not reach the authentication server. Check your connection,
            then reload this page — the link in your email is still valid.
          </FormMessage>
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      </AuthShell>
    )
  }

  if (state === 'invalid') {
    return (
      <AuthShell
        title="This link has expired"
        subtitle="Reset links are single-use and valid for a limited time."
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
      subtitle={
        accountEmail
          ? `Choose a new password for ${accountEmail}.`
          : 'Choose something you haven’t used on this account before.'
      }
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
