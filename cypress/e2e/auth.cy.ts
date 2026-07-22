describe('Choreline authentication', () => {
  it('offers real account creation and recovery', () => {
    cy.visit('/')
    cy.contains('Ready when you are.').should('be.visible')
    cy.contains('button', 'Create an account').click()
    cy.contains('Make good work visible.').should('be.visible')
    cy.contains('button', 'Sign in').click()
    cy.contains('button', 'Forgot password?').should('be.visible')
  })
})
