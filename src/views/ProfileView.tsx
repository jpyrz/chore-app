import { Home, LockKeyhole, LogOut, Mail, Plus, Smartphone, UsersRound, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import type { CrewMembershipSummary, CrewSnapshot, Member } from '../types/domain'
import styles from './views.module.scss'

export function ProfileView({
  snapshot,
  activeMember,
  email,
  memberships,
  onCreateCrew,
  onJoinCrew,
  membershipPending,
  membershipError,
  onSignOut,
}: {
  snapshot: CrewSnapshot
  activeMember: Member
  email: string
  memberships: CrewMembershipSummary[]
  onCreateCrew: (name: string) => Promise<unknown>
  onJoinCrew: (inviteCode: string) => Promise<unknown>
  membershipPending: boolean
  membershipError?: string
  onSignOut: () => Promise<void>
}) {
  const isManaged = Boolean(activeMember.managedBy)
  const [membershipMode, setMembershipMode] = useState<'create' | 'join' | null>(null)
  const [crewName, setCrewName] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const submitMembership = async (event: FormEvent) => {
    event.preventDefault()
    try {
      if (membershipMode === 'create') await onCreateCrew(crewName.trim())
      if (membershipMode === 'join') await onJoinCrew(inviteCode.trim())
      setMembershipMode(null)
      setCrewName('')
      setInviteCode('')
    } catch {
      // The mutation exposes its friendly error below the form.
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.profileHeader}>
        <Avatar member={activeMember} size="large" />
        <div>
          <span className={styles.eyebrow}>Your corner</span>
          <h1>{activeMember.name}</h1>
          <p>{snapshot.crew.name} · {activeMember.role === 'owner' ? 'Crew owner' : activeMember.role}</p>
        </div>
      </header>

      <section className={styles.profileDetails}>
        <div>
          <span className={styles.settingIcon}><Mail size={20} /></span>
          <span><strong>{isManaged ? 'Managed profile' : 'Account email'}</strong><small>{isManaged ? 'This profile is managed by a parent or guardian.' : email}</small></span>
        </div>
        <div>
          <span className={styles.settingIcon}><LockKeyhole size={20} /></span>
          <span><strong>Protected access</strong><small>{isManaged ? 'A four-number PIN unlocks this profile.' : 'Your account is protected by your email and password.'}</small></span>
        </div>
        <div>
          <span className={styles.settingIcon}><Smartphone size={20} /></span>
          <span><strong>Installable app</strong><small>Use your browser’s Add to Home Screen option for quick access.</small></span>
        </div>
      </section>

      {!isManaged && (
        <>
          <section className={styles.profileCrews}>
            <div className={styles.sectionHeading}>
              <div><span className={styles.eyebrow}>Memberships</span><h2>Your Crews</h2></div>
            </div>
            {memberships.map((membership) => (
              <div key={membership.crewId}>
                <span className={styles.settingIcon}><UsersRound size={19} /></span>
                <span><strong>{membership.crewName}</strong><small>{membership.role} · {membership.inviteCode}</small></span>
              </div>
            ))}
            <div className={styles.membershipActions}>
              <button onClick={() => setMembershipMode('create')}><Home size={16} /> New Crew</button>
              <button onClick={() => setMembershipMode('join')}><Plus size={16} /> Join a Crew</button>
            </div>
          </section>
          <button className={styles.signOutButton} onClick={() => void onSignOut()}>
            <LogOut size={17} /> Sign out
          </button>
        </>
      )}

      {membershipMode && (
        <div className={styles.inlineModalBackdrop} role="presentation" onMouseDown={() => setMembershipMode(null)}>
          <section className={styles.inlineModal} role="dialog" aria-modal="true" aria-labelledby="membership-heading" onMouseDown={(event) => event.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setMembershipMode(null)} aria-label="Close"><X size={18} /></button>
            <span className={styles.modalIcon}>{membershipMode === 'create' ? <Home size={22} /> : <UsersRound size={22} />}</span>
            <h2 id="membership-heading">{membershipMode === 'create' ? 'Start another Crew' : 'Join another Crew'}</h2>
            <p>{membershipMode === 'create' ? 'You’ll be its owner and can invite other people.' : 'Enter the invite code shared by a Crew owner.'}</p>
            <form onSubmit={(event) => void submitMembership(event)}>
              {membershipMode === 'create' ? (
                <label>Crew name<input value={crewName} onChange={(event) => setCrewName(event.target.value)} maxLength={80} required autoFocus /></label>
              ) : (
                <label>Invite code<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} maxLength={10} required autoFocus /></label>
              )}
              {membershipError && <p className={styles.modalError} role="alert">{membershipError}</p>}
              <button disabled={membershipPending}>{membershipPending ? 'One moment…' : membershipMode === 'create' ? 'Create Crew' : 'Join Crew'}</button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
