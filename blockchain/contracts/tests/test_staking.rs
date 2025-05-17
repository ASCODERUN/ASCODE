// test_staking.rs
// This module contains test cases for staking functionality and edge cases in the Ontora AI Solana program.
// It tests successful staking, unstaking, reward claiming, and various failure scenarios.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::Pubkey;
use anchor_client::solana_sdk::signature::Keypair;
use anchor_client::Program;
use solana_program_test::*;
use std::rc::Rc;

// Import test setup utilities (assumes test_setup.rs is in the same directory)
mod test_setup;
use test_setup::*;

// Assuming the program ID for Ontora AI (replace with actual program ID if needed)
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// Test successful staking by a user
#[tokio::test]
async fn test_stake_success() {
    let (mut ctx, program) = setup_test_context().await;
    let user = create_test_user(&mut ctx.banks_client, &ctx.payer, ctx.last_blockhash).await;

    // Create a mock AI agent for staking (adjust based on program logic)
    let agent_pda = create_mock_ai_agent(&mut ctx.banks_client, &program, &user, TEST_AI_AGENT_ID).await;

    // Get user's initial balance
    let initial_balance = get_account_balance(&mut ctx.banks_client, &user.pubkey).await;

    // Perform staking (replace with actual instruction call)
    let stake_amount = TEST_STAKE_AMOUNT;
    let result = program
        .request()
        .accounts(ontora_ai::accounts::Stake {
            user: user.pubkey,
            agent: agent_pda,
            stake_account: derive_stake_account_pda(&user.pubkey, &agent_pda, &program.id()),
            system_program: anchor_lang::solana_program::system_program::ID,
        })
        .args(ontora_ai::instruction::Stake {
            amount: stake_amount,
        })
        .signer(&user.keypair)
        .send()
        .await;

    // Assert the staking was successful
    assert!(result.is_ok());

    // Verify user's balance decreased by stake amount
    let final_balance = get_account_balance(&mut ctx.banks_client, &user.pubkey).await;
    assert_eq!(initial_balance - final_balance, stake_amount);
}

// Test staking with insufficient funds
#[tokio::test]
async fn test_stake_insufficient_funds() {
    let (mut ctx, program) = setup_test_context().await;
    let user = create_test_user(&mut ctx.banks_client, &ctx.payer, ctx.last_blockhash).await;

    // Create a mock AI agent for staking
    let agent_pda = create_mock_ai_agent(&mut ctx.banks_client, &program, &user, TEST_AI_AGENT_ID).await;

    // Attempt to stake more than the user's balance
    let stake_amount = INITIAL_LAMPORTS * 2; // More than user's balance
    let result = program
        .request()
        .accounts(ontora_ai::accounts::Stake {
            user: user.pubkey,
            agent: agent_pda,
            stake_account: derive_stake_account_pda(&user.pubkey, &agent_pda, &program.id()),
            system_program: anchor_lang::solana_program::system_program::ID,
        })
        .args(ontora_ai::instruction::Stake {
            amount: stake_amount,
        })
        .signer(&user.keypair)
        .send()
        .await;

    // Assert the staking fails due to insufficient funds
    assert!(result.is_err());
}

