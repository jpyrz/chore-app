import { describe, expect, it } from 'vitest'
import { formatMoney, getBalance } from './money'

describe('money helpers', () => {
  it('formats whole and partial dollar amounts', () => {
    expect(formatMoney(500)).toBe('$5')
    expect(formatMoney(250)).toBe('$2.50')
  })

  it('calculates a member balance from immutable ledger entries', () => {
    expect(
      getBalance(
        [
          { id: '1', memberId: 'mia', kind: 'earning', amountCents: 500, description: 'Job', createdAt: '2026-07-22' },
          { id: '2', memberId: 'mia', kind: 'payout', amountCents: -200, description: 'Paid', createdAt: '2026-07-22' },
          { id: '3', memberId: 'sam', kind: 'earning', amountCents: 900, description: 'Other', createdAt: '2026-07-22' },
        ],
        'mia',
      ),
    ).toBe(300)
  })
})
