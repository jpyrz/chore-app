import { describe, expect, it } from 'vitest'
import { initialSnapshot } from '../data/demo'
import { approveChore, claimChore, completeChore } from './demoRepository'

describe('demo chore workflow', () => {
  it('lets the active member claim an available chore', () => {
    const result = claimChore(structuredClone(initialSnapshot), 'dishwasher')
    const chore = result.chores.find((item) => item.id === 'dishwasher')

    expect(chore?.status).toBe('claimed')
    expect(chore?.assigneeId).toBe('mia')
  })

  it('does not let a different member finish someone else’s chore', () => {
    const snapshot = { ...structuredClone(initialSnapshot), activeMemberId: 'sam' }
    const result = completeChore(snapshot, 'dog-walk')

    expect(result.chores.find((item) => item.id === 'dog-walk')?.status).toBe('claimed')
  })

  it('approves work once and records exactly one earning', () => {
    const snapshot = structuredClone(initialSnapshot)
    const before = snapshot.ledger.length
    const first = approveChore(snapshot, 'counter')
    const second = approveChore(first, 'counter')

    expect(first.ledger).toHaveLength(before + 1)
    expect(first.ledger[0]).toMatchObject({ memberId: 'sam', amountCents: 100, kind: 'earning' })
    expect(second.ledger).toHaveLength(before + 1)
  })
})
