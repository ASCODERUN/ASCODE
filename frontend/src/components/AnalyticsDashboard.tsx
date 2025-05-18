import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsData {
  userCount: number;
  agentCount: number;
  transactionVolume: number;
  userGrowth: Array<{ date: string; users: number }>;
  agentActivity: Array<{ date: string; deployments: number }>;
  agentDistribution: Array<{ name: string; value: number }>;
}

const AnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('7d');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        // Mock data for analytics; replace with actual API or Solana blockchain data fetching
        const mockData: AnalyticsData = {
          userCount: 1245,
          agentCount: 320,
          transactionVolume: 8500,
          userGrowth: [
            { date: '2023-10-01', users: 800 },
            { date: '2023-10-02', users: 850 },
            { date: '2023-10-03', users: 900 },
            { date: '2023-10-04', users: 950 },
            { date: '2023-10-05', users: 1000 },
            { date: '2023-10-06', users: 1100 },
            { date: '2023-10-07', users: 1245 },
          ],
          agentActivity: [
            { date: '2023-10-01', deployments: 50 },
            { date: '2023-10-02', deployments: 60 },
            { date: '2023-10-03', deployments: 45 },
            { date: '2023-10-04', deployments: 70 },
            { date: '2023-10-05', deployments: 80 },
            { date: '2023-10-06', deployments: 65 },
            { date: '2023-10-07', deployments: 75 },
          ],
          agentDistribution: [
            { name: 'Trading Bots', value: 120 },
            { name: 'NFT Agents', value: 80 },
            { name: 'Governance Bots', value: 60 },
            { name: 'Custom Agents', value: 60 },
          ],
        };

        // Simulate filtering based on time range
        let filteredData = { ...mockData };
        if (timeRange === '7d') {
          filteredData.userGrowth = mockData.userGrowth.slice(-7);
          filteredData.agentActivity = mockData.agentActivity.slice(-7);
        } else if (timeRange === '30d') {
          filteredData.userGrowth = mockData.userGrowth.slice(-30);
          filteredData.agentActivity = mockData.agentActivity.slice(-30);
        }

        setAnalytics(filteredData);
      } catch (err) {
        setError('Failed to load analytics data. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeRange]);

  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  if (loading) {
    return (
      <div className="flex justify-center items-center p-6 min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="p-6 text-center text-red-600 min-h-screen">
        <p>{error || 'No data available.'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Analytics Dashboard</h1>
        <div className="flex gap-2 mt-2 md:mt-0">
          <button
            onClick={() => handleTimeRangeChange('7d')}
            className={`px-3 py-1 text-sm rounded-md ${
              timeRange === '7d'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            } transition-colors`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => handleTimeRangeChange('30d')}
            className={`px-3 py-1 text-sm rounded-md ${
              timeRange === '30d'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            } transition-colors`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => handleTimeRangeChange('all')}
            className={`px-3 py-1 text-sm rounded-md ${
              timeRange === 'all'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            } transition-colors`}
          >
            All Time
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="p-6 bg-white shadow-md rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Active Users</h2>
          <p className="text-3xl font-bold text-gray-800">{analytics.userCount.toLocaleString()}</p>
          <p className="text-sm text-green-600 mt-1">+12.5% from last period</p>
        </div>
        <div className="p-6 bg-white shadow-md rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Active Agents</h2>
          <p className="text-3xl font-bold text-gray-800">{analytics.agentCount.toLocaleString()}</p>
          <p className="text-sm text-green-600 mt-1">+8.3% from last period</p>
        </div>
        <div className="p-6 bg-white shadow-md rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Transaction Volume (SOL)</h2>
          <p className="text-3xl font-bold text-gray-800">
            {analytics.transactionVolume.toLocaleString()}
          </p>
          <p className="text-sm text-green-600 mt-1">+15.7% from last period</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="p-6 bg-white shadow-md rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">User Growth Over Time</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.userGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name="Users"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 bg-white shadow-md rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Agent Activity Over Time</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.agentActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Bar dataKey="deployments" fill="#10B981" name="Deployments" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 bg-white shadow-md rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Agent Type Distribution</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.agentDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label
                >
                  {analytics.agentDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 bg-white shadow-md rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Additional Insights</h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-md">
              <p className="font-medium text-gray-700">Top Performing Agent Category</p>
              <p className="text-gray-600">Trading Bots - 45% success rate</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-md">
              <p className="font-medium text-gray-700">User Retention Rate</p>
              <p className="text-gray-600">78% after 30 days</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-md">
              <p className="font-medium text-gray-700">Average Agent Lifespan</p>
              <p className="text-gray-600">14 days before redeployment</p>
            </div>
          </div>
          <button className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors">
            View Detailed Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
