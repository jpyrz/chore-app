import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { requestPasswordReset, signIn, signUp } from '../api/auth'
import styles from './AuthView.module.scss'

type AuthMode = 'sign-in' | 'sign-up' | 'forgot'

function readableError(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

export function AuthView() {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError('')
    setMessage('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'sign-in') {
        await signIn(email.trim(), password)
      } else if (mode === 'sign-up') {
        if (name.trim().length < 2) throw new Error('Please enter your name.')
        if (password.length < 8) throw new Error('Use at least 8 characters for your password.')
        if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error('Include at least one letter and one number.')
        const signedIn = await signUp(name, email.trim(), password)
        if (!signedIn) setMessage('Check your inbox to confirm your email, then come back to sign in.')
      } else {
        await requestPasswordReset(email.trim())
        setMessage('Password reset instructions are on their way. Check your inbox.')
      }
    } catch (caught) {
      setError(readableError(caught))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.story}>
        <a className={styles.brand} href="/">
          <img src="/mark.svg" alt="" />
          <span>task tin</span>
        </a>
        <div className={styles.storyCopy}>
          <span className={styles.eyebrow}>Good work lives here</span>
          <h1>Small jobs.<br />Real pride.</h1>
          <p>A shared place to find useful work, follow through, and watch every effort add up.</p>
        </div>
        <div className={styles.exampleJob}>
          <span className={styles.check}><CheckCircle2 size={23} /></span>
          <div><strong>Take the dog for a walk</strong><small>A small job, clearly rewarded</small></div>
          <b>+$2.50</b>
        </div>
      </section>

      <section className={styles.formSide}>
        <div className={styles.formCard}>
          {mode === 'forgot' && (
            <button className={styles.back} onClick={() => changeMode('sign-in')}>
              <ArrowLeft size={16} /> Back to sign in
            </button>
          )}
          <span className={styles.eyebrow}>
            {mode === 'sign-in' ? 'Welcome back' : mode === 'sign-up' ? 'Start a crew' : 'Reset password'}
          </span>
          <h2>{mode === 'sign-in' ? 'Ready when you are.' : mode === 'sign-up' ? 'Make good work visible.' : 'We’ll get you back in.'}</h2>
          <p className={styles.intro}>
            {mode === 'sign-in'
              ? 'Sign in to see what’s waiting.'
              : mode === 'sign-up'
                ? 'Create your account, then start or join a Crew.'
                : 'Enter the email attached to your account.'}
          </p>

          <form onSubmit={submit}>
            {mode === 'sign-up' && (
              <label>
                Your name
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="James" maxLength={60} required />
              </label>
            )}
            <label>
              Email
              <span className={styles.inputWithIcon}>
                <Mail size={18} />
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" required />
              </span>
            </label>
            {mode !== 'forgot' && (
              <label>
                <span className={styles.labelRow}>
                  Password
                  {mode === 'sign-in' && <button type="button" onClick={() => changeMode('forgot')}>Forgot password?</button>}
                </span>
                <span className={styles.inputWithIcon}>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                    placeholder={mode === 'sign-up' ? '8+ characters, a letter & number' : 'Your password'}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
            )}

            {error && <p className={styles.error} role="alert">{error}</p>}
            {message && <p className={styles.message} role="status">{message}</p>}

            <button className={styles.submit} disabled={loading}>
              {loading ? 'One moment…' : mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          {mode !== 'forgot' && (
            <p className={styles.switchMode}>
              {mode === 'sign-in' ? 'New to Task Tin?' : 'Already have an account?'}
              <button onClick={() => changeMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
                {mode === 'sign-in' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
