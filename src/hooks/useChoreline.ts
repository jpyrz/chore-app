import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveRealChore,
  claimRealChore,
  completeRealChore,
  createCrew,
  createManagedProfile,
  createRealChore,
  getAccountContext,
  getCrewSnapshot,
  joinCrew,
  recordRealPayout,
  removeRealMember,
  setSavingsGoal,
  updateRealMemberRole,
  verifyManagedProfilePin,
} from '../api/chorelineRepository'
import type { ManagedProfileInput, MemberRole, NewChoreInput, PayoutInput } from '../types/domain'

function useCrewMutation<T>(queryKey: Array<string | undefined>, mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
}

export function useAccount(authUserId: string | undefined) {
  return useQuery({
    queryKey: ['account', authUserId],
    queryFn: () => getAccountContext(authUserId!),
    enabled: Boolean(authUserId),
  })
}

export function useOnboarding(authUserId: string | undefined) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['account', authUserId] })
  const createMutation = useMutation({ mutationFn: createCrew, onSuccess: invalidate })
  const joinMutation = useMutation({ mutationFn: joinCrew, onSuccess: invalidate })

  return {
    createCrew: createMutation.mutateAsync,
    joinCrew: joinMutation.mutateAsync,
    isPending: createMutation.isPending || joinMutation.isPending,
    error: createMutation.error ?? joinMutation.error,
  }
}

export function useRealCrew(crewId: string | undefined, activeMemberId: string | undefined) {
  const queryKey = ['crew', crewId]
  const query = useQuery({
    queryKey,
    queryFn: () => getCrewSnapshot(crewId!),
    enabled: Boolean(crewId),
    refetchOnWindowFocus: true,
    staleTime: 15_000,
    select: (snapshot) => ({ ...snapshot, activeMemberId: activeMemberId ?? snapshot.activeMemberId }),
  })

  const claim = useCrewMutation<string>(queryKey, (choreId) => claimRealChore(choreId, activeMemberId!))
  const complete = useCrewMutation<string>(queryKey, (choreId) => completeRealChore(choreId, activeMemberId!))
  const approve = useCrewMutation<string>(queryKey, approveRealChore)
  const add = useCrewMutation<NewChoreInput>(queryKey, (input) => createRealChore(crewId!, input))
  const addManaged = useCrewMutation<ManagedProfileInput>(queryKey, (input) => createManagedProfile(crewId!, input))
  const goal = useCrewMutation<{ name: string; targetCents: number }>(queryKey, (input) =>
    setSavingsGoal(crewId!, activeMemberId!, input.name, input.targetCents),
  )
  const payout = useCrewMutation<PayoutInput>(queryKey, (input) => recordRealPayout(crewId!, input))
  const updateRole = useCrewMutation<{ memberId: string; role: MemberRole }>(queryKey, (input) =>
    updateRealMemberRole(crewId!, input.memberId, input.role),
  )
  const removeMember = useCrewMutation<string>(queryKey, (memberId) => removeRealMember(crewId!, memberId))

  return {
    ...query,
    claimChore: claim.mutateAsync,
    completeChore: complete.mutateAsync,
    approveChore: approve.mutateAsync,
    addChore: add.mutateAsync,
    addManagedProfile: addManaged.mutateAsync,
    updateGoal: goal.mutateAsync,
    recordPayout: payout.mutateAsync,
    updateMemberRole: updateRole.mutateAsync,
    removeMember: removeMember.mutateAsync,
    verifyManagedProfilePin,
    isSaving:
      claim.isPending || complete.isPending || approve.isPending || add.isPending || addManaged.isPending || goal.isPending || payout.isPending || updateRole.isPending || removeMember.isPending,
    mutationError: claim.error ?? complete.error ?? approve.error ?? add.error ?? addManaged.error ?? goal.error ?? payout.error ?? updateRole.error ?? removeMember.error,
  }
}
