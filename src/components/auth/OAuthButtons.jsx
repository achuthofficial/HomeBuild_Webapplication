import { useState } from 'react'
import Button from '@/components/ui/Button'

/* lucide ships no brand marks, so the two logos are inlined. Google's is the
   official four-colour G; Apple's is a single path that takes currentColor so
   it inverts correctly in dark mode. */

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4 shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l2.99-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.16 6.65 3.58 9 3.58Z" />
    </svg>
  )
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.54c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.61-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.75-.78-2.87-.76-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.74 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.87.69 1.18-.02 1.93-1.08 2.65-2.14.83-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.51ZM14.88 5.6c.6-.74 1.01-1.76.9-2.78-.87.04-1.93.58-2.56 1.31-.56.65-1.06 1.7-.93 2.7.97.08 1.97-.49 2.59-1.23Z" />
    </svg>
  )
}

const providers = [
  { id: 'google', label: 'Google', Mark: GoogleMark },
  { id: 'apple', label: 'Apple', Mark: AppleMark },
]

/**
 * Google and Apple sign-in. A successful call navigates the browser away to
 * the provider, so the pending state is never cleared on the happy path —
 * only a failure brings us back here.
 */
export default function OAuthButtons({ onSignIn, disabled }) {
  const [pending, setPending] = useState(null)

  const start = async (id) => {
    setPending(id)
    const { error } = await onSignIn(id)
    if (error) setPending(null)
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {providers.map(({ id, label, Mark }) => (
        <Button
          key={id}
          variant="outline"
          size="lg"
          disabled={disabled || pending !== null}
          onClick={() => start(id)}
        >
          <Mark />
          {pending === id ? 'Redirecting…' : label}
        </Button>
      ))}
    </div>
  )
}
