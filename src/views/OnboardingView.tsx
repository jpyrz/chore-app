import { ArrowRight, Home, KeyRound, UsersRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useOnboarding } from '../hooks/useChoreline'
import type { AccountProfile } from '../types/domain'
import styles from './OnboardingView.module.scss'

export function OnboardingView({ authUserId, profile }: { authUserId: string; profile: AccountProfile }) {
  const onboarding = useOnboarding(authUserId)
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [crewName, setCrewName] = useState(`${profile.name}'s Crew`)
  const [inviteCode, setInviteCode] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'create') await onboarding.createCrew(crewName)
    if (mode === 'join') await onboarding.joinCrew(inviteCode)
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header>
          <img src="/mark.svg" alt="" />
          <div><span>Welcome, {profile.name}</span><h1>Find your Crew.</h1></div>
        </header>

        {mode === 'choose' ? (
          <div className={styles.choices}>
            <button onClick={() => setMode('create')}>
              <span className={styles.choiceIcon}><Home size={24} /></span>
              <span><strong>Start a new Crew</strong><small>Create jobs and invite your people.</small></span>
              <ArrowRight size={19} />
            </button>
            <button onClick={() => setMode('join')}>
              <span className={styles.choiceIcon}><UsersRound size={24} /></span>
              <span><strong>Join with a code</strong><small>Someone already made your Crew.</small></span>
              <ArrowRight size={19} />
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <button type="button" className={styles.back} onClick={() => setMode('choose')}>← Back</button>
            <span className={styles.formIcon}>{mode === 'create' ? <Home size={24} /> : <KeyRound size={24} />}</span>
            <h2>{mode === 'create' ? 'Name your Crew' : 'Enter the invite code'}</h2>
            <p>{mode === 'create' ? 'You can change this later.' : 'Codes are ten letters and numbers.'}</p>
            {mode === 'create' ? (
              <label>Crew name<input value={crewName} onChange={(event) => setCrewName(event.target.value)} required autoFocus /></label>
            ) : (
              <label>Invite code<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} maxLength={10} required autoFocus /></label>
            )}
            {onboarding.error && <p className={styles.error} role="alert">{onboarding.error.message}</p>}
            <button className={styles.submit} disabled={onboarding.isPending}>
              {onboarding.isPending ? 'One moment…' : mode === 'create' ? 'Create Crew' : 'Join Crew'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
