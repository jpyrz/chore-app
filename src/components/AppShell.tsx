import {
  ChevronDown,
  CircleUserRound,
  House,
  KeyRound,
  LogOut,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react'
import { useState, type FormEvent, type PropsWithChildren } from 'react'
import { NavLink } from 'react-router'
import type { CrewMembershipSummary, CrewSnapshot, Member } from '../types/domain'
import { Avatar } from './Avatar'
import styles from './AppShell.module.scss'

interface AppShellProps extends PropsWithChildren {
  snapshot: CrewSnapshot
  activeMember: Member
  currentProfileId: string
  memberships: CrewMembershipSummary[]
  onSelectCrew: (crewId: string) => void
  onSelectMember: (memberId: string, pin?: string) => Promise<boolean>
  onSignOut: () => Promise<void>
}

const navigation = [
  { to: '/', label: 'Home', icon: House },
  { to: '/earnings', label: 'Earnings', icon: WalletCards },
  { to: '/crew', label: 'Crew', icon: UsersRound },
  { to: '/profile', label: 'You', icon: CircleUserRound },
]

export function AppShell({
  snapshot,
  activeMember,
  currentProfileId,
  memberships,
  onSelectCrew,
  onSelectMember,
  onSignOut,
  children,
}: AppShellProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [pinMember, setPinMember] = useState<Member | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)

  const selectMember = async (member: Member) => {
    if (member.id === currentProfileId && activeMember.id === currentProfileId) {
      await onSelectMember(member.id)
      setProfileOpen(false)
      return
    }
    setPinMember(member)
    setPin('')
    setPinError('')
    setProfileOpen(false)
  }

  const submitPin = async (event: FormEvent) => {
    event.preventDefault()
    if (!pinMember) return
    setPinLoading(true)
    setPinError('')
    try {
      const verified = await onSelectMember(pinMember.id, pin)
      if (!verified) return setPinError(unlockingAccount ? 'That password didn’t match. Try again.' : 'That PIN didn’t match. Try again.')
      setPinMember(null)
      setPin('')
    } catch (error) {
      setPinError(error instanceof Error ? error.message : 'The profile could not be unlocked.')
    } finally {
      setPinLoading(false)
    }
  }

  const switchableMembers = snapshot.members.filter(
    (member) => member.id === currentProfileId || member.managedBy === currentProfileId,
  )
  const unlockingAccount = pinMember?.id === currentProfileId

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <NavLink to="/" className={styles.brand} aria-label="Choreline home">
          <img src="/mark.svg" alt="" />
          <span>choreline</span>
        </NavLink>

        <button
          className={styles.profileButton}
          onClick={() => setProfileOpen((value) => !value)}
          aria-expanded={profileOpen}
          aria-haspopup="dialog"
          aria-label={`Switch profile. Currently viewing as ${activeMember.name}`}
        >
          <span className={styles.profileText}>
            <strong>{activeMember.name}</strong>
            <small>{snapshot.crew.name}</small>
          </span>
          <Avatar member={activeMember} size="small" />
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </header>

      {profileOpen && (
        <div className={styles.switcher} role="dialog" aria-label="Switch profile">
          <div className={styles.switcherHeading}>
            <div>
              <span>Viewing as</span>
              <small>Choose who is using this device</small>
            </div>
            <button onClick={() => setProfileOpen(false)} aria-label="Close profile switcher">
              <X size={18} />
            </button>
          </div>
          {switchableMembers.map((member) => (
            <button
              key={member.id}
              className={member.id === activeMember.id ? styles.activeProfile : ''}
              onClick={() => void selectMember(member)}
            >
              <Avatar member={member} size="small" />
              <span>
                <strong>{member.name}</strong>
                <small>{member.id === currentProfileId ? 'Your account' : 'Managed profile'}</small>
              </span>
              {member.id === activeMember.id && <span className={styles.activeDot} />}
            </button>
          ))}
          {memberships.length > 1 && activeMember.id === currentProfileId && (
            <div className={styles.crewList}>
              <span>Your Crews</span>
              {memberships.map((membership) => (
                <button
                  key={membership.crewId}
                  className={membership.crewId === snapshot.crew.id ? styles.activeCrew : ''}
                  onClick={() => {
                    onSelectCrew(membership.crewId)
                    setProfileOpen(false)
                  }}
                >
                  <UsersRound size={17} />
                  <span>{membership.crewName}</span>
                </button>
              ))}
            </div>
          )}
          <button className={styles.signOut} onClick={() => void onSignOut()}>
            <LogOut size={17} />
            <span>Sign out</span>
          </button>
        </div>
      )}

      {pinMember && (
        <div className={styles.pinBackdrop} role="presentation" onMouseDown={() => setPinMember(null)}>
          <section className={styles.pinModal} role="dialog" aria-modal="true" aria-labelledby="pin-heading" onMouseDown={(event) => event.stopPropagation()}>
            <button className={styles.pinClose} onClick={() => setPinMember(null)} aria-label="Close PIN prompt"><X size={18} /></button>
            <span className={styles.pinIcon}><KeyRound size={23} /></span>
            <h2 id="pin-heading">{unlockingAccount ? 'Return to parent mode' : `Hi, ${pinMember.name}!`}</h2>
            <p>{unlockingAccount ? 'Enter your account password to unlock parent controls.' : 'Enter your four-number PIN to open your profile.'}</p>
            <form onSubmit={submitPin}>
              <label>
                {unlockingAccount ? 'Account password' : 'Profile PIN'}
                <input
                  type="password"
                  inputMode={unlockingAccount ? undefined : 'numeric'}
                  pattern={unlockingAccount ? undefined : '[0-9]{4}'}
                  maxLength={unlockingAccount ? undefined : 4}
                  value={pin}
                  onChange={(event) => setPin(unlockingAccount ? event.target.value : event.target.value.replace(/\D/g, ''))}
                  autoFocus
                  required
                />
              </label>
              {pinError && <p className={styles.pinError} role="alert">{pinError}</p>}
              <button disabled={pinLoading || (unlockingAccount ? pin.length === 0 : pin.length !== 4)}>{pinLoading ? 'Checking…' : unlockingAccount ? 'Unlock parent mode' : 'Open profile'}</button>
            </form>
          </section>
        </div>
      )}

      <main className={styles.main}>{children}</main>

      <nav className={styles.navigation} aria-label="Main navigation">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => (isActive ? styles.activeNav : undefined)}
          >
            <Icon size={22} strokeWidth={2.1} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
