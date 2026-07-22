import {
  ChevronDown,
  CircleUserRound,
  House,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react'
import { useState, type PropsWithChildren } from 'react'
import { NavLink } from 'react-router'
import type { CrewSnapshot, Member } from '../types/domain'
import { Avatar } from './Avatar'
import styles from './AppShell.module.scss'

interface AppShellProps extends PropsWithChildren {
  snapshot: CrewSnapshot
  activeMember: Member
  onSelectMember: (memberId: string) => void
}

const navigation = [
  { to: '/', label: 'Home', icon: House },
  { to: '/earnings', label: 'Earnings', icon: WalletCards },
  { to: '/crew', label: 'Crew', icon: UsersRound },
  { to: '/profile', label: 'You', icon: CircleUserRound },
]

export function AppShell({ snapshot, activeMember, onSelectMember, children }: AppShellProps) {
  const [profileOpen, setProfileOpen] = useState(false)

  const selectMember = (memberId: string) => {
    onSelectMember(memberId)
    setProfileOpen(false)
  }

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
        <div className={styles.switcher} role="dialog" aria-label="Switch demo profile">
          <div className={styles.switcherHeading}>
            <div>
              <span>Viewing as</span>
              <small>Switch roles to try the full loop</small>
            </div>
            <button onClick={() => setProfileOpen(false)} aria-label="Close profile switcher">
              <X size={18} />
            </button>
          </div>
          {snapshot.members.map((member) => (
            <button
              key={member.id}
              className={member.id === activeMember.id ? styles.activeProfile : ''}
              onClick={() => selectMember(member.id)}
            >
              <Avatar member={member} size="small" />
              <span>
                <strong>{member.name}</strong>
                <small>{member.role === 'owner' ? 'Crew owner' : 'Crew member'}</small>
              </span>
              {member.id === activeMember.id && <span className={styles.activeDot} />}
            </button>
          ))}
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
