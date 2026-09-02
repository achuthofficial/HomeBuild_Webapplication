import { BookOpen, LifeBuoy, MessageSquare, Phone } from 'lucide-react'

import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/ui/Card'
import { useToast } from '@/context/ToastContext'

const channels = [
  {
    id: 'docs',
    icon: BookOpen,
    title: 'Documentation',
    body: 'Module guides for Blueprint, Construction, Finance and Schedule.',
    action: 'Browse docs',
  },
  {
    id: 'chat',
    icon: MessageSquare,
    title: 'Live Chat',
    body: 'Weekdays 09:00–19:00 IST. Median first response under 6 minutes.',
    action: 'Start a chat',
  },
  {
    id: 'phone',
    icon: Phone,
    title: 'Site Escalation',
    body: 'For blocked sites and safety incidents that need a same-day response.',
    action: 'Call the escalation desk',
  },
]

/**
 * The sidebar links to Support on every screen, but no mockup exists for it.
 * This is a deliberately plain placeholder so the link is never a dead end.
 */
export default function Support() {
  const { toast } = useToast()

  return (
    <>
      <PageHeader
        eyebrow="Help"
        title="Support"
        subtitle="No mockup was provided for this screen — this is a placeholder so the sidebar link resolves."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {channels.map((channel) => {
          const Icon = channel.icon
          return (
            <Card key={channel.id} className="p-5">
              <span className="flex size-8 items-center justify-center rounded-[8px] bg-brand-50 text-brand-600">
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <h2 className="mt-4 text-[15px] font-semibold text-ink">
                {channel.title}
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
                {channel.body}
              </p>
              <button
                type="button"
                onClick={() =>
                  toast(`${channel.action} — not wired up in this prototype.`, {
                    tone: 'info',
                  })
                }
                className="focus-ring mt-4 rounded text-[12px] font-semibold text-brand-600 hover:underline"
              >
                {channel.action}
              </button>
            </Card>
          )
        })}
      </div>

      <Card className="mt-4 flex items-start gap-3 p-5">
        <LifeBuoy className="mt-px size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          This build is a static UI prototype. Every figure on every screen is
          fixture data from the mockups — nothing is persisted, and no request
          leaves the browser.
        </p>
      </Card>
    </>
  )
}
