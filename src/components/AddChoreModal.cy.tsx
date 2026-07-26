/// <reference types="cypress" />

import { mount } from 'cypress/react'
import { AddChoreModal } from './AddChoreModal'

const members = [
  { id: 'james', name: 'James', initials: 'JP', role: 'owner' as const, color: '#247c66', streak: 0 },
  { id: 'mia', name: 'Mia', initials: 'MI', role: 'member' as const, color: '#ef745e', streak: 0 },
]

describe('AddChoreModal', () => {
  it('creates an up-for-grabs job with a custom claim window', () => {
    const onAdd = cy.stub().as('add')

    mount(<AddChoreModal members={members} onClose={cy.stub()} onAdd={onAdd} />)

    cy.get('input[placeholder="Wash the car"]').type('Rake the leaves')
    cy.contains('label', 'Time to finish after claiming').find('select').select('Custom…')
    cy.contains('label', 'Amount').find('input').clear().type('5')
    cy.contains('label', 'Unit').find('select').select('Days')
    cy.contains('button', 'Add to the line').click()

    cy.get('@add').should('have.been.calledWithMatch', {
      title: 'Rake the leaves',
      claimWindowHours: 120,
      assignedMemberId: undefined,
    })
  })

  it('assigns a job directly and removes the claim timer controls', () => {
    const onAdd = cy.stub().as('add')

    mount(<AddChoreModal members={members} onClose={cy.stub()} onAdd={onAdd} />)

    cy.get('input[placeholder="Wash the car"]').type('Finish a chess game')
    cy.contains('label', 'Who can do this?').find('select').select('Mia')
    cy.contains('Time to finish after claiming').should('not.exist')
    cy.contains('stay there until it’s finished').should('be.visible')
    cy.contains('button', 'Add to the line').click()

    cy.get('@add').should('have.been.calledWithMatch', {
      title: 'Finish a chess game',
      assignedMemberId: 'mia',
      claimWindowHours: null,
    })
  })
})
