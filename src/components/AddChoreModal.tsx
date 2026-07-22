import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { ChoreCategory, NewChoreInput } from '../types/domain'
import styles from './AddChoreModal.module.scss'

interface AddChoreModalProps {
  onClose: () => void
  onAdd: (input: NewChoreInput) => void
}

export function AddChoreModal({ onClose, onAdd }: AddChoreModalProps) {
  const [title, setTitle] = useState('')
  const [reward, setReward] = useState('2.00')
  const [category, setCategory] = useState<ChoreCategory>('tidy')
  const [cadence, setCadence] = useState('One time')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const rewardCents = Math.round(Number(reward) * 100)
    if (!title.trim() || !Number.isFinite(rewardCents) || rewardCents <= 0) return
    onAdd({
      title: title.trim(),
      rewardCents,
      category,
      cadence,
      timing: 'Anytime today',
    })
    onClose()
  }

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-job-heading"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>New opportunity</span>
            <h2 id="add-job-heading">Add a job</h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            What needs doing?
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Wash the car" autoFocus />
          </label>
          <div className={styles.twoColumns}>
            <label>
              Reward
              <span className={styles.moneyInput}>
                <span>$</span>
                <input inputMode="decimal" value={reward} onChange={(event) => setReward(event.target.value)} />
              </span>
            </label>
            <label>
              Repeats
              <select value={cadence} onChange={(event) => setCadence(event.target.value)}>
                <option>One time</option>
                <option>Daily</option>
                <option>Weekdays</option>
                <option>Weekly</option>
              </select>
            </label>
          </div>
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value as ChoreCategory)}>
              <option value="tidy">Tidying</option>
              <option value="kitchen">Kitchen</option>
              <option value="outside">Outside</option>
              <option value="pets">Pets</option>
              <option value="laundry">Laundry</option>
              <option value="other">Other</option>
            </select>
          </label>
          <button type="submit" className={styles.submit}>Add to the line</button>
        </form>
      </section>
    </div>
  )
}
