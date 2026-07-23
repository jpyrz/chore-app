/// <reference types="cypress" />

import { mount } from 'cypress/react'
import type { CrewSnapshot } from '../types/domain'
import { EarningsView } from './EarningsView'

const snapshot: CrewSnapshot = {
  crew: { id: 'crew-1', name: 'The Crew', inviteCode: 'GOODWORK' },
  activeMemberId: 'mia',
  members: [
    { id: 'mia', name: 'Mia', initials: 'MI', role: 'member', color: '#ef745e', streak: 2 },
  ],
  chores: [
    { id: 'job-1', title: 'Feed the dogs', category: 'pets', rewardCents: 300, timing: 'Today', cadence: 'Daily', status: 'claimed', assigneeId: 'mia' },
    { id: 'job-2', title: 'Put away dishes', category: 'kitchen', rewardCents: 200, timing: 'Today', cadence: 'Daily', status: 'review', assigneeId: 'mia' },
  ],
  ledger: [
    { id: 'gift-1', memberId: 'mia', kind: 'adjustment', category: 'gift', amountCents: 2000, description: 'Birthday gift', createdAt: '2026-07-22T12:00:00Z' },
    { id: 'purchase-1', memberId: 'mia', kind: 'adjustment', category: 'purchase', amountCents: -500, description: 'Book', createdAt: '2026-07-22T13:00:00Z' },
  ],
  balances: { mia: 1500 },
  goals: { mia: { name: 'Art supplies', targetCents: 3000 } },
}

describe('Bank view', () => {
  it('centers the current balance and pending job money', () => {
    mount(<EarningsView snapshot={snapshot} activeMember={snapshot.members[0]} onUpdateGoal={cy.stub().resolves()} />)

    cy.contains('Bank balance').parent().should('contain', '$15')
    cy.contains('On the way').parent().should('contain', '$5')
    cy.contains('Birthday gift').should('be.visible')
    cy.contains('Book').should('be.visible')
    cy.contains('All-time earned').should('not.exist')
  })
})
