import { initialSnapshot } from '../data/demo'
import type { CrewSnapshot, NewChoreInput } from '../types/domain'

const STORAGE_KEY = 'choreline.demo.v1'

function cloneInitialSnapshot(): CrewSnapshot {
  return structuredClone(initialSnapshot)
}

export async function getSnapshot(): Promise<CrewSnapshot> {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) return cloneInitialSnapshot()

  try {
    return JSON.parse(stored) as CrewSnapshot
  } catch {
    return cloneInitialSnapshot()
  }
}

export async function saveSnapshot(snapshot: CrewSnapshot): Promise<CrewSnapshot> {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  return snapshot
}

export function setActiveMember(snapshot: CrewSnapshot, memberId: string): CrewSnapshot {
  return { ...snapshot, activeMemberId: memberId }
}

export function claimChore(snapshot: CrewSnapshot, choreId: string): CrewSnapshot {
  return {
    ...snapshot,
    chores: snapshot.chores.map((chore) =>
      chore.id === choreId && chore.status === 'available'
        ? { ...chore, status: 'claimed', assigneeId: snapshot.activeMemberId }
        : chore,
    ),
  }
}

export function completeChore(snapshot: CrewSnapshot, choreId: string): CrewSnapshot {
  return {
    ...snapshot,
    chores: snapshot.chores.map((chore) =>
      chore.id === choreId && chore.assigneeId === snapshot.activeMemberId
        ? { ...chore, status: 'review' }
        : chore,
    ),
  }
}

export function approveChore(snapshot: CrewSnapshot, choreId: string): CrewSnapshot {
  const chore = snapshot.chores.find((item) => item.id === choreId)
  if (!chore || chore.status !== 'review' || !chore.assigneeId) return snapshot

  return {
    ...snapshot,
    chores: snapshot.chores.map((item) =>
      item.id === choreId ? { ...item, status: 'completed' } : item,
    ),
    ledger: [
      {
        id: `ledger-${crypto.randomUUID()}`,
        memberId: chore.assigneeId,
        kind: 'earning',
        amountCents: chore.rewardCents,
        description: chore.title,
        createdAt: new Date().toISOString(),
      },
      ...snapshot.ledger,
    ],
  }
}

export function addChore(snapshot: CrewSnapshot, input: NewChoreInput): CrewSnapshot {
  return {
    ...snapshot,
    chores: [
      {
        id: `chore-${crypto.randomUUID()}`,
        ...input,
        status: 'available',
      },
      ...snapshot.chores,
    ],
  }
}

export function resetDemo(): CrewSnapshot {
  const snapshot = cloneInitialSnapshot()
  window.localStorage.removeItem(STORAGE_KEY)
  return snapshot
}
