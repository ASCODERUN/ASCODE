import { Connection, PublicKey, Keypair, clusterApiUrl } from '@solana/web3.js';
import { Program, AnchorProvider, web3, utils, BN } from '@project-serum/anchor';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { getWallets, WalletAdapter } from '@solana/wallet-adapter-base';
import * as IDL from './idl/ontora_ai.json'; // Adjust path to your generated IDL file

// Define the program ID (replace with your deployed program ID)
const PROGRAM_ID = new PublicKey('YourProgramIdHere'); // Replace with actual program ID after deployment

// Define network (use 'devnet', 'testnet', or 'mainnet-beta')
const NETWORK = WalletAdapterNetwork.Devnet;
const RPC_ENDPOINT = clusterApiUrl(NETWORK);

// Interface for Ontora AI client
interface OntoraAIClient {
  provider: AnchorProvider;
  program: Program;
  wallet: WalletAdapter | null;
  userAccount: PublicKey | null;
}

// Class to handle Ontora AI contract interactions
class OntoraAI {
  private client: OntoraAIClient;

  constructor() {
    this.client = {
      provider: null as unknown as AnchorProvider,
      program: null as unknown as Program,
      wallet: null,
      userAccount: null,
    };
  }

  // Initialize connection and wallet
  async initialize(): Promise<void> {
    try {
      // Set up connection to Solana network
      const connection = new Connection(RPC_ENDPOINT, 'confirmed');

      // Get available wallets (Phantom, Solflare, etc.)
      const wallets = getWallets([
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
      ]);

      // For simplicity, assume the first wallet is used (in a real app, let user choose)
      const wallet = wallets[0];
      await wallet.connect();
      this.client.wallet = wallet;

      // Set up Anchor provider with wallet and connection
      const provider = new AnchorProvider(connection, wallet, {
        preflightCommitment: 'confirmed',
      });
      this.client.provider = provider;

      // Initialize program from IDL
      const program = new Program(IDL as any, PROGRAM_ID, provider);
      this.client.program = program;

      // Set user account (wallet public key)
      this.client.userAccount = wallet.publicKey;

      console.log('Ontora AI client initialized successfully');
      console.log('Connected wallet:', wallet.publicKey?.toString());
    } catch (error) {
      console.error('Initialization failed:', error);
      throw new Error('Failed to initialize Ontora AI client');
    }
  }

  // Check if wallet is connected
  isConnected(): boolean {
    return this.client.wallet !== null && this.client.wallet.connected;
  }

  // Disconnect wallet
  async disconnect(): Promise<void> {
    if (this.client.wallet) {
      await this.client.wallet.disconnect();
      this.client.wallet = null;
      this.client.userAccount = null;
      console.log('Wallet disconnected');
    }
  }

