import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { UserProfile } from '../components/UserProfile';
import { ThemeProvider } from '../context/ThemeContext';

// Mock components and dependencies for testing
const mockOnClick = vi.fn();
const mockOnChange = vi.fn();
const mockOnClose = vi.fn();

// Mock user data for UserProfile component
const mockUser = {
  id: 'user123',
  name: 'Test User',
  walletAddress: 'SolanaWalletAddress123',
  isConnected: true,
};

// Mock theme context values
const mockThemeContext = {
  theme: 'dark',
  toggleTheme: vi.fn(),
};

// Wrapper for rendering components with ThemeProvider
const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider value={mockThemeContext}>
      {component}
    </ThemeProvider>
  );
};

describe('Button Component', () => {
  it('renders button with correct text', () => {
    renderWithTheme(<Button label="Click Me" onClick={mockOnClick} />);
    expect(screen.getByRole('button', { name: /Click Me/i })).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', () => {
    renderWithTheme(<Button label="Click Me" onClick={mockOnClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Click Me/i }));
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('disables button when disabled prop is true', () => {
    renderWithTheme(<Button label="Click Me" onClick={mockOnClick} disabled />);
    const button = screen.getByRole('button', { name: /Click Me/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('applies correct variant class', () => {
    renderWithTheme(<Button label="Click Me" onClick={mockOnClick} variant="secondary" />);
    const button = screen.getByRole('button', { name: /Click Me/i });
    expect(button).toHaveClass('btn-secondary');
  });

  it('renders loading state correctly', () => {
    renderWithTheme(<Button label="Click Me" onClick={mockOnClick} isLoading />);
    expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
  });

  it('has correct aria-label for accessibility', () => {
    renderWithTheme(<Button label="Click Me" onClick={mockOnClick} ariaLabel="Action Button" />);
    const button = screen.getByRole('button', { name: /Action Button/i });
    expect(button).toBeInTheDocument();
  });
});

describe('Input Component', () => {
  it('renders input with correct placeholder', () => {
    renderWithTheme(<Input value="" onChange={mockOnChange} placeholder="Enter text" />);
    expect(screen.getByPlaceholderText(/Enter text/i)).toBeInTheDocument();
  });

  it('updates input value on change', () => {
    renderWithTheme(<Input value="" onChange={mockOnChange} placeholder="Enter text" />);
    const input = screen.getByPlaceholderText(/Enter text/i);
    fireEvent.change(input, { target: { value: 'Test Input' } });
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('displays error message when error prop is provided', () => {
    renderWithTheme(<Input value="" onChange={mockOnChange} error="Invalid input" />);
    expect(screen.getByText(/Invalid input/i)).toBeInTheDocument();
  });

  it('applies disabled state correctly', () => {
    renderWithTheme(<Input value="" onChange={mockOnChange} disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('renders correct input type', () => {
    renderWithTheme(<Input value="" onChange={mockOnChange} type="password" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('has correct aria-invalid attribute when error exists', () => {
    renderWithTheme(<Input value="" onChange={mockOnChange} error="Invalid input" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Modal Component', () => {
  it('renders modal when isOpen is true', () => {
    renderWithTheme(<Modal isOpen={true} onClose={mockOnClose} title="Test Modal">Modal Content</Modal>);
    expect(screen.getByRole('dialog', { name: /Test Modal/i })).toBeInTheDocument();
    expect(screen.getByText(/Modal Content/i)).toBeInTheDocument();
  });

  it('does not render modal when isOpen is false', () => {
    renderWithTheme(<Modal isOpen={false} onClose={mockOnClose} title="Test Modal">Modal Content</Modal>);
    expect(screen.queryByRole('dialog', { name: /Test Modal/i })).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    renderWithTheme(<Modal isOpen={true} onClose={mockOnClose} title="Test Modal">Modal Content</Modal>);
    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('closes modal on overlay click if closeOnOverlayClick is true', () => {
    renderWithTheme(<Modal isOpen={true} onClose={mockOnClose} title="Test Modal" closeOnOverlayClick>Modal Content</Modal>);
    fireEvent.click(screen.getByTestId('modal-overlay'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not close modal on overlay click if closeOnOverlayClick is false', () => {
    renderWithTheme(<Modal isOpen={true} onClose={mockOnClose} title="Test Modal" closeOnOverlayClick={false}>Modal Content</Modal>);
    fireEvent.click(screen.getByTestId('modal-overlay'));
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('has correct aria-modal attribute for accessibility', () => {
    renderWithTheme(<Modal isOpen={true} onClose={mockOnClose} title="Test Modal">Modal Content</Modal>);
    const modal = screen.getByRole('dialog', { name: /Test Modal/i });
    expect(modal).toHaveAttribute('aria-modal', 'true');
  });
});

describe('UserProfile Component', () => {
  it('renders user name and wallet address when connected', () => {
    renderWithTheme(<UserProfile user={mockUser} onDisconnect={mockOnClick} />);
    expect(screen.getByText(/Test User/i)).toBeInTheDocument();
    expect(screen.getByText(/SolanaWalletAddress123/i)).toBeInTheDocument();
  });

  it('renders connect button when user is not connected', () => {
    const disconnectedUser = { ...mockUser, isConnected: false };
    renderWithTheme(<UserProfile user={disconnectedUser} onDisconnect={mockOnClick} onConnect={mockOnClick} />);
    expect(screen.getByRole('button', { name: /Connect Wallet/i })).toBeInTheDocument();
  });

  it('calls onConnect when connect button is clicked', () => {
    const disconnectedUser = { ...mockUser, isConnected: false };
    renderWithTheme(<UserProfile user={disconnectedUser} onDisconnect={mockOnClick} onConnect={mockOnClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Connect Wallet/i }));
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('calls onDisconnect when disconnect button is clicked', () => {
    renderWithTheme(<UserProfile user={mockUser} onDisconnect={mockOnClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Disconnect/i }));
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('displays truncated wallet address if longer than threshold', () => {
    const longWalletUser = { ...mockUser, walletAddress: 'SolanaWalletAddressVeryLong1234567890' };
    renderWithTheme(<UserProfile user={longWalletUser} onDisconnect={mockOnClick} />);
    const walletText = screen.getByText(/SolanaWalletAddressVeryLong...7890/i);
    expect(walletText).toBeInTheDocument();
  });

  it('applies correct theme class based on context', () => {
    renderWithTheme(<UserProfile user={mockUser} onDisconnect={mockOnClick} />);
    const profileContainer = screen.getByTestId('user-profile-container');
    expect(profileContainer).toHaveClass('dark-theme');
  });
});

describe('Accessibility Tests', () => {
  it('Button component has proper focus state', () => {
    renderWithTheme(<Button label="Click Me" onClick={mockOnClick} />);
    const button = screen.getByRole('button', { name: /Click Me/i });
    button.focus();
    expect(button).toHaveFocus();
  });

  it('Input component has proper label association', () => {
    renderWithTheme(<Input value="" onChange={mockOnChange} label="Input Label" id="test-input" />);
    const input = screen.getByLabelText(/Input Label/i);
    expect(input).toBeInTheDocument();
  });

  it('Modal component traps focus when open', async () => {
    renderWithTheme(<Modal isOpen={true} onClose={mockOnClose} title="Test Modal">Modal Content</Modal>);
    const closeButton = screen.getByRole('button', { name: /Close/i });
    await waitFor(() => expect(closeButton).toHaveFocus());
  });

  it('UserProfile component has proper aria-labels for wallet address', () => {
    renderWithTheme(<UserProfile user={mockUser} onDisconnect={mockOnClick} />);
    const walletElement = screen.getByText(/SolanaWalletAddress123/i);
    expect(walletElement).toHaveAttribute('aria-label', 'Wallet Address');
  });
});

describe('Edge Cases and Error Handling', () => {
  it('Button component handles empty label gracefully', () => {
    renderWithTheme(<Button label="" onClick={mockOnClick} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('Input component handles null value', () => {
    renderWithTheme(<Input value={null as any} onChange={mockOnChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('');
  });

  it('Modal component handles null children', () => {
    renderWithTheme(<Modal isOpen={true} onClose={mockOnClose} title="Test Modal">{null}</Modal>);
    expect(screen.getByRole('dialog', { name: /Test Modal/i })).toBeInTheDocument();
  });

  it('UserProfile component handles missing user data', () => {
    const emptyUser = { id: '', name: '', walletAddress: '', isConnected: false };
    renderWithTheme(<UserProfile user={emptyUser} onDisconnect={mockOnClick} onConnect={mockOnClick} />);
    expect(screen.getByRole('button', { name: /Connect Wallet/i })).toBeInTheDocument();
  });
});
