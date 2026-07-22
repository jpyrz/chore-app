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
          timing: 'Today',
          cadence: 'Weekly',
          status: 'available',
        }}
        mode="available"
        onAction={onAction}
      />,
    )

    cy.contains('Sweep the porch').should('be.visible')
    cy.contains('$4').should('be.visible')
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
        }}
        mode="mine"
        onAction={onFinish}
        onSecondaryAction={onUnclaim}
      />,
    )

    cy.contains('button', 'Unclaim').click()
    cy.get('@unclaim').should('have.been.calledOnce')
    cy.get('@finish').should('not.have.been.called')
  })
})
