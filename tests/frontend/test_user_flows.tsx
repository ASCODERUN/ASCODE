import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { App } from '../App';
import { ThemeProvider } from '../context/ThemeContext';
import { WalletProvider } from '../context/WalletContext';

// Mock dependencies for Web3 and Solana interactions
const mockConnectWallet = vi.fn().mockResolvedValue({ success: true, address: 'SolanaWalletAddress123' });
const mockDisconnectWallet = vi.fn().mockResolvedValue({ success: true });
const mockStakeTokens = vi.fn().mockResolvedValue({ success: true, txId: 'StakeTx123' });
const mockCreateAgent = vi.fn().mockResolvedValue({ success: true, agentId: 'Agent123' });
const mockGetBalance = vi.fn().mockResolvedValue({ balance: 1000 });

// Mock context values
const mockThemeContext = {
  theme: 'dark',
  toggleTheme: vi.fn(),
};

const mockWalletContext = {
  isConnected: false,
  walletAddress: '',
  balance: 0,
  connectWallet: mockConnectWallet,
  disconnectWallet: mockDisconnectWallet,
  stakeTokens: mockStakeTokens,
  getBalance: mockGetBalance,
};

// Mock window.solana for Solana wallet interactions
const mockSolana = {
  connect: vi.fn().mockResolvedValue({ publicKey: { toString: () => 'SolanaWalletAddress123' } }),
  disconnect: vi.fn().mockResolvedValue(undefined),
  isPhantom: true,
};
Object.defineProperty(window, 'solana', { value: mockSolana, writable: true });

// Wrapper for rendering components with necessary providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider value={mockThemeContext}>
      <WalletProvider value={mockWalletContext}>
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </WalletProvider>
    </ThemeProvider>
  );
};

