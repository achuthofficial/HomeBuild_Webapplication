import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'

import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { FormMessage } from '@/components/auth/AuthForm'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { useQuery } from '@/hooks/useQuery'
import { listProjectFilters, updateProjectDetails } from '@/api/projects'
import { rupees, longDate } from '@/lib/format'

const field =
  'focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-ink-4 disabled:opacity-60'

/* Same vocabularies as the create dialog — they match the CHECK constraints. */
const FACINGS = ['North', 'South', 'East', 'West']
const FLOORS = [
  { value: 'G', label: 'Ground only' },
  { value: 'G+1', label: 'G+1' },
  { value: 'G+2', label: 'G+2' },
  { value: 'G+3', label: 'G+3' },
]
const BHK = [1, 2, 3, 4]

function Label({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="eyebrow mb-1.5 block">
      {children}
    </label>
  )
}

/**
 * Edit Project — the descriptive fields only.
 *
 * Budget and the two dates are shown but LOCKED, and the panel says why. They
 * are not merely "not implemented": the six escrow milestones, the six cost
 * categories and the eleven schedule phases were all costed and due-dated from
 * them when the project was created, so changing one here would leave those
 * figures derived from a number that no longer exists. Showing them greyed
 * with a reason beats hiding them and leaving the PM hunting for a control
 * that is deliberately absent.
 *
 * The project manager and customer links are absent for a different reason —
 * they decide access, not presentation. See the note on updateProjectDetails.
 */
export default function EditProjectModal({ open, project, onClose, onSaved }) {
  const { toast } = useToast()
  const { authUser } = useAuth()

  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  /* Cities offered as a datalist, same as the create dialog, so the field
     still accepts a new market. */
  const filters = useQuery(() => listProjectFilters(), [], { enabled: open })
  const cities = (filters.data?.city ?? []).slice(1)

  /* Re-seed every time the dialog opens, and whenever it opens onto a
     different project — a cancelled edit must not leak into the next one. */
  useEffect(() => {
    if (!open || !project) return
    setError(null)
    setForm({
      name: project.name ?? '',
      client: project.client === '—' ? '' : (project.client ?? ''),
      city: project.city ?? '',
      plotAddress: project.plotAddress ?? '',
      plotLat: project.plotLat ?? '',
      plotLng: project.plotLng ?? '',
      plotFacing: project.plotFacing ?? 'East',
      totalFloors: project.totalFloors ?? 'G+1',
      bhkPerFloor: project.bhkPerFloor ?? 2,
    })
  }, [open, project])

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const updated = await updateProjectDetails(project.id, form, authUser?.uid)
      setBusy(false)
      /* null means nothing actually changed, so say that rather than
         claiming a save that did not happen. */
      toast(updated ? `“${updated.name}” updated.` : 'No changes to save.')
      onClose?.()
      if (updated) onSaved?.(updated)
    } catch (failure) {
      setBusy(false)
      setError(failure.message)
    }
  }

  if (!form) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Project"
      description="Change the project's details. Budget and dates are fixed."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            form="edit-project-form"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <form id="edit-project-form" onSubmit={submit} className="space-y-5">
        <FormMessage>{error}</FormMessage>

        <section className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Project
          </p>

          <div>
            <Label htmlFor="ep-name">Project Name</Label>
            <input
              id="ep-name"
              value={form.name}
              onChange={set('name')}
              className={field}
              required
              disabled={busy}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ep-client">Client Name</Label>
              <input
                id="ep-client"
                value={form.client}
                onChange={set('client')}
                placeholder="e.g. Rajesh Sharma"
                className={field}
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="ep-city">City</Label>
              <input
                id="ep-city"
                list="ep-city-options"
                value={form.city}
                onChange={set('city')}
                placeholder="Bengaluru"
                className={field}
                disabled={busy}
              />
              <datalist id="ep-city-options">
                {cities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-line pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Plot
          </p>

          <div>
            <Label htmlFor="ep-address">Plot Address</Label>
            <input
              id="ep-address"
              value={form.plotAddress}
              onChange={set('plotAddress')}
              placeholder="Survey no., street, city, PIN"
              className={field}
              disabled={busy}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ep-lat">Latitude</Label>
              <input
                id="ep-lat"
                type="number"
                step="0.000001"
                min="-90"
                max="90"
                value={form.plotLat}
                onChange={set('plotLat')}
                placeholder="12.976750"
                className={`${field} tnum`}
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="ep-lng">Longitude</Label>
              <input
                id="ep-lng"
                type="number"
                step="0.000001"
                min="-180"
                max="180"
                value={form.plotLng}
                onChange={set('plotLng')}
                placeholder="77.575210"
                className={`${field} tnum`}
                disabled={busy}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="ep-facing">Facing</Label>
              <select
                id="ep-facing"
                value={form.plotFacing}
                onChange={set('plotFacing')}
                className={field}
                disabled={busy}
              >
                {FACINGS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="ep-floors">Total Floors</Label>
              <select
                id="ep-floors"
                value={form.totalFloors}
                onChange={set('totalFloors')}
                className={field}
                disabled={busy}
              >
                {FLOORS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="ep-bhk">BHK per Floor</Label>
              <select
                id="ep-bhk"
                value={form.bhkPerFloor}
                onChange={set('bhkPerFloor')}
                className={field}
                disabled={busy}
              >
                {BHK.map((b) => (
                  <option key={b} value={b}>
                    {b} BHK
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Shown, not hidden: a PM looking for the budget field should find it
            and find out why it is fixed, rather than conclude the screen is
            incomplete. */}
        <section className="space-y-3 border-t border-line pt-5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            <Lock className="size-3" strokeWidth={2} />
            Fixed after creation
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[8px] border border-line bg-canvas px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.05em] text-ink-4">
                Total Budget
              </p>
              <p className="tnum mt-0.5 text-[13px] font-semibold text-ink-2">
                {project.budgetTotal ? rupees(project.budgetTotal) : '—'}
              </p>
            </div>
            <div className="rounded-[8px] border border-line bg-canvas px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.05em] text-ink-4">
                Start Date
              </p>
              <p className="mt-0.5 text-[13px] font-semibold text-ink-2">
                {project.startDate ? longDate(project.startDate) : '—'}
              </p>
            </div>
            <div className="rounded-[8px] border border-line bg-canvas px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.05em] text-ink-4">
                Expected Completion
              </p>
              <p className="mt-0.5 text-[13px] font-semibold text-ink-2">
                {project.estimate ? longDate(project.estimate) : '—'}
              </p>
            </div>
          </div>

          <p className="text-[11.5px] leading-relaxed text-ink-3">
            The escrow milestones, cost categories and schedule phases were all
            costed and due-dated from these when the project was created.
            Changing one here would leave those figures derived from a number
            that no longer exists.
          </p>
        </section>
      </form>
    </Modal>
  )
}
