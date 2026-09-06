import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { FormMessage } from '@/components/auth/AuthForm'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { useQuery } from '@/hooks/useQuery'
import { listProjectFilters, createProject } from '@/api/projects'
import { listProfilesByRole } from '@/api/profiles'
import { lakh } from '@/lib/format'

const field =
  'focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-ink-4 disabled:opacity-60'

/** PRD 8.1 vocabularies — these match the CHECK constraints on the table. */
const FACINGS = ['North', 'South', 'East', 'West']

/** The lifecycle states a project can legitimately be created in. */
const CREATE_STATUSES = [
  { value: 'lead', label: 'Lead' },
  { value: 'in_design', label: 'In Design' },
  { value: 'active', label: 'Active' },
]
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
 * Create New Project.
 *
 * Collects the PRD 8.1 field set rather than just a name and a budget: plot
 * dimensions, facing, floors and BHK are what the Design module will need to
 * generate anything, and asking for them at creation avoids a second pass.
 *
 * On save the project also gets the PRD 5.4.2 phase template, so its Gantt is
 * populated immediately instead of being an empty chart.
 */
export default function CreateProjectModal({ open, onClose, onCreated }) {
  const { toast } = useToast()
  const { authUser } = useAuth()

  const [form, setForm] = useState({
    name: '',
    client: '',
    customerUid: '',
    managerUid: '',
    status: 'lead',
    city: 'Bengaluru',
    plotAddress: '',
    plotLat: '',
    plotLng: '',
    plotLengthFt: '',
    plotWidthFt: '',
    plotFacing: 'East',
    totalFloors: 'G+1',
    bhkPerFloor: 2,
    budget: '',
    startDate: '',
    expectedCompletion: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  /* Cities come from projects already in the database rather than a fixed
     list, so the dropdown reflects where work actually is. */
  const filters = useQuery(() => listProjectFilters(), [], { enabled: open })
  const cities = (filters.data?.city ?? []).slice(1)

  /* PRD 8.1 models Customer and Project Manager as links to profiles, not
     free text, so both are pickers over the directory. */
  const customers = useQuery(() => listProfilesByRole('customer'), [], {
    enabled: open,
  })
  const managers = useQuery(() => listProfilesByRole('project_manager'), [], {
    enabled: open,
  })

  const reset = () =>
    setForm({
      name: '',
      client: '',
      customerUid: '',
      managerUid: authUser?.uid ?? '',
      status: 'lead',
      city: cities[0] ?? 'Bengaluru',
      plotAddress: '',
      plotLat: '',
      plotLng: '',
      plotLengthFt: '',
      plotWidthFt: '',
      plotFacing: 'East',
      totalFloors: 'G+1',
      bhkPerFloor: 2,
      budget: '',
      startDate: '',
      expectedCompletion: '',
    })

  const submit = async (e) => {
    e.preventDefault()
    setError(null)

    /* Caught here rather than by a CHECK constraint, so the message names the
       fields instead of quoting a constraint. */
    if (
      form.startDate &&
      form.expectedCompletion &&
      form.expectedCompletion < form.startDate
    ) {
      setError('Expected completion cannot be before the start date.')
      return
    }

    setBusy(true)
    try {
      const project = await createProject({
        ...form,
        /* Fall back to the creator when no PM is chosen, so a project is
           never left unowned. */
        managerUid: form.managerUid || authUser?.uid || null,
      })
      setBusy(false)
      toast(`“${project.name}” created with its default schedule.`)
      reset()
      onClose?.()
      onCreated?.(project)
    } catch (failure) {
      setBusy(false)
      setError(failure.message)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Project"
      description="Initialise the site plan, budget and schedule."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            form="create-project-form"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Creating…' : 'Create Project'}
          </Button>
        </>
      }
    >
      <form id="create-project-form" onSubmit={submit} className="space-y-5">
        <FormMessage>{error}</FormMessage>

        <section className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Project
          </p>

          <div>
            <Label htmlFor="cp-name">Project Name</Label>
            <input
              id="cp-name"
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. Sharma Residence"
              className={field}
              required
              disabled={busy}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cp-client">Client Name</Label>
              <input
                id="cp-client"
                value={form.client}
                onChange={set('client')}
                placeholder="e.g. Rajesh Sharma"
                className={field}
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="cp-customer">Customer Account</Label>
              <select
                id="cp-customer"
                value={form.customerUid}
                onChange={set('customerUid')}
                className={field}
                disabled={busy}
              >
                <option value="">Not linked yet</option>
                {(customers.data ?? []).map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {c.name}
                  </option>
                ))}
              </select>
              {/* PRD 8.1 models Customer as a link to the homeowner's profile.
                  The name above is the display label; this is the account the
                  project actually belongs to. */}
              <p className="mt-1.5 text-[11.5px] text-ink-3">
                Links the project to a homeowner’s account.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cp-manager">Project Manager</Label>
              <select
                id="cp-manager"
                value={form.managerUid}
                onChange={set('managerUid')}
                className={field}
                disabled={busy}
              >
                <option value="">Assign me</option>
                {(managers.data ?? []).map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="cp-status">Lifecycle Stage</Label>
              <select
                id="cp-status"
                value={form.status}
                onChange={set('status')}
                className={field}
                disabled={busy}
              >
                {CREATE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <Label htmlFor="cp-city">City</Label>
              <input
                id="cp-city"
                list="cp-city-options"
                value={form.city}
                onChange={set('city')}
                placeholder="Bengaluru"
                className={field}
                disabled={busy}
              />
              {/* A datalist rather than a select: a new city must be typeable,
                  or the first project in a new market cannot be created. */}
              <datalist id="cp-city-options">
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
            <Label htmlFor="cp-address">Plot Address</Label>
            <input
              id="cp-address"
              value={form.plotAddress}
              onChange={set('plotAddress')}
              placeholder="Survey no., street, city, PIN"
              className={field}
              disabled={busy}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cp-lat">Latitude</Label>
              <input
                id="cp-lat"
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
              <Label htmlFor="cp-lng">Longitude</Label>
              <input
                id="cp-lng"
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
          {/* PRD 8.1: geo-location for site navigation. Optional — a plot
              often has an address before it has coordinates. */}
          <p className="-mt-1 text-[11.5px] text-ink-3">
            Optional. Used for site navigation once surveyed.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="cp-length">Length (ft)</Label>
              <input
                id="cp-length"
                type="number"
                min="1"
                value={form.plotLengthFt}
                onChange={set('plotLengthFt')}
                placeholder="60"
                className={`${field} tnum`}
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="cp-width">Width (ft)</Label>
              <input
                id="cp-width"
                type="number"
                min="1"
                value={form.plotWidthFt}
                onChange={set('plotWidthFt')}
                placeholder="40"
                className={`${field} tnum`}
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="cp-facing">Facing</Label>
              <select
                id="cp-facing"
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cp-floors">Total Floors</Label>
              <select
                id="cp-floors"
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
              <Label htmlFor="cp-bhk">BHK per Floor</Label>
              <select
                id="cp-bhk"
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

        <section className="space-y-4 border-t border-line pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Budget &amp; Timeline
          </p>

          <div>
            <Label htmlFor="cp-budget">Total Budget (₹)</Label>
            <input
              id="cp-budget"
              type="number"
              min="0"
              step="1000"
              value={form.budget}
              onChange={set('budget')}
              placeholder="12450000"
              className={`${field} tnum`}
              disabled={busy}
            />
            {/* Stored in rupees to avoid rounding drift between screens, but
                the PRD and the business both talk in lakhs — so show both
                rather than making the PM convert in their head. */}
            <p className="mt-1.5 text-[11.5px] text-ink-3">
              In rupees
              {form.budget && Number(form.budget) > 0
                ? ` — ${lakh(form.budget)} (${(Number(form.budget) / 100000).toFixed(2)} lakh)`
                : ''}
              . The default phase schedule is costed from this figure.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cp-start">Start Date</Label>
              <input
                id="cp-start"
                type="date"
                value={form.startDate}
                onChange={set('startDate')}
                className={field}
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="cp-end">Expected Completion</Label>
              <input
                id="cp-end"
                type="date"
                value={form.expectedCompletion}
                onChange={set('expectedCompletion')}
                className={field}
                disabled={busy}
              />
            </div>
          </div>
        </section>
      </form>
    </Modal>
  )
}