// Test successful unstaking by a user
#[tokio::test]
async fn test_unstake_success() {
    let (mut ctx, program) = setup_test_context().await;
    let user = create_test_user(&mut ctx.banks_client, &ctx.payer, ctx.last_blockhash).await;

    // Create a mock AI agent for staking
    let agent_pda = create_mock_ai_agent(&mut ctx.banks_client, &program, &user, TEST_AI_AGENT_ID).await;

    // Perform staking first
    let stake_amount = TEST_STAKE_AMOUNT;
    let _ = program
        .request()
        .accounts(ontora_ai::accounts::Stake {
            user: user.pubkey,
            agent: agent_pda,
            stake_account: derive_stake_account_pda(&user.pubkey, &agent_pda, &program.id()),
            system_program: anchor_lang::solana_program::system_program::ID,
        })
        .args(ontora_ai::instruction::Stake {
            amount: stake_amount,
        })
        .signer(&user.keypair)
        .send()
        .await
        .unwrap();

    // Get user's initial balance after staking
    let initial_balance = get_account_balance(&mut ctx.banks_client, &user.pubkey).await;

    // Perform unstaking (replace with actual instruction call)
    let result = program
        .request()
        .accounts(ontora_ai::accounts::Unstake {
            user: user.pubkey,
            agent: agent_pda,
            stake_account: derive_stake_account_pda(&user.pubkey, &agent_pda, &program.id()),
            system_program: anchor_lang::solana_program::system_program::ID,
        })
        .args(ontora_ai::instruction::Unstake {})
        .signer(&user.keypair)
        .send()
        .await;

    // Assert the unstaking was successful
    assert!(result.is_ok());

    // Verify user's balance increased (minus potential fees or penalties)
    let final_balance = get_account_balance(&mut ctx.banks_client, &user.pubkey).await;
    assert!(final_balance > initial_balance);
}

// Test unstaking without prior staking
#[tokio::test]
async fn test_unstake_no_stake() {
    let (mut ctx, program) = setup_test_context().await;
    let user = create_test_user(&mut ctx.banks_client, &ctx.payer, ctx.last_blockhash).await;

    // Create a mock AI agent for staking
    let agent_pda = create_mock_ai_agent(&mut ctx.banks_client, &program, &user, TEST_AI_AGENT_ID).await;

    // Attempt to unstake without staking first
    let result = program
        .request()
        .accounts(ontora_ai::accounts::Unstake {
            user: user.pubkey,
            agent: agent_pda,
            stake_account: derive_stake_account_pda(&user.pubkey, &agent_pda, &program.id()),
            system_program: anchor_lang::solana_program::system_program::ID,
        })
        .args(ontora_ai::instruction::Unstake {})
        .signer(&user.keypair)
        .send()
        .await;

    // Assert the unstaking fails due to no prior stake
    assert!(result.is_err());
}

// Test claiming rewards after staking
#[tokio::test]
async fn test_claim_rewards_success() {
    let (mut ctx, program) = setup_test_context().await;
    let user = create_test_user(&mut ctx.banks_client, &ctx.payer, ctx.last_blockhash).await;

    // Create a mock AI agent for staking
    let agent_pda = create_mock_ai_agent(&mut ctx.banks_client, &program, &user, TEST_AI_AGENT_ID).await;

    // Perform staking
    let stake_amount = TEST_STAKE_AMOUNT;
    let _ = program
        .request()
        .accounts(ontora_ai::accounts::Stake {
            user: user.pubkey,
            agent: agent_pda,
            stake_account: derive_stake_account_pda(&user.pubkey, &agent_pda, &program.id()),
            system_program: anchor_lang::solana_program::system_program::ID,
        })
        .args(ontora_ai::instruction::Stake {
            amount: stake_amount,
        })
        .signer(&user.keypair)
        .send()
        .await
        .unwrap();

    // Advance slots to simulate time passing for reward accrual
    advance_slot(&mut ctx.banks_client, 100).await;

    // Get user's initial balance before claiming rewards
    let initial_balance = get_account_balance(&mut ctx.banks_client, &user.pubkey).await;

    // Claim rewards (replace with actual instruction call)
    let result = program
        .request()
        .accounts(ontora_ai::accounts::ClaimRewards {
            user: user.pubkey,
            agent: agent_pda,
            stake_account: derive_stake_account_pda(&user.pubkey, &agent_pda, &program.id()),
            system_program: anchor_lang::solana_program::system_program::ID,
        })
        .args(ontora_ai::instruction::ClaimRewards {})
        .signer(&user.keypair)
        .send()
        .await;

    // Assert the reward claim was successful
    assert!(result.is_ok());

    // Verify user's balance increased due to rewards
    let final_balance = get_account_balance(&mut ctx.banks_client, &user.pubkey).await;
    assert!(final_balance > initial_balance);
}

