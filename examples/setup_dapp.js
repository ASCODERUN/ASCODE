// setup_dapp.js
// Example of setting up a frontend DApp with wallet integration for Solana blockchain

import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { 
    PhantomWalletAdapter, 
    SolflareWalletAdapter, 
    TorusWalletAdapter 
} from '@solana/wallet-adapter-wallets';
import { 
    WalletAdapterNetwork, 
    WalletNotConnectedError 
} from '@solana/wallet-adapter-base';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCallback, useEffect, useState } from 'react';

// Define supported networks for Solana
const network = WalletAdapterNetwork.Devnet; // Change to MainnetBeta for production
const endpoint = clusterApiUrl(network);
const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new TorusWalletAdapter()
];

// Custom hook for managing DApp wallet connection and interactions
export const useDAppSetup = () => {
    const { 
        wallet, 
        connect, 
        disconnect, 
        connected, 
        publicKey, 
        signTransaction, 
        signAllTransactions 
    } = useWallet();
    const [connection, setConnection] = useState(null);
    const [balance, setBalance] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Initialize Solana connection on component mount
    useEffect(() => {
        try {
            const conn = new Connection(endpoint, 'confirmed');
            setConnection(conn);
            console.log(`Connected to Solana ${network} network at ${endpoint}`);
        } catch (err) {
            console.error('Failed to initialize Solana connection:', err);
            setError('Network connection failed. Please try again later.');
        }
    }, []);

    // Fetch wallet balance when connected
    const fetchBalance = useCallback(async () => {
        if (!connected || !publicKey || !connection) return;
        setIsLoading(true);
        setError(null);
        try {
            const balanceInLamports = await connection.getBalance(publicKey);
            const balanceInSOL = balanceInLamports / LAMPORTS_PER_SOL;
            setBalance(balanceInSOL);
            console.log(`Wallet balance: ${balanceInSOL} SOL`);
        } catch (err) {
            console.error('Failed to fetch balance:', err);
            setError('Unable to fetch wallet balance. Please check your connection.');
        } finally {
            setIsLoading(false);
        }
    }, [connected, publicKey, connection]);

    // Refresh balance whenever connection or publicKey changes
    useEffect(() => {
        if (connected && publicKey && connection) {
            fetchBalance();
        }
    }, [connected, publicKey, connection, fetchBalance]);

    // Handle wallet connection
    const handleConnect = async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (!wallet) {
                throw new WalletNotConnectedError('No wallet selected. Please select a wallet.');
            }
            await connect();
            console.log('Wallet connected successfully');
        } catch (err) {
            console.error('Wallet connection failed:', err);
            setError('Failed to connect wallet. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle wallet disconnection
    const handleDisconnect = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await disconnect();
            setBalance(0);
            console.log('Wallet disconnected successfully');
        } catch (err) {
            console.error('Wallet disconnection failed:', err);
            setError('Failed to disconnect wallet. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Example function to send a small transaction (for testing)
    const sendTestTransaction = async (destinationAddress, amountInSOL) => {
        if (!connected || !publicKey || !connection) {
            setError('Wallet not connected. Please connect your wallet first.');
            return false;
        }
        setIsLoading(true);
        setError(null);
        try {
            const destinationPubkey = new PublicKey(destinationAddress);
            const amountInLamports = amountInSOL * LAMPORTS_PER_SOL;

            // Check if balance is sufficient
            if (balance < amountInSOL) {
                throw new Error('Insufficient balance for transaction.');
            }

            // Create transaction (simplified, add fees and proper instruction in production)
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: destinationPubkey,
                    lamports: amountInLamports,
                })
            );

            // Sign and send transaction
            const signature = await signTransaction(transaction);
            const txId = await connection.sendRawTransaction(signature.serialize());
            await connection.confirmTransaction(txId);
            console.log(`Transaction successful with ID: ${txId}`);
            await fetchBalance(); // Refresh balance after transaction
            return txId;
        } catch (err) {
            console.error('Transaction failed:', err);
            setError(`Transaction failed: ${err.message}`);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        connected,
        publicKey: publicKey?.toString() || null,
        balance,
        isLoading,
        error,
        connect: handleConnect,
        disconnect: handleDisconnect,
        refreshBalance: fetchBalance,
        sendTestTransaction
    };
};

// Example React component to integrate the DApp setup (can be adapted to vanilla JS)
export const DAppSetupComponent = () => {
    const {
        connected,
        publicKey,
        balance,
        isLoading,
        error,
        connect,
        disconnect,
        refreshBalance,
        sendTestTransaction
    } = useDAppSetup();

    // Handle test transaction (replace with a valid destination address for testing)
    const handleTestTransaction = async () => {
        const testDestination = '8uvia8bNfEHFaxcEpg5uLJoTXJoZ9frsfgBU6JemUgNt'; // Replace with a valid Solana address
        const amount = 0.001; // Small amount for testing on devnet
        const txId = await sendTestTransaction(testDestination, amount);
        if (txId) {
            alert(`Transaction successful! ID: ${txId}`);
        }
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h2>Ontora AI DApp Wallet Integration</h2>
            {error && (
                <div style={{ color: 'red', marginBottom: '10px' }}>
                    Error: {error}
                </div>
            )}
            {isLoading ? (
                <div>Loading...</div>
            ) : (
                <div>
                    <div>
                        <strong>Wallet Status:</strong> {connected ? 'Connected' : 'Disconnected'}
                    </div>
                    {connected && (
                        <>
                            <div>
                                <strong>Wallet Address:</strong> {publicKey}
                            </div>
                            <div>
                                <strong>Balance:</strong> {balance.toFixed(4)} SOL
                            </div>
                            <button 
                                onClick={refreshBalance} 
                                style={{ margin: '10px', padding: '5px 10px' }}
                            >
                                Refresh Balance
                            </button>
                            <button 
                                onClick={handleTestTransaction} 
                                style={{ margin: '10px', padding: '5px 10px' }}
                            >
                                Send Test Transaction (0.001 SOL)
                            </button>
                        </>
                    )}
                    <button 
                        onClick={connected ? disconnect : connect}
                        style={{ margin: '10px', padding: '5px 10px' }}
                    >
                        {connected ? 'Disconnect Wallet' : 'Connect Wallet'}
                    </button>
                </div>
            )}
        </div>
    );
};

// Utility function to initialize the DApp in a vanilla JS environment
export const initializeDApp = () => {
    console.log('Initializing Ontora AI DApp...');
    try {
        // Check if React and wallet adapter context are available (if not, log a warning)
        if (!window.React || !window.ReactDOM) {
            console.warn('React not found. Please ensure React is included for full DApp functionality.');
            return;
        }
        // Placeholder for mounting React component (adjust based on your HTML structure)
        const appContainer = document.getElementById('app');
        if (appContainer) {
            console.log('DApp container found. Mounting wallet integration...');
            // ReactDOM.render(<DAppSetupComponent />, appContainer);
            // Uncomment the above line if using React and ReactDOM is available
        } else {
            console.warn('App container not found. Please ensure an element with ID "app" exists in your HTML.');
        }
    } catch (err) {
        console.error('Failed to initialize DApp:', err);
    }
};

// Run initialization if this script is loaded directly
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        initializeDApp();
    });
}
