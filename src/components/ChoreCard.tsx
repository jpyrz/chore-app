import { Check, Clock3 } from 'lucide-react'
import type { Chore } from '../types/domain'
import { formatMoney } from '../utils/money'
import { CategoryIcon } from './CategoryIcon'
import styles from './shared.module.scss'

interface ChoreCardProps {
  chore: Chore
  mode: 'available' | 'mine' | 'review'
  memberName?: string
  onAction: () => void
}

export function ChoreCard({ chore, mode, memberName, onAction }: ChoreCardProps) {
  const actionLabel = mode === 'available' ? 'I’ll do it' : mode === 'mine' ? 'Mark finished' : 'Approve'

  return (
    <article className={`${styles.choreCard} ${mode === 'mine' ? styles.mine : ''}`}>
      <div className={styles.choreTopline}>
        <CategoryIcon category={chore.category} />
        <div className={styles.choreCopy}>
          <h3>{chore.title}</h3>
          <p>
            <Clock3 size={14} aria-hidden="true" />
            {mode === 'review' && memberName ? `${memberName} · ` : ''}
            {chore.timing}
          </p>
        </div>
        <strong className={styles.reward}>{formatMoney(chore.rewardCents)}</strong>
      </div>

      {chore.instructions && mode === 'mine' && (
        <p className={styles.instructions}>{chore.instructions}</p>
      )}

      <div className={styles.choreFooter}>
        <span>{chore.cadence}</span>
        <button className={mode === 'available' ? styles.secondaryAction : styles.primaryAction} onClick={onAction}>
          {mode !== 'available' && <Check size={16} aria-hidden="true" />}
          {actionLabel}
        </button>
      </div>
    </article>
  )
}