// Test claiming rewards with no staking
#[tokio::test]
async fn test_claim_rewards_no_stake() {
    let (mut ctx, program) = setup_test_context().await;
    let user = create_test_user(&mut ctx.banks_client, &ctx.payer, ctx.last_blockhash).await;

    // Create a mock AI agent for staking
    let agent_pda = create_mock_ai_agent(&mut ctx.banks_client, &program, &user, TEST_AI_AGENT_ID).await;

    // Attempt to claim rewards without staking
    let result = program
        .request()
        .accounts(ontora_ai::accounts::ClaimRewards {
            user: user.pubkey,
            agent: agent_pda,
            stake_account: derive_stake_account_pda(&user.pubkey, &agent_pda, &program.id()),
            system_program: anchor_lang::solana_program::system_program::ID,
        })
        .args(ontora_ai::instruction::ClaimRewards {})
        .signer(&user.keypair)
        .send()
        .await;

    // Assert the reward claim fails due to no stake
    assert!(result.is_err());
}

// Test staking with invalid AI agent
#[tokio::test]
async fn test_stake_invalid_agent() {
    let (mut ctx, program) = setup_test_context().await;
    let user = create_test_user(&mut ctx.banks_client, &ctx.payer, ctx.last_blockhash).await;

    // Use a random Pubkey as an invalid agent PDA
    let invalid_agent_pda = Pubkey::new_unique();

    // Attempt to stake with an invalid agent
    let stake_amount = TEST_STAKE_AMOUNT;
    let result = program
        .request()
        .accounts(ontora_ai::accounts::Stake {
            user: user.pubkey,
            agent: invalid_agent_pda,
            stake_account: derive_stake_account_pda(&user.pubkey, &invalid_agent_pda, &program.id()),
            system_program: anchor_lang::solana_program::system_program::ID,
        })
        .args(ontora_ai::instruction::Stake {
            amount: stake_amount,
        })
        .signer(&user.keypair)
        .send()
        .await;

    // Assert the staking fails due to invalid agent
    assert!(result.is_err());
}

// Test multiple users staking on the same AI agent
#[tokio::test]
async fn test_multiple_users_stake_same_agent() {
    let (mut ctx, program) = setup_test_context().await;
    let user1 = create_test_user(&mut ctx.banks_client, &ctx.payer, ctx.last_blockhash).await;
    let user2 = create_test_user(&mut ctx.banks_client, &ctx.payer, ctx.last_blockhash).await;

    // Create a mock AI agent for staking
    let agent_pda = create_mock_ai_agent(&mut ctx.banks_client, &program, &user1, TEST_AI_AGENT_ID).await;

    // User 1 stakes
    let stake_amount = TEST_STAKE_AMOUNT;
    let result1 = program
        .request()
        .accounts(ontora_ai::accounts::Stake {
            user: user1.pubkey,
            agent: agent_pda,
            stake_account: derive_stake_account_pda(&user1.pubkey, &agent_pda, &program.id()),
            system_program: anchor_lang::solana_program::system_program::ID,
        })
        .args(ontora_ai::instruction::Stake {
            amount: stake_amount,
        })
        .signer(&user1.keypair)
        .send()
        .await;

    // User 2 stakes on the same agent
    let result2 = program
        .request()
        .accounts(ontora_ai::accounts::Stake {
            user: user2.pubkey,
            agent: agent_pda,
            stake_account: derive_stake_account_pda(&user2.pubkey, &agent_pda, &program.id()),
            system_program: anchor_lang::solana_program::system_program::ID,
        })
        .args(ontora_ai::instruction::Stake {
            amount: stake_amount,
        })
        .signer(&user2.keypair)
        .send()
        .await;

    // Assert both staking operations were successful
    assert!(result1.is_ok());
    assert!(result2.is_ok());
}

// Helper function to derive stake account PDA (adjust based on program logic)
fn derive_stake_account_pda(user: &Pubkey, agent: &Pubkey, program_id: &Pubkey) -> Pubkey {
    let (pda, _bump) = Pubkey::find_program_address(
        &[b"stake_account", user.as_ref(), agent.as_ref()],
        program_id,
    );
    pda
}