  // Initialize user account on-chain (if needed by your program)
  async initializeUserAccount(): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    try {
      const userAccountKeypair = Keypair.generate();
      const tx = await this.client.program.methods
        .initializeUser()
        .accounts({
          userAccount: userAccountKeypair.publicKey,
          user: this.client.userAccount!,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([userAccountKeypair])
        .rpc();

      console.log('User account initialized. Transaction:', tx);
      return tx;
    } catch (error) {
      console.error('Failed to initialize user account:', error);
      throw error;
    }
  }

  // Stake tokens for AI agent operation
  async stakeTokens(amount: number, agentId: string): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    try {
      // Convert amount to BN (BigNumber) for on-chain precision
      const stakeAmount = new BN(amount);

      // Derive PDA for agent account (adjust based on your program logic)
      const [agentAccountPda] = await PublicKey.findProgramAddress(
        [Buffer.from('agent'), Buffer.from(agentId)],
        PROGRAM_ID
      );

      // Derive PDA for user's stake account
      const [stakeAccountPda] = await PublicKey.findProgramAddress(
        [Buffer.from('stake'), this.client.userAccount!.toBuffer(), Buffer.from(agentId)],
        PROGRAM_ID
      );

      const tx = await this.client.program.methods
        .stake(stakeAmount, agentId)
        .accounts({
          stakeAccount: stakeAccountPda,
          agentAccount: agentAccountPda,
          user: this.client.userAccount!,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      console.log(`Staked ${amount} tokens for agent ${agentId}. Transaction:`, tx);
      return tx;
    } catch (error) {
      console.error('Staking failed:', error);
      throw error;
    }
  }

  // Claim rewards for staked AI agents
  async claimRewards(agentId: string): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    try {
      // Derive PDA for user's stake account
      const [stakeAccountPda] = await PublicKey.findProgramAddress(
        [Buffer.from('stake'), this.client.userAccount!.toBuffer(), Buffer.from(agentId)],
        PROGRAM_ID
      );

      // Derive PDA for rewards account (adjust based on your program)
      const [rewardsAccountPda] = await PublicKey.findProgramAddress(
        [Buffer.from('rewards'), this.client.userAccount!.toBuffer()],
        PROGRAM_ID
      );

      const tx = await this.client.program.methods
        .claimRewards(agentId)
        .accounts({
          stakeAccount: stakeAccountPda,
          rewardsAccount: rewardsAccountPda,
          user: this.client.userAccount!,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      console.log(`Claimed rewards for agent ${agentId}. Transaction:`, tx);
      return tx;
    } catch (error) {
      console.error('Failed to claim rewards:', error);
      throw error;
    }
  }

  // Create a governance proposal
  async createProposal(title: string, description: string, votingDuration: number): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    try {
      const proposalKeypair = Keypair.generate();
      const votingDurationBN = new BN(votingDuration);

      const tx = await this.client.program.methods
        .createProposal(title, description, votingDurationBN)
        .accounts({
          proposal: proposalKeypair.publicKey,
          proposer: this.client.userAccount!,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([proposalKeypair])
        .rpc();

      console.log(`Created proposal: ${title}. Transaction:`, tx);
      return tx;
    } catch (error) {
      console.error('Failed to create proposal:', error);
      throw error;
    }
  }

  // Vote on a governance proposal
  async voteOnProposal(proposalId: string, inFavor: boolean): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    try {
      // Derive PDA for proposal account
      const [proposalPda] = await PublicKey.findProgramAddress(
        [Buffer.from('proposal'), Buffer.from(proposalId)],
        PROGRAM_ID
      );

      // Derive PDA for user's vote account
      const [votePda] = await PublicKey.findProgramAddress(
        [Buffer.from('vote'), this.client.userAccount!.toBuffer(), Buffer.from(proposalId)],
        PROGRAM_ID
      );

      const tx = await this.client.program.methods
        .vote(proposalId, inFavor)
        .accounts({
          proposal: proposalPda,
          vote: votePda,
          voter: this.client.userAccount!,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      console.log(`Voted ${inFavor ? 'in favor' : 'against'} proposal ${proposalId}. Transaction:`, tx);
      return tx;
    } catch (error) {
      console.error('Voting failed:', error);
      throw error;
    }
  }

  // Fetch account data (example for stake account)
  async getStakeAccount(agentId: string): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    try {
      // Derive PDA for user's stake account
      const [stakeAccountPda] = await PublicKey.findProgramAddress(
        [Buffer.from('stake'), this.client.userAccount!.toBuffer(), Buffer.from(agentId)],
        PROGRAM_ID
      );

      const accountData = await this.client.program.account.stakeAccount.fetch(stakeAccountPda);
      console.log(`Stake account data for agent ${agentId}:`, accountData);
      return accountData;
    } catch (error) {
      console.error('Failed to fetch stake account:', error);
      throw error;
    }
  }
}

// Export the client for use in other modules or apps
export default OntoraAI;

// Example usage (uncomment to test in a standalone script)
// async function main() {
//   const ontoraAI = new OntoraAI();
//   await ontoraAI.initialize();
//   await ontoraAI.initializeUserAccount();
//   await ontoraAI.stakeTokens(1000, 'agent-001');
//   await ontoraAI.claimRewards('agent-001');
//   await ontoraAI.createProposal('Upgrade AI Model', 'Proposal to upgrade AI model v2', 604800); // 7 days
//   await ontoraAI.voteOnProposal('proposal-001', true);
//   await ontoraAI.getStakeAccount('agent-001');
//   await ontoraAI.disconnect();
// }
// main().catch(console.error);
