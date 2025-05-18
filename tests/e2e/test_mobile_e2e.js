// test_mobile_e2e.js
// End-to-End tests for mobile responsiveness and functionality using Cypress

describe('Mobile End-to-End Tests for DApp', () => {
  // Define base URL for the DApp (adjust based on your environment)
  const BASE_URL = 'http://localhost:3000';

  // Define test user credentials or wallet details (mocked for testing)
  const TEST_WALLET_ADDRESS = 'mockWalletAddress123';

  // Before all tests, set up the mobile viewport
  before(() => {
    // Set viewport to emulate a mobile device (e.g., iPhone X)
    cy.viewport('iphone-x');
    // Visit the DApp homepage before running tests
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

  // Before each test, ensure a clean state and mobile viewport
  beforeEach(() => {
    // Reset viewport to mobile device
    cy.viewport('iphone-x');
    cy.visit(BASE_URL);
    // Simulate wallet connection before each test
    cy.contains('button', 'Connect Wallet').click();
    cy.contains('span', TEST_WALLET_ADDRESS.slice(0, 6)).should('be.visible');
  });

  // Test Case 1: Verify mobile homepage loads correctly
  it('should load homepage and display content correctly on mobile', () => {
    // Check if the page title or header is visible
    cy.contains('h1', 'Ontora AI').should('be.visible');

    // Verify that mobile navigation menu or hamburger icon is visible
    cy.get('.mobile-menu-toggle').should('be.visible');

    // Verify that main content is visible and responsive
    cy.get('.hero-section').should('be.visible');
    cy.get('.hero-section').should('have.css', 'flex-direction', 'column'); // Check for mobile layout
  });

  // Test Case 2: Test mobile navigation menu functionality
  it('should open and close mobile navigation menu', () => {
    // Click on mobile menu toggle (hamburger icon)
    cy.get('.mobile-menu-toggle').click();

    // Verify that the navigation menu is visible
    cy.get('.mobile-nav-menu').should('be.visible');
    cy.get('.mobile-nav-menu').contains('a', 'Marketplace').should('be.visible');
    cy.get('.mobile-nav-menu').contains('a', 'Dashboard').should('be.visible');

    // Click on toggle again to close the menu
    cy.get('.mobile-menu-toggle').click();

    // Verify that the menu is hidden
    cy.get('.mobile-nav-menu').should('not.be.visible');
  });

  // Test Case 3: Navigate to marketplace on mobile
  it('should navigate to marketplace page via mobile menu', () => {
    // Open mobile menu
    cy.get('.mobile-menu-toggle').click();

    // Click on Marketplace link
    cy.get('.mobile-nav-menu').contains('a', 'Marketplace').click();

    // Verify redirection to marketplace page
    cy.url().should('include', '/marketplace');
    cy.contains('h2', 'Marketplace').should('be.visible');

    // Verify mobile layout for marketplace listings (e.g., single column)
    cy.get('.listing-grid').should('have.css', 'grid-template-columns', '1fr');
  });

  // Test Case 4: Browse marketplace listings on mobile
  it('should display marketplace listings correctly on mobile', () => {
    // Navigate to marketplace
    cy.get('.mobile-menu-toggle').click();
    cy.get('.mobile-nav-menu').contains('a', 'Marketplace').click();

    // Verify that listings are displayed in a mobile-friendly format
    cy.get('.listing-card').should('have.length.greaterThan', 0);
    cy.get('.listing-card').first().should('have.css', 'width', '100%'); // Full width for mobile

    // Scroll to ensure lazy-loaded content (if applicable) is visible
    cy.scrollTo('bottom');
    cy.get('.listing-card').last().should('be.visible');
  });

  // Test Case 5: View item details on mobile
  it('should navigate to item details page and display content correctly on mobile', () => {
    // Navigate to marketplace
    cy.get('.mobile-menu-toggle').click();
    cy.get('.mobile-nav-menu').contains('a', 'Marketplace').click();

    // Click on the first listing card
    cy.get('.listing-card').first().click();

    // Verify redirection to item details page
    cy.url().should('include', '/item/');
    cy.contains('h2', 'Test AI Agent').should('be.visible');

    // Verify mobile layout for item details (e.g., stacked content)
    cy.get('.item-details').should('have.css', 'flex-direction', 'column');
    cy.contains('button', 'Buy Now').should('be.visible');
  });

  // Test Case 6: Purchase an item on mobile
  it('should allow users to purchase an item on mobile with a connected wallet', () => {
    // Navigate to marketplace and item details
    cy.get('.mobile-menu-toggle').click();
    cy.get('.mobile-nav-menu').contains('a', 'Marketplace').click();
    cy.get('.listing-card').first().click();

    // Click the "Buy Now" button
    cy.contains('button', 'Buy Now').click();

    // Simulate transaction confirmation (mocking blockchain interaction)
    cy.window().then((win) => {
      cy.stub(win.phantom.solana, 'signTransaction').resolves({ signature: 'mockSignature123' });
    });

    // Verify transaction initiation
    cy.contains('div', 'Transaction in progress...').should('be.visible');

    // Verify successful purchase
    cy.contains('div', 'Purchase successful!').should('be.visible', { timeout: 10000 });

    // Verify redirection to orders page
    cy.url().should('include', '/orders');
  });

  // Test Case 7: Test mobile form input for creating a listing
  it('should allow users to create a listing using mobile-friendly forms', () => {
    // Navigate to "Sell Item" page via mobile menu
    cy.get('.mobile-menu-toggle').click();
    cy.get('.mobile-nav-menu').contains('a', 'Sell Item').click();
    cy.url().should('include', '/sell');

    // Fill out the listing form on mobile
    cy.get('input#name').type('Mobile Test Listing');
    cy.get('input#price').type('0.5');
    cy.get('textarea#description').type('A test listing created from mobile view.');

    // Verify mobile keyboard input works (indirectly by checking typed text)
    cy.get('input#name').should('have.value', 'Mobile Test Listing');

    // Submit the listing
    cy.contains('button', 'Create Listing').click();

    // Verify success message
    cy.contains('div', 'Listing created successfully!').should('be.visible', { timeout: 10000 });
  });

  // Test Case 8: Test mobile responsiveness for wallet connection error
  it('should display wallet connection error gracefully on mobile', () => {
    // Simulate wallet disconnection or failure
    cy.window().then((win) => {
      cy.stub(win.phantom.solana, 'connect').rejects(new Error('Wallet connection failed'));
    });

    // Reload page to simulate disconnected state
    cy.reload();

    // Attempt to connect wallet
    cy.contains('button', 'Connect Wallet').click();

    // Verify error message is visible and formatted for mobile
    cy.contains('div', 'Wallet connection failed. Please try again.').should('be.visible');
    cy.get('.error-message').should('have.css', 'font-size', '14px'); // Check for readable font size on mobile
  });

  // Test Case 9: Test search functionality on mobile
  it('should allow users to search for items using mobile interface', () => {
    // Navigate to marketplace
    cy.get('.mobile-menu-toggle').click();
    cy.get('.mobile-nav-menu').contains('a', 'Marketplace').click();

    // Type a search query in the search bar (mobile layout may have a search icon to tap first)
    cy.get('.search-toggle').click(); // Assuming a search icon or toggle for mobile
    cy.get('input#search').type('AI Agent');
    cy.contains('button', 'Search').click();

    // Verify search results are displayed in mobile layout
    cy.get('.listing-card').should('have.length.greaterThan', 0);
    cy.get('.listing-card').first().contains('span', 'AI Agent').should('be.visible');
  });

  // Test Case 10: Test mobile scrolling and lazy loading
  it('should handle scrolling and lazy loading of content on mobile', () => {
    // Navigate to marketplace
    cy.get('.mobile-menu-toggle').click();
    cy.get('.mobile-nav-menu').contains('a', 'Marketplace').click();

    // Verify initial set of listings
    cy.get('.listing-card').should('have.length.greaterThan', 0);

    // Scroll to the bottom of the page
    cy.scrollTo('bottom', { duration: 2000 });

    // Verify additional listings are loaded (assuming lazy loading is implemented)
    cy.get('.listing-card').should('have.length.greaterThan', 5); // Adjust based on your lazy loading threshold

    // Verify no overlap or layout issues on mobile after scrolling
    cy.get('.listing-card').last().should('be.visible');
  });

  // Test Case 11: Test mobile dashboard or user profile
  it('should display user dashboard or profile correctly on mobile', () => {
    // Navigate to dashboard via mobile menu
    cy.get('.mobile-menu-toggle').click();
    cy.get('.mobile-nav-menu').contains('a', 'Dashboard').click();
    cy.url().should('include', '/dashboard');

    // Verify mobile layout for dashboard (stacked sections)
    cy.get('.dashboard-sections').should('have.css', 'flex-direction', 'column');

    // Verify key elements are visible
    cy.contains('h3', 'My Orders').should('be.visible');
    cy.contains('h3', 'My Listings').should('be.visible');
  });

  // Test Case 12: Test mobile touch gestures (swipe or tap)
  it('should handle touch gestures like swipe for carousel or navigation', () => {
    // Navigate to homepage or a page with a carousel (e.g., featured items)
    cy.visit(BASE_URL);

    // Simulate swipe on a carousel (assuming a featured items carousel exists)
    cy.get('.carousel').should('be.visible');
    cy.get('.carousel').trigger('touchstart', { touches: [{ clientX: 300, clientY: 200 }] });
    cy.get('.carousel').trigger('touchmove', { touches: [{ clientX: 100, clientY: 200 }] });
    cy.get('.carousel').trigger('touchend');

    // Verify carousel moved to the next item (check for new visible item)
    cy.get('.carousel-item').eq(1).should('be.visible');
  });
});
