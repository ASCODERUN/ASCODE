// test_setup.rs
// This module provides setup utilities and helper functions for testing the Ontora AI Solana program.
// It includes functions to initialize test environments, create mock accounts, and simulate user interactions.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use anchor_lang::solana_program::pubkey::Pubkey;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::system_program;
use anchor_client::solana_sdk::account::Account;
use anchor_client::solana_sdk::signature::{Keypair, Signer};
use anchor_client::solana_sdk::transaction::Transaction;
use anchor_client::Program;
use solana_program_test::*;
use solana_sdk::commitment_config::CommitmentLevel;
use std::rc::Rc;

// Assuming the program ID for Ontora AI (replace with actual program ID if needed)
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// Constants for test setup
pub const INITIAL_LAMPORTS: u64 = 10_000_000_000; // 10 SOL for test accounts
pub const TEST_STAKE_AMOUNT: u64 = 1_000_000_000; // 1 SOL for staking in tests
pub const TEST_AI_AGENT_ID: u64 = 1; // Mock AI agent ID for testing

// TestUser struct to represent a user in the test environment
#[derive(Clone)]
pub struct TestUser {
    pub keypair: Keypair,
    pub pubkey: Pubkey,
}

// TestContext struct to hold the test environment state
pub struct TestContext {
    pub banks_client: BanksClient,
    pub payer: Keypair,
    pub last_blockhash: [u8; 32],
}

// Utility function to create a new test user with initial lamports
pub async fn create_test_user(banks_client: &mut BanksClient, payer: &Keypair, last_blockhash: [u8; 32]) -> TestUser {
    let user_keypair = Keypair::new();
    let user_pubkey = user_keypair.pubkey();

    // Create a transaction to transfer initial lamports to the new user
    let tx = Transaction::new_signed_with_payer(
        &[system_instruction::transfer(
            &payer.pubkey(),
            &user_pubkey,
            INITIAL_LAMPORTS,
        )],
        Some(&payer.pubkey()),
        &[payer, &user_keypair],
        last_blockhash,
    );

    // Process the transaction
    banks_client
        .process_transaction_with_commitment(tx, CommitmentLevel::Confirmed)
        .await
        .unwrap();

    TestUser {
        keypair: user_keypair,
        pubkey: user_pubkey,
    }
}

// Utility function to initialize the test context with a payer account
pub async fn setup_test_context() -> (TestContext, Program) {
    // Start the Solana test validator
    let mut test = ProgramTest::new(
        "ontora_ai", // Program name (adjust if different)
        id(),        // Program ID
        processor!(ontora_ai::entry), // Entry point (adjust based on your program)
    );

    // Add initial payer account with lamports
    let payer = Keypair::new();
    test.add_account(
        payer.pubkey(),
        Account {
            lamports: INITIAL_LAMPORTS * 10, // Give payer more SOL for transactions
            data: vec![],
            owner: system_program::ID,
            executable: false,
            rent_epoch: 0,
        },
    );

    // Start the test environment
    let (banks_client, _payer, last_blockhash) = test.start().await;

    // Create a program instance for interacting with the Solana program
    let program = Program::new(
        id(),
        Rc::new(banks_client.clone()),
        CommitmentLevel::Confirmed,
    );

    (
        TestContext {
            banks_client,
            payer,
            last_blockhash,
        },
        program,
    )
}

// Utility function to get the current slot (block height) in the test environment
pub async fn get_current_slot(banks_client: &mut BanksClient) -> u64 {
    banks_client
        .get_sysvar::<Clock>()
        .await
        .unwrap()
        .slot
}

// Utility function to advance the slot by a specified number for testing time-dependent logic
pub async fn advance_slot(banks_client: &mut BanksClient, slots: u64) {
    let current_slot = get_current_slot(banks_client).await;
    banks_client
        .warp_to_slot(current_slot + slots)
        .await
        .unwrap();
}

// Utility function to create a mock AI agent account (adjust based on your program's state structure)
pub async fn create_mock_ai_agent(
    banks_client: &mut BanksClient,
    program: &Program,
    owner: &TestUser,
    agent_id: u64,
) -> Pubkey {
    // Derive PDA for the AI agent account (adjust based on your program's PDA logic)
    let (agent_pda, _bump) = Pubkey::find_program_address(
        &[b"ai_agent", owner.pubkey.as_ref(), &agent_id.to_le_bytes()],
        &program.id(),
    );

    // Mock instruction to initialize the AI agent (replace with actual instruction call)
    // This is a placeholder; implement based on your program's instruction for creating an AI agent
    let _result = program
        .request()
        .accounts(ontora_ai::accounts::InitializeAiAgent {
            agent: agent_pda,
            owner: owner.pubkey,
            system_program: system_program::ID,
        })
        .args(ontora_ai::instruction::InitializeAiAgent { agent_id })
        .signer(&owner.keypair)
        .send()
        .await
        .unwrap();

    agent_pda
}

// Utility function to fund a test account with additional lamports
pub async fn fund_account(
    banks_client: &mut BanksClient,
    payer: &Keypair,
    account: &Pubkey,
    amount: u64,
    last_blockhash: [u8; 32],
) {
    let tx = Transaction::new_signed_with_payer(
        &[system_instruction::transfer(
            &payer.pubkey(),
            account,
            amount,
        )],
        Some(&payer.pubkey()),
        &[payer],
        last_blockhash,
    );

    banks_client
        .process_transaction_with_commitment(tx, CommitmentLevel::Confirmed)
        .await
        .unwrap();
}

// Utility function to get account balance in lamports
pub async fn get_account_balance(banks_client: &mut BanksClient, account: &Pubkey) -> u64 {
    banks_client
        .get_account(*account)
        .await
        .unwrap()
        .unwrap()
        .lamports
}

// Mock data for testing governance proposals (adjust based on your program's structure)
pub struct MockProposal {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub creator: Pubkey,
}

// Utility function to create a mock governance proposal (placeholder for actual instruction)
pub async fn create_mock_proposal(
    banks_client: &mut BanksClient,
    program: &Program,
    creator: &TestUser,
    proposal_id: u64,
) -> Pubkey {
    // Derive PDA for the proposal account (adjust based on your program's PDA logic)
    let (proposal_pda, _bump) = Pubkey::find_program_address(
        &[b"proposal", &proposal_id.to_le_bytes()],
        &program.id(),
    );

    // Mock instruction to create a proposal (replace with actual instruction call)
    // This is a placeholder; implement based on your program's instruction for creating a proposal
    let _result = program
        .request()
        .accounts(ontora_ai::accounts::CreateProposal {
            proposal: proposal_pda,
            creator: creator.pubkey,
            system_program: system_program::ID,
        })
        .args(ontora_ai::instruction::CreateProposal {
            id: proposal_id,
            title: "Test Proposal".to_string(),
            description: "A test proposal for Ontora AI".to_string(),
        })
        .signer(&creator.keypair)
        .send()
        .await
        .unwrap();

    proposal_pda
}

// Add more utility functions as needed for staking, rewards, or other program-specific logic
