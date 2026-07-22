import { supabase } from './supabase'
import type {
  AccountContext,
  Chore,
  ChoreCategory,
  CrewMembershipSummary,
  CrewSnapshot,
  LedgerEntry,
  ManagedProfileInput,
  Member,
  MemberRole,
  NewChoreInput,
  PayoutInput,
} from '../types/domain'
import { calculateStreak } from '../utils/streak'

function client() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message)
  if (data === null) throw new Error('The requested data was not found.')
  return data
}

interface ProfileRow {
  id: string
  display_name: string
  initials: string
  color: string
  managed_by: string | null
}

interface MembershipRow {
  crew_id: string
  role: 'owner' | 'manager' | 'member'
  crews: { id: string; name: string; invite_code: string } | Array<{ id: string; name: string; invite_code: string }>
}

interface MemberRow {
  role: 'owner' | 'manager' | 'member'
  profiles: ProfileRow | ProfileRow[]
}

interface ChoreRow {
  id: string
  title: string
  category: ChoreCategory
  reward_cents: number
  due_at: string | null
  status: 'available' | 'claimed' | 'review' | 'completed' | 'cancelled'
  assignee_id: string | null
  instructions: string | null
  chore_templates: { cadence: string } | Array<{ cadence: string }> | null
}

interface LedgerRow {
  id: string
  member_id: string
  kind: 'earning' | 'payout' | 'adjustment'
  amount_cents: number
  description: string
  created_at: string
}

const cadenceLabels: Record<string, string> = {
  one_time: 'One time',
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
}

function relatedOne<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value
}

function timingLabel(dueAt: string | null) {
  if (!dueAt) return 'Anytime'
  const due = new Date(dueAt)
  const today = new Date()
  const sameDay = due.toDateString() === today.toDateString()
  if (sameDay) return 'Today'
  return `Due ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(due)}`
}

export async function getAccountContext(authUserId: string): Promise<AccountContext> {
  const profileResult = await client()
    .from('profiles')
    .select('id, display_name, initials, color, managed_by')
    .eq('auth_user_id', authUserId)
    .single()
  const profile = unwrap(profileResult.data as ProfileRow | null, profileResult.error)

  const membershipResult = await client()
    .from('crew_members')
    .select('crew_id, role, crews!inner(id, name, invite_code)')
    .eq('profile_id', profile.id)
    .order('joined_at')
  const rows = unwrap((membershipResult.data ?? []) as MembershipRow[], membershipResult.error)
  const memberships: CrewMembershipSummary[] = rows.map((row) => {
    const crew = relatedOne(row.crews)
    return { crewId: row.crew_id, crewName: crew.name, inviteCode: crew.invite_code, role: row.role }
  })

  return {
    profile: {
      id: profile.id,
      name: profile.display_name,
      initials: profile.initials,
      color: profile.color,
    },
    memberships,
  }
}

export async function getCrewSnapshot(crewId: string): Promise<CrewSnapshot> {
  const api = client()
  const ensured = await api.rpc('ensure_due_occurrences', { p_crew_id: crewId })
  if (ensured.error) throw new Error(ensured.error.message)

  const [crewResult, membersResult, choresResult, ledgerResult, goalsResult] = await Promise.all([
    api.from('crews').select('id, name, invite_code').eq('id', crewId).single(),
    api
      .from('crew_members')
      .select('role, profiles!inner(id, display_name, initials, color, managed_by)')
      .eq('crew_id', crewId)
      .order('joined_at'),
    api
      .from('chore_occurrences')
      .select('id, title, category, reward_cents, due_at, status, assignee_id, instructions, chore_templates(cadence)')
      .eq('crew_id', crewId)
      .in('status', ['available', 'claimed', 'review'])
      .order('due_at', { ascending: true, nullsFirst: false }),
    api
      .from('ledger_entries')
      .select('id, member_id, kind, amount_cents, description, created_at')
      .eq('crew_id', crewId)
      .order('created_at', { ascending: false })
      .limit(200),
    api.from('savings_goals').select('member_id, name, target_cents').eq('crew_id', crewId),
  ])

  const crew = unwrap(crewResult.data as { id: string; name: string; invite_code: string } | null, crewResult.error)
  const memberRows = unwrap((membersResult.data ?? []) as MemberRow[], membersResult.error)
  const members: Member[] = memberRows.map((row) => {
    const profile = relatedOne(row.profiles)
    return {
      id: profile.id,
      name: profile.display_name,
      initials: profile.initials,
      role: row.role,
      color: profile.color,
      managedBy: profile.managed_by ?? undefined,
      streak: 0,
    }
  })

  const choreRows = unwrap((choresResult.data ?? []) as ChoreRow[], choresResult.error)
  const chores: Chore[] = choreRows.map((row) => {
    const template = row.chore_templates ? relatedOne(row.chore_templates) : null
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      rewardCents: row.reward_cents,
      timing: timingLabel(row.due_at),
      cadence: cadenceLabels[template?.cadence ?? 'one_time'] ?? 'One time',
      status: row.status === 'cancelled' ? 'completed' : row.status,
      assigneeId: row.assignee_id ?? undefined,
      instructions: row.instructions ?? undefined,
    }
  })

  const ledgerRows = unwrap((ledgerResult.data ?? []) as LedgerRow[], ledgerResult.error)
  const ledger: LedgerEntry[] = ledgerRows.map((row) => ({
    id: row.id,
    memberId: row.member_id,
    kind: row.kind === 'payout' ? 'payout' : 'earning',
    amountCents: row.amount_cents,
    description: row.description,
    createdAt: row.created_at,
  }))
  for (const member of members) member.streak = calculateStreak(ledger, member.id)

  if (goalsResult.error) throw new Error(goalsResult.error.message)
  const goals = Object.fromEntries(
    ((goalsResult.data ?? []) as Array<{ member_id: string; name: string; target_cents: number }>).map((goal) => [
      goal.member_id,
      { name: goal.name, targetCents: goal.target_cents },
    ]),
  )
  for (const member of members) {
    if (!goals[member.id]) goals[member.id] = { name: 'Something worth saving for', targetCents: 2500 }
  }

  return {
    crew: { id: crew.id, name: crew.name, inviteCode: crew.invite_code },
    activeMemberId: members[0]?.id ?? '',
    members,
    chores,
    ledger,
    goals,
  }
}

