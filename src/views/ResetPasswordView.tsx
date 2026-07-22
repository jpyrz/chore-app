import { CheckCircle2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { updatePassword } from '../api/auth'
import styles from './UtilityViews.module.scss'

export function ResetPasswordView() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError('Include at least one letter and one number.')
    if (password !== confirm) return setError('The passwords do not match.')
    setLoading(true)
    try {
      await updatePassword(password)
      setComplete(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Password could not be updated.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.utilityPage}>
      <section className={styles.utilityCard}>
        <img src="/mark.svg" alt="" />
        {complete ? (
          <>
            <CheckCircle2 className={styles.successIcon} size={34} />
            <h1>Password updated.</h1>
            <p>You’re all set. Head back into Task Tin with your new password.</p>
            <a className={styles.primaryLink} href="/">Return to Task Tin</a>
          </>
        ) : (
          <>
            <span className={styles.eyebrow}>Account recovery</span>
            <h1>Choose a new password.</h1>
            <p>Use at least eight characters with a letter and number that you don’t reuse elsewhere.</p>
            <form onSubmit={submit} className={styles.utilityForm}>
              <label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              <label>Confirm password<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></label>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button disabled={loading}>{loading ? 'Updating…' : 'Update password'}</button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
