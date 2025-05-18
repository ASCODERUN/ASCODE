import { PublicKey, SystemProgram, TransactionInstruction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN, Program, Idl, utils as anchorUtils } from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as borsh from 'borsh';
import { Buffer } from 'buffer';

// Import types (assuming types.ts is in the same directory or adjust path accordingly)
import { UserAccount, StakeAccount, ProposalAccount, AiAgent, RewardPool, ProgramState, StakeInstructionArgs, CreateProposalArgs, ClaimRewardArgs, DerivedAccounts } from './types';

// Utility class for encoding and decoding data using Borsh
export class BorshCoder {
  // Encode data into a Buffer using a Borsh schema
  static encode(schema: any, data: any): Buffer {
    return Buffer.from(borsh.serialize(schema, data));
  }

  // Decode data from a Buffer using a Borsh schema
  static decode<T>(schema: any, buffer: Buffer): T {
    return borsh.deserialize(schema, buffer) as T;
  }
}

// Utility for generating PDAs (Program Derived Addresses)
export class PdaUtils {
  // Generate PDA for a user account based on user public key and program ID
  static async getUserAccountPda(user: PublicKey, programId: PublicKey): Promise<PublicKey> {
    const [pda, _] = await PublicKey.findProgramAddress(
      [Buffer.from('user_account'), user.toBuffer()],
      programId
    );
    return pda;
  }

  // Generate PDA for a stake account based on user public key and stake ID
  static async getStakeAccountPda(user: PublicKey, stakeId: string, programId: PublicKey): Promise<PublicKey> {
    const [pda, _] = await PublicKey.findProgramAddress(
      [Buffer.from('stake_account'), user.toBuffer(), Buffer.from(stakeId)],
      programId
    );
    return pda;
  }

  // Generate PDA for a proposal account based on proposal ID
  static async getProposalAccountPda(proposalId: string, programId: PublicKey): Promise<PublicKey> {
    const [pda, _] = await PublicKey.findProgramAddress(
      [Buffer.from('proposal_account'), Buffer.from(proposalId)],
      programId
    );
    return pda;
  }

  // Generate PDA for a reward pool
  static async getRewardPoolPda(programId: PublicKey): Promise<PublicKey> {
    const [pda, _] = await PublicKey.findProgramAddress(
      [Buffer.from('reward_pool')],
      programId
    );
    return pda;
  }

  // Generate PDA for program state
  static async getProgramStatePda(programId: PublicKey): Promise<PublicKey> {
    const [pda, _] = await PublicKey.findProgramAddress(
      [Buffer.from('program_state')],
      programId
    );
    return pda;
  }
}

// Utility for encoding instruction data
export class InstructionUtils {
  // Encode staking instruction data
  static encodeStakeInstruction(args: StakeInstructionArgs): Buffer {
    const schema = new Map([
      [
        StakeInstructionArgs,
        {
          kind: 'struct',
          fields: [
            ['amount', 'u64'],
            ['duration', 'u64'],
          ],
        },
      ],
    ]);
    return BorshCoder.encode(schema, args);
  }

  // Encode create proposal instruction data
  static encodeCreateProposalInstruction(args: CreateProposalArgs): Buffer {
    const schema = new Map([
      [
        CreateProposalArgs,
        {
          kind: 'struct',
          fields: [
            ['title', 'string'],
            ['description', 'string'],
            ['votingDuration', 'u64'],
            ['targetProgram', { kind: 'option', type: [32] }], // Optional PublicKey (32 bytes)
          ],
        },
      ],
    ]);
    return BorshCoder.encode(schema, args);
  }

  // Encode claim reward instruction data
  static encodeClaimRewardInstruction(args: ClaimRewardArgs): Buffer {
    const schema = new Map([
      [
        ClaimRewardArgs,
        {
          kind: 'struct',
          fields: [
            ['stakeAccount', [32]], // PublicKey (32 bytes)
          ],
        },
      ],
    ]);
    return BorshCoder.encode(schema, args);
  }
}

// Utility for decoding account data
export class AccountUtils {
  // Decode user account data from buffer
  static decodeUserAccount(data: Buffer): UserAccount {
    const schema = new Map([
      [
        UserAccount,
        {
          kind: 'struct',
          fields: [
            ['owner', [32]], // PublicKey
            ['username', 'string'],
            ['role', 'u8'], // Enum as u8
            ['totalStaked', 'u64'],
            ['rewardsEarned', 'u64'],
            ['createdAt', 'u64'],
            ['updatedAt', 'u64'],
            ['isActive', 'u8'], // Boolean as u8 (0 or 1)
          ],
        },
      ],
    ]);
    const decoded = BorshCoder.decode<UserAccount>(schema, data);
    decoded.owner = new PublicKey(decoded.owner);
    decoded.isActive = decoded.isActive === 1;
    return decoded;
  }

