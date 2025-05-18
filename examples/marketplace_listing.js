// marketplace_listing.js
// Example of listing an AI agent or service on a Solana-based marketplace (JavaScript)

const {
    Connection,
    clusterApiUrl,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    Transaction,
    TransactionInstruction,
    sendAndConfirmTransaction,
    SystemProgram,
} = require('@solana/web3.js');
const bs58 = require('bs58');
const fs = require('fs').promises;
const path = require('path');
const BufferLayout = require('buffer-layout');

// Utility to log messages to console and optionally to a file
async function logMessage(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
    try {
        await fs.appendFile(
            path.join(__dirname, 'marketplace_listing.log'),
            `[${new Date().toISOString()}] ${message}\n`
        );
    } catch (error) {
        console.error('Error writing to log file:', error.message);
    }
}

// Define a placeholder marketplace program ID (replace with actual program ID in production)
const MARKETPLACE_PROGRAM_ID = new PublicKey('11111111111111111111111111111111'); // Placeholder, update with real program ID

// Define data structure for a marketplace listing (simplified for demo)
const ListingLayout = BufferLayout.struct([
    BufferLayout.u8('isInitialized'), // Flag to check if listing is active (1 = active, 0 = inactive)
    BufferLayout.blob(32, 'owner'), // Owner's public key (32 bytes)
    BufferLayout.blob(100, 'agentName'), // Name of the AI agent or service (fixed 100 bytes for simplicity)
    BufferLayout.blob(200, 'description'), // Description of the listing (fixed 200 bytes)
    BufferLayout.nu64('price'), // Price in lamports (u64)
    BufferLayout.blob(32, 'agentId'), // Unique ID or reference for the AI agent (32 bytes, e.g., a hash or key)
]);

// Class to manage marketplace listings on Solana
class MarketplaceManager {
    constructor(cluster = 'devnet') {
        // Initialize connection to Solana cluster (default to devnet for testing)
        this.connection = new Connection(clusterApiUrl(cluster), 'confirmed');
        // Payer wallet (null by default for safety; set via environment or file in production)
        this.payer = null;
        // Marketplace listing account (to store listing data)
        this.listingAccount = null;
        logMessage('MarketplaceManager initialized with connection to ' + cluster);
    }

    // Load payer wallet from environment variable or file (safely for demo)
    async loadPayerWallet() {
        try {
            const privateKeyBase58 = process.env.SOLANA_PRIVATE_KEY;
            if (!privateKeyBase58) {
                logMessage('No private key provided in environment. Running in demo mode (no real transactions).');
                return false;
            }
            const privateKeyUint8Array = bs58.decode(privateKeyBase58);
            this.payer = Keypair.fromSecretKey(privateKeyUint8Array);
            logMessage('Payer wallet loaded successfully.');
            // Verify balance for transaction fees
            const balance = await this.connection.getBalance(this.payer.publicKey);
            logMessage(`Payer balance: ${balance / LAMPORTS_PER_SOL} SOL`);
            if (balance < 0.01 * LAMPORTS_PER_SOL) {
                throw new Error('Insufficient balance for transactions.');
            }
            return true;
        } catch (error) {
            logMessage('Error loading payer wallet: ' + error.message);
            this.payer = null;
            return false;
        }
    }

