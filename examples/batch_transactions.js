// batch_transactions.js
// Example of batching Solana transactions for efficiency and cost savings using @solana/web3.js

const { Connection, clusterApiUrl, Keypair, LAMPORTS_PER_SOL, Transaction, TransactionInstruction, sendAndConfirmTransaction, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');
const fs = require('fs').promises;
const path = require('path');

// Configure logging for debugging and tracking
const log = (message, level = 'info') => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    // Optionally, append to a log file
    fs.appendFile(path.join(__dirname, 'batch_transactions.log'), `[${timestamp}] [${level.toUpperCase()}] ${message}\n`).catch(err => {
        console.error(`Failed to write to log file: ${err.message}`);
    });
};

class BatchTransactionManager {
    /**
     * A manager class to handle batching of Solana transactions for efficiency.
     * Supports batching multiple instructions into a single transaction or sending multiple transactions together.
     */
    constructor(network = 'devnet', privateKeyBase58 = null) {
        /**
         * Initialize the batch transaction manager with a Solana network connection.
         * @param {string} network - Solana network to connect to (e.g., 'devnet', 'testnet', 'mainnet-beta').
         * @param {string} privateKeyBase58 - Base58-encoded private key for the payer wallet (optional, can be loaded from file).
         */
        try {
            this.connection = new Connection(clusterApiUrl(network), 'confirmed');
            this.payer = privateKeyBase58 ? Keypair.fromSecretKey(bs58.decode(privateKeyBase58)) : null;
            this.transactionBatch = [];
            this.maxInstructionsPerTx = 10; // Limit instructions per transaction to avoid size limits
            log(`BatchTransactionManager initialized for ${network} network`);
            if (this.payer) {
                log(`Payer wallet initialized with public key: ${this.payer.publicKey.toString()}`);
            } else {
                log('No payer wallet provided. Must set payer before sending transactions.', 'warning');
            }
        } catch (error) {
            log(`Error initializing BatchTransactionManager: ${error.message}`, 'error');
            throw error;
        }
    }

    async loadPayerFromFile(filePath) {
        /**
         * Load payer wallet private key from a file (e.g., JSON or base58 string).
         * @param {string} filePath - Path to the file containing the private key.
         */
        try {
            const data = await fs.readFile(filePath, 'utf8');
            let privateKey;
            if (filePath.endsWith('.json')) {
                const keypairJson = JSON.parse(data);
                privateKey = Uint8Array.from(keypairJson);
            } else {
                privateKey = bs58.decode(data.trim());
            }
            this.payer = Keypair.fromSecretKey(privateKey);
            log(`Payer wallet loaded from ${filePath} with public key: ${this.payer.publicKey.toString()}`);
        } catch (error) {
            log(`Error loading payer wallet from file ${filePath}: ${error.message}`, 'error');
            throw error;
        }
    }

    async checkPayerBalance() {
        /**
         * Check the balance of the payer wallet to ensure it can cover transaction fees.
         * @returns {number} Balance in SOL.
         */
        try {
            if (!this.payer) {
                throw new Error('Payer wallet not set.');
            }
            const balance = await this.connection.getBalance(this.payer.publicKey);
            const balanceInSol = balance / LAMPORTS_PER_SOL;
            log(`Payer balance: ${balanceInSol} SOL`);
            return balanceInSol;
        } catch (error) {
            log(`Error checking payer balance: ${error.message}`, 'error');
            throw error;
        }
    }

    addInstructionToBatch(instruction, programId, description = 'Unnamed instruction') {
        /**
         * Add a single instruction to the batch for later processing.
         * @param {TransactionInstruction} instruction - The Solana instruction to add.
         * @param {PublicKey} programId - The program ID associated with the instruction.
         * @param {string} description - A description for logging purposes.
         */
        try {
            if (!(instruction instanceof TransactionInstruction)) {
                throw new Error('Invalid instruction provided. Must be a TransactionInstruction.');
            }
            this.transactionBatch.push({
                instruction,
                programId,
                description
            });
            log(`Added instruction to batch: ${description}`);
        } catch (error) {
            log(`Error adding instruction to batch: ${error.message}`, 'error');
            throw error;
        }
    }

    async buildBatchTransactions() {
        /**
         * Build transactions from the batch of instructions, splitting into multiple transactions if needed.
         * @returns {Transaction[]} Array of transactions ready to be signed and sent.
         */
        try {
            if (this.transactionBatch.length === 0) {
                throw new Error('No instructions in batch to build transactions.');
            }
            if (!this.payer) {
                throw new Error('Payer wallet not set. Cannot build transactions.');
            }

            const transactions = [];
            let currentTx = new Transaction().addFeePayer(this.payer.publicKey);
            let instructionCount = 0;

            for (const { instruction, description } of this.transactionBatch) {
                if (instructionCount >= this.maxInstructionsPerTx) {
                    transactions.push(currentTx);
                    log(`Created transaction with ${instructionCount} instructions`);
                    currentTx = new Transaction().addFeePayer(this.payer.publicKey);
                    instructionCount = 0;
                }
                currentTx.add(instruction);
                instructionCount++;
                log(`Added instruction ${description} to current transaction`);
            }

            if (instructionCount > 0) {
                transactions.push(currentTx);
                log(`Created final transaction with ${instructionCount} instructions`);
            }

            return transactions;
        } catch (error) {
            log(`Error building batch transactions: ${error.message}`, 'error');
            throw error;
        }
    }

