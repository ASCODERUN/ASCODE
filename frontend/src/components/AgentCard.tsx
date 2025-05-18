import React, { useState, useEffect, useContext } from 'react';
import { WebSocketContext } from '../context/WebSocketContext'; // Assumed context for WebSocket updates

// Define the props interface for the AgentCard component
interface AgentCardProps {
  agentId: string;
  name: string;
  status: 'running' | 'stopped' | 'error' | 'updating';
  uptime: number; // Uptime in seconds
  transactionsProcessed: number;
  lastUpdated: string; // ISO timestamp or readable string
  blockchain: string; // e.g., "Solana"
  onViewTransactions: (agentId: string) => void; // Callback for viewing transaction history
}

// Define a type for WebSocket status update messages (assumed structure)
interface AgentStatusUpdate {
  agentId: string;
  status: 'running' | 'stopped' | 'error' | 'updating';
  message?: string;
  timestamp: string;
}

// Mock WebSocketContext if not defined elsewhere (remove if you have a real context)
const WebSocketContext = React.createContext<{
  subscribe: (topic: string, callback: (data: any) => void) => void;
  unsubscribe: (topic: string) => void;
  sendMessage: (message: any) => void;
}>({
  subscribe: () => {},
  unsubscribe: () => {},
  sendMessage: () => {},
});

const AgentCard: React.FC<AgentCardProps> = ({
  agentId,
  name,
  status: initialStatus,
  uptime,
  transactionsProcessed,
  lastUpdated,
  blockchain,
  onViewTransactions,
}) => {
  const [status, setStatus] = useState(initialStatus);
  const [isLoading, setIsLoading] = useState(false);
  const { subscribe, unsubscribe, sendMessage } = useContext(WebSocketContext);

  // Subscribe to WebSocket updates for this agent's status
  useEffect(() => {
    const topic = `agent:${agentId}`;
    const handleStatusUpdate = (data: AgentStatusUpdate) => {
      if (data.agentId === agentId) {
        setStatus(data.status);
        setIsLoading(false);
      }
    };

    subscribe(topic, handleStatusUpdate);
    return () => unsubscribe(topic);
  }, [agentId, subscribe, unsubscribe]);

  // Format uptime into a readable string (e.g., "2h 30m")
  const formatUptime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  // Handle agent control actions (Start, Stop, Update Config)
  const handleAgentAction = (command: string) => {
    setIsLoading(true);
    const message = {
      type: 'agent_control',
      payload: {
        agent_id: agentId,
        command,
        params: command === 'update_config' ? { mode: 'latest' } : undefined,
      },
    };
    sendMessage(message);
    // Timeout fallback in case WebSocket update doesn't arrive (for demo purposes)
    setTimeout(() => setIsLoading(false), 5000);
  };

  // Get status color for visual indication
  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'stopped':
        return 'bg-red-500';
      case 'error':
        return 'bg-orange-500';
      case 'updating':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-md transition-transform transform hover:scale-105 hover:shadow-lg"
      role="article"
      aria-labelledby={`agent-name-${agentId}`}
    >
      {/* Header with Agent Name and Status */}
      <div className="flex justify-between items-center mb-4">
        <h2
          id={`agent-name-${agentId}`}
          className="text-2xl font-bold text-gray-800 dark:text-white truncate"
        >
          {name}
        </h2>
        <div className="flex items-center">
          <span
            className={`w-3 h-3 rounded-full mr-2 ${getStatusColor()}`}
            aria-label={`Status: ${status}`}
          />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300 capitalize">
            {status}
          </span>
        </div>
      </div>

      {/* Agent ID and Blockchain */}
      <div className="mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          ID: <span className="font-mono">{agentId.slice(0, 8)}...</span>
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Blockchain: <span className="font-medium">{blockchain}</span>
        </p>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md">
          <p className="text-sm text-gray-500 dark:text-gray-400">Uptime</p>
          <p className="text-lg font-semibold text-gray-800 dark:text-white">
            {formatUptime(uptime)}
          </p>
        </div>
        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md">
          <p className="text-sm text-gray-500 dark:text-gray-400">Transactions</p>
          <p className="text-lg font-semibold text-gray-800 dark:text-white">
            {transactionsProcessed.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Last Updated */}
      <div className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Last Updated: {lastUpdated}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleAgentAction('start')}
          disabled={isLoading || status === 'running'}
          className={`px-4 py-2 rounded-md text-white font-medium transition-opacity ${
            status === 'running' || isLoading
              ? 'bg-green-300 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600'
          }`}
          aria-label="Start Agent"
        >
          {isLoading && status !== 'running' ? 'Starting...' : 'Start'}
        </button>
        <button
          onClick={() => handleAgentAction('stop')}
          disabled={isLoading || status === 'stopped'}
          className={`px-4 py-2 rounded-md text-white font-medium transition-opacity ${
            status === 'stopped' || isLoading
              ? 'bg-red-300 cursor-not-allowed'
              : 'bg-red-500 hover:bg-red-600'
          }`}
          aria-label="Stop Agent"
        >
          {isLoading && status !== 'stopped' ? 'Stopping...' : 'Stop'}
        </button>
        <button
          onClick={() => handleAgentAction('update_config')}
          disabled={isLoading}
          className={`px-4 py-2 rounded-md text-white font-medium transition-opacity ${
            isLoading
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
          aria-label="Update Configuration"
        >
          {isLoading ? 'Updating...' : 'Update Config'}
        </button>
        <button
          onClick={() => onViewTransactions(agentId)}
          className="px-4 py-2 rounded-md text-white font-medium bg-purple-500 hover:bg-purple-600 transition-opacity"
          aria-label="View Transactions"
        >
          Transactions
        </button>
      </div>
    </div>
  );
};

export default AgentCard;
