import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera,
  Check,
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
import Avatar from '@/components/ui/Avatar'
import Chip from '@/components/ui/Chip'
import Modal from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useToast } from '@/context/ToastContext'
import EditProfileModal from '@/components/shared/EditProfileModal'
import QueryBoundary, { RowSkeleton } from '@/components/ui/QueryBoundary'
import { useQuery } from '@/hooks/useQuery'
import { getProfile, getProfileStats } from '@/api/profiles'
import {
  listTeamMembers,
  createInvitation,
  revokeInvitation,
} from '@/api/invitations'
import { listActivity } from '@/api/activity'
import { longDate } from '@/lib/format'
import { FormMessage } from '@/components/auth/AuthForm'
import { uploadAvatar } from '@/lib/storage'
import { isStorageConfigured } from '@/lib/supabaseStorage'

const themes = [
  { id: 'light', label: 'Light Mode', icon: Sun },
  { id: 'dark', label: 'Dark Mode', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
]

/**
 * Team member status.
 *
 * ACTIVE  — invited, and has since signed up with that address.
 * PENDING — invited, invitation still live.
 * EXPIRED — invited, the seven-day window closed before they signed up.
 */
const MEMBER_STATUS_TONES = {
  ACTIVE: 'info',
  PENDING: 'warning',
  EXPIRED: 'neutral',
}

const languages = [
  'English (United States)',
  'हिन्दी (Hindi)',
  'తెలుగు (Telugu)',
  'தமிழ் (Tamil)',
  'ಕನ್ನಡ (Kannada)',
]

export default function SettingsPage() {
  const { user, authUser, signOut, resendVerification, refreshUser, setAvatarUrl } =
    useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const { theme, resolvedTheme, systemDark, setTheme } = useTheme()
  const [language, setLanguage] = useState(languages[0])
  const [verifying, setVerifying] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  /* Declared here, above the queries that gate on them — a query using a
     flag declared further down hits the temporal dead zone at render. */
  const [inviteOpen, setInviteOpen] = useState(false)
  const [memberMenu, setMemberMenu] = useState(null)
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [invite, setInvite] = useState({ email: '', role: 'project_manager' })

  /* Role, phone and job title live in Supabase — Firebase has nowhere to put
     them — so the profile card reads from both sources. */
  const profileQuery = useQuery(
    () => getProfile(authUser?.uid),
    [authUser?.uid],
    { enabled: Boolean(authUser?.uid) },
  )

  const stats = useQuery(
    () => getProfileStats(authUser?.uid),
    [authUser?.uid],
    { enabled: Boolean(authUser?.uid) },
  )
  /* Everyone this account has invited, and whether they have signed up yet.
     Not the profiles directory: nobody belongs on this list until they were
     invited here. */
  const teamQuery = useQuery(
    () => listTeamMembers(authUser?.uid),
    [authUser?.uid],
    { enabled: Boolean(authUser?.uid) },
  )
  const profile = profileQuery.data

  /* `id` is null for an invitee who has not signed up, which disables this —
     there is no account whose activity could be looked up. */
  const memberActivity = useQuery(
    () => listActivity({ actorUid: memberMenu.id, limit: 10 }),
    [memberMenu?.id],
    { enabled: Boolean(memberMenu?.id) },
  )

  const sendInvite = async (e) => {
    e.preventDefault()
    setInviteError(null)
    setInviting(true)

    try {
      await createInvitation({
        email: invite.email,
        role: invite.role,
        invitedBy: authUser?.uid,
      })
      setInviting(false)
      setInvite({ email: '', role: 'project_manager' })
      setInviteOpen(false)
      toast(`Invitation recorded for ${invite.email}.`)
      /* They join the list immediately, as a pending member — the invite is
         what puts them on the team, not their eventual sign-up. */
      teamQuery.refetch()
    } catch (error) {
      setInviting(false)
      setInviteError(error.message)
    }
  }

  /* Revoking withdraws the invitation, which is what removes someone from
     this list — listTeamMembers only counts pending and accepted ones. */
  const revoke = async (member) => {
    try {
      await revokeInvitation(member.inviteId)
      setMemberMenu(null)
      toast(`Invitation for ${member.email} revoked.`)
      teamQuery.refetch()
    } catch (error) {
      toast(error.message, { tone: 'info' })
    }
  }
  const avatarInput = useRef(null)

  /**
   * Replace the profile photo.
   *
   * The file goes to Supabase Storage, then the resulting public URL is written
   * back to the Firebase profile — that is what makes it survive a reload and
   * appear in the topbar, since there is no user table of our own to hold it.
   */
  const onAvatarPicked = async (event) => {
    const file = event.target.files?.[0]
    /* Let the same file be re-picked after a failure. */
    event.target.value = ''
    if (!file) return

    setUploadingAvatar(true)
    const { data, error } = await uploadAvatar(file, authUser?.uid)

    if (error) {
      setUploadingAvatar(false)
      toast(error, { tone: 'info' })
      return
    }

    const { error: profileError } = await setAvatarUrl(data.url)
    setUploadingAvatar(false)

    toast(
      profileError
        ? `Uploaded, but the profile could not be updated: ${profileError}`
        : 'Profile photo updated.',
      { tone: profileError ? 'info' : 'success' },
    )
  }

  /* Briefly enable colour transitions so a theme switch cross-fades instead of
     snapping. The class is removed afterwards so ordinary interactions (hover,
     route changes) are not slowed by a global transition rule. */
  const applyTheme = (next) => {
    if (next === theme) return
    const body = document.body
    body.classList.add('theme-transition')
    setTheme(next)
    window.setTimeout(() => body.classList.remove('theme-transition'), 260)
    toast(
      next === 'system'
        ? 'Theme now follows your device setting.'
        : `${next === 'dark' ? 'Dark' : 'Light'} mode enabled.`,
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* ---------------- profile column ---------------- */}
      <div className="space-y-4">
        <Card className="p-6 text-center">
          <div className="relative mx-auto w-fit">
            <Avatar user={user} size={104} />
            <input
              ref={avatarInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={onAvatarPicked}
              className="sr-only"
              tabIndex={-1}
            />
            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => {
                /* Without storage configured this stays the prototype's
                   no-op, so the app is still usable with no Supabase project. */
                if (!isStorageConfigured) {
                  toast(
                    'File storage is not configured for this build. See STORAGE_SETUP.md.',
                    { tone: 'info' },
                  )
                  return
                }
                avatarInput.current?.click()
              }}
              aria-label="Change profile photo"
              className="focus-ring absolute bottom-1 right-1 flex size-7 items-center justify-center rounded-full bg-brand-600 text-on-brand ring-2 ring-surface transition hover:bg-brand-700 disabled:opacity-60"
            >
              {uploadingAvatar ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <Camera className="size-3.5" strokeWidth={2} />
              )}
            </button>
          </div>

          <h1 className="mt-4 text-[17px] font-bold text-ink">{user.name}</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            {profile?.job_title ?? user.role}
          </p>

          <Button
            variant="outline"
            icon={Pencil}
            className="mt-5 w-full"
            onClick={() => setEditOpen(true)}
          >
            Edit Profile
          </Button>

          <Button
            variant="danger"
            className="mt-2 w-full"
            onClick={async () => {
              await signOut()
              navigate('/sign-in', { replace: true })
            }}
          >
            Log Out
          </Button>
        </Card>

        {/* Counted from the database. These were fixture numbers (12 and 04)
            shown under the signed-in user's own name. */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-[11px] text-ink-3">Active Projects</p>
            <p className="tnum mt-2 text-[24px] font-bold leading-none text-brand-ink">
              {stats.isLoading ? '—' : (stats.data?.activeProjects ?? 0)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] text-ink-3">Teams Led</p>
            <p className="tnum mt-2 text-[24px] font-bold leading-none text-success">
              {stats.isLoading ? '—' : (stats.data?.teamsLed ?? 0)}
            </p>
          </Card>
        </div>
      </div>

      {/* ---------------- settings column ---------------- */}
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-brand-ink" strokeWidth={2} />
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

              {/* Firebase signs users in before they verify, so the state has
                  to be visible and actionable rather than silently pending. */}
              {user.emailVerified ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-success">
                  <Check className="size-3.5" strokeWidth={2.5} />
                  Verified
                </p>
              ) : (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[11.5px] font-medium text-warning">
                    Not verified
                  </span>
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={async () => {
                      setVerifying(true)
                      const { error } = await resendVerification()
                      setVerifying(false)
                      toast(
                        error ?? 'Verification email sent. Check your inbox.',
                        { tone: error ? 'info' : 'success' },
                      )
                    }}
                    className="focus-ring rounded text-[11.5px] font-semibold text-brand-ink hover:underline disabled:opacity-50"
                  >
                    {verifying ? 'Sending…' : 'Resend email'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await refreshUser()
                      toast('Status refreshed.', { tone: 'info' })
                    }}
                    className="focus-ring rounded text-[11.5px] font-medium text-ink-3 hover:text-ink-2"
                  >
                    Already done?
                  </button>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="set-phone" className="eyebrow mb-1.5 block">
                Contact Number
              </label>
              <input
                id="set-phone"
                readOnly
                value={profile?.phone ?? '—'}
                className="focus-ring tnum h-9 w-full rounded-[8px] border border-line bg-canvas px-3 text-[13px] text-ink-2"
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-brand-ink" strokeWidth={2} />
              <h2 className="text-[15px] font-semibold text-ink">
                Team Management
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="focus-ring rounded-[8px] border border-brand-ink px-3 py-1.5 text-[12px] font-semibold text-brand-ink transition-colors hover:bg-brand-50"
            >
              Invite Member
            </button>
          </div>

          <div className="mt-4">
          <QueryBoundary
            isLoading={teamQuery.isLoading}
            error={teamQuery.error}
            data={teamQuery.data}
            onRetry={teamQuery.refetch}
            emptyTitle="No team members yet"
            emptyBody="Invite a colleague and they'll appear here — nobody is added to your team without an invitation."
            skeleton={<RowSkeleton rows={2} />}
          >
          <ul className="space-y-2.5">
            {(teamQuery.data ?? []).map((member) => (
              <li
                key={member.inviteId}
                className="flex items-center gap-3 rounded-[10px] border border-line bg-canvas px-3.5 py-3"
              >
                <Avatar user={member} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">
                    {member.name}
                  </p>
                  <p className="truncate text-[11.5px] text-ink-3">
                    {/* Someone who has not signed up has no job title yet, and
                        their address is the only thing that identifies them —
                        which is already the name above, so don't repeat it. */}
                    {member.joined ? member.role : `Invited as ${member.role}`}
                  </p>
                </div>
                <Chip tone={MEMBER_STATUS_TONES[member.status] ?? 'neutral'}>
                  {member.status}
                </Chip>
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
          </QueryBoundary>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal
              className="size-4 text-brand-ink"
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
                /* The picker lists the PRD's eleven target languages, but
                   translating the interface is out of scope for this build —
                   see CLAUDE.md. It used to claim success on every change
                   ("Interface language set to Hindi") while the screen stayed
                   in English, which reads as a bug rather than a stated gap. */
                setLanguage(e.target.value)
                if (e.target.value !== languages[0]) {
                  toast(
                    `${e.target.value.replace(/\s*\(.*\)/, '')} isn't available in this build yet — the interface stays in English.`,
                    { tone: 'info' },
                  )
                }
              }}
              className="focus-ring h-9 w-full max-w-xs rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
            >
              {languages.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            {language !== languages[0] ? (
              <p className="mt-1.5 text-[11.5px] text-ink-3">
                Shown in English until this language ships.
              </p>
            ) : null}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="eyebrow">Display Theme</p>
              <p className="text-[11px] text-ink-3">
                {theme === 'system'
                  ? `Following your device — currently ${systemDark ? 'dark' : 'light'}`
                  : `Locked to ${resolvedTheme}`}
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label="Display theme"
              className="grid max-w-lg grid-cols-3 gap-3"
            >
              {themes.map((option) => {
                const Icon = option.icon
                const active = theme === option.id
                const isDark = option.id === 'dark'
                const isSystem = option.id === 'system'

                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => applyTheme(option.id)}
                    className={cn(
                      'focus-ring relative flex flex-col items-center justify-center gap-2 rounded-[10px] border-2 px-3 py-6 transition-colors',
                      isDark && 'bg-dark-surface text-white',
                      isSystem && 'bg-sys-surface text-ink-2',
                      !isDark && !isSystem && 'bg-surface text-ink',
                      active
                        ? 'border-brand-ink'
                        : 'border-transparent hover:border-line-strong',
                    )}
                  >
                    {active ? (
                      <Check
                        className="absolute right-2 top-2 size-3.5 text-brand-ink"
                        strokeWidth={2.5}
                      />
                    ) : null}
                    <Icon
                      className={cn(
                        'size-5',
                        !isDark && !isSystem && 'text-warning',
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

            <p className="mt-3 max-w-lg text-[11.5px] leading-relaxed text-ink-3">
              The mockups are light-only, so the dark palette is an authored
              counterpart rather than a sampled one — it preserves the light
              palette&rsquo;s relationships instead of its hex values.
            </p>
          </div>
        </Card>
      </div>

      {/* ---------------- invite dialog ---------------- */}
      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        onSaved={(message) => {
          toast(message)
          profileQuery.refetch()
        }}
      />

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
              form="invite-form"
              type="submit"
              disabled={inviting}
            >
              {inviting ? 'Creating…' : 'Send Invite'}
            </Button>
          </>
        }
      >
        <form id="invite-form" onSubmit={sendInvite} className="space-y-4">
          <FormMessage>{inviteError}</FormMessage>

          <div>
            <label htmlFor="inv-email" className="eyebrow mb-1.5 block">
              Email Address
            </label>
            <input
              id="inv-email"
              type="email"
              value={invite.email}
              onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))}
              placeholder="name@company.com"
              required
              disabled={inviting}
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-ink-4"
            />
          </div>

          <div>
            <label htmlFor="inv-role" className="eyebrow mb-1.5 block">
              Role
            </label>
            <select
              id="inv-role"
              value={invite.role}
              onChange={(e) => setInvite((v) => ({ ...v, role: e.target.value }))}
              disabled={inviting}
              className="focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink"
            >
              {/* The three PRD section 4 personas — these match the CHECK
                  constraint on the column. */}
              <option value="project_manager">Project Manager</option>
              <option value="site_supervisor">Site Supervisor</option>
              <option value="customer">Customer</option>
            </select>
          </div>

          {/* Honest about the limit rather than implying an email went out. */}
          <p className="rounded-[8px] border border-line bg-subtle/60 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-2">
            The invitation is recorded and expires in 7 days. Email delivery
            needs a mail provider that is not configured in this build, so
            share the link manually for now.
          </p>

          {/* Pending invitations used to be listed again down here. They are
              the Team Management list now — a pending invite IS a team member
              who has not signed up yet — so showing them twice, with two
              separate revoke buttons, only invited the question of whether
              they were the same thing. */}
        </form>
      </Modal>

      <Modal
        open={!!memberMenu}
        onClose={() => setMemberMenu(null)}
        title={memberMenu?.name ?? ''}
        description={memberMenu?.email ?? ''}
        size="sm"
      >
        <div className="space-y-3">
          {/* Two different people, so two different sheets. Someone who has
              signed up has a history worth reading; someone who has only been
              invited has nothing behind them yet, and the useful action is
              withdrawing the invitation. */}
          {memberMenu?.joined ? (
            <QueryBoundary
              isLoading={memberActivity.isLoading}
              error={memberActivity.error}
              data={memberActivity.data}
              onRetry={memberActivity.refetch}
              emptyTitle="No recorded activity"
              emptyBody="Changes this person makes will be listed here."
              skeleton={<RowSkeleton rows={2} />}
            >
              <div>
                <p className="eyebrow mb-2">Recent activity</p>
                <ol className="space-y-2">
                  {(memberActivity.data ?? []).slice(0, 6).map((entry) => (
                    <li key={entry.id} className="text-[12.5px] leading-snug text-ink-2">
                      {entry.summary}
                      <span className="ml-1 text-ink-4">· {longDate(entry.at)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </QueryBoundary>
          ) : (
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              {memberMenu?.status === 'EXPIRED'
                ? `This invitation expired before ${memberMenu.email} signed up. Revoke it and send a fresh one.`
                : `Invited as ${memberMenu?.role}. They join once they create an account with this address.`}
            </p>
          )}

          {/* Revoking is what removes someone from the team, so it is the one
              action here — and it only exists for an invitation that has not
              been taken up. Someone who already has an account keeps it; that
              is a deactivation, which needs the admin role below. */}
          {memberMenu && !memberMenu.joined ? (
            <div className="border-t border-line pt-3">
              <button
                type="button"
                onClick={() => revoke(memberMenu)}
                className="focus-ring block w-full rounded-[8px] px-3 py-2.5 text-left text-[13px] font-semibold text-danger transition-colors hover:bg-danger-bg/50"
              >
                Revoke invitation
              </button>
            </div>
          ) : (
            /* Role changes are absent rather than faked: the security policy
               lets a user modify only their own profile, so editing someone
               else's needs an admin role this app does not have yet. Saying so
               beats a button that always fails. */
            <p className="border-t border-line pt-3 text-[11.5px] leading-relaxed text-ink-3">
              Changing another member’s role or deactivating them needs an
              administrator role, which isn’t part of the permission model yet.
              Each person sets their own role from their profile.
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
