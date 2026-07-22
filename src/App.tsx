import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { isSupabaseConfigured } from './api/supabase'
import { verifyAccountPassword } from './api/auth'
import { AppShell } from './components/AppShell'
import { useAccount, useOnboarding, useRealCrew } from './hooks/useChoreline'
import { useAuth } from './state/useAuth'
import { AuthView } from './views/AuthView'
import { ConfigurationView } from './views/ConfigurationView'
import { CrewView } from './views/CrewView'
import { EarningsView } from './views/EarningsView'
import { HomeView } from './views/HomeView'
import { OnboardingView } from './views/OnboardingView'
import { ProfileView } from './views/ProfileView'
import { ResetPasswordView } from './views/ResetPasswordView'

function LoadingScreen({ message = 'Getting your Crew ready…' }: { message?: string }) {
  return (
    <main className="loading-screen" aria-label={message}>
      <img src="/mark.svg" alt="" />
      <p>{message}</p>
    </main>
  )
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="error-screen">
      <img src="/mark.svg" alt="" />
      <h1>We hit a snag.</h1>
      <p>{message}</p>
      <button onClick={onRetry}>Try again</button>
    </main>
  )
}

function SignedInApp({ authUserId }: { authUserId: string }) {
  const account = useAccount(authUserId)
  const [crewId, setCrewId] = useState<string | undefined>(() => window.localStorage.getItem(`choreline.crew.${authUserId}`) ?? undefined)
  const [activeMemberId, setActiveMemberId] = useState<string>()

  useEffect(() => {
    if (!account.data) return
    setCrewId((current) =>
      current && account.data.memberships.some((membership) => membership.crewId === current)
        ? current
        : account.data.memberships[0]?.crewId,
    )
    setActiveMemberId((current) => {
      if (current) return current
      const selectedCrew = crewId ?? account.data.memberships[0]?.crewId
      return selectedCrew
        ? window.localStorage.getItem(`choreline.profile.${authUserId}.${selectedCrew}`) ?? account.data.profile.id
        : account.data.profile.id
    })
  }, [account.data, authUserId, crewId])

  const crew = useRealCrew(crewId, activeMemberId)
  const memberships = useOnboarding(authUserId)
  const auth = useAuth()

  if (account.isLoading) return <LoadingScreen message="Finding your account…" />
  if (account.error) return <ErrorScreen message={account.error.message} onRetry={() => void account.refetch()} />
  if (!account.data) return <ErrorScreen message="Your account profile could not be loaded." onRetry={() => void account.refetch()} />
  if (account.data.memberships.length === 0) return <OnboardingView authUserId={authUserId} profile={account.data.profile} />
  if (!crewId || crew.isLoading || !crew.data) return <LoadingScreen />
  if (crew.error) return <ErrorScreen message={crew.error.message} onRetry={() => void crew.refetch()} />

  const currentProfileId = account.data.profile.id
  const activeMember =
    crew.data.members.find((member) => member.id === crew.data.activeMemberId) ??
    crew.data.members.find((member) => member.id === currentProfileId) ??
    crew.data.members[0]

  const switchCrew = (nextCrewId: string) => {
    setCrewId(nextCrewId)
    window.localStorage.setItem(`choreline.crew.${authUserId}`, nextCrewId)
    setActiveMemberId(window.localStorage.getItem(`choreline.profile.${authUserId}.${nextCrewId}`) ?? currentProfileId)
  }

  const selectMember = (memberId: string) => {
    setActiveMemberId(memberId)
    window.localStorage.setItem(`choreline.profile.${authUserId}.${crewId}`, memberId)
  }

  return (
    <AppShell
      snapshot={crew.data}
      activeMember={activeMember}
      currentProfileId={currentProfileId}
      memberships={account.data.memberships}
      onSelectCrew={switchCrew}
      onSelectMember={async (memberId, pin) => {
        if (memberId === currentProfileId && activeMember.id !== currentProfileId) {
          const verified = await verifyAccountPassword(auth.user?.email ?? '', pin ?? '')
          if (!verified) return false
        } else if (memberId !== currentProfileId) {
          const verified = await crew.verifyManagedProfilePin(memberId, pin ?? '')
          if (!verified) return false
        }
        selectMember(memberId)
        return true
      }}
      onSignOut={auth.signOut}
    >
      {crew.mutationError && <div className="app-alert" role="alert">{crew.mutationError.message}</div>}
      <Routes>
        <Route
          path="/"
          element={
            <HomeView
              snapshot={crew.data}
              activeMember={activeMember}
              onClaim={crew.claimChore}
              onComplete={crew.completeChore}
              onApprove={crew.approveChore}
              onAddChore={crew.addChore}
            />
          }
        />
        <Route
          path="/earnings"
          element={
            <EarningsView
              snapshot={crew.data}
              activeMember={activeMember}
              onUpdateGoal={crew.updateGoal}
            />
          }
        />
        <Route
          path="/crew"
          element={
            <CrewView
              snapshot={crew.data}
              activeMember={activeMember}
              onAddManagedProfile={crew.addManagedProfile}
              onRecordPayout={crew.recordPayout}
              onUpdateRole={crew.updateMemberRole}
              onRemoveMember={crew.removeMember}
            />
          }
        />
        <Route
          path="/profile"
          element={
            <ProfileView
              snapshot={crew.data}
              activeMember={activeMember}
              email={auth.user?.email ?? ''}
              memberships={account.data.memberships}
              onCreateCrew={memberships.createCrew}
              onJoinCrew={memberships.joinCrew}
              membershipPending={memberships.isPending}
              membershipError={memberships.error?.message}
              onSignOut={auth.signOut}
            />
          }
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </AppShell>
  )
}

function App() {
  const auth = useAuth()

  if (!isSupabaseConfigured) return <ConfigurationView />
  if (auth.loading) return <LoadingScreen message="Opening Choreline…" />
  if (window.location.pathname === '/reset-password' && auth.session) return <ResetPasswordView />
  if (!auth.user) return <AuthView />
  return <SignedInApp authUserId={auth.user.id} />
}

export default App
