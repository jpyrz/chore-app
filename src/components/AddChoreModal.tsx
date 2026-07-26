import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { ChoreCategory, Member, NewChoreInput } from '../types/domain'
import styles from './AddChoreModal.module.scss'

interface AddChoreModalProps {
  members: Member[]
  onClose: () => void
  onAdd: (input: NewChoreInput) => void
}

type ClaimWindowChoice = '24' | '72' | '168' | 'none' | 'custom'

export function AddChoreModal({ members, onClose, onAdd }: AddChoreModalProps) {
  const [title, setTitle] = useState('')
  const [reward, setReward] = useState('2.00')
  const [category, setCategory] = useState<ChoreCategory>('tidy')
  const [cadence, setCadence] = useState('One time')
  const [instructions, setInstructions] = useState('')
  const [assignedMemberId, setAssignedMemberId] = useState('')
  const [claimWindow, setClaimWindow] = useState<ClaimWindowChoice>('24')
  const [customWindow, setCustomWindow] = useState('2')
  const [customUnit, setCustomUnit] = useState<'hours' | 'days'>('days')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const rewardCents = Math.round(Number(reward) * 100)
    const customHours = Math.round(Number(customWindow) * (customUnit === 'days' ? 24 : 1))
    const claimWindowHours = assignedMemberId
      ? null
      : claimWindow === 'none'
        ? null
        : claimWindow === 'custom'
          ? customHours
          : Number(claimWindow)

    if (
      !title.trim()
      || !Number.isFinite(rewardCents)
      || rewardCents <= 0
      || (claimWindowHours !== null && (!Number.isFinite(claimWindowHours) || claimWindowHours < 1 || claimWindowHours > 8760))
    ) return

    onAdd({
      title: title.trim(),
      rewardCents,
      category,
      cadence,
      timing: 'Anytime today',
      assignedMemberId: assignedMemberId || undefined,
      claimWindowHours,
      instructions: instructions.trim() || undefined,
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
          <label>
            Who can do this?
            <select value={assignedMemberId} onChange={(event) => setAssignedMemberId(event.target.value)}>
              <option value="">Anyone in the crew</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </label>
          {assignedMemberId ? (
            <p className={styles.fieldHint}>
              This job will go straight into their lineup and stay there until it’s finished.
            </p>
          ) : (
            <>
              <label>
                Time to finish after claiming
                <select
                  value={claimWindow}
                  onChange={(event) => setClaimWindow(event.target.value as ClaimWindowChoice)}
                >
                  <option value="24">24 hours</option>
                  <option value="72">3 days</option>
                  <option value="168">1 week</option>
                  <option value="none">No time limit</option>
                  <option value="custom">Custom…</option>
                </select>
              </label>
              {claimWindow === 'custom' && (
                <div className={styles.customWindow}>
                  <label>
                    Amount
                    <input
                      inputMode="numeric"
                      min="1"
                      value={customWindow}
                      onChange={(event) => setCustomWindow(event.target.value)}
                    />
                  </label>
                  <label>
                    Unit
                    <select value={customUnit} onChange={(event) => setCustomUnit(event.target.value as 'hours' | 'days')}>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                  </label>
                </div>
              )}
            </>
          )}
          <label>
            Helpful details <small>Optional</small>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Put clean towels in the hall closet…"
              maxLength={500}
            />
          </label>
          <button type="submit" className={styles.submit}>Add to the line</button>
        </form>
      </section>
    </div>
  )
}
