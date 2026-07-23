import { Check, Copy, Flame, KeyRound, Landmark, UserPlus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import type { BankBalanceInput, BankTransactionCategory, BankTransactionInput, CrewSnapshot, ManagedProfileInput, Member, MemberRole } from '../types/domain'
import { formatMoney } from '../utils/money'
import styles from './views.module.scss'

interface CrewViewProps {
  snapshot: CrewSnapshot
  activeMember: Member
  onAddManagedProfile: (input: ManagedProfileInput) => Promise<unknown>
  onRecordBankTransaction: (input: BankTransactionInput) => Promise<unknown>
  onSetBankBalance: (input: BankBalanceInput) => Promise<unknown>
  onUpdateRole: (input: { memberId: string; role: MemberRole }) => Promise<unknown>
  onRemoveMember: (memberId: string) => Promise<unknown>
}

export function CrewView({
  snapshot,
  activeMember,
  onAddManagedProfile,
  onRecordBankTransaction,
  onSetBankBalance,
  onUpdateRole,
  onRemoveMember,
}: CrewViewProps) {
  const [copied, setCopied] = useState(false)
  const [modal, setModal] = useState<'managed' | 'bank' | null>(null)
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [color, setColor] = useState('#ef745e')
  const [bankMemberId, setBankMemberId] = useState('')
  const [bankAction, setBankAction] = useState<'add' | 'spend' | 'correct'>('add')
  const [bankCategory, setBankCategory] = useState<Extract<BankTransactionCategory, 'gift' | 'allowance' | 'deposit'>>('gift')
  const [bankAmount, setBankAmount] = useState('')
  const [bankDescription, setBankDescription] = useState('Birthday gift')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isManager = activeMember.role === 'owner' || activeMember.role === 'manager'

  const copyCode = async () => {
    await navigator.clipboard?.writeText(snapshot.crew.inviteCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const openBank = (memberId = snapshot.members[0]?.id ?? '') => {
    setBankMemberId(memberId)
    setBankAction('add')
    setBankCategory('gift')
    setBankAmount('')
    setBankDescription('Birthday gift')
    setError('')
    setModal('bank')
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

  const submitBank = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const amountCents = Math.round(Number(bankAmount) * 100)
    if (!bankMemberId || !Number.isFinite(amountCents) || amountCents < 0 || (bankAction !== 'correct' && amountCents === 0)) return
    setSaving(true)
    try {
      if (bankAction === 'correct') {
        await onSetBankBalance({ memberId: bankMemberId, targetCents: amountCents, description: bankDescription.trim() })
      } else {
        await onRecordBankTransaction({
          memberId: bankMemberId,
          direction: bankAction === 'add' ? 'deposit' : 'withdrawal',
          category: bankAction === 'add' ? bankCategory : 'purchase',
          amountCents,
          description: bankDescription.trim(),
        })
      }
      setModal(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The bank activity could not be recorded.')
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
          <button onClick={() => openBank()} disabled={snapshot.members.length === 0}><Landmark size={17} /> Manage banks</button>
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
                <strong>{formatMoney(snapshot.balances[member.id] ?? 0)} in bank</strong>
                {isManager && (
                  <button className={styles.manageBankButton} onClick={() => openBank(member.id)}>
                    <Landmark size={15} /> Manage bank
                  </button>
                )}
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

      {modal === 'bank' && (
        <div className={styles.inlineModalBackdrop} role="presentation" onMouseDown={() => setModal(null)}>
          <section className={styles.inlineModal} role="dialog" aria-modal="true" aria-labelledby="bank-heading" onMouseDown={(event) => event.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setModal(null)} aria-label="Close"><X size={18} /></button>
            <span className={styles.modalIcon}><Landmark size={22} /></span>
            <h2 id="bank-heading">Manage a bank</h2>
            <p>Add gifts, record purchases, or correct a balance without erasing its history.</p>
            <form onSubmit={submitBank}>
              <label>Member
                <select value={bankMemberId} onChange={(event) => {
                  const memberId = event.target.value
                  setBankMemberId(memberId)
                  if (bankAction === 'correct') setBankAmount(((snapshot.balances[memberId] ?? 0) / 100).toFixed(2))
                }}>
                  {snapshot.members.map((member) => <option key={member.id} value={member.id}>{member.name} · {formatMoney(snapshot.balances[member.id] ?? 0)}</option>)}
                </select>
              </label>
              <label>Action
                <select value={bankAction} onChange={(event) => {
                  const action = event.target.value as 'add' | 'spend' | 'correct'
                  setBankAction(action)
                  setBankAmount(action === 'correct' ? ((snapshot.balances[bankMemberId] ?? 0) / 100).toFixed(2) : '')
                  setBankDescription(action === 'add' ? 'Birthday gift' : action === 'spend' ? 'Store purchase' : 'Balance correction')
                }}>
                  <option value="add">Add money</option>
                  <option value="spend">Record a purchase</option>
                  <option value="correct">Correct the balance</option>
                </select>
              </label>
              {bankAction === 'add' && (
                <label>Money came from
                  <select value={bankCategory} onChange={(event) => setBankCategory(event.target.value as typeof bankCategory)}>
                    <option value="gift">Gift</option>
                    <option value="allowance">Allowance</option>
                    <option value="deposit">Something else</option>
                  </select>
                </label>
              )}
              <label>{bankAction === 'correct' ? 'New balance' : 'Amount'}<input value={bankAmount} onChange={(event) => setBankAmount(event.target.value)} inputMode="decimal" min="0" step="0.01" required /></label>
              <label>Note<input value={bankDescription} onChange={(event) => setBankDescription(event.target.value)} maxLength={160} required /></label>
              {bankAction === 'correct' && <p className={styles.bankHint}>Task Tin will add a correction for the difference. Earlier activity stays visible.</p>}
              {error && <p className={styles.modalError} role="alert">{error}</p>}
              <button disabled={saving}>{saving ? 'Saving…' : bankAction === 'add' ? 'Add to bank' : bankAction === 'spend' ? 'Record purchase' : 'Correct balance'}</button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
