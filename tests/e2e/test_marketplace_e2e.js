// test_marketplace_e2e.js
// End-to-End tests for marketplace transactions and interactions using Cypress

describe('Marketplace End-to-End Tests', () => {
  // Define base URL for the marketplace DApp (adjust based on your environment)
  const BASE_URL = 'http://localhost:3000/marketplace';

  // Define test user credentials or wallet details (mocked for testing)
  const TEST_WALLET_ADDRESS = 'mockWalletAddress123';
  const TEST_ITEM_NAME = 'Test AI Agent #001';
  const TEST_ITEM_PRICE = '0.5'; // Assuming price in SOL or a custom token

  // Before all tests, set up the environment
  before(() => {
    // Visit the marketplace homepage before running tests
    cy.visit(BASE_URL);

    // Optionally, mock wallet connection if real wallet interaction isn't feasible
    cy.window().then((win) => {
      win.phantom = {
        solana: {
          isPhantom: true,
          connect: () => Promise.resolve({ publicKey: TEST_WALLET_ADDRESS }),
          disconnect: () => Promise.resolve(),
          signTransaction: () => Promise.resolve({ signature: 'mockSignature' }),
        },
      };
    });
  });

  // Before each test, ensure a clean state (e.g., reset wallet connection or clear cart)
  beforeEach(() => {
    cy.visit(BASE_URL);
    // Simulate wallet connection before each test
    cy.contains('button', 'Connect Wallet').click();
    cy.contains('span', TEST_WALLET_ADDRESS.slice(0, 6)).should('be.visible');
  });

  // Test Case 1: Verify marketplace homepage loads correctly
  it('should load marketplace homepage and display listings', () => {
    // Check if the page title or header is correct
    cy.contains('h1', 'Marketplace').should('be.visible');

    // Verify that at least one listing card or item is displayed
    cy.get('.listing-card').should('have.length.greaterThan', 0);
  });

  // Test Case 2: Browse and filter marketplace listings
  it('should allow users to filter listings by category or price', () => {
    // Apply a category filter (e.g., AI Agents)
    cy.get('select#category-filter').select('AI Agents');
    cy.contains('button', 'Apply Filters').click();

    // Verify that filtered results are displayed
    cy.get('.listing-card').each(($card) => {
      cy.wrap($card).contains('span', 'AI Agent').should('be.visible');
    });

    // Apply a price filter (e.g., under 1 SOL)
    cy.get('input#max-price').type('1');
    cy.contains('button', 'Apply Filters').click();

    // Verify price filter works (assuming price is displayed in listing cards)
    cy.get('.listing-card .price').each(($price) => {
      const priceText = $price.text();
      const priceValue = parseFloat(priceText.replace(' SOL', ''));
      expect(priceValue).to.be.lessThan(1.1); // Slight buffer for floating-point comparison
    });
  });

  // Test Case 3: View item details
  it('should navigate to item details page when clicking on a listing', () => {
    // Click on the first listing card
    cy.get('.listing-card').first().click();

    // Verify redirection to item details page
    cy.url().should('include', '/item/');
    cy.contains('h2', TEST_ITEM_NAME).should('be.visible');
    cy.contains('span', TEST_ITEM_PRICE).should('be.visible');
    cy.contains('button', 'Buy Now').should('be.visible');
  });

  // Test Case 4: Purchase an item from the marketplace
  it('should allow users to purchase an item with a connected wallet', () => {
    // Navigate to an item details page
    cy.get('.listing-card').first().click();

    // Click the "Buy Now" button
    cy.contains('button', 'Buy Now').click();

    // Simulate transaction confirmation (mocking blockchain interaction)
    cy.window().then((win) => {
      cy.stub(win.phantom.solana, 'signTransaction').resolves({ signature: 'mockSignature123' });
    });

    // Verify transaction initiation
    cy.contains('div', 'Transaction in progress...').should('be.visible');

    // Verify successful purchase (assuming a success message is shown)
    cy.contains('div', 'Purchase successful!').should('be.visible', { timeout: 10000 });

    // Verify redirection to user dashboard or orders page after purchase
    cy.url().should('include', '/orders');
    cy.contains('span', 'Order Confirmed').should('be.visible');
  });

  // Test Case 5: Create a new listing in the marketplace
  it('should allow users to create a new listing for an item', () => {
    // Navigate to the "Sell" or "Create Listing" page
    cy.contains('a', 'Sell Item').click();
    cy.url().should('include', '/sell');

    // Fill out the listing form
    cy.get('input#name').type('Test AI Agent Listing');
    cy.get('input#price').type('0.8');
    cy.get('textarea#description').type('This is a test AI agent for automation tasks.');
    cy.get('select#category').select('AI Agents');

    // Upload an image (mock file upload if real upload isn't supported in test)
    cy.get('input[type="file"]').attachFile({
      filePath: 'test-image.png',
      fileName: 'test-image.png',
      mimeType: 'image/png',
    });

    // Submit the listing
    cy.contains('button', 'Create Listing').click();

    // Verify listing creation success
    cy.contains('div', 'Listing created successfully!').should('be.visible', { timeout: 10000 });

    // Verify redirection to marketplace or user listings
    cy.url().should('include', '/my-listings');
    cy.contains('span', 'Test AI Agent Listing').should('be.visible');
  });

  // Test Case 6: Handle failed wallet connection during purchase
  it('should display an error if wallet connection fails during purchase', () => {
    // Disconnect wallet or simulate failure
    cy.window().then((win) => {
      cy.stub(win.phantom.solana, 'connect').rejects(new Error('Wallet connection failed'));
    });

    // Reload page to simulate disconnected state
    cy.reload();

    // Attempt to buy an item without a connected wallet
    cy.get('.listing-card').first().click();
    cy.contains('button', 'Buy Now').click();

    // Verify error message for wallet not connected
    cy.contains('div', 'Please connect your wallet to proceed.').should('be.visible');
  });

  // Test Case 7: Handle insufficient funds during purchase
  it('should display an error if user has insufficient funds for purchase', () => {
    // Simulate insufficient balance in wallet
    cy.window().then((win) => {
      cy.stub(win.phantom.solana, 'signTransaction').rejects(new Error('Insufficient funds'));
    });

    // Navigate to item details and attempt purchase
    cy.get('.listing-card').first().click();
    cy.contains('button', 'Buy Now').click();

    // Verify error message for insufficient funds
    cy.contains('div', 'Insufficient funds for this transaction.').should('be.visible', { timeout: 10000 });
  });

  // Test Case 8: Search for items in the marketplace
  it('should allow users to search for items by keyword', () => {
    // Type a search query in the search bar
    cy.get('input#search').type('AI Agent');
    cy.contains('button', 'Search').click();

    // Verify search results contain the keyword
    cy.get('.listing-card').each(($card) => {
      cy.wrap($card).contains('span', 'AI Agent').should('be.visible');
    });

    // Test empty search results
    cy.get('input#search').clear().type('NonExistentItem123');
    cy.contains('button', 'Search').click();
    cy.contains('div', 'No results found.').should('be.visible');
  });

  // Test Case 9: View user orders or purchase history
  it('should display user orders or purchase history', () => {
    // Navigate to user profile or orders page
    cy.contains('a', 'My Orders').click();
    cy.url().should('include', '/orders');

    // Verify that orders are displayed (assuming at least one order exists from previous tests)
    cy.get('.order-item').should('have.length.greaterThan', 0);
    cy.get('.order-item').first().contains('span', TEST_ITEM_NAME).should('be.visible');
  });

  // Test Case 10: Cancel or edit a listing (if supported by the marketplace)
  it('should allow users to cancel or edit their listings', () => {
    // Navigate to user listings
    cy.contains('a', 'My Listings').click();
    cy.url().should('include', '/my-listings');

    // Click on edit or cancel for the first listing
    cy.get('.listing-item').first().contains('button', 'Cancel Listing').click();

    // Confirm cancellation in a modal (if applicable)
    cy.contains('button', 'Confirm').click();

    // Verify cancellation success
    cy.contains('div', 'Listing cancelled successfully.').should('be.visible');

    // Verify listing is no longer visible
    cy.reload();
    cy.get('.listing-item').should('not.contain', 'Test AI Agent Listing');
  });
});