export async function createCrew(name: string) {
  const { data, error } = await client().rpc('create_crew', { p_name: name })
  return unwrap(data, error)
}

export async function joinCrew(inviteCode: string) {
  const { data, error } = await client().rpc('join_crew_by_code', { p_invite_code: inviteCode })
  return unwrap(data, error)
}

export async function createManagedProfile(crewId: string, input: ManagedProfileInput) {
  const { data, error } = await client().rpc('create_managed_profile', {
    p_crew_id: crewId,
    p_display_name: input.name,
    p_pin: input.pin,
    p_color: input.color,
  })
  return unwrap(data, error)
}

export async function verifyManagedProfilePin(profileId: string, pin: string) {
  const { data, error } = await client().rpc('verify_managed_profile_pin', {
    p_profile_id: profileId,
    p_pin: pin,
  })
  return unwrap(data as boolean | null, error)
}

export async function claimRealChore(choreId: string, memberId: string) {
  const { error } = await client().rpc('claim_chore', { p_occurrence_id: choreId, p_member_id: memberId })
  if (error) throw new Error(error.message)
}

export async function unclaimRealChore(choreId: string, memberId: string) {
  const { error } = await client().rpc('unclaim_chore', { p_occurrence_id: choreId, p_member_id: memberId })
  if (error) throw new Error(error.message)
}

export async function completeRealChore(choreId: string, memberId: string) {
  const { error } = await client().rpc('complete_chore', { p_occurrence_id: choreId, p_member_id: memberId })
  if (error) throw new Error(error.message)
}

export async function approveRealChore(choreId: string) {
  const { error } = await client().rpc('approve_chore', {
    p_occurrence_id: choreId,
    p_idempotency_key: crypto.randomUUID(),
  })
  if (error) throw new Error(error.message)
}

export async function createRealChore(crewId: string, input: NewChoreInput) {
  const cadence = input.cadence.toLowerCase().replace('one time', 'one_time')
  const { error } = await client().rpc('create_chore', {
    p_crew_id: crewId,
    p_title: input.title,
    p_category: input.category,
    p_reward_cents: input.rewardCents,
    p_cadence: cadence,
    p_instructions: input.instructions ?? null,
    p_due_at: null,
  })
  if (error) throw new Error(error.message)
}

export async function setSavingsGoal(crewId: string, memberId: string, name: string, targetCents: number) {
  const { error } = await client().rpc('set_savings_goal', {
    p_crew_id: crewId,
    p_member_id: memberId,
    p_name: name,
    p_target_cents: targetCents,
  })
  if (error) throw new Error(error.message)
}

export async function recordRealPayout(crewId: string, input: PayoutInput) {
  const { error } = await client().rpc('record_payout', {
    p_crew_id: crewId,
    p_member_id: input.memberId,
    p_amount_cents: input.amountCents,
    p_description: input.description,
    p_idempotency_key: crypto.randomUUID(),
  })
  if (error) throw new Error(error.message)
}

export async function updateRealMemberRole(crewId: string, memberId: string, role: MemberRole) {
  const { error } = await client().rpc('update_crew_member_role', {
    p_crew_id: crewId,
    p_member_id: memberId,
    p_role: role,
  })
  if (error) throw new Error(error.message)
}

export async function removeRealMember(crewId: string, memberId: string) {
  const { error } = await client().rpc('remove_crew_member', {
    p_crew_id: crewId,
    p_member_id: memberId,
  })
  if (error) throw new Error(error.message)
}
