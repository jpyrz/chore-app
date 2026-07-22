import type { LedgerEntry } from '../types/domain'

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function dayKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calculateStreak(entries: LedgerEntry[], memberId: string, now = new Date()) {
  const earnedDays = new Set(
    entries
      .filter((entry) => entry.memberId === memberId && entry.kind === 'earning')
      .map((entry) => dayKey(new Date(entry.createdAt))),
  )
  const cursor = startOfLocalDay(now)

  if (!earnedDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)

  let streak = 0
  while (earnedDays.has(dayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
