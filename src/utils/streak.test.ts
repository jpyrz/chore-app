import { describe, expect, it } from 'vitest'
import type { LedgerEntry } from '../types/domain'
import { calculateStreak } from './streak'

function earning(day: string): LedgerEntry {
  return { id: day, memberId: 'kid', kind: 'earning', amountCents: 100, description: 'Job', createdAt: `${day}T12:00:00` }
}

describe('calculateStreak', () => {
  it('counts consecutive earning days through today', () => {
    expect(calculateStreak([earning('2026-07-20'), earning('2026-07-21'), earning('2026-07-22')], 'kid', new Date(2026, 6, 22, 18))).toBe(3)
  })

  it('keeps a streak alive when the latest earning was yesterday', () => {
    expect(calculateStreak([earning('2026-07-20'), earning('2026-07-21')], 'kid', new Date(2026, 6, 22, 8))).toBe(2)
  })

  it('ignores payouts and other members', () => {
    const entries: LedgerEntry[] = [
      earning('2026-07-21'),
      { ...earning('2026-07-22'), id: 'other', memberId: 'other' },
      { ...earning('2026-07-22'), id: 'payout', kind: 'payout' },
    ]
    expect(calculateStreak(entries, 'kid', new Date(2026, 6, 22, 8))).toBe(1)
  })
})
