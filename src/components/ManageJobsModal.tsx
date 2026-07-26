import { Archive, CheckCircle2, CircleDashed, Clock3, X } from 'lucide-react'
import { useState } from 'react'
import type { JobTemplate, Member } from '../types/domain'
import { formatMoney } from '../utils/money'
import { CategoryIcon } from './CategoryIcon'
import styles from './ManageJobsModal.module.scss'

interface ManageJobsModalProps {
  jobs: JobTemplate[]
  members: Member[]
  onClose: () => void
  onArchive: (templateId: string) => Promise<unknown>
}

function statusLabel(job: JobTemplate) {
  if (job.currentStatus === 'available') return 'Up for grabs'
  if (job.currentStatus === 'claimed') return 'In progress'
  if (job.currentStatus === 'review') return 'Awaiting approval'
  return 'Between repeats'
}

function ArchiveCopy({ job, members }: { job: JobTemplate; members: Member[] }) {
  const assignee = members.find((member) => member.id === job.currentAssigneeId)

  if (job.currentStatus === 'claimed') {
    return (
      <>
        <h3>Remove this active job?</h3>
        <p>
          {assignee ? `${assignee.name} has this in their lineup.` : 'Someone has this in their lineup.'}
          {' '}Archiving removes it now, stops future copies, and does not add money to their bank.
        </p>
      </>
    )
  }

  if (job.currentStatus === 'review') {
    return (
      <>
        <h3>Stop this job from repeating?</h3>
        <p>
          The finished copy will stay ready for approval so the work can still be paid. No new copies will appear.
        </p>
      </>
    )
  }

  return (
    <>
      <h3>Archive this job?</h3>
      <p>
        {job.currentStatus === 'available'
          ? 'It will disappear from the job board now and will not return.'
          : 'It will not appear again in the next daily or weekly cycle.'}
        {' '}Completed work and bank history stay untouched.
      </p>
    </>
  )
}

export function ManageJobsModal({ jobs, members, onClose, onArchive }: ManageJobsModalProps) {
  const [candidate, setCandidate] = useState<JobTemplate>()
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState('')

  const confirmArchive = async () => {
    if (!candidate || archiving) return
    setArchiving(true)
    setError('')
    try {
      await onArchive(candidate.id)
      setCandidate(undefined)
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'This job could not be archived.')
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={archiving ? undefined : onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-jobs-heading"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Keep the line tidy</span>
            <h2 id="manage-jobs-heading">Manage jobs</h2>
            <p>Archive jobs you no longer want to offer or repeat.</p>
          </div>
          <button onClick={onClose} aria-label="Close" disabled={archiving}>
            <X size={20} />
          </button>
        </header>

        {jobs.length > 0 ? (
          <div className={styles.jobList}>
            {jobs.map((job) => (
              <article className={styles.job} key={job.id}>
                <CategoryIcon category={job.category} />
                <div className={styles.jobCopy}>
                  <strong>{job.title}</strong>
                  <span>
                    {job.currentStatus === 'review' ? <CheckCircle2 size={13} /> : job.currentStatus ? <Clock3 size={13} /> : <CircleDashed size={13} />}
                    {statusLabel(job)} · {job.cadence}
                  </span>
                </div>
                <b>{formatMoney(job.rewardCents)}</b>
                <button
                  className={styles.archiveButton}
                  onClick={() => {
                    setError('')
                    setCandidate(job)
                  }}
                  aria-label={`Archive ${job.title}`}
                >
                  <Archive size={16} />
                  Archive
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <CheckCircle2 size={24} />
            <strong>No active jobs</strong>
            <p>Add a job when you’re ready to put something new up for grabs.</p>
          </div>
        )}

        {candidate && (
          <div className={styles.confirmation} role="alertdialog" aria-modal="true" aria-labelledby="archive-job-heading">
            <div className={styles.confirmationCard}>
              <span className={styles.archiveIcon}><Archive size={21} /></span>
              <div id="archive-job-heading">
                <ArchiveCopy job={candidate} members={members} />
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <div className={styles.confirmationActions}>
                <button className={styles.keepButton} onClick={() => setCandidate(undefined)} disabled={archiving}>
                  Keep job
                </button>
                <button className={styles.confirmButton} onClick={() => void confirmArchive()} disabled={archiving}>
                  {archiving ? 'Archiving…' : 'Archive job'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
