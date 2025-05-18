import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { WalletProvider } from '../context/WalletContext';
import { App } from '../App';
import axe, { AxeResults } from 'axe-core';

// Helper function to run accessibility checks
const runAxe = async (element: HTMLElement): Promise<AxeResults> => {
  return await axe.run(element, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    },
  });
};

// Wrapper component to provide necessary context and routing
const AppWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <WalletProvider>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </WalletProvider>
  </ThemeProvider>
);

describe('Accessibility Tests for Ontora AI Application', () => {
  beforeEach(() => {
    // Reset any runtime modifications to the DOM or mocks
    document.body.innerHTML = '';
  });

  it('should have no accessibility violations on the homepage', async () => {
    render(
      <AppWrapper>
        <App />
      </AppWrapper>
    );

    // Wait for the homepage content to load
    await screen.findByRole('heading', { name: /welcome to ontora ai/i }, { timeout: 3000 });

    // Run axe-core accessibility checks
    const results = await runAxe(document.body);

    // Assert no violations are found
    expect(results.violations.length).toBe(0);
    if (results.violations.length > 0) {
      console.log('Accessibility Violations:', results.violations);
    }
  });

  it('should ensure navigation menu is accessible', async () => {
    render(
      <AppWrapper>
        <App />
      </AppWrapper>
    );

    // Wait for navigation elements to render
    await screen.findByRole('navigation', { timeout: 3000 });

    // Check if navigation links have proper roles and labels
    const navLinks = screen.getAllByRole('link');
    navLinks.forEach((link) => {
      expect(link).toHaveAttribute('href');
      expect(link).toHaveTextContent(/.+/); // Ensure link has readable text
    });

    // Run axe-core on navigation section
    const navElement = screen.getByRole('navigation');
    const results = await runAxe(navElement);

    expect(results.violations.length).toBe(0);
    if (results.violations.length > 0) {
      console.log('Navigation Accessibility Violations:', results.violations);
    }
  });

  it('should ensure wallet connection button is accessible', async () => {
    render(
      <AppWrapper>
        <App />
      </AppWrapper>
    );

    // Wait for wallet connection button to render
    const connectButton = await screen.findByRole('button', { name: /connect wallet/i }, { timeout: 3000 });

    // Check button accessibility attributes
    expect(connectButton).toBeEnabled();
    expect(connectButton).toHaveAttribute('aria-label', expect.stringContaining('connect wallet'));

    // Run axe-core on button
    const results = await runAxe(connectButton.parentElement as HTMLElement);

    expect(results.violations.length).toBe(0);
    if (results.violations.length > 0) {
      console.log('Wallet Button Accessibility Violations:', results.violations);
    }
  });

  it('should ensure staking form is accessible', async () => {
    render(
      <AppWrapper>
        <App />
      </AppWrapper>
    );

    // Navigate to staking page or section (assuming it's rendered or reachable)
    const stakingLink = await screen.findByRole('link', { name: /stake tokens/i }, { timeout: 3000 });
    fireEvent.click(stakingLink);

    // Wait for staking form to render
    const stakingForm = await screen.findByRole('form', { name: /stake ontora tokens/i }, { timeout: 3000 });

    // Check form inputs for labels and accessibility
    const amountInput = screen.getByLabelText(/amount to stake/i);
    expect(amountInput).toHaveAttribute('type', 'number');
    expect(amountInput).toHaveAttribute('id');
    expect(amountInput).toHaveAttribute('aria-required', 'true');

    const submitButton = screen.getByRole('button', { name: /confirm stake/i });
    expect(submitButton).toBeEnabled();

    // Run axe-core on staking form
    const results = await runAxe(stakingForm);

    expect(results.violations.length).toBe(0);
    if (results.violations.length > 0) {
      console.log('Staking Form Accessibility Violations:', results.violations);
    }
  });

  it('should ensure color contrast meets WCAG standards', async () => {
    render(
      <AppWrapper>
        <App />
      </AppWrapper>
    );

    // Wait for primary content to load
    await screen.findByRole('main', { timeout: 3000 });

    // Run axe-core with focus on color contrast (included in WCAG tags)
    const results = await runAxe(document.body);

    // Filter for color contrast violations specifically
    const contrastViolations = results.violations.filter(
      (violation) => violation.id === 'color-contrast'
    );

    expect(contrastViolations.length).toBe(0);
    if (contrastViolations.length > 0) {
      console.log('Color Contrast Violations:', contrastViolations);
    }
  });

  it('should ensure keyboard navigation works for critical elements', async () => {
    render(
      <AppWrapper>
        <App />
      </AppWrapper>
    );

    // Wait for content to load
    await screen.findByRole('heading', { name: /welcome to ontora ai/i }, { timeout: 3000 });

    // Simulate tab navigation to check focusable elements
    const firstFocusable = screen.getByRole('link', { name: /home/i });
    fireEvent.focus(firstFocusable);
    expect(firstFocusable).toHaveFocus();

    // Simulate further tabbing (mocking user behavior)
    fireEvent.keyDown(document.body, { key: 'Tab' });
    const nextFocusable = screen.getByRole('link', { name: /stake/i });
    expect(nextFocusable).toHaveFocus();

    // Run axe-core for keyboard-related issues
    const results = await runAxe(document.body);

    const keyboardViolations = results.violations.filter(
      (violation) => violation.id.includes('keyboard') || violation.id.includes('focus')
    );

    expect(keyboardViolations.length).toBe(0);
    if (keyboardViolations.length > 0) {
      console.log('Keyboard Navigation Violations:', keyboardViolations);
    }
  });

  it('should ensure ARIA roles and labels are correctly implemented', async () => {
    render(
      <AppWrapper>
        <App />
      </AppWrapper>
    );

    // Wait for content to load
    await screen.findByRole('main', { timeout: 3000 });

    // Check specific ARIA roles and attributes
    const mainContent = screen.getByRole('main');
    expect(mainContent).toHaveAttribute('aria-labelledby', expect.any(String));

    const navigation = screen.getByRole('navigation');
    expect(navigation).toHaveAttribute('aria-label', expect.stringContaining('main navigation'));

    // Run axe-core for ARIA-specific issues
    const results = await runAxe(document.body);

    const ariaViolations = results.violations.filter(
      (violation) => violation.id.includes('aria')
    );

    expect(ariaViolations.length).toBe(0);
    if (ariaViolations.length > 0) {
      console.log('ARIA Violations:', ariaViolations);
    }
  });
});