describe('End-to-End User Flow Tests for Ontora AI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletContext.isConnected = false;
    mockWalletContext.walletAddress = '';
    mockWalletContext.balance = 0;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('completes onboarding flow with wallet connection', async () => {
    renderWithProviders(<App />);
    expect(screen.getByText(/Welcome to Ontora AI/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Get Started/i }));
    await waitFor(() => expect(screen.getByText(/Connect Your Wallet/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Connect Wallet/i }));
    await waitFor(() => expect(mockConnectWallet).toHaveBeenCalledTimes(1));
    mockWalletContext.isConnected = true;
    mockWalletContext.walletAddress = 'SolanaWalletAddress123';
    mockWalletContext.balance = 1000;

    await waitFor(() => expect(screen.getByText(/SolanaWalletAddress123/i)).toBeInTheDocument());
    expect(screen.getByText(/Balance: 1000/i)).toBeInTheDocument();
  });

  it('handles wallet connection failure gracefully', async () => {
    mockConnectWallet.mockRejectedValueOnce(new Error('Connection failed'));
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Get Started/i }));
    await waitFor(() => expect(screen.getByText(/Connect Your Wallet/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Connect Wallet/i }));
    await waitFor(() => expect(mockConnectWallet).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/Failed to connect wallet. Please try again./i)).toBeInTheDocument());
  });

  it('completes staking flow with sufficient balance', async () => {
    mockWalletContext.isConnected = true;
    mockWalletContext.walletAddress = 'SolanaWalletAddress123';
    mockWalletContext.balance = 1000;
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole('link', { name: /Staking/i }));
    await waitFor(() => expect(screen.getByText(/Stake Tokens for Ontora AI/i)).toBeInTheDocument());

    const amountInput = screen.getByLabelText(/Stake Amount/i);
    fireEvent.change(amountInput, { target: { value: '500' } });

    fireEvent.click(screen.getByRole('button', { name: /Stake Now/i }));
    await waitFor(() => expect(mockStakeTokens).toHaveBeenCalledWith(500));
    await waitFor(() => expect(screen.getByText(/Staking successful! Transaction ID: StakeTx123/i)).toBeInTheDocument());

    mockWalletContext.balance = 500;
    await waitFor(() => expect(screen.getByText(/Balance: 500/i)).toBeInTheDocument());
  });

  it('prevents staking with insufficient balance', async () => {
    mockWalletContext.isConnected = true;
    mockWalletContext.walletAddress = 'SolanaWalletAddress123';
    mockWalletContext.balance = 100;
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole('link', { name: /Staking/i }));
    await waitFor(() => expect(screen.getByText(/Stake Tokens for Ontora AI/i)).toBeInTheDocument());

    const amountInput = screen.getByLabelText(/Stake Amount/i);
    fireEvent.change(amountInput, { target: { value: '500' } });

    fireEvent.click(screen.getByRole('button', { name: /Stake Now/i }));
    await waitFor(() => expect(screen.getByText(/Insufficient balance for staking./i)).toBeInTheDocument());
    expect(mockStakeTokens).not.toHaveBeenCalled();
  });

  it('handles staking transaction failure', async () => {
    mockStakeTokens.mockRejectedValueOnce(new Error('Transaction failed'));
    mockWalletContext.isConnected = true;
    mockWalletContext.walletAddress = 'SolanaWalletAddress123';
    mockWalletContext.balance = 1000;
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole('link', { name: /Staking/i }));
    await waitFor(() => expect(screen.getByText(/Stake Tokens for Ontora AI/i)).toBeInTheDocument());

    const amountInput = screen.getByLabelText(/Stake Amount/i);
    fireEvent.change(amountInput, { target: { value: '500' } });

    fireEvent.click(screen.getByRole('button', { name: /Stake Now/i }));
    await waitFor(() => expect(mockStakeTokens).toHaveBeenCalledWith(500));
    await waitFor(() => expect(screen.getByText(/Staking failed. Please try again./i)).toBeInTheDocument());
  });

  it('completes AI agent creation and customization flow', async () => {
    mockWalletContext.isConnected = true;
    mockWalletContext.walletAddress = 'SolanaWalletAddress123';
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole('link', { name: /Create AI Agent/i }));
    await waitFor(() => expect(screen.getByText(/Build Your AI Agent/i)).toBeInTheDocument());

    const nameInput = screen.getByLabelText(/Agent Name/i);
    fireEvent.change(nameInput, { target: { value: 'TestAgent' } });

    const behaviorSelect = screen.getByLabelText(/Behavior Type/i);
    fireEvent.change(behaviorSelect, { target: { value: 'analytical' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Agent/i }));
    await waitFor(() => expect(mockCreateAgent).toHaveBeenCalledWith({ name: 'TestAgent', behavior: 'analytical' }));
    await waitFor(() => expect(screen.getByText(/Agent created successfully! ID: Agent123/i)).toBeInTheDocument());
  });

  it('prevents AI agent creation without wallet connection', async () => {
    mockWalletContext.isConnected = false;
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole('link', { name: /Create AI Agent/i }));
    await waitFor(() => expect(screen.getByText(/Please connect your wallet to create an AI agent./i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Create Agent/i })).not.toBeInTheDocument();
  });

  it('handles AI agent creation failure', async () => {
    mockCreateAgent.mockRejectedValueOnce(new Error('Creation failed'));
    mockWalletContext.isConnected = true;
    mockWalletContext.walletAddress = 'SolanaWalletAddress123';
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole('link', { name: /Create AI Agent/i }));
    await waitFor(() => expect(screen.getByText(/Build Your AI Agent/i)).toBeInTheDocument());

    const nameInput = screen.getByLabelText(/Agent Name/i);
    fireEvent.change(nameInput, { target: { value: 'TestAgent' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Agent/i }));
    await waitFor(() => expect(mockCreateAgent).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/Failed to create agent. Please try again./i)).toBeInTheDocument());
  });

  it('completes wallet disconnection flow', async () => {
    mockWalletContext.isConnected = true;
    mockWalletContext.walletAddress = 'SolanaWalletAddress123';
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole('link', { name: /Profile/i }));
    await waitFor(() => expect(screen.getByText(/SolanaWalletAddress123/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Disconnect Wallet/i }));
    await waitFor(() => expect(mockDisconnectWallet).toHaveBeenCalledTimes(1));
    mockWalletContext.isConnected = false;
    mockWalletContext.walletAddress = '';
    mockWalletContext.balance = 0;

    await waitFor(() => expect(screen.getByRole('button', { name: /Connect Wallet/i })).toBeInTheDocument());
    expect(screen.queryByText(/SolanaWalletAddress123/i)).not.toBeInTheDocument();
  });

  it('navigates through dashboard after successful onboarding', async () => {
    mockWalletContext.isConnected = true;
    mockWalletContext.walletAddress = 'SolanaWalletAddress123';
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole('link', { name: /Dashboard/i }));
    await waitFor(() => expect(screen.getByText(/Your Ontora AI Dashboard/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('link', { name: /Staking/i }));
    await waitFor(() => expect(screen.getByText(/Stake Tokens for Ontora AI/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('link', { name: /Create AI Agent/i }));
    await waitFor(() => expect(screen.getByText(/Build Your AI Agent/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('link', { name: /Profile/i }));
    await waitFor(() => expect(screen.getByText(/Your Profile/i)).toBeInTheDocument());
  });
});

describe('Accessibility in User Flows', () => {
  it('ensures wallet connection button is accessible', async () => {
    renderWithProviders(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Get Started/i }));
    await waitFor(() => expect(screen.getByText(/Connect Your Wallet/i)).toBeInTheDocument());

    const connectButton = screen.getByRole('button', { name: /Connect Wallet/i });
    expect(connectButton).toHaveAttribute('aria-label', 'Connect your Solana wallet');
    connectButton.focus();
    expect(connectButton).toHaveFocus();
  });

  it('ensures staking form inputs are accessible', async () => {
    mockWalletContext.isConnected = true;
    mockWalletContext.walletAddress = 'SolanaWalletAddress123';
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole('link', { name: /Staking/i }));
    await waitFor(() => expect(screen.getByText(/Stake Tokens for Ontora AI/i)).toBeInTheDocument());

    const amountInput = screen.getByLabelText(/Stake Amount/i);
    expect(amountInput).toHaveAttribute('aria-required', 'true');
    amountInput.focus();
    expect(amountInput).toHaveFocus();
  });

  it('ensures AI agent creation form is accessible', async () => {
    mockWalletContext.isConnected = true;
    mockWalletContext.walletAddress = 'SolanaWalletAddress123';
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole('link', { name: /Create AI Agent/i }));
    await waitFor(() => expect(screen.getByText(/Build Your AI Agent/i)).toBeInTheDocument());

    const nameInput = screen.getByLabelText(/Agent Name/i);
    expect(nameInput).toHaveAttribute('aria-required', 'true');
    nameInput.focus();
    expect(nameInput).toHaveFocus();

    const behaviorSelect = screen.getByLabelText(/Behavior Type/i);
    expect(behaviorSelect).toBeInTheDocument();
  });
});

