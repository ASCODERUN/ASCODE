// interact_with_contract.js
// Example of interacting with a Solana smart contract for staking and rewards using @solana/web3.js

const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID, AccountLayout } = require('@solana/spl-token');
const bs58 = require('bs58');
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables from .env file
dotenv.config();

// Network configuration (use devnet for testing, switch to mainnet-beta for production)
const NETWORK = 'https://api.devnet.solana.com';
const connection = new Connection(NETWORK, 'confirmed');

// Wallet configuration (private key from environment or file for testing)
const PRIVATE_KEY_BASE58 = process.env.PRIVATE_KEY || '';
let wallet;
if (PRIVATE_KEY_BASE58) {
  const privateKeyUint8Array = bs58.decode(PRIVATE_KEY_BASE58);
  wallet = Keypair.fromSecretKey(privateKeyUint8Array);
} else {
  console.error('Private key not found in environment variables. Please set PRIVATE_KEY in .env');
  process.exit(1);
}

// Program ID and token addresses (replace with your deployed program and token details)
const PROGRAM_ID = new PublicKey('YourProgramIdHere'); // Replace with your staking program ID
const STAKING_TOKEN_MINT = new PublicKey('YourStakingTokenMintHere'); // Replace with staking token mint address
const REWARD_TOKEN_MINT = new PublicKey('YourRewardTokenMintHere'); // Replace with reward token mint address

// PDA (Program Derived Address) seeds for staking account (adjust based on your program)
const STAKING_ACCOUNT_SEED = Buffer.from('staking_account');

// Utility function to log transaction details
const logTransaction = (txId, action) => {
  console.log(`${action} transaction successful. Transaction ID: https://explorer.solana.com/tx/${txId}?cluster=devnet`);
};

// Utility function to get or create associated token account
async function getOrCreateAssociatedTokenAccount(connection, payer, tokenMint, owner) {
  const token = new Token(
    connection,
    tokenMint,
    TOKEN_PROGRAM_ID,
    payer
  );

  const associatedTokenAddress = await Token.getAssociatedTokenAddress(
    TOKEN_PROGRAM_ID,
    tokenMint,
    owner,
    false
  );

  try {
    const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
    if (!accountInfo) {
      console.log(`Creating associated token account for ${tokenMint.toBase58()}`);
      const tx = await token.createAssociatedTokenAccount(owner);
      console.log(`Associated token account created: ${associatedTokenAddress.toBase58()}`);
      return associatedTokenAddress;
    }
    return associatedTokenAddress;
  } catch (error) {
    console.error('Error creating associated token account:', error.message);
    throw error;
  }
}

// Initialize staking account (if required by your program)
async function initializeStakingAccount() {
  try {
    console.log('Initializing staking account...');
    const [stakingAccountPDA, bump] = await PublicKey.findProgramAddress(
      [STAKING_ACCOUNT_SEED, wallet.publicKey.toBuffer()],
      PROGRAM_ID
    );

    // Check if staking account already exists
    const accountInfo = await connection.getAccountInfo(stakingAccountPDA);
    if (accountInfo) {
      console.log(`Staking account already exists: ${stakingAccountPDA.toBase58()}`);
      return stakingAccountPDA;
    }

    // If not, create the staking account (adjust instruction based on your program)
    console.log(`Creating staking account at: ${stakingAccountPDA.toBase58()}`);
    // Note: This is a placeholder. Replace with actual instruction to initialize staking account
    // using your program's method (e.g., via Anchor client or raw instruction).
    // Example: tx = program.rpc.initializeStakingAccount(bump, { accounts: {...} });

    return stakingAccountPDA;
  } catch (error) {
    console.error('Error initializing staking account:', error.message);
    throw error;
  }
}

// Stake tokens into the program
async function stakeTokens(amount) {
  try {
    console.log(`Staking ${amount} tokens...`);
    const stakingTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      STAKING_TOKEN_MINT,
      wallet.publicKey
    );

    const [stakingAccountPDA, bump] = await PublicKey.findProgramAddress(
      [STAKING_ACCOUNT_SEED, wallet.publicKey.toBuffer()],
      PROGRAM_ID
    );

    // Check token balance before staking
    const token = new Token(connection, STAKING_TOKEN_MINT, TOKEN_PROGRAM_ID, wallet);
    const balance = await token.getAccountInfo(stakingTokenAccount);
    console.log(`Current staking token balance: ${balance.amount.toString()}`);

    if (balance.amount.lt(amount * Math.pow(10, 9))) { // Assuming 9 decimals for token
      throw new Error('Insufficient token balance for staking');
    }

    // Placeholder for staking instruction (replace with actual program call)
    // Example using Anchor or raw instruction:
    // const tx = await program.rpc.stake(new BN(amount * Math.pow(10, 9)), bump, {
    //   accounts: {
    //     stakingAccount: stakingAccountPDA,
    //     stakingTokenAccount: stakingTokenAccount,
    //     user: wallet.publicKey,
    //     tokenProgram: TOKEN_PROGRAM_ID,
    //   },
    //   signers: [wallet],
    // });

    console.log(`Staked ${amount} tokens successfully.`);
    // Replace with actual transaction ID once implemented
    logTransaction('mockTransactionId', 'Stake');
  } catch (error) {
    console.error('Error staking tokens:', error.message);
    throw error;
  }
}

