import type { LedgerEntry } from '../types/domain'

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

export function getBalance(entries: LedgerEntry[], memberId: string): number {
  return entries
    .filter((entry) => entry.memberId === memberId)
    .reduce((total, entry) => total + entry.amountCents, 0)
}

export function getOnTheWayTotal(chores: Array<{ assigneeId?: string; rewardCents: number; status: string }>, memberId: string): number {
  return chores
    .filter((chore) => chore.assigneeId === memberId && (chore.status === 'claimed' || chore.status === 'review'))
    .reduce((total, chore) => total + chore.rewardCents, 0)
}
