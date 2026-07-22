import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { mount } from 'cypress/react'
import { AuthView } from './AuthView'

describe('AuthView', () => {
  it('moves between sign-in and account creation', () => {
    const queryClient = new QueryClient()
    mount(<QueryClientProvider client={queryClient}><AuthView /></QueryClientProvider>)

    cy.contains('Ready when you are.').should('be.visible')
    cy.contains('button', 'Create an account').click()
    cy.contains('Make good work visible.').should('be.visible')
    cy.contains('label', 'Your name').should('be.visible')
  })
})
