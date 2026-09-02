import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera,
  Monitor,
  Moon,
  MoreVertical,
  Pencil,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Users,
} from 'lucide-react'

import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import Modal from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { teamMembers } from '@/data/user'

const themes = [
  { id: 'light', label: 'Light Mode', icon: Sun },
  { id: 'dark', label: 'Dark Mode', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
]

const languages = [
  'English (United States)',
  'हिन्दी (Hindi)',
  'తెలుగు (Telugu)',
  'தமிழ் (Tamil)',
  'ಕನ್ನಡ (Kannada)',
]

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [theme, setTheme] = useState('light')
  const [language, setLanguage] = useState(languages[0])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [memberMenu, setMemberMenu] = useState(null)

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* ---------------- profile column ---------------- */}
      <div className="space-y-4">
        <Card className="p-6 text-center">
          <div className="relative mx-auto w-fit">
            <img
              src={user.avatar}
              alt={user.name}
              className="size-[104px] rounded-full object-cover"
            />
            <button
              type="button"
              onClick={() =>
                toast('Photo upload is not wired up in this prototype.', {
                  tone: 'info',
                })
              }
              aria-label="Change profile photo"
              className="focus-ring absolute bottom-1 right-1 flex size-7 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-surface transition hover:bg-brand-700"
            >
              <Camera className="size-3.5" strokeWidth={2} />
            </button>
          </div>

          <h1 className="mt-4 text-[17px] font-bold text-ink">{user.name}</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-3">{user.role}</p>

          <Button
            variant="outline"
            icon={Pencil}
            className="mt-5 w-full"
            onClick={() =>
              toast('Profile editing is not available in this prototype.', {
                tone: 'info',
              })
            }
          >
            Edit Profile
          </Button>

          <Button
            variant="danger"
            className="mt-2 w-full"
            onClick={() => {
              signOut()
              navigate('/sign-in', { replace: true })
            }}
          >
            Log Out
          </Button>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-[11px] text-ink-3">Active Projects</p>
            <p className="tnum mt-2 text-[24px] font-bold leading-none text-brand-600">
              {user.activeProjects}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] text-ink-3">Teams Led</p>
            <p className="tnum mt-2 text-[24px] font-bold leading-none text-success">
              {user.teamsLed}
            </p>
          </Card>
        </div>
      </div>

      {/* ---------------- settings column ---------------- */}
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-brand-600" strokeWidth={2} />
            <h2 className="text-[15px] font-semibold text-ink">
              Account & Security
            </h2>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="set-email" className="eyebrow mb-1.5 block">
                Email Address
              </label>
              <input
                id="set-email"
                readOnly
                value={user.email}
                className="focus-ring h-9 w-full rounded-[8px] border border-line bg-canvas px-3 text-[13px] text-ink-2"
              />
            </div>
            <div>
              <label htmlFor="set-phone" className="eyebrow mb-1.5 block">
                Contact Number
              </label>
              <input
                id="set-phone"
                readOnly
                value={user.phone}
                className="focus-ring tnum h-9 w-full rounded-[8px] border border-line bg-canvas px-3 text-[13px] text-ink-2"
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-brand-600" strokeWidth={2} />
              <h2 className="text-[15px] font-semibold text-ink">
                Team Management
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="focus-ring rounded-[8px] border border-brand-600 px-3 py-1.5 text-[12px] font-semibold text-brand-600 transition-colors hover:bg-brand-50"
            >
              Invite Member
            </button>
          </div>

          <ul className="mt-4 space-y-2.5">
            {teamMembers.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-3 rounded-[10px] border border-line bg-canvas px-3.5 py-3"
              >
                <img
                  src={member.avatar}
                  alt=""
                  className="size-9 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">
                    {member.name}
                  </p>
                  <p className="truncate text-[11.5px] text-ink-3">
                    {member.role}
                  </p>
                </div>
                <Chip tone="info">{member.status}</Chip>
                <button
                  type="button"
                  onClick={() => setMemberMenu(member)}
                  aria-label={`Actions for ${member.name}`}
                  className="focus-ring rounded-[6px] p-1.5 text-ink-4 transition-colors hover:bg-subtle hover:text-ink-2"
                >
                  <MoreVertical className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal
              className="size-4 text-brand-600"
              strokeWidth={2}
            />
            <h2 className="text-[15px] font-semibold text-ink">
              System Preferences
            </h2>
          </div>

          <div className="mt-4">
            <label htmlFor="set-lang" className="eyebrow mb-1.5 block">
              Language
            </label>
            <select
              id="set-lang"
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value)
                toast(`Interface language set to ${e.target.value}.`)
              }}
              className="focus-ring h-9 w-full max-w-xs rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
            >
              {languages.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className="mt-5">
            <p className="eyebrow mb-2">Display Theme</p>
            <div className="grid max-w-lg grid-cols-3 gap-3">
              {themes.map((option) => {
                const Icon = option.icon
                const active = theme === option.id
                const dark = option.id === 'dark'
                const system = option.id === 'system'

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setTheme(option.id)
                      if (option.id !== 'light') {
                        toast(
                          'Only Light Mode is implemented — every mockup is light-only.',
                          { tone: 'info' },
                        )
                      }
                    }}
                    aria-pressed={active}
                    className={cn(
                      'focus-ring flex flex-col items-center justify-center gap-2 rounded-[10px] border-2 px-3 py-6 transition-colors',
                      dark && 'bg-dark-surface text-white',
                      system && 'bg-sys-surface text-ink-2',
                      !dark && !system && 'bg-surface text-ink',
                      active
                        ? 'border-brand-600'
                        : 'border-transparent hover:border-line-strong',
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-5',
                        !dark && !system && 'text-warning',
                      )}
                      strokeWidth={1.75}
                    />
                    <span className="text-[12.5px] font-semibold">
                      {option.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* ---------------- invite dialog ---------------- */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite Member"
        description="Send a workspace invitation by email."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setInviteOpen(false)
                toast('Invitation sent.')
              }}
            >
              Send Invite
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="inv-email" className="eyebrow mb-1.5 block">
              Email Address
            </label>
            <input
              id="inv-email"
              type="email"
              placeholder="name@company.com"
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] placeholder:text-ink-4"
            />
          </div>
          <div>
            <label htmlFor="inv-role" className="eyebrow mb-1.5 block">
              Role
            </label>
            <select
              id="inv-role"
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px]"
            >
              {[
                'Project Manager',
                'Site Supervisor',
                'Architect',
                'Customer',
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!memberMenu}
        onClose={() => setMemberMenu(null)}
        title={memberMenu?.name ?? ''}
        description={memberMenu?.role ?? ''}
        size="sm"
      >
        <div className="space-y-1">
          {['Change Role', 'Reset Password', 'Deactivate Member'].map(
            (action) => (
              <button
                key={action}
                type="button"
                onClick={() => {
                  setMemberMenu(null)
                  toast(`${action} — not wired up in this prototype.`, {
                    tone: 'info',
                  })
                }}
                className={cn(
                  'focus-ring block w-full rounded-[8px] px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-subtle',
                  action.startsWith('Deactivate')
                    ? 'text-danger hover:bg-danger-bg/50'
                    : 'text-ink-2 hover:text-ink',
                )}
              >
                {action}
              </button>
            ),
          )}
        </div>
      </Modal>
    </div>
  )
}
