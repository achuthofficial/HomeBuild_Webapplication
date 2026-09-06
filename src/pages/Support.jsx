import { BookOpen, Copy, LifeBuoy, Mail, Phone } from 'lucide-react'

import PageHeader from '@/components/layout/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useTranslation } from '@/context/LanguageContext'

/**
 * Where support actually goes.
 *
 * Read from the environment so a deployment can point these at its own desk
 * without a code change; the defaults are HomeBuild's. `mailto:` and `tel:`
 * hand off to the device — no support widget to embed and nothing to keep
 * running — so every button on this page does what it says even though the
 * app has no ticketing backend of its own.
 */
const env = import.meta.env ?? {}
const SUPPORT = {
  email: env.VITE_SUPPORT_EMAIL || 'support@homebuild.in',
  phone: env.VITE_SUPPORT_PHONE || '+91 80 4718 2200',
  docs:
    env.VITE_SUPPORT_DOCS_URL ||
    'https://github.com/achuthofficial/HomeBuild_Webapplication#readme',
}

/** `tel:` wants no spaces or punctuation beyond a leading +. */
const dialable = (phone) => phone.replace(/[^\d+]/g, '')

const channels = [
  {
    id: 'docs',
    icon: BookOpen,
    title: 'Documentation',
    body: 'How each module works — Projects, Construction, Finance and Schedule — plus the setup guides for Firebase and Supabase.',
    action: 'Open the docs',
    href: SUPPORT.docs,
    external: true,
  },
  {
    id: 'email',
    icon: Mail,
    title: 'Email support',
    body: 'Weekdays 09:00–19:00 IST. Attach a screenshot and name the project — it usually saves a round trip.',
    action: SUPPORT.email,
    href: `mailto:${SUPPORT.email}`,
  },
  {
    id: 'phone',
    icon: Phone,
    title: 'Site escalation',
    body: 'For blocked sites and safety incidents that need a same-day response. Any hour.',
    action: SUPPORT.phone,
    href: `tel:${dialable(SUPPORT.phone)}`,
  },
]

/**
 * The sidebar links to Support from every screen and no mockup covers it, so
 * this is deliberately plain: three real ways to reach a person, and the
 * account details they will ask for first.
 */
export default function Support() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const { t } = useTranslation()

  /* What a support agent needs to find the account and reproduce the report.
     The build id makes a stale cached bundle obvious straight away. */
  const reference = [
    ['Signed in as', profile?.email ?? 'Not signed in'],
    ['Account id', profile?.id ?? '—'],
    ['Build', __APP_VERSION__],
  ]

  const copyReference = async () => {
    const text = reference.map(([label, value]) => `${label}: ${value}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast('Account details copied — paste them into your message.', {
        tone: 'success',
      })
    } catch {
      /* Clipboard access is denied outside a secure context, and on iOS unless
         the gesture is trusted. The details are on screen either way. */
      toast('Could not reach the clipboard. The details are listed above.', {
        tone: 'info',
      })
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={t('page.support.eyebrow')}
        title={t('page.support.title')}
        subtitle={t('page.support.subtitle')}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {channels.map((channel) => {
          const Icon = channel.icon
          return (
            <Card key={channel.id} className="flex flex-col p-5">
              <span className="flex size-8 items-center justify-center rounded-[8px] bg-brand-50 text-brand-ink">
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <h2 className="mt-4 text-[15px] font-semibold text-ink">
                {channel.title}
              </h2>
              <p className="mt-1.5 grow text-[12.5px] leading-relaxed text-ink-2">
                {channel.body}
              </p>
              <a
                href={channel.href}
                {...(channel.external
                  ? { target: '_blank', rel: 'noreferrer' }
                  : null)}
                className="focus-ring mt-4 self-start rounded text-[12px] font-semibold text-brand-ink hover:underline"
              >
                {channel.action}
              </a>
            </Card>
          )
        })}
      </div>

      <Card className="mt-4 p-5">
        <div className="flex items-start gap-3">
          <LifeBuoy className="mt-px size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
          <div className="min-w-0 grow">
            <h2 className="text-[15px] font-semibold text-ink">
              Include these details
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
              Support can look up your projects from the account id below. Add
              the screen you were on and roughly when it happened, and the first
              reply is usually an answer rather than a question.
            </p>

            <dl className="mt-4 grid gap-x-8 gap-y-2 text-[12.5px] sm:grid-cols-[auto_1fr]">
              {reference.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ink-3">{label}</dt>
                  <dd className="truncate font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <Button variant="outline" size="sm" icon={Copy} onClick={copyReference}>
            Copy
          </Button>
        </div>
      </Card>
    </>
  )
}