// Claim rewards from the staking program
async function claimRewards() {
  try {
    console.log('Claiming rewards...');
    const rewardTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      REWARD_TOKEN_MINT,
      wallet.publicKey
    );

    const [stakingAccountPDA, bump] = await PublicKey.findProgramAddress(
      [STAKING_ACCOUNT_SEED, wallet.publicKey.toBuffer()],
      PROGRAM_ID
    );

    // Placeholder for claiming rewards (replace with actual program call)
    // Example using Anchor or raw instruction:
    // const tx = await program.rpc.claimRewards(bump, {
    //   accounts: {
    //     stakingAccount: stakingAccountPDA,
    //     rewardTokenAccount: rewardTokenAccount,
    //     user: wallet.publicKey,
    //     tokenProgram: TOKEN_PROGRAM_ID,
    //   },
    //   signers: [wallet],
    // });

    console.log('Rewards claimed successfully.');
    // Replace with actual transaction ID once implemented
    logTransaction('mockTransactionId', 'Claim Rewards');

    // Check updated reward balance
    const token = new Token(connection, REWARD_TOKEN_MINT, TOKEN_PROGRAM_ID, wallet);
    const balance = await token.getAccountInfo(rewardTokenAccount);
    console.log(`Updated reward token balance: ${balance.amount.toString()}`);
  } catch (error) {
    console.error('Error claiming rewards:', error.message);
    throw error;
  }
}

// Unstake tokens from the program
async function unstakeTokens(amount) {
  try {
    console.log(`Unstaking ${amount} tokens...`);
    const stakingTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      STAKING_TOKEN_MINT,
      wallet.publicKey
    );

    const [stakingAccountPDA, bump] = await PublicKey.findProgramAddress(
      [STAKING_ACCOUNT_SEED, wallet.publicKey.toBuffer()],
      PROGRAM_ID
    );

    // Placeholder for unstaking instruction (replace with actual program call)
    // Example using Anchor or raw instruction:
    // const tx = await program.rpc.unstake(new BN(amount * Math.pow(10, 9)), bump, {
    //   accounts: {
    //     stakingAccount: stakingAccountPDA,
    //     stakingTokenAccount: stakingTokenAccount,
    //     user: wallet.publicKey,
    //     tokenProgram: TOKEN_PROGRAM_ID,
    //   },
    //   signers: [wallet],
    // });

    console.log(`Unstaked ${amount} tokens successfully.`);
    // Replace with actual transaction ID once implemented
    logTransaction('mockTransactionId', 'Unstake');
  } catch (error) {
    console.error('Error unstaking tokens:', error.message);
    throw error;
  }
}

// Check staking and reward balances
async function checkBalances() {
  try {
    console.log('Checking balances...');
    const stakingTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      STAKING_TOKEN_MINT,
      wallet.publicKey
    );
    const rewardTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      REWARD_TOKEN_MINT,
      wallet.publicKey
    );

    const stakingToken = new Token(connection, STAKING_TOKEN_MINT, TOKEN_PROGRAM_ID, wallet);
    const rewardToken = new Token(connection, REWARD_TOKEN_MINT, TOKEN_PROGRAM_ID, wallet);

    const stakingBalance = await stakingToken.getAccountInfo(stakingTokenAccount);
    const rewardBalance = await rewardToken.getAccountInfo(rewardTokenAccount);

    console.log(`Staking Token Balance: ${stakingBalance.amount.toString()}`);
    console.log(`Reward Token Balance: ${rewardBalance.amount.toString()}`);
  } catch (error) {
    console.error('Error checking balances:', error.message);
    throw error;
  }
}

// Main function to run interactions
async function main() {
  try {
    console.log(`Connected to Solana network: ${NETWORK}`);
    console.log(`Using wallet address: ${wallet.publicKey.toBase58()}`);

    // Check initial balances
    await checkBalances();

    // Initialize staking account if needed
    await initializeStakingAccount();

    // Stake a specific amount of tokens (adjust amount as needed)
    const stakeAmount = 10; // Example: 10 tokens
    await stakeTokens(stakeAmount);

    // Wait for a short period to simulate reward accrual (optional)
    console.log('Waiting for rewards to accrue (simulated delay)...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Claim rewards
    await claimRewards();

    // Unstake tokens (adjust amount as needed)
    const unstakeAmount = 5; // Example: 5 tokens
    await unstakeTokens(unstakeAmount);

    // Check final balances
    await checkBalances();
  } catch (error) {
    console.error('Error in main execution:', error.message);
    process.exit(1);
  }
}

// Execute the main function
main().then(() => {
  console.log('Interaction with Solana contract completed.');
}).catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
