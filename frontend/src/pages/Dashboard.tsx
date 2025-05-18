import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { PlusCircle, RefreshCw, DollarSign, BarChart2, Bot } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  performance: number;
}

interface Wallet {
  address: string;
  balance: number;
}

interface Stats {
  totalAgents: number;
  activeAgents: number;
  totalEarnings: number;
}

const Dashboard: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        await new Promise(resolve => setTimeout(resolve, 1000));

        const mockAgents: Agent[] = [
          { id: '1', name: 'Trading Bot Alpha', status: 'active', performance: 85 },
          { id: '2', name: 'NFT Monitor Beta', status: 'inactive', performance: 60 },
          { id: '3', name: 'Yield Optimizer', status: 'error', performance: 30 },
        ];

        const mockWallet: Wallet = {
          address: 'GsbwXfJraMomNxBc8oK4DjYMc4U8RKAQe4V3tqMzohsP',
          balance: 12.45,
        };

        const mockStats: Stats = {
          totalAgents: 3,
          activeAgents: 1,
          totalEarnings: 245.67,
        };

        setAgents(mockAgents);
        setWallet(mockWallet);
        setStats(mockStats);
      } catch (err) {
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleCreateAgent = () => {
    console.log('Navigating to agent creation page');
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    setAgents([]);
    setWallet(null);
    setStats(null);

    setTimeout(() => {
      const mockAgents: Agent[] = [
        { id: '1', name: 'Trading Bot Alpha', status: 'active', performance: 85 },
        { id: '2', name: 'NFT Monitor Beta', status: 'inactive', performance: 60 },
        { id: '3', name: 'Yield Optimizer', status: 'error', performance: 30 },
      ];

      const mockWallet: Wallet = {
        address: 'GsbwXfJraMomNxBc8oK4DjYMc4U8RKAQe4V3tqMzohsP',
        balance: 12.45,
      };

      const mockStats: Stats = {
        totalAgents: 3,
        activeAgents: 1,
        totalEarnings: 245.67,
      };

      setAgents(mockAgents);
      setWallet(mockWallet);
      setStats(mockStats);
      setLoading(false);
    }, 1000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'inactive':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600 animate-pulse">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-red-500 text-lg mb-2">{error}</div>
        <Button onClick={handleRefresh} className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Dashboard</h1>
          <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-semibold text-gray-800">Wallet</h2>
            </div>
            {wallet ? (
              <div>
                <p className="text-sm text-gray-500 truncate">Address: {wallet.address}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{wallet.balance} SOL</p>
              </div>
            ) : (
              <p className="text-gray-500">No wallet data available</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <Bot className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-semibold text-gray-800">Agents</h2>
            </div>
            {stats ? (
              <div>
                <p className="text-sm text-gray-500">Total: {stats.totalAgents}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeAgents} Active</p>
              </div>
            ) : (
              <p className="text-gray-500">No agent data available</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <BarChart2 className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-semibold text-gray-800">Earnings</h2>
            </div>
            {stats ? (
              <p className="text-2xl font-bold text-gray-900">{stats.totalEarnings} SOL</p>
            ) : (
              <p className="text-gray-500">No earnings data available</p>
            )}
          </div>
        </div>

        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-800">My AI Agents</h2>
          <Button onClick={handleCreateAgent} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
            <PlusCircle className="w-4 h-4" />
            Create New Agent
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {agents.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Name</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Status</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Performance</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {agents.map(agent => (
                  <tr key={agent.id} className="border-t hover:bg-gray-50">
                    <td className="p-4 text-gray-900">{agent.name}</td>
                    <td className="p-4 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`}></span>
                      <span className="text-gray-600 capitalize">{agent.status}</span>
                    </td>
                    <td className="p-4 text-gray-900">{agent.performance}%</td>
                    <td className="p-4">
                      <Link to={`/agent/${agent.id}`}>
                        <Button variant="outline" size="sm">View Details</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-gray-500">No agents found. Create your first AI agent to get started.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
