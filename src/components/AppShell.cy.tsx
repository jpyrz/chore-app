/// <reference types="cypress" />

import { mount } from 'cypress/react'
import { MemoryRouter } from 'react-router'
import type { CrewSnapshot } from '../types/domain'
import { HomeView } from '../views/HomeView'
import { AppShell } from './AppShell'

const snapshot: CrewSnapshot = {
  crew: { id: 'crew-1', name: 'The Pyrz Crew', inviteCode: 'GOODWORK' },
  activeMemberId: 'mia',
  members: [
    { id: 'james', name: 'James', initials: 'JP', role: 'owner', color: '#247c66', streak: 4 },
    { id: 'mia', name: 'Mia', initials: 'MI', role: 'member', color: '#ef745e', streak: 3, managedBy: 'james' },
  ],
  chores: [
    {
      id: 'chore-1',
      title: 'Feed the dogs',
      category: 'pets',
      rewardCents: 200,
      timing: 'Today',
      cadence: 'Daily',
      status: 'available',
      instructions: 'Fresh water too, please.',
    },
    {
      id: 'chore-2',
      title: 'Put away clean dishes',
      category: 'kitchen',
      rewardCents: 300,
      timing: 'Today',
      cadence: 'Daily',
      status: 'claimed',
      assigneeId: 'mia',
    },
  ],
  ledger: [
    { id: 'earning-1', memberId: 'mia', kind: 'earning', amountCents: 800, description: 'Fold the laundry', createdAt: new Date().toISOString() },
  ],
  goals: {
    james: { name: 'Something worth saving for', targetCents: 2500 },
    mia: { name: 'New art supplies', targetCents: 3000 },
  },
}

describe('AppShell mobile navigation', () => {
  it('keeps the navigation dock above the bottom gesture area', () => {
    cy.viewport(390, 844)
    const activeMember = snapshot.members[1]

    mount(
      <MemoryRouter>
        <AppShell
          snapshot={snapshot}
          activeMember={activeMember}
          currentProfileId="james"
          memberships={[{ crewId: 'crew-1', crewName: 'The Pyrz Crew', inviteCode: 'GOODWORK', role: 'owner' }]}
          notifications={[]}
          onSelectCrew={cy.stub()}
          onSelectMember={async () => true}
          onMarkNotificationRead={async () => undefined}
          onMarkAllNotificationsRead={async () => undefined}
          onSignOut={async () => undefined}
        >
          <HomeView
            snapshot={snapshot}
            activeMember={activeMember}
            onClaim={cy.stub()}
            onUnclaim={cy.stub()}
            onComplete={cy.stub()}
            onApprove={cy.stub()}
            onAddChore={cy.stub()}
          />
        </AppShell>
      </MemoryRouter>,
    )

    cy.get('nav[aria-label="Main navigation"]')
      .should('have.css', 'bottom', '12px')
      .and('have.css', 'border-radius', '23px')
  })
})
