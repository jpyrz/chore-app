/// <reference types="cypress" />

import { mount } from 'cypress/react'
import { MemoryRouter } from 'react-router'
import { NotificationCenter } from './NotificationCenter'

describe('NotificationCenter', () => {
  it('shows unread activity and marks a notification as read when opened', () => {
    cy.viewport(375, 667)
    const onMarkRead = cy.stub().resolves()
    const onClose = cy.stub()
    cy.wrap(onMarkRead).as('markRead')
    cy.wrap(onClose).as('close')

    mount(
      <MemoryRouter>
        <NotificationCenter
          notifications={[{
            id: 'notice-1',
            kind: 'approval_needed',
            title: 'Sweep the porch is ready for approval',
            body: 'Mia marked this job finished.',
            read: false,
            createdAt: new Date().toISOString(),
          }]}
          open
          onToggle={cy.stub()}
          onClose={onClose}
          onMarkRead={onMarkRead}
          onMarkAllRead={cy.stub().resolves()}
        />
      </MemoryRouter>,
    )

    cy.get('button[aria-label="Notifications, 1 unread"]').should('be.visible')
    cy.contains('button', 'Sweep the porch is ready for approval').click()
    cy.get('@markRead').should('have.been.calledWith', 'notice-1')
    cy.get('@close').should('have.been.calledOnce')
  })

  it('offers a friendly empty state', () => {
    mount(
      <MemoryRouter>
        <NotificationCenter
          notifications={[]}
          open
          onToggle={cy.stub()}
          onClose={cy.stub()}
          onMarkRead={cy.stub().resolves()}
          onMarkAllRead={cy.stub().resolves()}
        />
      </MemoryRouter>,
    )

    cy.contains('Quiet for now').should('be.visible')
    cy.contains('New jobs and Crew updates will land here.').should('be.visible')
  })
})