    async sendBatchTransactions(transactions = null) {
        /**
         * Send the batch of transactions to the Solana network.
         * @param {Transaction[]} transactions - Optional array of transactions to send (if not provided, builds from batch).
         * @returns {string[]} Array of transaction signatures.
         */
        try {
            if (!this.payer) {
                throw new Error('Payer wallet not set. Cannot send transactions.');
            }
            const txsToSend = transactions || await this.buildBatchTransactions();
            if (txsToSend.length === 0) {
                throw new Error('No transactions to send.');
            }

            // Check balance before sending to avoid unnecessary failures
            const balance = await this.checkPayerBalance();
            if (balance < 0.001 * txsToSend.length) {
                throw new Error(`Insufficient balance for fees. Need at least ${0.001 * txsToSend.length} SOL, have ${balance} SOL.`);
            }

            const signatures = [];
            log(`Sending ${txsToSend.length} batched transactions...`);

            // Send transactions sequentially to avoid nonce issues (can be parallelized with care)
            for (let i = 0; i < txsToSend.length; i++) {
                const tx = txsToSend[i];
                try {
                    const signature = await sendAndConfirmTransaction(this.connection, tx, [this.payer]);
                    signatures.push(signature);
                    log(`Transaction ${i + 1}/${txsToSend.length} confirmed with signature: ${signature}`);
                } catch (txError) {
                    log(`Error sending transaction ${i + 1}: ${txError.message}`, 'error');
                    // Continue with remaining transactions even if one fails
                    signatures.push(`Failed: ${txError.message}`);
                }
            }

            // Clear the batch after sending
            this.transactionBatch = [];
            log(`Batch transactions sent successfully. Signatures: ${signatures.length} recorded.`);
            return signatures;
        } catch (error) {
            log(`Error sending batch transactions: ${error.message}`, 'error');
            throw error;
        }
    }

    async createSampleInstructions(recipientPubkeyStr, amountInLamports = LAMPORTS_PER_SOL / 100) {
        /**
         * Create sample transfer instructions for testing batching.
         * @param {string} recipientPubkeyStr - Recipient public key as a base58 string.
         * @param {number} amountInLamports - Amount to transfer in lamports.
         * @returns {TransactionInstruction[]} Array of sample instructions.
         */
        try {
            if (!this.payer) {
                throw new Error('Payer wallet not set. Cannot create instructions.');
            }
            const recipient = new PublicKey(recipientPubkeyStr);
            const instructions = [];

            // Create multiple small transfer instructions as a test
            for (let i = 0; i < 5; i++) {
                const instruction = TransactionInstruction.from({
                    keys: [
                        { pubkey: this.payer.publicKey, isSigner: true, isWritable: true },
                        { pubkey: recipient, isSigner: false, isWritable: true }
                    ],
                    programId: new PublicKey('11111111111111111111111111111111'), // System program ID
                    data: Buffer.from(Uint8Array.of(
                        2, // Transfer instruction
                        ...Buffer.alloc(8).writeBigUInt64LE(BigInt(amountInLamports)) // Amount in lamports
                    ))
                });
                instructions.push(instruction);
                log(`Created sample transfer instruction ${i + 1} for ${amountInLamports} lamports to ${recipientPubkeyStr}`);
            }
            return instructions;
        } catch (error) {
            log(`Error creating sample instructions: ${error.message}`, 'error');
            throw error;
        }
    }
}

async function main() {
    /**
     * Main function to demonstrate batching Solana transactions.
     */
    try {
        log('Starting batch transaction demo...');

        // Initialize manager for devnet (replace with 'mainnet-beta' for production)
        const batchManager = new BatchTransactionManager('devnet');

        // Load payer wallet from a file (uncomment and provide path to your keypair file)
        // await batchManager.loadPayerFromFile('/path/to/your/keypair.json');
        // For demo, manually set a private key (safely replace with your own or use file loading)
        // const privateKeyBase58 = 'YOUR_PRIVATE_KEY_BASE58_HERE';
        // batchManager = new BatchTransactionManager('devnet', privateKeyBase58);

        // For this demo, we'll skip real transactions if no payer is set
        if (!batchManager.payer) {
            log('Demo running without a payer wallet. Skipping real transactions.', 'warning');
            log('Please set a payer wallet to test real batch transactions.');
            return;
        }

        // Check payer balance
        await batchManager.checkPayerBalance();

        // Create sample instructions (replace recipient with a valid public key for testing)
        const recipientPubkeyStr = '8uvia8bNfEHFaxcEpg5uLJoTXJoZ9frsfgBU6JemUgNt'; // Replace with a valid address
        const sampleInstructions = await batchManager.createSampleInstructions(recipientPubkeyStr, LAMPORTS_PER_SOL / 100);

        // Add instructions to batch
        sampleInstructions.forEach((instr, index) => {
            batchManager.addInstructionToBatch(instr, new PublicKey('11111111111111111111111111111111'), `Transfer ${index + 1}`);
        });

        // Send the batched transactions
        const signatures = await batchManager.sendBatchTransactions();
        log(`Batch transaction demo completed. Transaction signatures: ${JSON.stringify(signatures, null, 2)}`);

    } catch (error) {
        log(`Error in main execution: ${error.message}`, 'error');
        console.error(error);
    }
}

// Run the demo if this file is executed directly
if (require.main === module) {
    main().catch(err => {
        log(`Fatal error in demo: ${err.message}`, 'error');
        process.exit(1);
    });
}

module.exports = { BatchTransactionManager };
