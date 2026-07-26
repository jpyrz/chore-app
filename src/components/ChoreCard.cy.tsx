/// <reference types="cypress" />

import { mount } from 'cypress/react'
import { ChoreCard } from './ChoreCard'

describe('ChoreCard', () => {
  it('shows a reward and lets a member claim the job', () => {
    const onAction = cy.stub().as('claim')
    mount(
      <ChoreCard
        chore={{
          id: 'test',
          title: 'Sweep the porch',
          category: 'outside',
          rewardCents: 400,
          timing: 'Available now',
          cadence: 'Weekly',
          status: 'available',
        }}
        mode="available"
        onAction={onAction}
      />,
    )

    cy.contains('Sweep the porch').should('be.visible')
    cy.contains('$4').should('be.visible')
    cy.contains('Available now').should('be.visible')
    cy.contains('Due').should('not.exist')
    cy.contains('button', 'I’ll do it').click()
    cy.get('@claim').should('have.been.calledOnce')
  })

  it('lets the assigned member return a claimed job', () => {
    const onFinish = cy.stub().as('finish')
    const onUnclaim = cy.stub().as('unclaim')

    mount(
      <ChoreCard
        chore={{
          id: 'claimed-job',
          title: 'Put away laundry',
          category: 'laundry',
          rewardCents: 300,
          timing: 'Today',
          cadence: 'Daily',
          status: 'claimed',
          assigneeId: 'member-1',
          claimExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }}
        mode="mine"
        onAction={onFinish}
        onSecondaryAction={onUnclaim}
      />,
    )

    cy.contains('Finish by').should('be.visible')
    cy.contains('button', 'Unclaim').click()
    cy.get('@unclaim').should('have.been.calledOnce')
    cy.get('@finish').should('not.have.been.called')
  })

  it('keeps a directly assigned job in the member lineup without an unclaim action', () => {
    const onFinish = cy.stub().as('finish')

    mount(
      <ChoreCard
        chore={{
          id: 'assigned-job',
          title: 'Finish a chess game with Dad',
          category: 'other',
          rewardCents: 500,
          timing: 'Assigned to you · No deadline',
          cadence: 'One time',
          status: 'claimed',
          assigneeId: 'member-1',
          isAssigned: true,
        }}
        mode="mine"
        onAction={onFinish}
      />,
    )

    cy.contains('Assigned to you · No deadline').should('be.visible')
    cy.contains('button', 'Unclaim').should('not.exist')
    cy.contains('button', 'Mark finished').click()
    cy.get('@finish').should('have.been.calledOnce')
  })
})
