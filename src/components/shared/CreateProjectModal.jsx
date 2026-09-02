import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { projectFilters } from '@/data/projects'

const field =
  'focus-ring h-9 w-full rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-ink-4'

/**
 * "Create New Project" dialog. Nothing is persisted — submitting raises a
 * toast so the primary action in the topbar has a visible outcome.
 */
export default function CreateProjectModal({ open, onClose }) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [city, setCity] = useState('Bengaluru')
  const [budget, setBudget] = useState('')

  const reset = () => {
    setName('')
    setClient('')
    setCity('Bengaluru')
    setBudget('')
  }

  const submit = (e) => {
    e.preventDefault()
    toast(`“${name || 'Untitled Project'}” initialised. Assign a manager to begin.`)
    reset()
    onClose?.()
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
          <Button variant="primary" form="create-project-form" type="submit">
            Create Project
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
              {projectFilters.city.slice(1).map((c) => (
                <option key={c}>{c}</option>
              ))}
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
