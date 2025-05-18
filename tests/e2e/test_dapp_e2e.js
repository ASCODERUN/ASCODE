// Import Cypress commands and utilities
// Note: Cypress doesn't require explicit imports for its commands, but custom commands or plugins can be added here if needed
// For Web3 wallet interactions, we assume a mock or test wallet extension like Phantom is installed in the test browser

describe('Ontora AI DApp End-to-End Tests', () => {
  // Define base URL for the DApp (adjust based on your environment)
  const BASE_URL = 'http://localhost:3000'; // Assuming local dev server
  const WALLET_ADDRESS = 'mockWalletAddress123'; // Mock wallet address for testing

  beforeEach(() => {
    // Visit the DApp before each test
    cy.visit(BASE_URL);

    // Mock window.solana for wallet interactions if Phantom or another wallet isn't available in test environment
    cy.window().then((win) => {
      win.solana = {
        isPhantom: true,
        connect: cy.stub().resolves({ publicKey: { toString: () => WALLET_ADDRESS } }),
        disconnect: cy.stub().resolves(),
        signTransaction: cy.stub().resolves({ signature: 'mockSignature' }),
        signMessage: cy.stub().resolves({ signature: 'mockMessageSignature' })
      };
    });

    // Optionally, mock API responses if backend isn't fully set up
    cy.intercept('POST', '/api/governance/proposal', { statusCode: 200, body: { proposalId: 'prop456', title: 'Test Proposal', status: 'Draft' } }).as('createProposal');
    cy.intercept('POST', '/api/governance/vote', { statusCode: 200, body: { voteId: 'vote789', choice: 'Yes' } }).as('submitVote');
    cy.intercept('POST', '/api/ai/deploy', { statusCode: 200, body: { agentId: 'agent123', status: 'Deployed' } }).as('deployAgent');
  });

  it('should load the DApp homepage successfully', () => {
    // Verify the homepage loads and displays core elements
    cy.get('h1').should('contain.text', 'Ontora AI');
    cy.get('button').contains('Connect Wallet').should('be.visible');
    cy.get('nav').should('be.visible');
  });

  it('should connect a Solana wallet successfully', () => {
    // Simulate clicking the "Connect Wallet" button
    cy.get('button').contains('Connect Wallet').click();

    // Verify wallet connection status updates in UI
    cy.get('.wallet-status').should('contain.text', 'Connected');
    cy.get('.wallet-address').should('contain.text', WALLET_ADDRESS);

    // Verify the button text changes after connection
    cy.get('button').contains('Disconnect Wallet').should('be.visible');
  });

  it('should disconnect a Solana wallet successfully', () => {
    // First, connect the wallet
    cy.get('button').contains('Connect Wallet').click();
    cy.get('.wallet-status').should('contain.text', 'Connected');

    // Then, disconnect the wallet
    cy.get('button').contains('Disconnect Wallet').click();

    // Verify wallet disconnection status updates in UI
    cy.get('.wallet-status').should('contain.text', 'Disconnected');
    cy.get('.wallet-address').should('not.exist');
    cy.get('button').contains('Connect Wallet').should('be.visible');
  });

  it('should navigate to the governance dashboard after wallet connection', () => {
    // Connect wallet
    cy.get('button').contains('Connect Wallet').click();

    // Navigate to governance section
    cy.get('nav').contains('a', 'Governance').click();

    // Verify governance dashboard loads
    cy.url().should('include', '/governance');
    cy.get('h2').should('contain.text', 'Governance Dashboard');
    cy.get('button').contains('Create Proposal').should('be.visible');
  });

  it('should create a governance proposal successfully', () => {
    // Connect wallet
    cy.get('button').contains('Connect Wallet').click();

    // Navigate to governance section
    cy.get('nav').contains('a', 'Governance').click();

    // Click to create a new proposal
    cy.get('button').contains('Create Proposal').click();

    // Fill out proposal form
    cy.get('input[name="title"]').type('Test Proposal for Ontora AI');
    cy.get('textarea[name="description"]').type('This is a test proposal to enhance AI agent deployment rules.');
    cy.get('button').contains('Submit Proposal').click();

    // Verify API call was made and response handled
    cy.wait('@createProposal').its('response.body.proposalId').should('eq', 'prop456');

    // Verify UI updates after proposal creation
    cy.get('.proposal-list').should('contain.text', 'Test Proposal for Ontora AI');
    cy.get('.notification').should('contain.text', 'Proposal created successfully');
  });

  it('should vote on a governance proposal successfully', () => {
    // Connect wallet
    cy.get('button').contains('Connect Wallet').click();

    // Navigate to governance section
    cy.get('nav').contains('a', 'Governance').click();

    // Assume a proposal exists in the UI (mocked or pre-seeded)
    cy.get('.proposal-item').first().contains('button', 'Vote').click();

    // Select vote option (e.g., Yes)
    cy.get('input[value="Yes"]').check();
    cy.get('button').contains('Submit Vote').click();

    // Verify API call was made and response handled
    cy.wait('@submitVote').its('response.body.choice').should('eq', 'Yes');

    // Verify UI updates after voting
    cy.get('.notification').should('contain.text', 'Vote submitted successfully');
    cy.get('.proposal-item').first().should('contain.text', 'Voted: Yes');
  });

  it('should navigate to AI agent deployment page after wallet connection', () => {
    // Connect wallet
    cy.get('button').contains('Connect Wallet').click();

    // Navigate to AI agent deployment section
    cy.get('nav').contains('a', 'Deploy AI Agent').click();

    // Verify deployment page loads
    cy.url().should('include', '/deploy-agent');
    cy.get('h2').should('contain.text', 'Deploy AI Agent');
    cy.get('button').contains('Configure Agent').should('be.visible');
  });

  it('should deploy an AI agent with custom configuration', () => {
    // Connect wallet
    cy.get('button').contains('Connect Wallet').click();

    // Navigate to AI agent deployment section
    cy.get('nav').contains('a', 'Deploy AI Agent').click();

    // Configure AI agent parameters
    cy.get('input[name="agentName"]').type('TestAgent001');
    cy.get('select[name="modelType"]').select('PredictiveModel');
    cy.get('input[name="trainingData"]').type('localDataset.json');
    cy.get('button').contains('Deploy Agent').click();

    // Verify API call was made and response handled
    cy.wait('@deployAgent').its('response.body.agentId').should('eq', 'agent123');

    // Verify UI updates after deployment
    cy.get('.agent-list').should('contain.text', 'TestAgent001');
    cy.get('.notification').should('contain.text', 'AI Agent deployed successfully');
    cy.get('.agent-status').should('contain.text', 'Status: Deployed');
  });

  it('should display error message when wallet connection fails', () => {
    // Mock a failed wallet connection
    cy.window().then((win) => {
      win.solana.connect = cy.stub().rejects(new Error('Wallet connection failed'));
    });

    // Attempt to connect wallet
    cy.get('button').contains('Connect Wallet').click();

    // Verify error message is displayed
    cy.get('.notification-error').should('contain.text', 'Failed to connect wallet');
    cy.get('.wallet-status').should('contain.text', 'Disconnected');
  });

  it('should display error message when proposal creation fails', () => {
    // Mock a failed API response for proposal creation
    cy.intercept('POST', '/api/governance/proposal', { statusCode: 400, body: { error: 'Invalid proposal data' } }).as('createProposalFail');

    // Connect wallet
    cy.get('button').contains('Connect Wallet').click();

    // Navigate to governance section
    cy.get('nav').contains('a', 'Governance').click();

    // Click to create a new proposal
    cy.get('button').contains('Create Proposal').click();

    // Fill out proposal form with invalid data (or mock failure)
    cy.get('input[name="title"]').type('Test Proposal');
    cy.get('textarea[name="description"]').type('Invalid data');
    cy.get('button').contains('Submit Proposal').click();

    // Verify API call failed and error is handled
    cy.wait('@createProposalFail').its('response.statusCode').should('eq', 400);

    // Verify error message in UI
    cy.get('.notification-error').should('contain.text', 'Failed to create proposal');
  });

  it('should display error message when AI agent deployment fails', () => {
    // Mock a failed API response for agent deployment
    cy.intercept('POST', '/api/ai/deploy', { statusCode: 500, body: { error: 'Deployment failed due to server error' } }).as('deployAgentFail');

    // Connect wallet
    cy.get('button').contains('Connect Wallet').click();

    // Navigate to AI agent deployment section
    cy.get('nav').contains('a', 'Deploy AI Agent').click();

    // Configure AI agent parameters
    cy.get('input[name="agentName"]').type('TestAgentFail');
    cy.get('select[name="modelType"]').select('PredictiveModel');
    cy.get('button').contains('Deploy Agent').click();

    // Verify API call failed and error is handled
    cy.wait('@deployAgentFail').its('response.statusCode').should('eq', 500);

    // Verify error message in UI
    cy.get('.notification-error').should('contain.text', 'Failed to deploy AI agent');
  });

  it('should handle user logout and redirect to homepage', () => {
    // Connect wallet
    cy.get('button').contains('Connect Wallet').click();

    // Navigate to user profile or settings
    cy.get('nav').contains('a', 'Profile').click();
    cy.url().should('include', '/profile');

    // Click logout button
    cy.get('button').contains('Logout').click();

    // Verify redirection to homepage and wallet disconnection
    cy.url().should('eq', BASE_URL + '/');
    cy.get('.wallet-status').should('contain.text', 'Disconnected');
    cy.get('button').contains('Connect Wallet').should('be.visible');
  });

  it('should display AI agent evolution stats after deployment', () => {
    // Connect wallet
    cy.get('button').contains('Connect Wallet').click();

    // Navigate to AI agent deployment section
    cy.get('nav').contains('a', 'Deploy AI Agent').click();

    // Deploy an agent (mocked response)
    cy.get('input[name="agentName"]').type('TestAgentStats');
    cy.get('button').contains('Deploy Agent').click();
    cy.wait('@deployAgent');

    // Navigate to agent stats or dashboard
    cy.get('nav').contains('a', 'Agent Dashboard').click();
    cy.url().should('include', '/agent-dashboard');

    // Verify stats are displayed (assuming mock data or pre-seeded)
    cy.get('.agent-stats').should('contain.text', 'Evolution Progress');
    cy.get('.stat-item').should('contain.text', 'Accuracy: 85%');
    cy.get('.stat-item').should('contain.text', 'Iterations: 100');
  });

  it('should handle full user journey from wallet connection to AI agent deployment and governance', () => {
    // Step 1: Connect wallet
    cy.get('button').contains('Connect Wallet').click();
    cy.get('.wallet-status').should('contain.text', 'Connected');

    // Step 2: Navigate to governance and create a proposal
    cy.get('nav').contains('a', 'Governance').click();
    cy.get('button').contains('Create Proposal').click();
    cy.get('input[name="title"]').type('Full Journey Proposal');
    cy.get('textarea[name="description"]').type('Proposal for testing full user journey.');
    cy.get('button').contains('Submit Proposal').click();
    cy.wait('@createProposal');
    cy.get('.notification').should('contain.text', 'Proposal created successfully');

    // Step 3: Vote on the proposal
    cy.get('.proposal-item').first().contains('button', 'Vote').click();
    cy.get('input[value="Yes"]').check();
    cy.get('button').contains('Submit Vote').click();
    cy.wait('@submitVote');
    cy.get('.notification').should('contain.text', 'Vote submitted successfully');

    // Step 4: Navigate to AI agent deployment and deploy an agent
    cy.get('nav').contains('a', 'Deploy AI Agent').click();
    cy.get('input[name="agentName"]').type('FullJourneyAgent');
    cy.get('button').contains('Deploy Agent').click();
    cy.wait('@deployAgent');
    cy.get('.notification').should('contain.text', 'AI Agent deployed successfully');

    // Step 5: Verify agent in dashboard
    cy.get('nav').contains('a', 'Agent Dashboard').click();
    cy.get('.agent-list').should('contain.text', 'FullJourneyAgent');
  });
});
