import { ArrowRight, CheckCircle2, Flame, Plus, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AddChoreModal } from '../components/AddChoreModal'
import { Avatar } from '../components/Avatar'
import { ChoreCard } from '../components/ChoreCard'
import type { CrewSnapshot, Member, NewChoreInput } from '../types/domain'
import { formatMoney, getOnTheWayTotal } from '../utils/money'
import styles from './views.module.scss'

interface HomeViewProps {
  snapshot: CrewSnapshot
  activeMember: Member
  onClaim: (choreId: string) => void
  onUnclaim: (choreId: string) => void
  onComplete: (choreId: string) => void
  onApprove: (choreId: string) => void
  onAddChore: (input: NewChoreInput) => void
}

export function HomeView({
  snapshot,
  activeMember,
  onClaim,
  onUnclaim,
  onComplete,
  onApprove,
  onAddChore,
}: HomeViewProps) {
  const [addingChore, setAddingChore] = useState(false)
  const isManager = activeMember.role === 'owner' || activeMember.role === 'manager'
  const available = snapshot.chores.filter((chore) => chore.status === 'available')
  const mine = snapshot.chores.filter(
    (chore) => chore.assigneeId === activeMember.id && chore.status === 'claimed',
  )
  const waiting = snapshot.chores.filter(
    (chore) => chore.assigneeId === activeMember.id && chore.status === 'review',
  )
  const review = snapshot.chores.filter((chore) => chore.status === 'review')
  const latestEarning = snapshot.ledger.find((entry) => entry.kind === 'earning')
  const latestEarner = snapshot.members.find((member) => member.id === latestEarning?.memberId)
  const balance = snapshot.balances[activeMember.id] ?? 0
  const onTheWay = getOnTheWayTotal(snapshot.chores, activeMember.id)
  const goal = snapshot.goals[activeMember.id]
  const progress = Math.min(100, Math.max(0, (balance / goal.targetCents) * 100))
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.greeting}>
          <p>{greeting},</p>
          <h1>{activeMember.name}!</h1>
          {activeMember.streak > 0 && (
            <span className={styles.streak}>
              <Flame size={16} fill="currentColor" /> {activeMember.streak} day rhythm
            </span>
          )}
        </div>

        <Link to="/earnings" className={styles.balanceCard}>
          <span>In your bank</span>
          <strong>{formatMoney(balance)}</strong>
          <small>{onTheWay > 0 ? `${formatMoney(onTheWay)} on the way` : 'Open your bank'} <ArrowRight size={14} /></small>
        </Link>
      </section>

      <section className={styles.goalCard}>
        <div className={styles.goalIcon}><Sparkles size={22} /></div>
        <div className={styles.goalBody}>
          <div>
            <span>Saving for</span>
            <strong>{goal.name}</strong>
          </div>
          <small>{formatMoney(Math.max(0, goal.targetCents - balance))} to go</small>
          <div className={styles.progressTrack} aria-label={`${Math.round(progress)}% saved`}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      {isManager && review.length > 0 && (
        <section className={styles.reviewSection}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>Ready for you</span>
              <h2>Give it a look</h2>
            </div>
            <span className={styles.count}>{review.length}</span>
          </div>
          <div className={styles.cardGrid}>
            {review.map((chore) => (
              <ChoreCard
                key={chore.id}
                chore={chore}
                mode="review"
                memberName={snapshot.members.find((member) => member.id === chore.assigneeId)?.name}
                onAction={() => onApprove(chore.id)}
              />
            ))}
          </div>
        </section>
      )}

      {(mine.length > 0 || waiting.length > 0) && (
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>Your lineup</span>
              <h2>Let’s make it happen</h2>
            </div>
          </div>
          <div className={styles.cardGrid}>
            {mine.map((chore) => (
              <ChoreCard
                key={chore.id}
                chore={chore}
                mode="mine"
                onAction={() => onComplete(chore.id)}
                onSecondaryAction={() => onUnclaim(chore.id)}
              />
            ))}
            {waiting.map((chore) => (
              <article className={styles.waitingCard} key={chore.id}>
                <CheckCircle2 size={23} />
                <div>
                  <strong>{chore.title}</strong>
                  <span>Waiting for a quick check</span>
                </div>
                <b>{formatMoney(chore.rewardCents)}</b>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>Up for grabs</span>
            <h2>Pick your next win</h2>
          </div>
          {isManager && (
            <button className={styles.addButton} onClick={() => setAddingChore(true)}>
              <Plus size={17} /> Add a job
            </button>
          )}
        </div>
        <div className={styles.cardGrid}>
          {available.map((chore) => (
            <ChoreCard key={chore.id} chore={chore} mode="available" onAction={() => onClaim(chore.id)} />
          ))}
          {available.length === 0 && <p className={styles.emptyLine}>Nothing is waiting right now. Nice work.</p>}
        </div>
      </section>

      <section className={styles.buzz}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>Crew buzz</span>
            <h2>Good work travels</h2>
          </div>
        </div>
        {latestEarning && latestEarner ? (
          <div className={styles.buzzItem}>
            <div className={styles.avatarStack}><Avatar member={latestEarner} size="small" /></div>
            <p><strong>{latestEarner.name}</strong> earned {formatMoney(latestEarning.amountCents)} for {latestEarning.description.toLowerCase()}.</p>
          </div>
        ) : (
          <p className={styles.emptyBuzz}>The first finished job will show up here.</p>
        )}
      </section>

      {addingChore && <AddChoreModal onClose={() => setAddingChore(false)} onAdd={onAddChore} />}
    </div>
  )
}
