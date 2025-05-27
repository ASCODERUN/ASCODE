const { Connection, clusterApiUrl, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { AnchorProvider, Program, setProvider } = require('@project-serum/anchor');
const { readFileSync } = require('fs');
const { join } = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file if available
dotenv.config();

// Configuration
const CLUSTER = process.env.CLUSTER || 'devnet'; // Options: 'mainnet-beta', 'testnet', 'devnet'
const WALLET_PATH = process.env.WALLET_PATH || join(process.env.HOME, '.config', 'solana', 'id.json');
const PROGRAM_SO_PATH = process.env.PROGRAM_SO_PATH || join(__dirname, 'target', 'deploy', 'Nivaro_ai.so');
const PROGRAM_IDL_PATH = process.env.PROGRAM_IDL_PATH || join(__dirname, 'target', 'idl', 'Nivaro_ai.json');
const PROGRAM_ID = process.env.PROGRAM_ID || ''; // Program ID of the existing deployed program to upgrade
const BUFFER_ACCOUNT = process.env.BUFFER_ACCOUNT || ''; // Optional: Buffer account for upgrade if required

// Utility to load wallet keypair from file
function loadWalletKeypair(walletPath) {
  try {
    const walletData = JSON.parse(readFileSync(walletPath, 'utf-8'));
    return Keypair.fromSecretKey(Buffer.from(walletData));
  } catch (error) {
    console.error('Failed to load wallet keypair:', error.message);
    process.exit(1);
  }
}

// Utility to get cluster URL
function getClusterUrl(cluster) {
  switch (cluster) {
    case 'mainnet-beta':
      return clusterApiUrl('mainnet-beta');
    case 'testnet':
      return clusterApiUrl('testnet');
    case 'devnet':
    default:
      return clusterApiUrl('devnet');
  }
}

// Utility to check if program ID is provided
function validateProgramId(programId) {
  if (!programId) {
    console.error('Program ID not provided. Set PROGRAM_ID in environment variables or .env file.');
    process.exit(1);
  }
  return programId;
}

// Main upgrade function
async function upgradeProgram() {
  console.log(`Upgrading program on ${CLUSTER} cluster...`);

  // Load wallet keypair
  const walletKeypair = loadWalletKeypair(WALLET_PATH);
  console.log('Wallet loaded:', walletKeypair.publicKey.toString());

  // Set up connection and provider
  const connection = new Connection(getClusterUrl(CLUSTER), 'confirmed');
  const provider = new AnchorProvider(connection, walletKeypair, { commitment: 'confirmed' });
  setProvider(provider);

  // Validate program ID
  const programId = validateProgramId(PROGRAM_ID);
  console.log('Target Program ID for upgrade:', programId);

  // Load program IDL
  let idl;
  try {
    idl = JSON.parse(readFileSync(PROGRAM_IDL_PATH, 'utf-8'));
  } catch (error) {
    console.error('Failed to load program IDL:', error.message);
    process.exit(1);
  }

  // Create program instance (for reference, not directly used in upgrade)
  const program = new Program(idl, programId, provider);

  // Check if program binary exists
  try {
    readFileSync(PROGRAM_SO_PATH);
  } catch (error) {
    console.error('Program binary not found at:', PROGRAM_SO_PATH);
    console.error('Ensure the program is built using "anchor build" before upgrade.');
    process.exit(1);
  }

  // Check wallet balance before upgrade (upgrades require SOL for transaction fees)
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log('Wallet balance:', balance / LAMPORTS_PER_SOL, 'SOL');
  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.warn('Wallet balance is low. Ensure sufficient SOL for transaction fees.');
  }

  // Perform the upgrade
  try {
    console.log('Initiating program upgrade...');
    // Note: Direct program upgrades via JS are not fully supported in Anchor without CLI.
    // This script assumes the use of `anchor upgrade` command or manual buffer account handling.
    // For simplicity, it logs the intended process and recommends using Anchor CLI.
    console.log('Upgrade simulation: Using existing program ID and new binary.');
    console.log('For actual upgrade, use "anchor upgrade" with the following parameters:');
    console.log(`anchor upgrade ${PROGRAM_SO_PATH} --program-id ${programId} --provider.cluster ${CLUSTER}`);

    // Optionally, if a buffer account is used, log it (advanced users can extend this for direct upgrade)
    if (BUFFER_ACCOUNT) {
      console.log('Buffer account for upgrade (if applicable):', BUFFER_ACCOUNT);
      console.log('Advanced: Extend script to handle buffer account upgrade if needed.');
    }

    // Verify program info post-upgrade simulation
    const programInfo = await connection.getAccountInfo(program.programId);
    if (programInfo) {
      console.log('Program exists on chain. Upgrade simulation successful.');
      console.log('Program ID:', program.programId.toString());
      console.log('Note: Actual upgrade requires running the Anchor CLI command or extending this script.');
    } else {
      console.warn('Program ID not found on chain. Deployment or upgrade may not have been executed.');
    }

    // Version control logging (placeholder for actual version tracking)
    const version = idl.metadata?.version || 'unknown';
    console.log('Program version (from IDL metadata):', version);
    console.log('Recommendation: Implement version tracking in a governance account or off-chain database.');
  } catch (error) {
    console.error('Upgrade process failed:', error.message);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
    process.exit(1);
  }

  // Post-upgrade instructions
  console.log('Upgrade simulation complete. Next steps:');
  console.log('- Run the actual upgrade using "anchor upgrade" command as shown above.');
  console.log('- Update client code if the IDL or program interface has changed.');
  console.log('- Test interactions with the upgraded program using test scripts.');
}

// Error handling wrapper for async execution
async function main() {
  try {
    await upgradeProgram();
  } catch (error) {
    console.error('Unexpected error during upgrade:', error.message);
    process.exit(1);
  }
}

// Execute upgrade
main().then(() => {
  console.log('Upgrade script execution completed.');
  process.exit(0);
}).catch((error) => {
  console.error('Upgrade script failed:', error.message);
  process.exit(1);
});
