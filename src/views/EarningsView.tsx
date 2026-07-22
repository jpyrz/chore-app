import { ArrowDownLeft, ArrowUpRight, Pencil, Target, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { CrewSnapshot, Member } from '../types/domain'
import { formatMoney, getBalance } from '../utils/money'
import styles from './views.module.scss'

export function EarningsView({
  snapshot,
  activeMember,
  onUpdateGoal,
}: {
  snapshot: CrewSnapshot
  activeMember: Member
  onUpdateGoal: (input: { name: string; targetCents: number }) => Promise<unknown>
}) {
  const entries = snapshot.ledger.filter((entry) => entry.memberId === activeMember.id)
  const balance = getBalance(snapshot.ledger, activeMember.id)
  const lifetime = entries
    .filter((entry) => entry.kind === 'earning')
    .reduce((total, entry) => total + entry.amountCents, 0)
  const goal = snapshot.goals[activeMember.id]
  const progress = Math.min(100, Math.max(0, (balance / goal.targetCents) * 100))
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalName, setGoalName] = useState(goal.name)
  const [goalAmount, setGoalAmount] = useState((goal.targetCents / 100).toFixed(2))

  const saveGoal = async (event: FormEvent) => {
    event.preventDefault()
    const targetCents = Math.round(Number(goalAmount) * 100)
    if (!goalName.trim() || !Number.isFinite(targetCents) || targetCents <= 0) return
    await onUpdateGoal({ name: goalName.trim(), targetCents })
    setEditingGoal(false)
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>Your money</span>
        <h1>Every job adds up.</h1>
        <p>A clear record of what you’ve earned and what’s been paid.</p>
      </header>

      <section className={styles.earningsHero}>
        <div>
          <span>Ready to be paid</span>
          <strong>{formatMoney(balance)}</strong>
        </div>
        <div>
          <span>All-time earned</span>
          <strong>{formatMoney(lifetime)}</strong>
        </div>
      </section>

      <section className={styles.savingsCard}>
        <div className={styles.targetIcon}><Target size={24} /></div>
        <div>
          <span>Saving for</span>
          <h2>{goal.name}</h2>
          <div className={styles.progressTrack}><span style={{ width: `${progress}%` }} /></div>
          <p><strong>{formatMoney(balance)}</strong> of {formatMoney(goal.targetCents)}</p>
        </div>
        <button className={styles.editGoalButton} onClick={() => setEditingGoal(true)} aria-label="Edit savings goal"><Pencil size={16} /></button>
      </section>

      {editingGoal && (
        <div className={styles.inlineModalBackdrop} role="presentation" onMouseDown={() => setEditingGoal(false)}>
          <section className={styles.inlineModal} role="dialog" aria-modal="true" aria-labelledby="goal-heading" onMouseDown={(event) => event.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setEditingGoal(false)} aria-label="Close"><X size={18} /></button>
            <span className={styles.modalIcon}><Target size={22} /></span>
            <h2 id="goal-heading">Set a savings goal</h2>
            <p>Give the work a purpose worth looking forward to.</p>
            <form onSubmit={saveGoal}>
              <label>Saving for<input value={goalName} onChange={(event) => setGoalName(event.target.value)} required autoFocus /></label>
              <label>Goal amount<input value={goalAmount} onChange={(event) => setGoalAmount(event.target.value)} inputMode="decimal" required /></label>
              <button>Save goal</button>
            </form>
          </section>
        </div>
      )}

      <section className={styles.ledgerSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>History</span>
            <h2>Recent activity</h2>
          </div>
        </div>
        <div className={styles.ledgerList}>
          {entries.map((entry) => (
            <article key={entry.id}>
              <span className={entry.kind === 'earning' ? styles.earnedIcon : styles.paidIcon}>
                {entry.kind === 'earning' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
              </span>
              <div>
                <strong>{entry.description}</strong>
                <small>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(entry.createdAt))}</small>
              </div>
              <b className={entry.amountCents > 0 ? styles.positive : ''}>
                {entry.amountCents > 0 ? '+' : ''}{formatMoney(entry.amountCents)}
              </b>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
