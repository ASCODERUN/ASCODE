describe('Full System Flow Tests for Ontora AI', () => {
  beforeEach(() => {
    // Reset mocks and intercept external calls before each test
    cy.intercept('POST', '/api/auth/login', { statusCode: 200, body: { token: 'mock-jwt-token', userId: 'user123' } }).as('loginRequest');
    cy.intercept('GET', '/api/user/wallet', { statusCode: 200, body: { address: 'mockSolanaAddress', balance: 100 } }).as('getWallet');
    cy.intercept('POST', '/api/blockchain/stake', { statusCode: 200, body: { txId: 'mockTxId', status: 'success' } }).as('stakeRequest');
    cy.intercept('POST', '/api/ai/agent', { statusCode: 200, body: { agentId: 'agent456', response: 'AI agent initialized for staking strategy.' } }).as('aiAgentRequest');
    
    // Visit the application homepage
    cy.visit('http://localhost:3000');
  });

  it('should complete full flow from login to staking and AI agent interaction', () => {
    // Step 1: User logs in through the frontend
    cy.get('[data-testid="login-button"]').click();
    cy.get('[data-testid="email-input"]').type('testuser@ontora.ai');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="submit-login"]').click();

    // Verify login API call
    cy.wait('@loginRequest').its('request.body').should('include', {
      email: 'testuser@ontora.ai',
      password: 'password123'
    });
    cy.get('[data-testid="user-welcome"]').should('contain.text', 'Welcome, testuser');

    // Step 2: User connects Solana wallet
    cy.get('[data-testid="connect-wallet-button"]').click();
    cy.wait('@getWallet');
    cy.get('[data-testid="wallet-address"]').should('contain.text', 'mockSolanaAddress');
    cy.get('[data-testid="wallet-balance"]').should('contain.text', '100');

    // Step 3: User navigates to staking page and stakes tokens
    cy.get('[data-testid="nav-stake"]').click();
    cy.url().should('include', '/stake');
    cy.get('[data-testid="stake-amount-input"]').type('50');
    cy.get('[data-testid="confirm-stake-button"]').click();

    // Verify blockchain staking API call
    cy.wait('@stakeRequest').its('request.body').should('include', {
      amount: 50,
      walletAddress: 'mockSolanaAddress'
    });
    cy.get('[data-testid="stake-confirmation"]').should('contain.text', 'Transaction successful: mockTxId');

    // Step 4: User initializes AI agent for staking strategy
    cy.get('[data-testid="init-ai-agent-button"]').click();
    cy.get('[data-testid="ai-strategy-select"]').select('conservative');
    cy.get('[data-testid="confirm-ai-agent-button"]').click();

    // Verify AI agent API call
    cy.wait('@aiAgentRequest').its('request.body').should('include', {
      strategy: 'conservative',
      userId: 'user123'
    });
    cy.get('[data-testid="ai-agent-response"]').should('contain.text', 'AI agent initialized for staking strategy.');

    // Step 5: Verify full flow completion with UI feedback
    cy.get('[data-testid="flow-complete-message"]').should('contain.text', 'Your staking and AI setup is complete!');
  });

  it('should handle login failure gracefully', () => {
    // Override the login intercept to simulate failure
    cy.intercept('POST', '/api/auth/login', { statusCode: 401, body: { error: 'Invalid credentials' } }).as('failedLoginRequest');

    // Attempt login with wrong credentials
    cy.get('[data-testid="login-button"]').click();
    cy.get('[data-testid="email-input"]').type('wronguser@ontora.ai');
    cy.get('[data-testid="password-input"]').type('wrongpass');
    cy.get('[data-testid="submit-login"]').click();

    // Verify failed login API call
    cy.wait('@failedLoginRequest').its('response.statusCode').should('eq', 401);
    cy.get('[data-testid="login-error"]').should('contain.text', 'Invalid credentials');
  });

  it('should handle wallet connection failure', () => {
    // Override the wallet intercept to simulate failure
    cy.intercept('GET', '/api/user/wallet', { statusCode: 503, body: { error: 'Wallet service unavailable' } }).as('failedWalletRequest');

    // Attempt wallet connection
    cy.get('[data-testid="login-button"]').click();
    cy.get('[data-testid="email-input"]').type('testuser@ontora.ai');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="submit-login"]').click();
    cy.wait('@loginRequest');
    cy.get('[data-testid="connect-wallet-button"]').click();

    // Verify failed wallet connection
    cy.wait('@failedWalletRequest').its('response.statusCode').should('eq', 503);
    cy.get('[data-testid="wallet-error"]').should('contain.text', 'Wallet service unavailable');
  });

  it('should handle staking transaction failure on blockchain', () => {
    // Override the staking intercept to simulate blockchain failure
    cy.intercept('POST', '/api/blockchain/stake', { statusCode: 400, body: { error: 'Insufficient balance' } }).as('failedStakeRequest');

    // Complete login and wallet connection
    cy.get('[data-testid="login-button"]').click();
    cy.get('[data-testid="email-input"]').type('testuser@ontora.ai');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="submit-login"]').click();
    cy.wait('@loginRequest');
    cy.get('[data-testid="connect-wallet-button"]').click();
    cy.wait('@getWallet');

    // Attempt staking
    cy.get('[data-testid="nav-stake"]').click();
    cy.get('[data-testid="stake-amount-input"]').type('150');
    cy.get('[data-testid="confirm-stake-button"]').click();

    // Verify failed staking transaction
    cy.wait('@failedStakeRequest').its('response.statusCode').should('eq', 400);
    cy.get('[data-testid="stake-error"]').should('contain.text', 'Insufficient balance');
  });

  it('should handle AI agent initialization failure', () => {
    // Override the AI agent intercept to simulate failure
    cy.intercept('POST', '/api/ai/agent', { statusCode: 500, body: { error: 'AI service down' } }).as('failedAiAgentRequest');

    // Complete login, wallet connection, and staking
    cy.get('[data-testid="login-button"]').click();
    cy.get('[data-testid="email-input"]').type('testuser@ontora.ai');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="submit-login"]').click();
    cy.wait('@loginRequest');
    cy.get('[data-testid="connect-wallet-button"]').click();
    cy.wait('@getWallet');
    cy.get('[data-testid="nav-stake"]').click();
    cy.get('[data-testid="stake-amount-input"]').type('50');
    cy.get('[data-testid="confirm-stake-button"]').click();
    cy.wait('@stakeRequest');

    // Attempt AI agent initialization
    cy.get('[data-testid="init-ai-agent-button"]').click();
    cy.get('[data-testid="ai-strategy-select"]').select('conservative');
    cy.get('[data-testid="confirm-ai-agent-button"]').click();

    // Verify failed AI agent initialization
    cy.wait('@failedAiAgentRequest').its('response.statusCode').should('eq', 500);
    cy.get('[data-testid="ai-agent-error"]').should('contain.text', 'AI service down');
  });

  it('should handle concurrent user actions without breaking flow', () => {
    // Complete login and wallet connection
    cy.get('[data-testid="login-button"]').click();
    cy.get('[data-testid="email-input"]').type('testuser@ontora.ai');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="submit-login"]').click();
    cy.wait('@loginRequest');
    cy.get('[data-testid="connect-wallet-button"]').click();
    cy.wait('@getWallet');

    // Simulate rapid user actions (e.g., clicking stake multiple times)
    cy.get('[data-testid="nav-stake"]').click();
    cy.get('[data-testid="stake-amount-input"]').type('50');
    cy.get('[data-testid="confirm-stake-button"]').click();
    cy.get('[data-testid="confirm-stake-button"]').click(); // Double-click simulation
    cy.wait('@stakeRequest').its('request.body.amount').should('eq', 50);

    // Verify no duplicate transactions or UI errors
    cy.get('[data-testid="stake-confirmation"]').should('contain.text', 'Transaction successful');
    cy.get('[data-testid="stake-error"]').should('not.exist');

    // Proceed to AI agent initialization
    cy.get('[data-testid="init-ai-agent-button"]').click();
    cy.get('[data-testid="ai-strategy-select"]').select('conservative');
    cy.get('[data-testid="confirm-ai-agent-button"]').click();
    cy.wait('@aiAgentRequest');
    cy.get('[data-testid="ai-agent-response"]').should('contain.text', 'AI agent initialized');
  });
});