  // Decode stake account data from buffer
  static decodeStakeAccount(data: Buffer): StakeAccount {
    const schema = new Map([
      [
        StakeAccount,
        {
          kind: 'struct',
          fields: [
            ['user', [32]], // PublicKey
            ['amount', 'u64'],
            ['status', 'u8'], // Enum as u8
            ['startTime', 'u64'],
            ['endTime', 'u64'],
            ['rewardRate', 'u64'],
            ['lastClaimed', 'u64'],
          ],
        },
      ],
    ]);
    const decoded = BorshCoder.decode<StakeAccount>(schema, data);
    decoded.user = new PublicKey(decoded.user);
    return decoded;
  }

  // Decode proposal account data from buffer
  static decodeProposalAccount(data: Buffer): ProposalAccount {
    const schema = new Map([
      [
        ProposalAccount,
        {
          kind: 'struct',
          fields: [
            ['creator', [32]], // PublicKey
            ['title', 'string'],
            ['description', 'string'],
            ['status', 'u8'], // Enum as u8
            ['yesVotes', 'u64'],
            ['noVotes', 'u64'],
            ['startTime', 'u64'],
            ['endTime', 'u64'],
            ['executedAt', { kind: 'option', type: 'u64' }],
            ['targetProgram', { kind: 'option', type: [32] }], // Optional PublicKey
          ],
        },
      ],
    ]);
    const decoded = BorshCoder.decode<ProposalAccount>(schema, data);
    decoded.creator = new PublicKey(decoded.creator);
    if (decoded.targetProgram) {
      decoded.targetProgram = new PublicKey(decoded.targetProgram);
    }
    return decoded;
  }

  // Decode AI agent data from buffer
  static decodeAiAgent(data: Buffer): AiAgent {
    const schema = new Map([
      [
        AiAgent,
        {
          kind: 'struct',
          fields: [
            ['owner', [32]], // PublicKey
            ['agentId', 'string'],
            ['modelVersion', 'string'],
            ['trainingDataHash', 'string'],
            ['performanceScore', 'u64'],
            ['createdAt', 'u64'],
            ['lastUpdated', 'u64'],
            ['isDeployed', 'u8'], // Boolean as u8
          ],
        },
      ],
    ]);
    const decoded = BorshCoder.decode<AiAgent>(schema, data);
    decoded.owner = new PublicKey(decoded.owner);
    decoded.isDeployed = decoded.isDeployed === 1;
    return decoded;
  }

  // Decode reward pool data from buffer
  static decodeRewardPool(data: Buffer): RewardPool {
    const schema = new Map([
      [
        RewardPool,
        {
          kind: 'struct',
          fields: [
            ['totalRewards', 'u64'],
            ['distributionRate', 'u64'],
            ['lastDistribution', 'u64'],
            ['admin', [32]], // PublicKey
            ['isActive', 'u8'], // Boolean as u8
          ],
        },
      ],
    ]);
    const decoded = BorshCoder.decode<RewardPool>(schema, data);
    decoded.admin = new PublicKey(decoded.admin);
    decoded.isActive = decoded.isActive === 1;
    return decoded;
  }

  // Decode program state data from buffer
  static decodeProgramState(data: Buffer): ProgramState {
    const schema = new Map([
      [
        ProgramState,
        {
          kind: 'struct',
          fields: [
            ['admin', [32]], // PublicKey
            ['totalUsers', 'u64'],
            ['totalStakedTokens', 'u64'],
            ['totalRewardsDistributed', 'u64'],
            ['stakingEnabled', 'u8'], // Boolean as u8
            ['governanceEnabled', 'u8'], // Boolean as u8
            ['lastUpdated', 'u64'],
          ],
        },
      ],
    ]);
    const decoded = BorshCoder.decode<ProgramState>(schema, data);
    decoded.admin = new PublicKey(decoded.admin);
    decoded.stakingEnabled = decoded.stakingEnabled === 1;
    decoded.governanceEnabled = decoded.governanceEnabled === 1;
    return decoded;
  }
}

// Utility for token-related operations
export class TokenUtils {
  // Get associated token account address for a user and token mint
  static async getAssociatedTokenAccount(user: PublicKey, mint: PublicKey): Promise<PublicKey> {
    return await getAssociatedTokenAddress(mint, user);
  }

  // Create instruction to initialize associated token account if it doesn't exist
  static createAssociatedTokenAccountInstruction(
    payer: PublicKey,
    associatedToken: PublicKey,
    owner: PublicKey,
    mint: PublicKey
  ): TransactionInstruction {
    return new TransactionInstruction({
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: associatedToken, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      data: Buffer.from([]),
    });
  }
}

// Utility for general conversions and helpers
export class GeneralUtils {
  // Convert SOL to lamports
  static solToLamports(sol: number): number {
    return sol * LAMPORTS_PER_SOL;
  }

  // Convert lamports to SOL
  static lamportsToSol(lamports: number): number {
    return lamports / LAMPORTS_PER_SOL;
  }

  // Convert string to buffer with padding (for fixed-size fields)
  static stringToBuffer(str: string, size: number): Buffer {
    const buf = Buffer.alloc(size);
    buf.write(str, 0, 'utf8');
    return buf;
  }

  // Generate a unique ID (e.g., for proposals or stakes)
  static generateUniqueId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Convert BN to string for display
  static bnToString(bn: BN): string {
    return bn.toString();
  }

  // Convert string to BN
  static stringToBn(str: string): BN {
    return new BN(str);
  }
}
