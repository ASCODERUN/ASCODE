import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, ParsedTransactionWithMeta, Connection } from '@solana/web3.js';
import { format } from 'date-fns';

// Define transaction data structure for display
interface Transaction {
  signature: string;
  type: 'Send' | 'Receive' | 'Other';
  amount: number; // In SOL (converted from lamports)
  date: string; // Formatted date string
  status: 'Confirmed' | 'Failed' | 'Pending';
  recipient?: string; // Public key or address (shortened for display)
  sender?: string; // Public key or address (shortened for display)
}

// Define filter options for transaction history
interface FilterOptions {
  type: 'All' | 'Send' | 'Receive' | 'Other';
  status: 'All' | 'Confirmed' | 'Failed' | 'Pending';
  dateFrom: string; // ISO date string (e.g., '2023-01-01')
  dateTo: string; // ISO date string (e.g., '2023-12-31')
}

// Props interface for TransactionHistory component (optional if used standalone)
interface TransactionHistoryProps {
  pageSize?: number; // Number of transactions per page
}

// Utility to shorten Solana public keys for display
const shortenAddress = (address: string) => {
  return address ? `${address.slice(0, 8)}...${address.slice(-4)}` : 'N/A';
};

// TransactionHistory component
const TransactionHistory: React.FC<TransactionHistoryProps> = ({ pageSize = 10 }) => {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [filters, setFilters] = useState<FilterOptions>({
    type: 'All',
    status: 'All',
    dateFrom: '',
    dateTo: '',
  });

  // Fetch transaction history from Solana blockchain
  const fetchTransactions = useCallback(
    async (pubKey: PublicKey, conn: Connection) => {
      setLoading(true);
      setError(null);
      try {
        // Fetch transaction signatures for the public key
        const signatures = await conn.getSignaturesForAddress(pubKey, { limit: 50 });
        if (signatures.length === 0) {
          setTransactions([]);
          setFilteredTransactions([]);
          return;
        }

        // Fetch detailed transaction data for each signature
        const txPromises = signatures.map((sig) =>
          conn.getParsedTransaction(sig.signature, { commitment: 'confirmed' })
        );
        const txData = (await Promise.all(txPromises)).filter(
          (tx): tx is ParsedTransactionWithMeta => tx !== null
        );

        // Parse transactions into a display-friendly format
        const parsedTransactions: Transaction[] = txData.map((tx) => {
          const isSender = tx.transaction.message.accountKeys.some(
            (key) => key.pubkey.toString() === pubKey.toString() && key.signer
          );
          const type = isSender ? 'Send' : 'Receive';
          const amount = tx.meta?.fee ? tx.meta.fee / 1e9 : 0; // Convert lamports to SOL
          const date = tx.blockTime
            ? format(new Date(tx.blockTime * 1000), 'yyyy-MM-dd HH:mm:ss')
            : 'Unknown';
          const status = tx.meta?.err ? 'Failed' : 'Confirmed';
          const recipient = isSender
            ? tx.transaction.message.accountKeys[1]?.pubkey.toString() || 'N/A'
            : undefined;
          const sender = !isSender
            ? tx.transaction.message.accountKeys[0]?.pubkey.toString() || 'N/A'
            : undefined;

          return {
            signature: tx.transaction.signatures[0],
            type,
            amount,
            date,
            status,
            recipient,
            sender,
          };
        });

        setTransactions(parsedTransactions);
        setFilteredTransactions(parsedTransactions);
      } catch (err) {
        console.error('Error fetching transactions:', err);
        setError('Failed to load transaction history. Please try again later.');
        setTransactions([]);
        setFilteredTransactions([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Fetch transactions when wallet is connected or public key changes
  useEffect(() => {
    if (connected && publicKey) {
      fetchTransactions(publicKey, connection);
    } else {
      setTransactions([]);
      setFilteredTransactions([]);
      setError('Please connect your wallet to view transaction history.');
    }
  }, [connected, publicKey, connection, fetchTransactions]);

  // Apply filters to transactions
  useEffect(() => {
    const filtered = transactions.filter((tx) => {
      const typeMatch = filters.type === 'All' || tx.type === filters.type;
      const statusMatch = filters.status === 'All' || tx.status === filters.status;
      const dateFromMatch = !filters.dateFrom || new Date(tx.date) >= new Date(filters.dateFrom);
      const dateToMatch = !filters.dateTo || new Date(tx.date) <= new Date(filters.dateTo);
      return typeMatch && statusMatch && dateFromMatch && dateToMatch;
    });
    setFilteredTransactions(filtered);
    setCurrentPage(1); // Reset to first page on filter change
  }, [transactions, filters]);

  // Handle filter input changes
  const handleFilterChange = (field: keyof FilterOptions, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  // Pagination logic
  const totalPages = useMemo(
    () => Math.ceil(filteredTransactions.length / pageSize),
    [filteredTransactions.length, pageSize]
  );
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, currentPage, pageSize]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md w-full transition-transform transform hover:shadow-lg">
        <p className="text-gray-600 dark:text-gray-300 text-lg">Loading transaction history...</p>
      </div>
    );
  }

  // Render error state or disconnected wallet
  if (error || !connected) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md w-full transition-transform transform hover:shadow-lg">
        <p className="text-red-600 dark:text-red-400 text-lg text-center">
          {error || 'Wallet not connected. Please connect to view transactions.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md w-full transition-transform transform hover:shadow-lg">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6" id="transaction-history-title">
        Transaction History
      </h2>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Transaction Type
          </label>
          <select
            id="type-filter"
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="All">All Types</option>
            <option value="Send">Send</option>
            <option value="Receive">Receive</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            id="status-filter"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="All">All Statuses</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Failed">Failed</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
        <div>
          <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date From
          </label>
          <input
            id="date-from"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label htmlFor="date-to" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date To
          </label>
          <input
            id="date-to"
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Transaction Table */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center p-6 text-gray-500 dark:text-gray-400">
          No transactions found matching the selected filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">
                <th className="px-4 py-2 text-left text-sm font-medium">Signature</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Type</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Amount (SOL)</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Date</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedTransactions.map((tx) => (
                <tr
                  key={tx.signature}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">
                    {shortenAddress(tx.signature)}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">{tx.type}</td>
                  <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">
                    {tx.amount.toFixed(4)}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">{tx.date}</td>
                  <td className="px-4 py-2 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        tx.status === 'Confirmed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : tx.status === 'Failed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">
                    {tx.type === 'Send' && tx.recipient
                      ? `To: ${shortenAddress(tx.recipient)}`
                      : tx.type === 'Receive' && tx.sender
                      ? `From: ${shortenAddress(tx.sender)}`
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredTransactions.length > 0 && (
        <div className="flex flex-col items-center mt-6 space-y-2">
          <div className="flex space-x-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              aria-label="Previous page"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => goToPage(page)}
                className={`px-3 py-1 rounded-md ${
                  currentPage === page
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                } transition-colors`}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {currentPage} of {totalPages} | Total Transactions: {filteredTransactions.length}
          </p>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
