import React, { useMemo, useCallback } from 'react'; 
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolletWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Import the wallet adapter UI styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Define props interface for WalletConnect component (optional if used standalone)
interface WalletConnectProps {
  onConnect?: (publicKey: string) => void; // Callback when wallet connects
  onDisconnect?: () => void; // Callback when wallet disconnects
}

// WalletConnect component
const WalletConnect: React.FC<WalletConnectProps> = ({ onConnect, onDisconnect }) => {
  // Configure the Solana network (use Devnet for development, switch to Mainnet for production)
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  // Initialize wallets to support (Phantom and Sollet in this case)
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolletWalletAdapter({ network })],
    [network]
  );

  // Handle connection and disconnection callbacks (optional)
  const handleConnect = useCallback(
    (publicKey: string) => {
      if (onConnect) {
        onConnect(publicKey);
      }
    },
    [onConnect]
  );

  const handleDisconnect = useCallback(() => {
    if (onDisconnect) {
      onDisconnect();
    }
  }, [onDisconnect]);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md w-full max-w-md transition-transform transform hover:shadow-lg">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4" id="wallet-connect-title">
        Connect Solana Wallet
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
        Connect your Solana wallet to interact with Ontora AI on the {network} network.
      </p>
      <div className="w-full flex justify-center">
        {/* Wrap the app or component with necessary providers */}
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider
            wallets={wallets}
            autoConnect={false}
            onError={(error) => console.error('Wallet connection error:', error)}
          >
            <WalletModalProvider>
              <WalletMultiButton
                className="w-full max-w-xs bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded-md transition-opacity"
                onConnect={(publicKey) => handleConnect(publicKey.toString())}
                onDisconnect={handleDisconnect}
              />
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </div>
      <div
        className="mt-4 text-sm text-gray-600 dark:text-gray-300 text-center"
        role="status"
        aria-live="polite"
      >
        {/* Additional status or error messages can be rendered here if needed */}
        Ensure your wallet (e.g., Phantom) is installed and unlocked.
      </div>
    </div>
  );
};

export default WalletConnect;
