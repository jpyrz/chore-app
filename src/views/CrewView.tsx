import { Check, Copy, DollarSign, Flame, KeyRound, UserPlus, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import type { CrewSnapshot, ManagedProfileInput, Member, MemberRole, PayoutInput } from '../types/domain'
import { formatMoney, getBalance } from '../utils/money'
import styles from './views.module.scss'

interface CrewViewProps {
  snapshot: CrewSnapshot
  activeMember: Member
  onAddManagedProfile: (input: ManagedProfileInput) => Promise<unknown>
  onRecordPayout: (input: PayoutInput) => Promise<unknown>
  onUpdateRole: (input: { memberId: string; role: MemberRole }) => Promise<unknown>
  onRemoveMember: (memberId: string) => Promise<unknown>
}

export function CrewView({
  snapshot,
  activeMember,
  onAddManagedProfile,
  onRecordPayout,
  onUpdateRole,
  onRemoveMember,
}: CrewViewProps) {
  const [copied, setCopied] = useState(false)
  const [modal, setModal] = useState<'managed' | 'payout' | null>(null)
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [color, setColor] = useState('#ef745e')
  const payableMembers = useMemo(
    () => snapshot.members.filter((member) => getBalance(snapshot.ledger, member.id) > 0),
    [snapshot.ledger, snapshot.members],
  )
  const [payoutMemberId, setPayoutMemberId] = useState('')
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutDescription, setPayoutDescription] = useState('Paid outside Task Tin')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isManager = activeMember.role === 'owner' || activeMember.role === 'manager'

  const copyCode = async () => {
    await navigator.clipboard?.writeText(snapshot.crew.inviteCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const openPayout = () => {
    const first = payableMembers[0]
    setPayoutMemberId(first?.id ?? '')
    setPayoutAmount(first ? (getBalance(snapshot.ledger, first.id) / 100).toFixed(2) : '')
    setError('')
    setModal('payout')
  }

  const submitManaged = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onAddManagedProfile({ name: name.trim(), pin, color })
      setName('')
      setPin('')
      setModal(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The profile could not be created.')
    } finally {
      setSaving(false)
    }
  }

  const submitPayout = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const amountCents = Math.round(Number(payoutAmount) * 100)
    if (!payoutMemberId || !Number.isFinite(amountCents) || amountCents <= 0) return
    setSaving(true)
    try {
      await onRecordPayout({ memberId: payoutMemberId, amountCents, description: payoutDescription.trim() })
      setModal(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The payout could not be recorded.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>Your Crew</span>
        <h1>{snapshot.crew.name}</h1>
        <p>Everyone has a part to play. Here’s how the Crew is doing.</p>
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
      <p className={styles.inviteHint}>New members create their own account, then join with this code.</p>

      {isManager && (
        <div className={styles.crewActions}>
          <button onClick={() => { setError(''); setModal('managed') }}><KeyRound size={17} /> Add a child profile</button>
          <button onClick={openPayout} disabled={payableMembers.length === 0}><DollarSign size={17} /> Record a payout</button>
        </div>
      )}

      <section className={styles.membersSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>People</span>
            <h2>{snapshot.members.length} in the Crew</h2>
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
                  <span className={styles.role}>{member.managedBy ? 'Managed' : member.role === 'owner' ? 'Owner' : member.role}</span>
                </div>
                <h3>{member.name}</h3>
                <div className={styles.memberStats}>
                  {member.streak > 0 && <span><Flame size={15} fill="currentColor" /> {member.streak} day rhythm</span>}
                  <span>{completed} jobs logged</span>
                </div>
                <strong>{formatMoney(getBalance(snapshot.ledger, member.id))} ready</strong>
                {activeMember.role === 'owner' && member.id !== activeMember.id && (
                  <div className={styles.memberAdmin}>
                    <label>
                      Role
                      <select
                        value={member.role}
                        onChange={(event) => void onUpdateRole({ memberId: member.id, role: event.target.value as MemberRole })}
                      >
                        <option value="member">Member</option>
                        <option value="manager">Manager</option>
                        <option value="owner">Owner</option>
                      </select>
                    </label>
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove ${member.name} from ${snapshot.crew.name}?`)) void onRemoveMember(member.id)
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      {modal === 'managed' && (
        <div className={styles.inlineModalBackdrop} role="presentation" onMouseDown={() => setModal(null)}>
          <section className={styles.inlineModal} role="dialog" aria-modal="true" aria-labelledby="managed-heading" onMouseDown={(event) => event.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setModal(null)} aria-label="Close"><X size={18} /></button>
            <span className={styles.modalIcon}><KeyRound size={22} /></span>
            <h2 id="managed-heading">Add a child profile</h2>
            <p>They can use this profile on your device without needing an email address.</p>
            <form onSubmit={submitManaged}>
              <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required autoFocus /></label>
              <label>Four-number PIN<input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required /></label>
              <label>Profile color
                <select value={color} onChange={(event) => setColor(event.target.value)}>
                  <option value="#ef745e">Coral</option>
                  <option value="#247c66">Green</option>
                  <option value="#e5a82e">Gold</option>
                  <option value="#63518c">Purple</option>
                  <option value="#306779">Blue</option>
                </select>
              </label>
              {error && <p className={styles.modalError} role="alert">{error}</p>}
              <button disabled={saving || pin.length !== 4}>{saving ? 'Adding…' : 'Add profile'}</button>
            </form>
          </section>
        </div>
      )}

      {modal === 'payout' && (
        <div className={styles.inlineModalBackdrop} role="presentation" onMouseDown={() => setModal(null)}>
          <section className={styles.inlineModal} role="dialog" aria-modal="true" aria-labelledby="payout-heading" onMouseDown={(event) => event.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setModal(null)} aria-label="Close"><X size={18} /></button>
            <span className={styles.modalIcon}><DollarSign size={22} /></span>
            <h2 id="payout-heading">Record a payout</h2>
            <p>Record money you already paid by cash or another service.</p>
            <form onSubmit={submitPayout}>
              <label>Member
                <select value={payoutMemberId} onChange={(event) => {
                  const memberId = event.target.value
                  setPayoutMemberId(memberId)
                  setPayoutAmount((getBalance(snapshot.ledger, memberId) / 100).toFixed(2))
                }}>
                  {payableMembers.map((member) => <option key={member.id} value={member.id}>{member.name} · {formatMoney(getBalance(snapshot.ledger, member.id))}</option>)}
                </select>
              </label>
              <label>Amount<input value={payoutAmount} onChange={(event) => setPayoutAmount(event.target.value)} inputMode="decimal" required /></label>
              <label>Note<input value={payoutDescription} onChange={(event) => setPayoutDescription(event.target.value)} maxLength={160} required /></label>
              {error && <p className={styles.modalError} role="alert">{error}</p>}
              <button disabled={saving}>{saving ? 'Recording…' : 'Record payout'}</button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
