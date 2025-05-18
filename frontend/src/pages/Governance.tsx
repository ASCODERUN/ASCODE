import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Gavel, ThumbsUp, ThumbsDown, Clock } from 'lucide-react';

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'passed' | 'rejected' | 'pending';
  votesFor: number;
  votesAgainst: number;
  endDate: string;
  proposer: string;
}

const mockProposals: Proposal[] = [
  {
    id: 'prop-001',
    title: 'Increase Agent Deployment Fee',
    description: 'Proposal to increase the deployment fee for AI agents by 10% to fund platform development.',
    status: 'active',
    votesFor: 120,
    votesAgainst: 80,
    endDate: '2023-12-15',
    proposer: '0x...a1b2',
  },
  {
    id: 'prop-002',
    title: 'Add NFT Trading Module',
    description: 'Proposal to integrate a new NFT trading module for AI agents to monitor and trade NFTs autonomously.',
    status: 'passed',
    votesFor: 200,
    votesAgainst: 50,
    endDate: '2023-11-30',
    proposer: '0x...c3d4',
  },
  {
    id: 'prop-003',
    title: 'Reduce Risk Tolerance Cap',
    description: 'Proposal to lower the maximum risk tolerance setting for AI agents to protect user funds.',
    status: 'rejected',
    votesFor: 90,
    votesAgainst: 150,
    endDate: '2023-11-15',
    proposer: '0x...e5f6',
  },
  {
    id: 'prop-004',
    title: 'Community Fund Allocation',
    description: 'Proposal to allocate 5% of platform fees to a community fund for developer grants.',
    status: 'pending',
    votesFor: 0,
    votesAgainst: 0,
    endDate: '2023-12-20',
    proposer: '0x...g7h8',
  },
];

const Governance: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>(mockProposals);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [isVoting, setIsVoting] = useState<boolean>(false);
  const [voteStatus, setVoteStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [voteMessage, setVoteMessage] = useState<string>('');

  const getStatusBadge = (status: Proposal['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Active</Badge>;
      case 'passed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Passed</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Rejected</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      default:
        return null;
    }
  };

  const handleVote = async (proposalId: string, voteFor: boolean) => {
    setIsVoting(true);
    setVoteStatus('idle');
    setVoteMessage('');

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setProposals(prev => prev.map(p => {
        if (p.id === proposalId && p.status === 'active') {
          return {
            ...p,
            votesFor: voteFor ? p.votesFor + 1 : p.votesFor,
            votesAgainst: !voteFor ? p.votesAgainst + 1 : p.votesAgainst,
          };
        }
        return p;
      }));
      setVoteStatus('success');
      setVoteMessage(voteFor ? 'Your vote in favor has been recorded!' : 'Your vote against has been recorded!');
    } catch (err) {
      setVoteStatus('error');
      setVoteMessage('Failed to record your vote. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Gavel className="w-8 h-8 text-indigo-600" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Governance</h1>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Participate in Governance</h2>
          <p className="text-gray-600 mb-4">
            View and vote on proposals to shape the future of the platform. Your voice matters in building a decentralized ecosystem.
          </p>
          <Button variant="outline" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
            Create Proposal
          </Button>
        </div>

        <div className="space-y-4">
          {proposals.length === 0 ? (
            <div className="text-center py-10 text-gray-500">No proposals available at the moment.</div>
          ) : (
            proposals.map(proposal => (
              <div
                key={proposal.id}
                className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-800">{proposal.title}</h3>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(proposal.status)}
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Ends: {proposal.endDate}
                    </span>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{proposal.description}</p>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-sm text-gray-500">
                    Proposer: {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      For: {proposal.votesFor} | Against: {proposal.votesAgainst}
                    </span>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedProposal(proposal)}
                        >
                          Details
                        </Button>
                      </DialogTrigger>
                      {selectedProposal?.id === proposal.id && (
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>{selectedProposal.title}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <p className="text-gray-600">{selectedProposal.description}</p>
                            <div className="flex justify-between text-sm text-gray-500">
                              <span>Status: {selectedProposal.status.charAt(0).toUpperCase() + selectedProposal.status.slice(1)}</span>
                              <span>Ends: {selectedProposal.endDate}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium">
                              <span>Votes For: {selectedProposal.votesFor}</span>
                              <span>Votes Against: {selectedProposal.votesAgainst}</span>
                            </div>
                            {selectedProposal.status === 'active' && (
                              <div className="flex gap-3 justify-center">
                                <Button
                                  size="sm"
                                  onClick={() => handleVote(selectedProposal.id, true)}
                                  disabled={isVoting}
                                  className="flex items-center gap-1 bg-green-50 text-green-700 hover:bg-green-100"
                                >
                                  <ThumbsUp className="w-4 h-4" />
                                  Vote For
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleVote(selectedProposal.id, false)}
                                  disabled={isVoting}
                                  className="flex items-center gap-1 bg-red-50 text-red-700 hover:bg-red-100"
                                >
                                  <ThumbsDown className="w-4 h-4" />
                                  Vote Against
                                </Button>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      )}
                    </Dialog>
                    {proposal.status === 'active' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleVote(proposal.id, true)}
                          disabled={isVoting}
                          className="bg-green-50 text-green-700 hover:bg-green-100"
                        >
                          For
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleVote(proposal.id, false)}
                          disabled={isVoting}
                          className="bg-red-50 text-red-700 hover:bg-red-100"
                        >
                          Against
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {voteStatus === 'success' && (
          <div className="fixed bottom-4 right-4 p-4 bg-green-50 text-green-700 rounded-md shadow-lg">
            {voteMessage}
          </div>
        )}
        {voteStatus === 'error' && (
          <div className="fixed bottom-4 right-4 p-4 bg-red-50 text-red-700 rounded-md shadow-lg">
            {voteMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default Governance;
