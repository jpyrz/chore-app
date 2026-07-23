export type MemberRole = 'owner' | 'manager' | 'member'

export type ChoreStatus = 'available' | 'claimed' | 'review' | 'completed'

export type ChoreCategory =
  | 'kitchen'
  | 'outside'
  | 'pets'
  | 'tidy'
  | 'laundry'
  | 'other'

export interface Member {
  id: string
  name: string
  initials: string
  role: MemberRole
  color: string
  streak: number
  managedBy?: string
}

export interface Chore {
  id: string
  title: string
  category: ChoreCategory
  rewardCents: number
  timing: string
  cadence: string
  status: ChoreStatus
  assigneeId?: string
  instructions?: string
}

export interface LedgerEntry {
  id: string
  memberId: string
  kind: 'earning' | 'payout' | 'adjustment'
  category: BankTransactionCategory
  amountCents: number
  description: string
  createdAt: string
}

export type BankTransactionCategory =
  | 'chore'
  | 'gift'
  | 'allowance'
  | 'deposit'
  | 'purchase'
  | 'withdrawal'
  | 'correction'

export type NotificationKind = 'approval_needed' | 'new_job' | 'payout_recorded'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  read: boolean
  createdAt: string
}

export interface CrewSnapshot {
  crew: {
    id: string
    name: string
    inviteCode: string
  }
  activeMemberId: string
  members: Member[]
  chores: Chore[]
  ledger: LedgerEntry[]
  balances: Record<string, number>
  goals: Record<string, { name: string; targetCents: number }>
}

export interface AccountProfile {
  id: string
  name: string
  initials: string
  color: string
}

export interface CrewMembershipSummary {
  crewId: string
  crewName: string
  inviteCode: string
  role: MemberRole
}

export interface AccountContext {
  profile: AccountProfile
  memberships: CrewMembershipSummary[]
}

export interface NewChoreInput {
  title: string
  category: ChoreCategory
  rewardCents: number
  timing: string
  cadence: string
  instructions?: string
}

export interface ManagedProfileInput {
  name: string
  pin: string
  color: string
}

export interface BankTransactionInput {
  memberId: string
  direction: 'deposit' | 'withdrawal'
  category: Extract<BankTransactionCategory, 'gift' | 'allowance' | 'deposit' | 'purchase' | 'withdrawal'>
  amountCents: number
  description: string
}

export interface BankBalanceInput {
  memberId: string
  targetCents: number
  description: string
}
