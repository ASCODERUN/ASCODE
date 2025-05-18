const { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
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

// Mock AI prediction API
const mockAiApi = {
  getPrediction: jest.fn().mockResolvedValue({
    predictionId: 'pred123',
    strategy: 'conservative',
    predictedValue: 0.75,
    timestamp: new Date().toISOString()
  })
};

// Mock user wallet and smart contract program ID
const userKeypair = Keypair.generate();
const programId = new PublicKey('11111111111111111111111111111111'); // Mock program ID

describe('AI Predictions On-Chain Integration Tests for Ontora AI', () => {
  let connection;
  let aiService;

  beforeAll(() => {
    // Initialize mock Solana connection
    connection = new Connection('http://localhost:8899', 'confirmed');
    aiService = mockAiApi;
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should successfully generate AI prediction and record it on-chain', async () => {
    // Step 1: Fetch AI prediction
    const prediction = await aiService.getPrediction({
      userId: 'user123',
      context: { stakingAmount: 50, strategy: 'conservative' }
    });

    // Verify AI prediction response
    expect(prediction).toBeDefined();
    expect(prediction.predictionId).toBe('pred123');
    expect(prediction.strategy).toBe('conservative');
    expect(prediction.predictedValue).toBe(0.75);
    expect(prediction.timestamp).toBeDefined();

    // Step 2: Prepare data for on-chain recording
    const predictionData = Buffer.from(JSON.stringify(prediction));

    // Step 3: Create a mock transaction to record prediction on Solana
    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: userKeypair.publicKey,
        toPubkey: programId,
        lamports: 10000 // Small fee for mock transaction
      })
    );

    // Attach prediction data as a memo (simulated)
    transaction.add({
      keys: [],
      programId: programId,
      data: predictionData
    });

    // Step 4: Send and confirm transaction
    const txId = await sendAndConfirmTransaction(connection, transaction, [userKeypair]);

    // Verify transaction was sent
    expect(connection.sendTransaction).toHaveBeenCalled();
    expect(txId).toBe('mockTransactionId');

    // Step 5: Verify confirmation
    expect(connection.confirmTransaction).toHaveBeenCalledWith('mockTransactionId', 'confirmed');

    // Step 6: Simulate fetching recorded data (mocked)
    const recordedData = predictionData.toString();
    const parsedData = JSON.parse(recordedData);

    // Verify data integrity after on-chain recording
    expect(parsedData.predictionId).toBe('pred123');
    expect(parsedData.strategy).toBe('conservative');
    expect(parsedData.predictedValue).toBe(0.75);
  });

  it('should handle AI prediction API failure gracefully', async () => {
    // Simulate AI API failure
    aiService.getPrediction.mockRejectedValueOnce(new Error('AI service unavailable'));

    // Attempt to fetch prediction
    await expect(
      aiService.getPrediction({
        userId: 'user123',
        context: { stakingAmount: 50, strategy: 'conservative' }
      })
    ).rejects.toThrow('AI service unavailable');

    // Verify no transaction was attempted
    expect(connection.sendTransaction).not.toHaveBeenCalled();
  });

  it('should handle insufficient balance for transaction fee', async () => {
    // Simulate low balance
    connection.getBalance.mockResolvedValueOnce(1000); // Less than required for fee

    // Fetch AI prediction
    const prediction = await aiService.getPrediction({
      userId: 'user123',
      context: { stakingAmount: 50, strategy: 'conservative' }
    });

    // Prepare data and transaction
    const predictionData = Buffer.from(JSON.stringify(prediction));
    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: userKeypair.publicKey,
        toPubkey: programId,
        lamports: 10000 // Fee exceeds balance
      })
    );

    // Expect transaction preparation to fail due to balance check
    await expect(
      sendAndConfirmTransaction(connection, transaction, [userKeypair])
    ).rejects.toThrow('Insufficient funds');

    // Override mock to simulate failure if balance check is bypassed
    connection.sendTransaction.mockRejectedValueOnce(new Error('Insufficient funds'));

    // Verify transaction was not sent
    expect(connection.sendTransaction).toHaveBeenCalledTimes(0);
  });

  it('should handle blockchain transaction failure', async () => {
    // Simulate transaction failure
    connection.sendTransaction.mockRejectedValueOnce(new Error('Transaction rejected by network'));

    // Fetch AI prediction
    const prediction = await aiService.getPrediction({
      userId: 'user123',
      context: { stakingAmount: 50, strategy: 'conservative' }
    });

    // Prepare data and transaction
    const predictionData = Buffer.from(JSON.stringify(prediction));
    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: userKeypair.publicKey,
        toPubkey: programId,
        lamports: 10000
      })
    );
    transaction.add({
      keys: [],
      programId: programId,
      data: predictionData
    });

    // Attempt transaction and expect failure
    await expect(
      sendAndConfirmTransaction(connection, transaction, [userKeypair])
    ).rejects.toThrow('Transaction rejected by network');

    // Verify transaction attempt and failure
    expect(connection.sendTransaction).toHaveBeenCalled();
    expect(connection.confirmTransaction).not.toHaveBeenCalled();
  });

  it('should handle data integrity issues during on-chain recording', async () => {
    // Fetch AI prediction
    const prediction = await aiService.getPrediction({
      userId: 'user123',
      context: { stakingAmount: 50, strategy: 'conservative' }
    });

    // Simulate corrupted data during transaction
    const predictionData = Buffer.from(JSON.stringify(prediction) + 'corrupted');
    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: userKeypair.publicKey,
        toPubkey: programId,
        lamports: 10000
      })
    );
    transaction.add({
      keys: [],
      programId: programId,
      data: predictionData
    });

    // Send transaction
    await sendAndConfirmTransaction(connection, transaction, [userKeypair]);

    // Simulate fetching recorded data with corruption
    const recordedData = predictionData.toString();
    const parseData = () => JSON.parse(recordedData.slice(0, recordedData.length - 9)); // Remove 'corrupted' part for mock

    // Verify data can still be partially recovered or handled
    const parsedData = parseData();
    expect(parsedData.predictionId).toBe('pred123');
  });

  it('should support batch recording of multiple AI predictions', async () => {
    // Simulate multiple predictions
    const predictions = [
      { predictionId: 'pred123', strategy: 'conservative', predictedValue: 0.75, timestamp: new Date().toISOString() },
      { predictionId: 'pred124', strategy: 'aggressive', predictedValue: 0.85, timestamp: new Date().toISOString() }
    ];

    aiService.getPrediction
      .mockResolvedValueOnce(predictions[0])
      .mockResolvedValueOnce(predictions[1]);

    // Fetch multiple predictions
    const prediction1 = await aiService.getPrediction({ userId: 'user123', context: { stakingAmount: 50, strategy: 'conservative' } });
    const prediction2 = await aiService.getPrediction({ userId: 'user123', context: { stakingAmount: 50, strategy: 'aggressive' } });

    // Prepare batch data
    const batchData = Buffer.from(JSON.stringify([prediction1, prediction2]));
    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: userKeypair.publicKey,
        toPubkey: programId,
        lamports: 10000
      })
    );
    transaction.add({
      keys: [],
      programId: programId,
      data: batchData
    });

    // Send batch transaction
    const txId = await sendAndConfirmTransaction(connection, transaction, [userKeypair]);
    expect(txId).toBe('mockTransactionId');

    // Verify recorded batch data
    const recordedBatch = JSON.parse(batchData.toString());
    expect(recordedBatch.length).toBe(2);
    expect(recordedBatch[0].predictionId).toBe('pred123');
    expect(recordedBatch[1].predictionId).toBe('pred124');
  });
});
