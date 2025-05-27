const { Connection, clusterApiUrl, PublicKey } = require('@solana/web3.js');
const { readFileSync } = require('fs');
const { join } = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file if available
dotenv.config();

// Configuration
const CLUSTER = process.env.CLUSTER || 'devnet'; // Options: 'mainnet-beta', 'testnet', 'devnet'
const PROGRAM_ID = process.env.PROGRAM_ID || ''; // Program ID of the deployed program to verify
const PROGRAM_SO_PATH = process.env.PROGRAM_SO_PATH || join(__dirname, 'target', 'deploy', 'Nivaro_ai.so');
const PROGRAM_IDL_PATH = process.env.PROGRAM_IDL_PATH || join(__dirname, 'target', 'idl', 'Nivaro_ai.json');

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

// Utility to validate program ID
function validateProgramId(programId) {
  if (!programId) {
    console.error('Program ID not provided. Set PROGRAM_ID in environment variables or .env file.');
    process.exit(1);
  }
  try {
    new PublicKey(programId);
    return programId;
  } catch (error) {
    console.error('Invalid Program ID format:', error.message);
    process.exit(1);
  }
}

// Utility to read local program binary
function readLocalProgramBinary(programPath) {
  try {
    const binaryData = readFileSync(programPath);
    console.log('Local program binary loaded from:', programPath);
    console.log('Local binary size:', binaryData.length, 'bytes');
    return binaryData;
  } catch (error) {
    console.error('Failed to read local program binary from:', programPath);
    console.error('Error:', error.message);
    console.error('Ensure the program is built using "anchor build" before verification.');
    process.exit(1);
  }
}

// Utility to fetch on-chain program data
async function fetchOnChainProgramData(connection, programId) {
  try {
    const programPubkey = new PublicKey(programId);
    const programInfo = await connection.getAccountInfo(programPubkey, 'confirmed');
    if (!programInfo) {
      console.error('Program account not found on chain for ID:', programId);
      process.exit(1);
    }
    if (!programInfo.executable) {
      console.error('Account at', programId, 'is not an executable program.');
      process.exit(1);
    }
    console.log('On-chain program data fetched for:', programId);
    console.log('On-chain program size:', programInfo.data.length, 'bytes');
    console.log('Program owner:', programInfo.owner.toString());
    console.log('Program lamports:', programInfo.lamports);
    return programInfo.data;
  } catch (error) {
    console.error('Failed to fetch on-chain program data for:', programId);
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Utility to compare bytecode
function compareBytecode(localBinary, onChainData) {
  if (localBinary.length !== onChainData.length) {
    console.warn('Bytecode size mismatch!');
    console.log('Local binary size:', localBinary.length, 'bytes');
    console.log('On-chain data size:', onChainData.length, 'bytes');
    return false;
  }

  for (let i = 0; i < localBinary.length; i++) {
    if (localBinary[i] !== onChainData[i]) {
      console.warn('Bytecode mismatch at byte index:', i);
      console.log('Local byte:', localBinary[i]);
      console.log('On-chain byte:', onChainData[i]);
      return false;
    }
  }

  console.log('Bytecode verification successful: Local binary matches on-chain program.');
  return true;
}

// Main verification function
async function verifyProgram() {
  console.log(`Verifying program on ${CLUSTER} cluster...`);

  // Validate program ID
  const programId = validateProgramId(PROGRAM_ID);
  console.log('Target Program ID for verification:', programId);

  // Set up connection
  const connection = new Connection(getClusterUrl(CLUSTER), 'confirmed');
  console.log('Connected to cluster:', CLUSTER);

  // Read local program binary
  const localBinary = readLocalProgramBinary(PROGRAM_SO_PATH);

  // Fetch on-chain program data
  const onChainData = await fetchOnChainProgramData(connection, programId);

  // Compare bytecode
  const isMatch = compareBytecode(localBinary, onChainData);
  if (isMatch) {
    console.log('Verification passed: The deployed program matches the local build.');
  } else {
    console.error('Verification failed: The deployed program does not match the local build.');
    console.error('Possible reasons:');
    console.error('- The deployed program is a different version or build.');
    console.error('- The local binary is not the one deployed to this Program ID.');
    console.error('- Data corruption or incorrect cluster selection.');
    console.error('Steps to resolve:');
    console.error('- Ensure the correct PROGRAM_SO_PATH points to the deployed binary.');
    console.error('- Verify the PROGRAM_ID matches the intended deployment.');
    console.error('- Check if the cluster (mainnet/testnet/devnet) is correct.');
    process.exit(1);
  }

  // Additional metadata from IDL (optional transparency step)
  try {
    const idl = JSON.parse(readFileSync(PROGRAM_IDL_PATH, 'utf-8'));
    console.log('Program IDL metadata:');
    console.log('Name:', idl.name || 'Not specified');
    console.log('Version:', idl.metadata?.version || 'Not specified');
    console.log('Note: IDL version is informational and not part of bytecode verification.');
  } catch (error) {
    console.warn('Could not load IDL for metadata:', error.message);
    console.warn('Skipping IDL metadata display (non-critical).');
  }

  // Post-verification instructions
  console.log('Verification process complete. Next steps:');
  console.log('- Share verification results with users for transparency.');
  console.log('- If verification failed, investigate build or deployment discrepancies.');
  console.log('- Consider automating verification in CI/CD pipelines for continuous transparency.');
}

// Error handling wrapper for async execution
async function main() {
  try {
    await verifyProgram();
  } catch (error) {
    console.error('Unexpected error during verification:', error.message);
    process.exit(1);
  }
}

// Execute verification
main().then(() => {
  console.log('Verification script execution completed.');
  process.exit(0);
}).catch((error) => {
  console.error('Verification script failed:', error.message);
  process.exit(1);
});
