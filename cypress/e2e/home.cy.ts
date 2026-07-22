describe('Choreline home', () => {
  it('lets a member claim an available job', () => {
    cy.visit('/')
    cy.contains('choreline').should('be.visible')
    cy.contains('Pick your next win').should('be.visible')
    cy.contains('button', 'I’ll do it').first().click()
    cy.contains('Your lineup').should('be.visible')
  })
})
