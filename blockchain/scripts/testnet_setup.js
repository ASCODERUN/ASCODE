const { Connection, clusterApiUrl, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { writeFileSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file if available
dotenv.config();

// Configuration
const CLUSTER = process.env.CLUSTER || 'devnet'; // Options: 'testnet', 'devnet'
const AIRDROP_AMOUNT = process.env.AIRDROP_AMOUNT || (2 * LAMPORTS_PER_SOL); // Default: 2 SOL in lamports
const OUTPUT_DIR = process.env.OUTPUT_DIR || join(__dirname, 'test-accounts');
const NUM_ACCOUNTS = process.env.NUM_ACCOUNTS || 3; // Default number of test accounts to create

// Utility to get cluster URL
function getClusterUrl(cluster) {
  switch (cluster) {
    case 'testnet':
      return clusterApiUrl('testnet');
    case 'devnet':
    default:
      return clusterApiUrl('devnet');
  }
}

// Utility to ensure output directory exists
function ensureOutputDir(dirPath) {
  try {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
      console.log('Created output directory for test accounts:', dirPath);
    } else {
      console.log('Output directory already exists:', dirPath);
    }
  } catch (error) {
    console.error('Failed to create output directory:', dirPath);
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Utility to generate a new keypair and save it
function generateAndSaveKeypair(index, dirPath) {
  try {
    const keypair = Keypair.generate();
    const filePath = join(dirPath, `test-account-${index}.json`);
    const keypairData = {
      publicKey: keypair.publicKey.toString(),
      secretKey: Buffer.from(keypair.secretKey).toString('base64'),
    };
    writeFileSync(filePath, JSON.stringify(keypairData, null, 2));
    console.log(`Generated and saved test account ${index} to:`, filePath);
    console.log(`Public Key:`, keypair.publicKey.toString());
    return keypair;
  } catch (error) {
    console.error(`Failed to generate or save test account ${index}:`);
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Utility to request airdrop for a given public key
async function requestAirdrop(connection, publicKey, amount) {
  try {
    console.log(`Requesting airdrop of ${amount / LAMPORTS_PER_SOL} SOL for:`, publicKey.toString());
    const signature = await connection.requestAirdrop(publicKey, amount);
    const latestBlockHash = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction({
      signature,
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    }, 'confirmed');
    console.log(`Airdrop successful for:`, publicKey.toString());
    console.log(`Transaction signature:`, signature);
    const balance = await connection.getBalance(publicKey, 'confirmed');
    console.log(`Current balance:`, balance / LAMPORTS_PER_SOL, 'SOL');
    return signature;
  } catch (error) {
    console.error(`Airdrop failed for:`, publicKey.toString());
    console.error('Error:', error.message);
    console.error('Note: Airdrop limits may apply on testnet/devnet (rate limits or max balance).');
    console.error('Skipping this account and continuing with setup.');
    return null;
  }
}

// Main setup function
async function setupTestnetAccounts() {
  console.log(`Setting up test accounts on ${CLUSTER} cluster...`);

  // Set up connection
  const connection = new Connection(getClusterUrl(CLUSTER), 'confirmed');
  console.log('Connected to cluster:', CLUSTER);

  // Ensure output directory exists
  ensureOutputDir(OUTPUT_DIR);

  // Parse number of accounts to create
  const numAccounts = parseInt(NUM_ACCOUNTS, 10);
  if (isNaN(numAccounts) || numAccounts <= 0) {
    console.error('Invalid number of accounts specified:', NUM_ACCOUNTS);
    console.error('Must be a positive integer. Defaulting to 3 accounts.');
    numAccounts = 3;
  }
  console.log('Number of test accounts to create:', numAccounts);

  // Parse airdrop amount
  const airdropAmount = parseInt(AIRDROP_AMOUNT, 10);
  if (isNaN(airdropAmount) || airdropAmount <= 0) {
    console.error('Invalid airdrop amount specified:', AIRDROP_AMOUNT);
    console.error('Must be a positive number of lamports. Defaulting to 2 SOL.');
    airdropAmount = 2 * LAMPORTS_PER_SOL;
  }
  console.log('Airdrop amount per account:', airdropAmount / LAMPORTS_PER_SOL, 'SOL');

  // Generate test accounts and request airdrops
  const keypairs = [];
  for (let i = 0; i < numAccounts; i++) {
    console.log(`\nProcessing test account ${i + 1} of ${numAccounts}...`);
    const keypair = generateAndSaveKeypair(i + 1, OUTPUT_DIR);
    keypairs.push(keypair);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay to avoid rate limiting
    await requestAirdrop(connection, keypair.publicKey, airdropAmount);
  }

  // Summary of created accounts
  console.log('\nTest account setup complete. Summary:');
  keypairs.forEach((keypair, index) => {
    console.log(`Account ${index + 1}:`, keypair.publicKey.toString());
  });
  console.log('Account details saved to:', OUTPUT_DIR);
  console.log('\nNext steps:');
  console.log('- Use these accounts for testing smart contracts or client interactions.');
  console.log('- Import secret keys into wallets or testing scripts as needed.');
  console.log('- Note that airdrop SOL is for testing only and has no real value.');
  console.log('- If airdrop failed for any account, retry after a delay or check cluster status.');
}

// Error handling wrapper for async execution
async function main() {
  try {
    await setupTestnetAccounts();
  } catch (error) {
    console.error('Unexpected error during testnet setup:', error.message);
    process.exit(1);
  }
}

// Execute setup
main().then(() => {
  console.log('Testnet setup script execution completed.');
  process.exit(0);
}).catch((error) => {
  console.error('Testnet setup script failed:', error.message);
  process.exit(1);
});
