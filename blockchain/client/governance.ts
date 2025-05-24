import { Connection, PublicKey, Transaction, TransactionInstruction, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@project-serum/anchor'; 
import { SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';

// Import types and utilities (assuming they are in the same directory or adjust path accordingly)
import { ProposalAccount, CreateProposalArgs, ProgramState } from './types';
import { PdaUtils, InstructionUtils, AccountUtils } from './utils';

// Governance client class for interacting with governance features
export class GovernanceClient {
  private program: Program;
  private provider: AnchorProvider;
  private connection: Connection;
  private programId: PublicKey;

  constructor(program: Program, provider: AnchorProvider, connection: Connection, programId: PublicKey) {
    this.program = program;
    this.provider = provider;
    this.connection = connection;
    this.programId = programId;
  }

  // Fetch program state to check if governance is enabled
  async fetchProgramState(): Promise<ProgramState> {
    const programStatePda = await PdaUtils.getProgramStatePda(this.programId);
    const accountData = await this.connection.getAccountInfo(programStatePda);
    if (!accountData) {
      throw new Error('Program state account not found');
    }
    return AccountUtils.decodeProgramState(accountData.data);
  }

  // Create a new governance proposal
  async createProposal(
    creator: PublicKey,
    title: string,
    description: string,
    votingDuration: number,
    targetProgram?: PublicKey
  ): Promise<{ tx: Transaction; proposalId: string }> {
    const proposalId = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    const proposalPda = await PdaUtils.getProposalAccountPda(proposalId, this.programId);
    const programStatePda = await PdaUtils.getProgramStatePda(this.programId);
    const userAccountPda = await PdaUtils.getUserAccountPda(creator, this.programId);

    const args: CreateProposalArgs = {
      title,
      description,
      votingDuration: new BN(votingDuration),
      targetProgram: targetProgram || null,
    };

    const instructionData = InstructionUtils.encodeCreateProposalInstruction(args);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: creator, isSigner: true, isWritable: false },
        { pubkey: proposalPda, isSigner: false, isWritable: true },
        { pubkey: userAccountPda, isSigner: false, isWritable: false },
        { pubkey: programStatePda, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.concat([Buffer.from([0]), instructionData]), // Assuming 0 is the instruction discriminator for createProposal
    });

    const tx = new Transaction().add(instruction);
    return { tx, proposalId };
  }

  // Vote on a proposal (yes or no)
  async voteOnProposal(
    voter: PublicKey,
    proposalId: string,
    voteYes: boolean
  ): Promise<Transaction> {
    const proposalPda = await PdaUtils.getProposalAccountPda(proposalId, this.programId);
    const userAccountPda = await PdaUtils.getUserAccountPda(voter, this.programId);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: voter, isSigner: true, isWritable: false },
        { pubkey: proposalPda, isSigner: false, isWritable: true },
        { pubkey: userAccountPda, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from([voteYes ? 1 : 2]), // Assuming 1 for voteYes, 2 for voteNo as instruction discriminators
    });

    return new Transaction().add(instruction);
  }

  // Execute a proposal if voting period is over and conditions are met
  async executeProposal(
    executor: PublicKey,
    proposalId: string
  ): Promise<Transaction> {
    const proposalPda = await PdaUtils.getProposalAccountPda(proposalId, this.programId);
    const programStatePda = await PdaUtils.getProgramStatePda(this.programId);
    const userAccountPda = await PdaUtils.getUserAccountPda(executor, this.programId);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: executor, isSigner: true, isWritable: false },
        { pubkey: proposalPda, isSigner: false, isWritable: true },
        { pubkey: userAccountPda, isSigner: false, isWritable: false },
        { pubkey: programStatePda, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.from([3]), // Assuming 3 is the instruction discriminator for executeProposal
    });

    return new Transaction().add(instruction);
  }

  // Fetch proposal data by ID
  async fetchProposal(proposalId: string): Promise<ProposalAccount> {
    const proposalPda = await PdaUtils.getProposalAccountPda(proposalId, this.programId);
    const accountData = await this.connection.getAccountInfo(proposalPda);
    if (!accountData) {
      throw new Error('Proposal account not found');
    }
    return AccountUtils.decodeProposalAccount(accountData.data);
  }

  // Fetch all proposals (requires off-chain indexing or filtering if many accounts exist)
  async fetchAllProposals(): Promise<ProposalAccount[]> {
    // Note: This is a placeholder. In a real application, you may need to use an indexer or filter accounts.
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: Buffer.from('proposal_account').toString('base64'),
          },
        },
      ],
    });

    return accounts.map((account) => AccountUtils.decodeProposalAccount(account.account.data));
  }

  // Check if a user has voted on a proposal (requires on-chain or off-chain tracking)
  async hasUserVoted(voter: PublicKey, proposalId: string): Promise<boolean> {
    // Note: This is a placeholder. Actual implementation depends on how votes are stored on-chain.
    const proposalPda = await PdaUtils.getProposalAccountPda(proposalId, this.programId);
    const userAccountPda = await PdaUtils.getUserAccountPda(voter, this.programId);

    // Assuming votes are tracked in a separate account or bitmap, this would query that data.
    // For simplicity, return false as a placeholder.
    return false;
  }

  // Update governance settings (e.g., enable/disable governance, only callable by admin)
  async updateGovernanceSettings(
    admin: PublicKey,
    stakingEnabled: boolean,
    governanceEnabled: boolean
  ): Promise<Transaction> {
    const programStatePda = await PdaUtils.getProgramStatePda(this.programId);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: admin, isSigner: true, isWritable: false },
        { pubkey: programStatePda, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.from([4, stakingEnabled ? 1 : 0, governanceEnabled ? 1 : 0]), // Assuming 4 is the instruction discriminator for updateSettings
    });

    return new Transaction().add(instruction);
  }

  // Delegate voting power to another user (if supported by the program)
  async delegateVotingPower(
    delegator: PublicKey,
    delegatee: PublicKey
  ): Promise<Transaction> {
    const delegatorAccountPda = await PdaUtils.getUserAccountPda(delegator, this.programId);
    const delegateeAccountPda = await PdaUtils.getUserAccountPda(delegatee, this.programId);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: delegator, isSigner: true, isWritable: false },
        { pubkey: delegatorAccountPda, isSigner: false, isWritable: true },
        { pubkey: delegateeAccountPda, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from([5]), // Assuming 5 is the instruction discriminator for delegateVotingPower
    });

    return new Transaction().add(instruction);
  }

  // Revoke delegated voting power
  async revokeVotingPower(
    delegator: PublicKey
  ): Promise<Transaction> {
    const delegatorAccountPda = await PdaUtils.getUserAccountPda(delegator, this.programId);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: delegator, isSigner: true, isWritable: false },
        { pubkey: delegatorAccountPda, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.from([6]), // Assuming 6 is the instruction discriminator for revokeVotingPower
    });

    return new Transaction().add(instruction);
  }
}
