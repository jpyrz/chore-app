import type { Member } from '../types/domain'
import styles from './shared.module.scss'

export function Avatar({ member, size = 'medium' }: { member: Member; size?: 'small' | 'medium' | 'large' }) {
  return (
    <span
      className={`${styles.avatar} ${styles[size]}`}
      style={{ backgroundColor: member.color }}
      aria-hidden="true"
    >
      {member.initials}
    </span>
  )
}
