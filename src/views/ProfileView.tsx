import { Bell, ChevronRight, LockKeyhole, RotateCcw, Smartphone } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import type { CrewSnapshot, Member } from '../types/domain'
import styles from './views.module.scss'

export function ProfileView({
  snapshot,
  activeMember,
  onReset,
}: {
  snapshot: CrewSnapshot
  activeMember: Member
  onReset: () => void
}) {
  return (
    <div className={styles.page}>
      <header className={styles.profileHeader}>
        <Avatar member={activeMember} size="large" />
        <div>
          <span className={styles.eyebrow}>Your corner</span>
          <h1>{activeMember.name}</h1>
          <p>{snapshot.crew.name} · {activeMember.role === 'owner' ? 'Crew owner' : 'Crew member'}</p>
        </div>
      </header>

      <section className={styles.settingsList}>
        <button>
          <span className={styles.settingIcon}><Bell size={20} /></span>
          <span><strong>Reminders</strong><small>A gentle nudge when a job is due</small></span>
          <ChevronRight size={18} />
        </button>
        <button>
          <span className={styles.settingIcon}><LockKeyhole size={20} /></span>
          <span><strong>Profile & sign-in</strong><small>Account, PIN, and privacy</small></span>
          <ChevronRight size={18} />
        </button>
        <button>
          <span className={styles.settingIcon}><Smartphone size={20} /></span>
          <span><strong>Install Choreline</strong><small>Keep it handy on this device</small></span>
          <ChevronRight size={18} />
        </button>
      </section>

      <section className={styles.demoNote}>
        <div>
          <span>Demo controls</span>
          <p>Your actions are saved on this device. Reset anytime to replay the flow.</p>
        </div>
        <button onClick={onReset}><RotateCcw size={17} /> Reset demo</button>
      </section>
    </div>
  )
}
