import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addChore,
  approveChore,
  claimChore,
  completeChore,
  getSnapshot,
  resetDemo,
  saveSnapshot,
  setActiveMember,
} from '../api/demoRepository'
import type { CrewSnapshot, NewChoreInput } from '../types/domain'

const CREW_QUERY_KEY = ['crew', 'demo']

export function useCrew() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: CREW_QUERY_KEY, queryFn: getSnapshot })

  const mutation = useMutation({
    mutationFn: saveSnapshot,
    onSuccess: (snapshot) => queryClient.setQueryData(CREW_QUERY_KEY, snapshot),
  })

  const update = (transform: (snapshot: CrewSnapshot) => CrewSnapshot) => {
    const snapshot = queryClient.getQueryData<CrewSnapshot>(CREW_QUERY_KEY)
    if (snapshot) mutation.mutate(transform(snapshot))
  }

  return {
    ...query,
    isSaving: mutation.isPending,
    setActiveMember: (memberId: string) => update((snapshot) => setActiveMember(snapshot, memberId)),
    claimChore: (choreId: string) => update((snapshot) => claimChore(snapshot, choreId)),
    completeChore: (choreId: string) => update((snapshot) => completeChore(snapshot, choreId)),
    approveChore: (choreId: string) => update((snapshot) => approveChore(snapshot, choreId)),
    addChore: (input: NewChoreInput) => update((snapshot) => addChore(snapshot, input)),
    reset: () => mutation.mutate(resetDemo()),
  }
}
