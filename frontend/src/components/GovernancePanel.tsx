import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import toast from 'react-hot-toast';

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: 'Active' | 'Passed' | 'Rejected' | 'Pending';
  votesFor: number;
  votesAgainst: number;
  createdAt: string;
  endsAt: string;
  creator: string;
}

const GovernancePanel: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const fetchProposals = async () => {
      try {
        setLoading(true);
        setError(null);

        // Mock data for proposals; replace with actual Solana governance program data fetching
        const mockProposals: Proposal[] = [
          {
            id: 'prop1',
            title: 'Increase Community Fund Allocation',
            description: 'Proposal to allocate 10% more tokens to community initiatives.',
            status: 'Active',
            votesFor: 120,
            votesAgainst: 80,
            createdAt: '2023-10-01T10:00:00Z',
            endsAt: '2023-10-08T10:00:00Z',
            creator: '3xV...9kP',
          },
          {
            id: 'prop2',
            title: 'Update Protocol Parameters',
            description: 'Adjust staking rewards to balance inflation.',
            status: 'Passed',
            votesFor: 300,
            votesAgainst: 50,
            createdAt: '2023-09-15T12:00:00Z',
            endsAt: '2023-09-22T12:00:00Z',
            creator: '7yT...2mN',
          },
          {
            id: 'prop3',
            title: 'New Partnership Proposal',
            description: 'Form a strategic partnership with a DeFi protocol.',
            status: 'Rejected',
            votesFor: 90,
            votesAgainst: 210,
            createdAt: '2023-09-01T08:00:00Z',
            endsAt: '2023-09-08T08:00:00Z',
            creator: '5kR...8vL',
          },
        ];

        setProposals(mockProposals);
      } catch (err) {
        setError('Failed to load proposals. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProposals();
  }, []);

  const handleVote = async (proposalId: string, vote: 'for' | 'against') => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet to vote.');
      return;
    }

    setVoting((prev) => ({ ...prev, [proposalId]: true }));

    try {
      // Simulate voting logic; replace with actual Solana governance program interaction
      console.log(`Voting ${vote} on proposal ${proposalId} by ${publicKey.toBase58()}`);
      toast.success(`Successfully voted ${vote} on the proposal!`);

      // Update local state for UI feedback (mock update)
      setProposals((prev) =>
        prev.map((p) =>
          p.id === proposalId
            ? {
                ...p,
                votesFor: vote === 'for' ? p.votesFor + 1 : p.votesFor,
                votesAgainst: vote === 'against' ? p.votesAgainst + 1 : p.votesAgainst,
              }
            : p
        )
      );
    } catch (err) {
      toast.error('Failed to submit vote. Please try again.');
      console.error(err);
    } finally {
      setVoting((prev) => ({ ...prev, [proposalId]: false }));
    }
  };

  const getStatusColor = (status: Proposal['status']) => {
    switch (status) {
      case 'Active':
        return 'bg-blue-100 text-blue-800';
      case 'Passed':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-6">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        <p>{error}</p>
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
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Governance Panel</h1>

      {!connected && (
        <div className="mb-6 p-4 bg-yellow-50 text-yellow-700 rounded-lg">
          <p>Connect your wallet to vote on proposals or create new ones.</p>
        </div>
      )}

      {proposals.length === 0 ? (
        <div className="text-center p-6 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No proposals found. Check back later or create one.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {proposals.map((proposal) => (
            <div
              key={proposal.id}
              className="p-6 bg-white shadow-md rounded-lg border border-gray-200"
            >
              <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">{proposal.title}</h2>
                  <p className="text-gray-600 mt-1">{proposal.description}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    proposal.status
                  )}`}
                >
                  {proposal.status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-500 mb-4">
                <div>
                  <p>
                    <strong>Created:</strong>{' '}
                    {new Date(proposal.createdAt).toLocaleDateString()}
                  </p>
                  <p>
                    <strong>Ends:</strong> {new Date(proposal.endsAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p>
                    <strong>Creator:</strong> {proposal.creator}
                  </p>
                </div>
                <div className="text-right">
                  <p>
                    <strong>Votes For:</strong> {proposal.votesFor}
                  </p>
                  <p>
                    <strong>Votes Against:</strong> {proposal.votesAgainst}
                  </p>
                </div>
              </div>

              {proposal.status === 'Active' && (
                <div className="flex gap-4">
                  <button
                    onClick={() => handleVote(proposal.id, 'for')}
                    disabled={
                      !connected || voting[proposal.id] || proposal.status !== 'Active'
                    }
                    className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    aria-label={`Vote for proposal ${proposal.title}`}
                  >
                    {voting[proposal.id] ? 'Voting...' : 'Vote For'}
                  </button>
                  <button
                    onClick={() => handleVote(proposal.id, 'against')}
                    disabled={
                      !connected || voting[proposal.id] || proposal.status !== 'Active'
                    }
                    className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    aria-label={`Vote against proposal ${proposal.title}`}
                  >
                    {voting[proposal.id] ? 'Voting...' : 'Vote Against'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {connected && (
        <div className="mt-6">
          <button
            onClick={() => toast.error('Create proposal functionality coming soon!')}
            className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
          >
            Create New Proposal
          </button>
        </div>
      )}
    </div>
  );
};

export default GovernancePanel;
