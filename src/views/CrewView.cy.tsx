/// <reference types="cypress" />

import { mount } from 'cypress/react'
import type { CrewSnapshot } from '../types/domain'
import { CrewView } from './CrewView'

const snapshot: CrewSnapshot = {
  crew: { id: 'crew-1', name: 'The Crew', inviteCode: 'GOODWORK' },
  activeMemberId: 'james',
  members: [
    { id: 'james', name: 'James', initials: 'JP', role: 'owner', color: '#247c66', streak: 0 },
    { id: 'mia', name: 'Mia', initials: 'MI', role: 'member', color: '#ef745e', streak: 2, managedBy: 'james' },
  ],
  chores: [],
  ledger: [
    { id: 'earning-1', memberId: 'mia', kind: 'earning', category: 'chore', amountCents: 800, description: 'Test job', createdAt: '2026-07-22T12:00:00Z' },
  ],
  balances: { james: 0, mia: 800 },
  goals: {
    james: { name: 'Something worth saving for', targetCents: 2500 },
    mia: { name: 'Art supplies', targetCents: 3000 },
  },
}

describe('Crew bank controls', () => {
  it('lets a manager correct a child balance without deleting history', () => {
    const setBalance = cy.stub().resolves()

    mount(
      <CrewView
        snapshot={snapshot}
        activeMember={snapshot.members[0]}
        onAddManagedProfile={cy.stub().resolves()}
        onRecordBankTransaction={cy.stub().resolves()}
        onSetBankBalance={setBalance}
        onUpdateRole={cy.stub().resolves()}
        onRemoveMember={cy.stub().resolves()}
      />,
    )

    cy.contains('article', 'Mia').within(() => cy.contains('button', 'Manage bank').click())
    cy.contains('h2', 'Manage a bank').should('be.visible')
    cy.contains('label', 'Action').find('select').select('Correct the balance')
    cy.contains('label', 'New balance').find('input').clear().type('0')
    cy.contains('label', 'Note').find('input').should('have.value', '').and('not.have.attr', 'required')
    cy.contains('button', 'Correct balance').click()
    cy.wrap(setBalance).should('have.been.calledWithMatch', {
      memberId: 'mia',
      targetCents: 0,
      description: 'Balance correction',
    })
  })

  it('adds money quickly without requiring a note', () => {
    const recordTransaction = cy.stub().resolves()

    mount(
      <CrewView
        snapshot={snapshot}
        activeMember={snapshot.members[0]}
        onAddManagedProfile={cy.stub().resolves()}
        onRecordBankTransaction={recordTransaction}
        onSetBankBalance={cy.stub().resolves()}
        onUpdateRole={cy.stub().resolves()}
        onRemoveMember={cy.stub().resolves()}
      />,
    )

    cy.contains('article', 'Mia').within(() => cy.contains('button', 'Manage bank').click())
    cy.contains('label', 'Amount').find('input').type('20')
    cy.contains('label', 'Note').find('input')
      .should('have.value', '')
      .and('have.attr', 'placeholder', 'Birthday, holiday, or who it came from')
    cy.contains('button', 'Add to bank').click()
    cy.wrap(recordTransaction).should('have.been.calledWithMatch', {
      memberId: 'mia',
      direction: 'deposit',
      category: 'gift',
      amountCents: 2000,
      description: 'Gift',
    })
  })
})
