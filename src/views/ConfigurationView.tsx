import { KeyRound, Server } from 'lucide-react'
import styles from './UtilityViews.module.scss'

export function ConfigurationView() {
  return (
    <main className={styles.utilityPage}>
      <section className={styles.utilityCard}>
        <img src="/mark.svg" alt="" />
        <span className={styles.eyebrow}>Setup needed</span>
        <h1>Connect Choreline to Supabase.</h1>
        <p>This build requires a hosted Supabase project before accounts and shared data can work.</p>
        <div className={styles.requirements}>
          <div><Server size={20} /><span><strong>Project URL</strong><small>VITE_SUPABASE_URL</small></span></div>
          <div><KeyRound size={20} /><span><strong>Publishable key</strong><small>VITE_SUPABASE_PUBLISHABLE_KEY</small></span></div>
        </div>
        <p className={styles.hint}>Add both values to <code>.env</code>, apply the migrations, then restart the app.</p>
      </section>
    </main>
  )
}
