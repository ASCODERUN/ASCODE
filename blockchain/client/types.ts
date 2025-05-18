import { PublicKey } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';

// Enum for different roles a user might have in the system
export enum UserRole {
  User = 0,
  Admin = 1,
  Validator = 2,
  Developer = 3,
}

// Enum for staking status
export enum StakeStatus {
  Active = 0,
  Locked = 1,
  Unstaked = 2,
}

// Enum for proposal status in governance
export enum ProposalStatus {
  Draft = 0,
  Active = 1,
  Passed = 2,
  Rejected = 3,
  Executed = 4,
}

// Interface for user account data stored on-chain
export interface UserAccount {
  owner: PublicKey; // The wallet address of the user
  username: string; // User's chosen name or identifier
  role: UserRole; // Role assigned to the user
  totalStaked: BN; // Total tokens staked by the user
  rewardsEarned: BN; // Total rewards earned by the user
  createdAt: BN; // Timestamp when the account was created
  updatedAt: BN; // Timestamp of last update
  isActive: boolean; // Whether the account is active
}

// Interface for staking data
export interface StakeAccount {
  user: PublicKey; // User who owns this stake
  amount: BN; // Amount of tokens staked
  status: StakeStatus; // Current status of the stake
  startTime: BN; // Timestamp when staking started
  endTime: BN; // Timestamp when staking ends (if applicable)
  rewardRate: BN; // Reward rate per epoch or time unit
  lastClaimed: BN; // Timestamp of last reward claim
}

// Interface for governance proposal data
export interface ProposalAccount {
  creator: PublicKey; // User who created the proposal
  title: string; // Title of the proposal
  description: string; // Detailed description of the proposal
  status: ProposalStatus; // Current status of the proposal
  yesVotes: BN; // Number of votes in favor
  noVotes: BN; // Number of votes against
  startTime: BN; // Timestamp when voting started
  endTime: BN; // Timestamp when voting ends
  executedAt: BN | null; // Timestamp when proposal was executed (if applicable)
  targetProgram: PublicKey | null; // Program to be updated if proposal passes
}

// Interface for AI agent metadata (specific to Ontora AI or similar projects)
export interface AiAgent {
  owner: PublicKey; // User who owns the AI agent
  agentId: string; // Unique identifier for the AI agent
  modelVersion: string; // Version of the AI model
  trainingDataHash: string; // Hash of the training data or parameters
  performanceScore: BN; // Score based on AI performance metrics
  createdAt: BN; // Timestamp when the agent was created
  lastUpdated: BN; // Timestamp of last update or retraining
  isDeployed: boolean; // Whether the AI agent is currently deployed
}

// Interface for reward pool data
export interface RewardPool {
  totalRewards: BN; // Total rewards available in the pool
  distributionRate: BN; // Rate at which rewards are distributed
  lastDistribution: BN; // Timestamp of last reward distribution
  admin: PublicKey; // Admin who manages the pool
  isActive: boolean; // Whether the pool is active
}

// Interface for token account data (for SPL tokens)
export interface TokenAccount {
  owner: PublicKey; // Owner of the token account
  mint: PublicKey; // Mint address of the token
  balance: BN; // Current balance of tokens
  isFrozen: boolean; // Whether the account is frozen
}

// Interface for program state or global configuration
export interface ProgramState {
  admin: PublicKey; // Admin of the program
  totalUsers: BN; // Total number of registered users
  totalStakedTokens: BN; // Total tokens staked across all users
  totalRewardsDistributed: BN; // Total rewards distributed by the program
  stakingEnabled: boolean; // Whether staking is currently enabled
  governanceEnabled: boolean; // Whether governance features are enabled
  lastUpdated: BN; // Timestamp of last state update
}

// Interface for event data emitted by the program
export interface ProgramEvent {
  eventType: string; // Type of event (e.g., "Stake", "ClaimReward", "ProposalCreated")
  timestamp: BN; // Timestamp when the event occurred
  user: PublicKey | null; // User associated with the event (if applicable)
  data: any; // Additional event-specific data
}

// Interface for instruction arguments (example for staking)
export interface StakeInstructionArgs {
  amount: BN; // Amount to stake
  duration: BN; // Duration of staking (if applicable)
}

// Interface for instruction arguments (example for creating a proposal)
export interface CreateProposalArgs {
  title: string; // Title of the proposal
  description: string; // Description of the proposal
  votingDuration: BN; // Duration of the voting period
  targetProgram?: PublicKey; // Optional target program for upgrades
}

// Interface for instruction arguments (example for claiming rewards)
export interface ClaimRewardArgs {
  stakeAccount: PublicKey; // Stake account to claim rewards from
}

// Interface for derived account addresses (PDAs)
export interface DerivedAccounts {
  userAccountPda: PublicKey; // PDA for user account
  stakeAccountPda: PublicKey; // PDA for stake account
  proposalAccountPda: PublicKey; // PDA for proposal account
  rewardPoolPda: PublicKey; // PDA for reward pool
}

// Interface for client configuration
export interface ClientConfig {
  programId: PublicKey; // Program ID of the deployed Solana program
  rpcEndpoint: string; // RPC endpoint for Solana network connection
  commitmentLevel: 'processed' | 'confirmed' | 'finalized'; // Commitment level for transactions
}

// Type for error handling
export type ProgramError = {
  code: number; // Error code from the program
  message: string; // Error message
};

// Type for transaction result
export type TransactionResult = {
  txId: string; // Transaction ID (signature)
  success: boolean; // Whether the transaction succeeded
  error?: ProgramError; // Error details if transaction failed
};

// Type for API response (for client-side usage)
export type ApiResponse<T> = {
  data?: T; // Response data
  error?: ProgramError; // Error if request failed
  timestamp: number; // Timestamp of the response
};