    // Create a new account for storing listing data (PDA or standalone account)
    async createListingAccount() {
        if (!this.payer) {
            logMessage('No payer wallet set. Skipping listing account creation (demo mode).');
            return null;
        }
        try {
            logMessage('1('Creating listing account...');
            this.listingAccount = Keypair.generate();
            const space = ListingLayout.span; // Size of the listing data structure
            const lamports = await this.connection.getMinimumBalanceForRentExemption(space);

            const tx = new Transaction().add(
                SystemProgram.createAccount({
                    fromPubkey: this.payer.publicKey,
                    newAccountPubkey: this.listingAccount.publicKey,
                    lamports,
                    space,
                    programId: MARKETPLACE_PROGRAM_ID,
                })
            );

            const txSignature = await sendAndConfirmTransaction(
                this.connection,
                tx,
                [this.payer, this.listingAccount]
            );
            logMessage(`Listing account created successfully. Tx: ${txSignature}`);
            return this.listingAccount.publicKey;
        } catch (error) {
            logMessage('Error creating listing account: ' + error.message);
            return null;
        }
    }

    // List an AI agent or service on the marketplace
    async createListing(agentName, description, priceInSol, agentId) {
        if (!this.payer || !this.listingAccount) {
            logMessage('No payer wallet or listing account set. Skipping listing creation (demo mode).');
            return null;
        }
        try {
            logMessage(`Creating marketplace listing for ${agentName}...`);
            // Prepare listing data
            const listingData = Buffer.alloc(ListingLayout.span);
            ListingLayout.encode(
                {
                    isInitialized: 1, // Mark as active
                    owner: this.payer.publicKey.toBuffer(),
                    agentName: Buffer.from(agentName.padEnd(100, '\0')), // Pad to fixed length
                    description: Buffer.from(description.padEnd(200, '\0')), // Pad to fixed length
                    price: BigInt(Math.floor(priceInSol * LAMPORTS_PER_SOL)), // Convert SOL to lamports
                    agentId: Buffer.from(agentId.padEnd(32, '\0')), // Pad to fixed length (e.g., a hash or ID)
                },
                listingData
            );

            // Create instruction to store listing data (custom marketplace program call)
            const instruction = new TransactionInstruction({
                keys: [
                    {
                        pubkey: this.listingAccount.publicKey,
                        isSigner: false,
                        isWritable: true,
                    },
                    {
                        pubkey: this.payer.publicKey,
                        isSigner: true,
                        isWritable: false,
                    },
                ],
                programId: MARKETPLACE_PROGRAM_ID,
                data: Buffer.concat([
                    Buffer.from([1]), // Instruction type (1 = CreateListing, placeholder)
                    listingData,
                ]),
            });

            const tx = new Transaction().add(instruction);
            const txSignature = await sendAndConfirmTransaction(this.connection, tx, [this.payer]);
            logMessage(`Listing created successfully for ${agentName}. Tx: ${txSignature}`);
            return txSignature;
        } catch (error) {
            logMessage('Error creating listing: ' + error.message);
            return null;
        }
    }

    // Fetch and display listing details (for verification)
    async getListingDetails() {
        if (!this.listingAccount) {
            logMessage('No listing account set. Skipping details fetch (demo mode).');
            return null;
        }
        try {
            const accountInfo = await this.connection.getAccountInfo(this.listingAccount.publicKey);
            if (!accountInfo) {
                logMessage('Listing account not found on blockchain.');
                return null;
            }

            const data = accountInfo.data;
            const listing = ListingLayout.decode(data);
            if (listing.isInitialized !== 1) {
                logMessage('Listing account is not initialized.');
                return null;
            }

            logMessage('Listing Details:');
            logMessage(`  Owner: ${new PublicKey(listing.owner).toBase58()}`);
            logMessage(`  Agent Name: ${listing.agentName.toString('utf8').replace(/\0/g, '').trim()}`);
            logMessage(`  Description: ${listing.description.toString('utf8').replace(/\0/g, '').trim()}`);
            logMessage(`  Price: ${Number(listing.price) / LAMPORTS_PER_SOL} SOL`);
            logMessage(`  Agent ID: ${listing.agentId.toString('hex')}`);
            return listing;
        } catch (error) {
            logMessage('Error fetching listing details: ' + error.message);
            return null;
        }
    }

    // Delist an AI agent or service from the marketplace (mark as inactive)
    async delist() {
        if (!this.payer || !this.listingAccount) {
            logMessage('No payer wallet or listing account set. Skipping delisting (demo mode).');
            return null;
        }
        try {
            logMessage('Delisting AI agent or service...');
            const instruction = new TransactionInstruction({
                keys: [
                    {
                        pubkey: this.listingAccount.publicKey,
                        isSigner: false,
                        isWritable: true,
                    },
                    {
                        pubkey: this.payer.publicKey,
                        isSigner: true,
                        isWritable: false,
                    },
                ],
                programId: MARKETPLACE_PROGRAM_ID,
                data: Buffer.from([2]), // Instruction type (2 = Delist, placeholder)
            });

            const tx = new Transaction().add(instruction);
            const txSignature = await sendAndConfirmTransaction(this.connection, tx, [this.payer]);
            logMessage(`Listing delisted successfully. Tx: ${txSignature}`);
            return txSignature;
        } catch (error) {
            logMessage('Error delisting: ' + error.message);
            return null;
        }
    }
}

// Main function to demonstrate marketplace listing creation and management
async function main() {
    logMessage('Starting Solana Marketplace Listing Demo...');
    const manager = new MarketplaceManager('devnet'); // Use devnet for testing

    // Load payer wallet (safely skips if not set)
    const hasPayer = await manager.loadPayerWallet();
    if (!hasPayer) {
        logMessage('Demo mode: No real transactions will be sent. Set SOLANA_PRIVATE_KEY in environment for real operations.');
    }

    // Step 1: Create a listing account
    await manager.createListingAccount();

    // Step 2: Create a listing for an AI agent or service
    await manager.createListing(
        'Ontora AI Agent v1.0', // Name of the AI agent
        'An autonomous AI agent for Web3 automation and decision-making on Solana.', // Description
        0.5, // Price in SOL
        'ontora-ai-agent-001-hash-id-1234567890' // Unique agent ID (e.g., a hash or reference)
    );

    // Step 3: Fetch and display listing details
    await manager.getListingDetails();

    // Step 4: Optionally delist the agent (commented out for demo)
    // await manager.delist();

    logMessage('Marketplace Listing Demo completed.');
}

// Execute main function with error handling
if (require.main === module) {
    main().catch((error) => {
        logMessage('Fatal error in main execution: ' + error.message);
        process.exit(1);
    });
}

// Export for use in other modules
module.exports = { MarketplaceManager };
