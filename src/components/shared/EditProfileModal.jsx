import { useEffect, useState } from 'react'
import { Mail, Lock, User, Phone, Briefcase } from 'lucide-react'

import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Segmented from '@/components/ui/Segmented'
import { Field, PasswordField, FormMessage } from '@/components/auth/AuthForm'
import { useAuth } from '@/context/AuthContext'
import { updateProfileDetails } from '@/api/profiles'

const TABS = ['Details', 'Email', 'Password']
const MIN_PASSWORD = 6

/**
 * Edit Profile.
 *
 * Split into three tabs because the fields behave very differently, not for
 * decoration:
 *
 *   Details  — name (Firebase) plus phone and job title (Supabase). No
 *              re-authentication needed, so it saves in one step.
 *   Email    — changes only after the user confirms a link sent to the NEW
 *              address, so a typo cannot lock them out.
 *   Password — replaced outright.
 *
 * The last two require a recent login. Rather than dumping the user at the
 * sign-in screen and losing their edits, they confirm in place: a password for
 * email accounts, a provider popup for Google or Apple.
 */
export default function EditProfileModal({ open, onClose, profile, onSaved }) {
  const { user, authUser, updateDisplayName, updateEmailAddress, changePassword } =
    useAuth()

  const [tab, setTab] = useState('Details')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')

  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')

  /* Google and Apple accounts have no password to confirm with — they get a
     provider popup instead, so the field is hidden for them. */
  const isPasswordAccount = (user?.provider ?? 'password') === 'password'

  /* Re-seed from the live values each time the dialog opens, so a cancelled
     edit does not persist into the next one. */
  useEffect(() => {
    if (!open) return
    setTab('Details')
    setError(null)
    setNotice(null)
    setFullName(user?.name ?? '')
    setPhone(profile?.phone ?? '')
    setJobTitle(profile?.job_title ?? '')
    setNewEmail('')
    setNewPassword('')
    setConfirmPassword('')
    setCurrentPassword('')
  }, [open, user?.name, profile?.phone, profile?.job_title])

  const saveDetails = async () => {
    setBusy(true)
    setError(null)

    /* Name lives in Firebase, phone and title in Supabase. Only write what
       actually changed so a no-op save is not two network calls. */
    if (fullName && fullName !== user?.name) {
      const { error: nameError } = await updateDisplayName(fullName.trim())
      if (nameError) {
        setBusy(false)
        setError(nameError)
        return
      }
    }

    try {
      await updateProfileDetails(authUser?.uid, { phone, jobTitle })
    } catch (failure) {
      setBusy(false)
      setError(failure.message)
      return
    }

    setBusy(false)
    onSaved?.('Profile updated.')
    onClose?.()
  }

  const saveEmail = async () => {
    if (!newEmail.trim()) {
      setError('Enter the new email address.')
      return
    }
    setBusy(true)
    setError(null)

    const { error: failure } = await updateEmailAddress(
      newEmail.trim(),
      currentPassword,
    )
    setBusy(false)

    if (failure) {
      setError(failure)
      return
    }
    /* Deliberately not closing: the user needs to read what happens next. */
    setNotice(
      `Confirm the change from the link we sent to ${newEmail.trim()}. Your address stays as it is until you do.`,
    )
    setCurrentPassword('')
  }

  const savePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('The two passwords do not match.')
      return
    }
    if (newPassword.length < MIN_PASSWORD) {
      setError(`Passwords need to be at least ${MIN_PASSWORD} characters.`)
      return
    }

    setBusy(true)
    setError(null)

    const { error: failure } = await changePassword(newPassword, currentPassword)
    setBusy(false)

    if (failure) {
      setError(failure)
      return
    }
    onSaved?.('Password updated.')
    onClose?.()
  }

  const submit = (e) => {
    e.preventDefault()
    if (tab === 'Details') return saveDetails()
    if (tab === 'Email') return saveEmail()
    return savePassword()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Profile"
      description="Update your name, contact details or sign-in credentials."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            form="edit-profile-form"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <Segmented
        options={TABS}
        value={tab}
        onChange={(next) => {
          setTab(next)
          setError(null)
          setNotice(null)
        }}
        ariaLabel="Which profile details to edit"
        className="mb-5"
      />

      <form id="edit-profile-form" onSubmit={submit} className="space-y-4">
        <FormMessage>{error}</FormMessage>
        {notice ? <FormMessage tone="info">{notice}</FormMessage> : null}

        {tab === 'Details' ? (
          <>
            <Field
              label="Full Name"
              icon={User}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Manish Kumar"
              disabled={busy}
            />
            <Field
              label="Job Title"
              icon={Briefcase}
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Senior Project Manager"
              disabled={busy}
            />
            <Field
              label="Contact Number"
              icon={Phone}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              disabled={busy}
            />
          </>
        ) : null}

        {tab === 'Email' ? (
          <>
            <Field
              label="Current Email"
              icon={Mail}
              value={user?.email ?? ''}
              readOnly
              disabled
            />
            <Field
              label="New Email Address"
              icon={Mail}
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@company.com"
              required
              disabled={busy}
              hint="We’ll send a confirmation link there. Nothing changes until you click it."
            />
            {isPasswordAccount ? (
              <PasswordField
                label="Current Password"
                icon={Lock}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={busy}
                hint="Required to confirm a change to your sign-in address."
              />
            ) : (
              <p className="text-[12px] leading-relaxed text-ink-3">
                You’ll be asked to confirm with your sign-in provider.
              </p>
            )}
          </>
        ) : null}

        {tab === 'Password' ? (
          <>
            {isPasswordAccount ? (
              <PasswordField
                label="Current Password"
                icon={Lock}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={busy}
              />
            ) : (
              <p className="text-[12px] leading-relaxed text-ink-3">
                You’ll be asked to confirm with your sign-in provider first.
              </p>
            )}
            <PasswordField
              label="New Password"
              icon={Lock}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={MIN_PASSWORD}
              required
              disabled={busy}
              hint={`At least ${MIN_PASSWORD} characters.`}
            />
            <PasswordField
              label="Confirm New Password"
              icon={Lock}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={busy}
            />
          </>
        ) : null}
      </form>
    </Modal>
  )
}
