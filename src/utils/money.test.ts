import { describe, expect, it } from 'vitest'
import { formatMoney, getBalance, getOnTheWayTotal } from './money'

describe('money helpers', () => {
  it('formats whole and partial dollar amounts', () => {
    expect(formatMoney(500)).toBe('$5')
    expect(formatMoney(250)).toBe('$2.50')
  })

  it('calculates a member balance from immutable ledger entries', () => {
    expect(
      getBalance(
        [
          { id: '1', memberId: 'mia', kind: 'earning', category: 'chore', amountCents: 500, description: 'Job', createdAt: '2026-07-22' },
          { id: '2', memberId: 'mia', kind: 'adjustment', category: 'purchase', amountCents: -200, description: 'Paid', createdAt: '2026-07-22' },
          { id: '3', memberId: 'sam', kind: 'earning', category: 'chore', amountCents: 900, description: 'Other', createdAt: '2026-07-22' },
        ],
        'mia',
      ),
    ).toBe(300)
  })

  it('counts claimed and review jobs as money on the way', () => {
    expect(getOnTheWayTotal([
      { assigneeId: 'mia', rewardCents: 200, status: 'claimed' },
      { assigneeId: 'mia', rewardCents: 300, status: 'review' },
      { assigneeId: 'mia', rewardCents: 400, status: 'available' },
      { assigneeId: 'sam', rewardCents: 500, status: 'claimed' },
    ], 'mia')).toBe(500)
  })
})
