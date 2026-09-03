import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { useQuery } from '@/hooks/useQuery'
import { listProjectFilters, createProject } from '@/api/projects'
import { useAuth } from '@/context/AuthContext'

const field =
  'focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-ink-4'

/**
 * "Create New Project" dialog. Nothing is persisted — submitting raises a
 * toast so the primary action in the topbar has a visible outcome.
 */
export default function CreateProjectModal({ open, onClose, onCreated }) {
  const { toast } = useToast()
  const { authUser } = useAuth()
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [city, setCity] = useState('Bengaluru')
  const [budget, setBudget] = useState('')
  const [busy, setBusy] = useState(false)

  /* Cities come from the projects already in the database rather than a
     hard-coded list, so the dropdown reflects where work actually is. */
  const filters = useQuery(() => listProjectFilters(), [], { enabled: open })
  const cities = (filters.data?.city ?? ['All Locations']).slice(1)

  const reset = () => {
    setName('')
    setClient('')
    setCity('Bengaluru')
    setBudget('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)

    try {
      await createProject({
        name,
        client,
        city,
        budget,
        managerUid: authUser?.uid ?? null,
      })
    } catch (error) {
      setBusy(false)
      toast(error.message, { tone: 'info' })
      return
    }

    setBusy(false)
    toast(`“${name}” created. Assign a manager to begin.`)
    reset()
    onClose?.()
    /* Let the portfolio refresh rather than waiting for a reload. */
    onCreated?.()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Project"
      description="Initialize site plan, budget, and assign your management team."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
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
      <form id="create-project-form" onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="cp-name" className="eyebrow mb-1.5 block">
            Project Name
          </label>
          <input
            id="cp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sky Villa 42"
            className={field}
            required
          />
        </div>

        <div>
          <label htmlFor="cp-client" className="eyebrow mb-1.5 block">
            Client
          </label>
          <input
            id="cp-client"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="e.g. Global Ventures Inc."
            className={field}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cp-city" className="eyebrow mb-1.5 block">
              City
            </label>
            <select
              id="cp-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={field}
            >
              {cities.length ? (
                cities.map((c) => <option key={c}>{c}</option>)
              ) : (
                <option>Bengaluru</option>
              )}
            </select>
          </div>

          <div>
            <label htmlFor="cp-budget" className="eyebrow mb-1.5 block">
              Budget (₹)
            </label>
            <input
              id="cp-budget"
              type="number"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="12450000"
              className={`${field} tnum`}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}