describe('Edge Cases in User Flows', () => {
  it('handles empty input in staking flow', async () => {
    mockWalletContext.isConnected = true;
    mockWalletContext.walletAddress = 'SolanaWalletAddress123';
    mockWalletContext.balance = 1000;
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole('link', { name: /Staking/i }));
    await waitFor(() => expect(screen.getByText(/Stake Tokens for Ontora AI/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Stake Now/i }));
    await waitFor(() => expect(screen.getByText(/Please enter a valid amount./i)).toBeInTheDocument());
    expect(mockStakeTokens).not.toHaveBeenCalled();
  });

  it('handles invalid input in AI agent creation', async () => {
    mockWalletContext.isConnected = true;
    mockWalletContext.walletAddress = 'SolanaWalletAddress123';
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole('link', { name: /Create AI Agent/i }));
    await waitFor(() => expect(screen.getByText(/Build Your AI Agent/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Create Agent/i }));
    await waitFor(() => expect(screen.getByText(/Please provide a valid agent name./i)).toBeInTheDocument());
    expect(mockCreateAgent).not.toHaveBeenCalled();
  });

  it('handles navigation to protected routes without authentication', async () => {
    mockWalletContext.isConnected = false;
    renderWithProviders(<App />);

    fireEvent.click(screen.getByRole('link', { name: /Dashboard/i }));
    await waitFor(() => expect(screen.getByText(/Please connect your wallet to access the dashboard./i)).toBeInTheDocument());
  });
});
