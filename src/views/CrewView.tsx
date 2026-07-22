import { Check, Copy, Flame, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '../components/Avatar'
import type { CrewSnapshot } from '../types/domain'
import { formatMoney, getBalance } from '../utils/money'
import styles from './views.module.scss'

export function CrewView({ snapshot }: { snapshot: CrewSnapshot }) {
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    await navigator.clipboard?.writeText(snapshot.crew.inviteCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>Your crew</span>
        <h1>{snapshot.crew.name}</h1>
        <p>Everyone has a part to play. Here’s how the crew is doing.</p>
      </header>

      <section className={styles.inviteCard}>
        <div className={styles.inviteIcon}><UserPlus size={24} /></div>
        <div>
          <span>Invite someone</span>
          <strong>{snapshot.crew.inviteCode}</strong>
        </div>
        <button onClick={copyCode}>
          {copied ? <Check size={17} /> : <Copy size={17} />}
          {copied ? 'Copied' : 'Copy code'}
        </button>
      </section>

      <section className={styles.membersSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>People</span>
            <h2>{snapshot.members.length} in the crew</h2>
          </div>
        </div>
        <div className={styles.memberGrid}>
          {snapshot.members.map((member) => {
            const completed = snapshot.ledger.filter(
              (entry) => entry.memberId === member.id && entry.kind === 'earning',
            ).length
            return (
              <article key={member.id} className={styles.memberCard}>
                <div className={styles.memberTop}>
                  <Avatar member={member} size="large" />
                  <span className={styles.role}>{member.role === 'owner' ? 'Owner' : 'Member'}</span>
                </div>
                <h3>{member.name}</h3>
                <div className={styles.memberStats}>
                  <span><Flame size={15} fill="currentColor" /> {member.streak} day rhythm</span>
                  <span>{completed} jobs logged</span>
                </div>
                <strong>{formatMoney(getBalance(snapshot.ledger, member.id))} earned</strong>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
