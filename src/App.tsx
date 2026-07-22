import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { useCrew } from './hooks/useCrew'
import { CrewView } from './views/CrewView'
import { EarningsView } from './views/EarningsView'
import { HomeView } from './views/HomeView'
import { ProfileView } from './views/ProfileView'

function App() {
  const crew = useCrew()

  if (crew.isLoading || !crew.data) {
    return (
      <main className="loading-screen" aria-label="Loading Choreline">
        <img src="/mark.svg" alt="" />
        <p>Setting up your line…</p>
      </main>
    )
  }

  const activeMember =
    crew.data.members.find((member) => member.id === crew.data.activeMemberId) ??
    crew.data.members[0]

  return (
    <AppShell
      snapshot={crew.data}
      activeMember={activeMember}
      onSelectMember={crew.setActiveMember}
    >
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
          element={<EarningsView snapshot={crew.data} activeMember={activeMember} />}
        />
        <Route path="/crew" element={<CrewView snapshot={crew.data} />} />
        <Route
          path="/profile"
          element={<ProfileView snapshot={crew.data} activeMember={activeMember} onReset={crew.reset} />}
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </AppShell>
  )
}

export default App
