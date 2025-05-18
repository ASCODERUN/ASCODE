const { Connection, clusterApiUrl, Keypair } = require('@solana/web3.js');
const { AnchorProvider, Program, setProvider, getProvider } = require('@project-serum/anchor');
const { readFileSync } = require('fs');
const { join } = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file if available
dotenv.config();

// Configuration
const CLUSTER = process.env.CLUSTER || 'devnet'; // Options: 'mainnet-beta', 'testnet', 'devnet'
const WALLET_PATH = process.env.WALLET_PATH || join(process.env.HOME, '.config', 'solana', 'id.json');
const PROGRAM_SO_PATH = process.env.PROGRAM_SO_PATH || join(__dirname, 'target', 'deploy', 'ontora_ai.so');
const PROGRAM_IDL_PATH = process.env.PROGRAM_IDL_PATH || join(__dirname, 'target', 'idl', 'ontora_ai.json');

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

// Main deployment function
async function deployProgram() {
  console.log(`Deploying to ${CLUSTER} cluster...`);

  // Load wallet keypair
  const walletKeypair = loadWalletKeypair(WALLET_PATH);
  console.log('Wallet loaded:', walletKeypair.publicKey.toString());

  // Set up connection and provider
  const connection = new Connection(getClusterUrl(CLUSTER), 'confirmed');
  const provider = new AnchorProvider(connection, walletKeypair, { commitment: 'confirmed' });
  setProvider(provider);

  // Load program IDL
  let idl;
  try {
    idl = JSON.parse(readFileSync(PROGRAM_IDL_PATH, 'utf-8'));
  } catch (error) {
    console.error('Failed to load program IDL:', error.message);
    process.exit(1);
  }

  // Create program instance
  const programId = idl.metadata.address;
  const program = new Program(idl, programId, provider);
  console.log('Program ID:', programId);

  // Check if program binary exists
  try {
    readFileSync(PROGRAM_SO_PATH);
  } catch (error) {
    console.error('Program binary not found at:', PROGRAM_SO_PATH);
    console.error('Ensure the program is built using "anchor build" before deployment.');
    process.exit(1);
  }

  // Deploy the program (Anchor handles deployment under the hood with provider)
  try {
    console.log('Initiating deployment...');
    // Note: Anchor CLI is typically used for deployment, but this script assumes
    // the program binary and IDL are already built and available.
    // If direct deployment via JS is needed, additional logic or a call to `anchor deploy` via exec can be added.
    console.log('Deployment simulation: Using existing program ID from IDL.');
    console.log('For actual deployment, use "anchor deploy" or integrate with Anchor CLI.');

    // Optionally, verify deployment by fetching program info
    const programInfo = await connection.getAccountInfo(program.programId);
    if (programInfo) {
      console.log('Program deployed and verified on chain.');
      console.log('Program ID:', program.programId.toString());
    } else {
      console.warn('Program ID not found on chain. Deployment may have failed or not been executed.');
    }
  } catch (error) {
    console.error('Deployment failed:', error.message);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
    process.exit(1);
  }

  // Post-deployment instructions
  console.log('Deployment complete. Next steps:');
  console.log('- Update your client code with the deployed program ID if necessary.');
  console.log('- Test interactions with the deployed program using test scripts.');
}

// Error handling wrapper for async execution
async function main() {
  try {
    await deployProgram();
  } catch (error) {
    console.error('Unexpected error during deployment:', error.message);
    process.exit(1);
  }
}

// Execute deployment
main().then(() => {
  console.log('Deployment script execution completed.');
  process.exit(0);
}).catch((error) => {
  console.error('Deployment script failed:', error.message);
  process.exit(1);
});
