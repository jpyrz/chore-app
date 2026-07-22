import { mount } from 'cypress/react'
import '../../src/styles/global.scss'

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount
    }
  }
}

Cypress.Commands.add('mount', mount)
