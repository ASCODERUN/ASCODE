const { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
const { createRealm, createProposal, vote, executeProposal } = require('@solana/spl-governance');
const { jest } = require('@jest/globals');

// Mock Solana connection to avoid real network calls
jest.mock('@solana/web3.js', () => {
  const mockConnection = {
    getBalance: jest.fn().mockResolvedValue(1000000000), // 1 SOL in lamports
    getRecentBlockhash: jest.fn().mockResolvedValue({ blockhash: 'mockBlockhash', feeCalculator: { lamportsPerSignature: 5000 } }),
    sendTransaction: jest.fn().mockResolvedValue('mockTransactionId'),
    confirmTransaction: jest.fn().mockResolvedValue({ context: { slot: 12345 }, value: { err: null } })
  };

  return {
    Connection: jest.fn(() => mockConnection),
    PublicKey: jest.requireActual('@solana/web3.js').PublicKey,
    Keypair: jest.requireActual('@solana/web3.js').Keypair,
    Transaction: jest.requireActual('@solana/web3.js').Transaction,
    SystemProgram: jest.requireActual('@solana/web3.js').SystemProgram,
    sendAndConfirmTransaction: jest.fn().mockResolvedValue('mockTransactionId')
  };
});

// Mock SPL Governance functions
jest.mock('@solana/spl-governance', () => ({
  createRealm: jest.fn().mockResolvedValue({
    realmId: 'realm123',
    authority: 'mockAuthorityPubkey'
  }),
  createProposal: jest.fn().mockResolvedValue({
    proposalId: 'prop456',
    title: 'Test Proposal',
    description: 'A test proposal for Ontora AI governance',
    status: 'Draft'
  }),
  vote: jest.fn().mockResolvedValue({
    voteId: 'vote789',
    proposalId: 'prop456',
    voter: 'user123',
    choice: 'Yes',
    weight: 100
  }),
  executeProposal: jest.fn().mockResolvedValue({
    proposalId: 'prop456',
    status: 'Executed',
    result: 'Success'
  })
}));

// Mock user wallet and governance program ID
const userKeypair = Keypair.generate();
const governanceProgramId = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw'); // Mock program ID
const realmAuthorityKeypair = Keypair.generate();

describe('Governance Flow Integration Tests for Ontora AI', () => {
  let connection;
  let governanceService;

  beforeAll(() => {
    // Initialize mock Solana connection
    connection = new Connection('http://localhost:8899', 'confirmed');
    governanceService = {
      createRealm,
      createProposal,
      vote,
      executeProposal
    };
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should successfully create a governance realm for Ontora AI', async () => {
    // Step 1: Create a governance realm
    const realmData = await governanceService.createRealm({
      connection: connection,
      authority: realmAuthorityKeypair.publicKey,
      name: 'OntoraAIRealm',
      programId: governanceProgramId,
      payer: userKeypair
    });

    // Verify realm creation
    expect(realmData).toBeDefined();
    expect(realmData.realmId).toBe('realm123');
    expect(realmData.authority).toBe('mockAuthorityPubkey');

    // Verify transaction was sent for realm creation
    expect(connection.sendTransaction).toHaveBeenCalled();
  });

  it('should successfully create a governance proposal in the realm', async () => {
    // Step 1: Create a proposal within the realm
    const proposalData = await governanceService.createProposal({
      connection: connection,
      realmId: 'realm123',
      title: 'Test Proposal',
      description: 'A test proposal for Ontora AI governance',
      proposer: userKeypair.publicKey,
      programId: governanceProgramId,
      payer: userKeypair
    });

    // Verify proposal creation
    expect(proposalData).toBeDefined();
    expect(proposalData.proposalId).toBe('prop456');
    expect(proposalData.title).toBe('Test Proposal');
    expect(proposalData.description).toBe('A test proposal for Ontora AI governance');
    expect(proposalData.status).toBe('Draft');

    // Verify transaction was sent for proposal creation
    expect(connection.sendTransaction).toHaveBeenCalled();
  });

  it('should allow users to vote on a governance proposal', async () => {
    // Step 1: Simulate voting on a proposal
    const voteData = await governanceService.vote({
      connection: connection,
      proposalId: 'prop456',
      voter: userKeypair.publicKey,
      choice: 'Yes',
      weight: 100,
      programId: governanceProgramId,
      payer: userKeypair
    });

    // Verify vote recording
    expect(voteData).toBeDefined();
    expect(voteData.voteId).toBe('vote789');
    expect(voteData.proposalId).toBe('prop456');
    expect(voteData.voter).toBe('user123');
    expect(voteData.choice).toBe('Yes');
    expect(voteData.weight).toBe(100);

    // Verify transaction was sent for voting
    expect(connection.sendTransaction).toHaveBeenCalled();
  });

  it('should successfully execute a governance proposal after voting', async () => {
    // Step 1: Simulate executing a proposal after voting period
    const executionData = await governanceService.executeProposal({
      connection: connection,
      proposalId: 'prop456',
      authority: realmAuthorityKeypair.publicKey,
      programId: governanceProgramId,
      payer: userKeypair
    });

    // Verify proposal execution
    expect(executionData).toBeDefined();
    expect(executionData.proposalId).toBe('prop456');
    expect(executionData.status).toBe('Executed');
    expect(executionData.result).toBe('Success');

    // Verify transaction was sent for execution
    expect(connection.sendTransaction).toHaveBeenCalled();
  });

  it('should handle failure during realm creation due to insufficient funds', async () => {
    // Simulate low balance
    connection.getBalance.mockResolvedValueOnce(1000); // Less than required for fee

    // Attempt to create a realm
    await expect(
      governanceService.createRealm({
        connection: connection,
        authority: realmAuthorityKeypair.publicKey,
        name: 'OntoraAIRealm',
        programId: governanceProgramId,
        payer: userKeypair
      })
    ).rejects.toThrow('Insufficient funds');

    // Verify no transaction was attempted
    expect(connection.sendTransaction).not.toHaveBeenCalled();
  });

  it('should handle failure during proposal creation due to invalid realm', async () => {
    // Simulate failure due to invalid realm
    governanceService.createProposal.mockRejectedValueOnce(new Error('Invalid realm ID'));

    // Attempt to create a proposal
    await expect(
      governanceService.createProposal({
        connection: connection,
        realmId: 'invalidRealm',
        title: 'Test Proposal',
        description: 'A test proposal for Ontora AI governance',
        proposer: userKeypair.publicKey,
        programId: governanceProgramId,
        payer: userKeypair
      })
    ).rejects.toThrow('Invalid realm ID');

    // Verify no transaction was attempted
    expect(connection.sendTransaction).not.toHaveBeenCalled();
  });

  it('should handle failure during voting due to unauthorized voter', async () => {
    // Simulate failure due to unauthorized voter
    governanceService.vote.mockRejectedValueOnce(new Error('Unauthorized voter'));

    // Attempt to vote on a proposal
    await expect(
      governanceService.vote({
        connection: connection,
        proposalId: 'prop456',
        voter: userKeypair.publicKey,
        choice: 'Yes',
        weight: 100,
        programId: governanceProgramId,
        payer: userKeypair
      })
    ).rejects.toThrow('Unauthorized voter');

    // Verify no transaction was attempted
    expect(connection.sendTransaction).not.toHaveBeenCalled();
  });

  it('should handle failure during proposal execution due to insufficient votes', async () => {
    // Simulate failure due to insufficient votes
    governanceService.executeProposal.mockRejectedValueOnce(new Error('Insufficient votes to execute'));

    // Attempt to execute a proposal
    await expect(
      governanceService.executeProposal({
        connection: connection,
        proposalId: 'prop456',
        authority: realmAuthorityKeypair.publicKey,
        programId: governanceProgramId,
        payer: userKeypair
      })
    ).rejects.toThrow('Insufficient votes to execute');

    // Verify no transaction was attempted
    expect(connection.sendTransaction).not.toHaveBeenCalled();
  });

  it('should handle multiple votes on a single proposal', async () => {
    // Simulate multiple votes from different users
    governanceService.vote
      .mockResolvedValueOnce({
        voteId: 'vote789',
        proposalId: 'prop456',
        voter: 'user123',
        choice: 'Yes',
        weight: 100
      })
      .mockResolvedValueOnce({
        voteId: 'vote790',
        proposalId: 'prop456',
        voter: 'user124',
        choice: 'No',
        weight: 50
      });

    // First vote
    const voteData1 = await governanceService.vote({
      connection: connection,
      proposalId: 'prop456',
      voter: userKeypair.publicKey,
      choice: 'Yes',
      weight: 100,
      programId: governanceProgramId,
      payer: userKeypair
    });

    // Second vote
    const voteData2 = await governanceService.vote({
      connection: connection,
      proposalId: 'prop456',
      voter: userKeypair.publicKey,
      choice: 'No',
      weight: 50,
      programId: governanceProgramId,
      payer: userKeypair
    });

    // Verify both votes were recorded
    expect(voteData1.voteId).toBe('vote789');
    expect(voteData1.choice).toBe('Yes');
    expect(voteData2.voteId).toBe('vote790');
    expect(voteData2.choice).toBe('No');

    // Verify transactions were sent for both votes
    expect(connection.sendTransaction).toHaveBeenCalledTimes(2);
  });

  it('should handle full governance flow from realm creation to proposal execution', async () => {
    // Step 1: Create realm
    const realmData = await governanceService.createRealm({
      connection: connection,
      authority: realmAuthorityKeypair.publicKey,
      name: 'OntoraAIRealm',
      programId: governanceProgramId,
      payer: userKeypair
    });
    expect(realmData.realmId).toBe('realm123');

    // Step 2: Create proposal
    const proposalData = await governanceService.createProposal({
      connection: connection,
      realmId: 'realm123',
      title: 'Test Proposal',
      description: 'A test proposal for Ontora AI governance',
      proposer: userKeypair.publicKey,
      programId: governanceProgramId,
      payer: userKeypair
    });
    expect(proposalData.proposalId).toBe('prop456');

    // Step 3: Vote on proposal
    const voteData = await governanceService.vote({
      connection: connection,
      proposalId: 'prop456',
      voter: userKeypair.publicKey,
      choice: 'Yes',
      weight: 100,
      programId: governanceProgramId,
      payer: userKeypair
    });
    expect(voteData.choice).toBe('Yes');

    // Step 4: Execute proposal
    const executionData = await governanceService.executeProposal({
      connection: connection,
      proposalId: 'prop456',
      authority: realmAuthorityKeypair.publicKey,
      programId: governanceProgramId,
      payer: userKeypair
    });
    expect(executionData.status).toBe('Executed');

    // Verify transactions were sent for each step
    expect(connection.sendTransaction).toHaveBeenCalledTimes(4);
  });
});
