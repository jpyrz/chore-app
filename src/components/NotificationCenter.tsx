import { Bell, CheckCheck, ClipboardCheck, Sparkles, WalletCards, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { AppNotification, NotificationKind } from '../types/domain'
import styles from './NotificationCenter.module.scss'

interface NotificationCenterProps {
  notifications: AppNotification[]
  open: boolean
  onToggle: () => void
  onClose: () => void
  onMarkRead: (notificationId: string) => Promise<unknown>
  onMarkAllRead: () => Promise<unknown>
}

const notificationIcons: Record<NotificationKind, typeof Bell> = {
  approval_needed: ClipboardCheck,
  new_job: Sparkles,
  payout_recorded: WalletCards,
}

function timeLabel(createdAt: string) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000))
  if (elapsedMinutes < 1) return 'Just now'
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`
  if (elapsedMinutes < 1_440) return `${Math.floor(elapsedMinutes / 60)}h ago`
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(createdAt))
}

export function NotificationCenter({
  notifications,
  open,
  onToggle,
  onClose,
  onMarkRead,
  onMarkAllRead,
}: NotificationCenterProps) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const unreadCount = notifications.filter((notification) => !notification.read).length

  const openNotification = async (notification: AppNotification) => {
    setBusy(true)
    setError('')
    try {
      if (!notification.read) await onMarkRead(notification.id)
      onClose()
      navigate(notification.kind === 'payout_recorded' ? '/earnings' : '/')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That notification could not be opened.')
    } finally {
      setBusy(false)
    }
  }

  const markAllRead = async () => {
    setBusy(true)
    setError('')
    try {
      await onMarkAllRead()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Notifications could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.center}>
      <button
        className={styles.bellButton}
        onClick={onToggle}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={21} aria-hidden="true" />
        {unreadCount > 0 && <span className={styles.badge}>{Math.min(unreadCount, 9)}{unreadCount > 9 ? '+' : ''}</span>}
      </button>

      {open && (
        <section className={styles.panel} role="dialog" aria-label="Notifications">
          <header>
            <div>
              <span>Notifications</span>
              <small>{unreadCount ? `${unreadCount} waiting for you` : 'You’re all caught up'}</small>
            </div>
            <button onClick={onClose} aria-label="Close notifications"><X size={18} /></button>
          </header>

          {notifications.length > 0 ? (
            <div className={styles.list}>
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.kind]
                return (
                  <button
                    key={notification.id}
                    className={!notification.read ? styles.unread : undefined}
                    onClick={() => void openNotification(notification)}
                    disabled={busy}
                  >
                    <span className={`${styles.icon} ${styles[notification.kind]}`}><Icon size={18} /></span>
                    <span className={styles.copy}>
                      <strong>{notification.title}</strong>
                      <span>{notification.body}</span>
                      <small>{timeLabel(notification.createdAt)}</small>
                    </span>
                    {!notification.read && <span className={styles.unreadDot} aria-label="Unread" />}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <CheckCheck size={27} />
              <strong>Quiet for now</strong>
              <span>New jobs and Crew updates will land here.</span>
            </div>
          )}

          {error && <p className={styles.error} role="alert">{error}</p>}

          {unreadCount > 0 && (
            <button className={styles.markAll} onClick={() => void markAllRead()} disabled={busy}>
              <CheckCheck size={16} /> Mark all as read
            </button>
          )}
        </section>
      )}
    </div>
  )
}
