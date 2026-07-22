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
})
