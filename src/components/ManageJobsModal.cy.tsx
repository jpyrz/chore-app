/// <reference types="cypress" />

import { mount } from 'cypress/react'
import type { JobTemplate, Member } from '../types/domain'
import { ManageJobsModal } from './ManageJobsModal'

const members: Member[] = [
  { id: 'james', name: 'James', initials: 'JP', role: 'owner', color: '#247c66', streak: 0 },
  { id: 'mia', name: 'Mia', initials: 'MI', role: 'member', color: '#ef745e', streak: 2 },
]

const jobs: JobTemplate[] = [
  {
    id: 'template-1',
    title: 'Feed the dogs',
    category: 'pets',
    rewardCents: 300,
    cadence: 'Daily',
    currentStatus: 'available',
  },
  {
    id: 'template-2',
    title: 'Finish a chess game',
    category: 'other',
    rewardCents: 500,
    cadence: 'Weekly',
    currentStatus: 'claimed',
    currentAssigneeId: 'mia',
  },
]

describe('ManageJobsModal', () => {
  it('lets a manager archive an available job without calling it a history deletion', () => {
    const archive = cy.stub().resolves()

    mount(
      <ManageJobsModal
        jobs={jobs}
        members={members}
        onClose={cy.stub()}
        onArchive={archive}
      />,
    )

    cy.contains('article', 'Feed the dogs').within(() => cy.contains('button', 'Archive').click())
    cy.contains('[role="alertdialog"]', 'Completed work and bank history stay untouched.').should('be.visible')
    cy.contains('button', 'Archive job').click()
    cy.wrap(archive).should('have.been.calledOnceWith', 'template-1')
  })

  it('warns when archiving removes a claimed job from a member lineup', () => {
    mount(
      <ManageJobsModal
        jobs={jobs}
        members={members}
        onClose={cy.stub()}
        onArchive={cy.stub().resolves()}
      />,
    )

    cy.contains('article', 'Finish a chess game').within(() => cy.contains('button', 'Archive').click())
    cy.contains('[role="alertdialog"]', 'Mia has this in their lineup.').should('be.visible')
    cy.contains('[role="alertdialog"]', 'does not add money to their bank').should('be.visible')
  })
})
