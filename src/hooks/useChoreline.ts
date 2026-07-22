import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import {
  approveRealChore,
  claimRealChore,
  completeRealChore,
  createCrew,
  createManagedProfile,
  createRealChore,
  getAccountContext,
  getCrewSnapshot,
  getNotifications,
  joinCrew,
  markAllNotificationsRead,
  markNotificationRead,
  recordRealPayout,
  removeRealMember,
  setSavingsGoal,
  unclaimRealChore,
  updateRealMemberRole,
  verifyManagedProfilePin,
} from '../api/chorelineRepository'
import { supabase } from '../api/supabase'
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
  const queryClient = useQueryClient()
  const queryKey = ['crew', crewId]
  const notificationsKey = ['notifications', crewId, activeMemberId]
  const query = useQuery({
    queryKey,
    queryFn: () => getCrewSnapshot(crewId!),
    enabled: Boolean(crewId),
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    staleTime: 15_000,
    select: (snapshot) => ({ ...snapshot, activeMemberId: activeMemberId ?? snapshot.activeMemberId }),
  })

  const notificationsQuery = useQuery({
    queryKey: notificationsKey,
    queryFn: () => getNotifications(crewId!, activeMemberId!),
    enabled: Boolean(crewId && activeMemberId),
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  useEffect(() => {
    const realtimeClient = supabase
    if (!crewId || !realtimeClient) return

    const refreshCrew = () => {
      void queryClient.invalidateQueries({ queryKey: ['crew', crewId] })
    }
    const refreshMembership = () => {
      refreshCrew()
      void queryClient.invalidateQueries({ queryKey: ['account'] })
    }
    const refreshNotifications = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', crewId] })
    }

    const channel = realtimeClient
      .channel(`choreline-crew-${crewId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crews', filter: `id=eq.${crewId}` }, refreshCrew)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crew_members', filter: `crew_id=eq.${crewId}` }, refreshMembership)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_templates', filter: `crew_id=eq.${crewId}` }, refreshCrew)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_occurrences', filter: `crew_id=eq.${crewId}` }, refreshCrew)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger_entries', filter: `crew_id=eq.${crewId}` }, refreshCrew)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_goals', filter: `crew_id=eq.${crewId}` }, refreshCrew)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `crew_id=eq.${crewId}` }, refreshNotifications)
      .subscribe()

    return () => {
      void realtimeClient.removeChannel(channel)
    }
  }, [crewId, queryClient])

  const claim = useCrewMutation<string>(queryKey, (choreId) => claimRealChore(choreId, activeMemberId!))
  const unclaim = useCrewMutation<string>(queryKey, (choreId) => unclaimRealChore(choreId, activeMemberId!))
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
  const markRead = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId, activeMemberId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey }),
  })
  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(crewId!, activeMemberId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey }),
  })

  return {
    ...query,
    claimChore: claim.mutateAsync,
    unclaimChore: unclaim.mutateAsync,
    completeChore: complete.mutateAsync,
    approveChore: approve.mutateAsync,
    addChore: add.mutateAsync,
    addManagedProfile: addManaged.mutateAsync,
    updateGoal: goal.mutateAsync,
    recordPayout: payout.mutateAsync,
    updateMemberRole: updateRole.mutateAsync,
    removeMember: removeMember.mutateAsync,
    notifications: notificationsQuery.data ?? [],
    markNotificationRead: markRead.mutateAsync,
    markAllNotificationsRead: markAllRead.mutateAsync,
    verifyManagedProfilePin,
    isSaving:
      claim.isPending || unclaim.isPending || complete.isPending || approve.isPending || add.isPending || addManaged.isPending || goal.isPending || payout.isPending || updateRole.isPending || removeMember.isPending,
    mutationError: claim.error ?? unclaim.error ?? complete.error ?? approve.error ?? add.error ?? addManaged.error ?? goal.error ?? payout.error ?? updateRole.error ?? removeMember.error,
  }
}
