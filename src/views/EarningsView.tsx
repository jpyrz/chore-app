import { ArrowDownLeft, ArrowUpRight, Target } from 'lucide-react'
import type { CrewSnapshot, Member } from '../types/domain'
import { formatMoney, getBalance } from '../utils/money'
import styles from './views.module.scss'

export function EarningsView({ snapshot, activeMember }: { snapshot: CrewSnapshot; activeMember: Member }) {
  const entries = snapshot.ledger.filter((entry) => entry.memberId === activeMember.id)
  const balance = getBalance(snapshot.ledger, activeMember.id)
  const lifetime = entries
    .filter((entry) => entry.kind === 'earning')
    .reduce((total, entry) => total + entry.amountCents, 0)
  const goal = snapshot.goals[activeMember.id]
  const progress = Math.min(100, Math.max(0, (balance / goal.targetCents) * 100))

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
      </section>

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
