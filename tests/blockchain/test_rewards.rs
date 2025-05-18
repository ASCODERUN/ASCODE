use solana_program_test::*;
use solana_sdk::{
    account::Account,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::Transaction,
    transport::TransportError,
    system_instruction,
};
use std::str::FromStr;
use ontora_ai_program::processor::process_instruction;
use ontora_ai_program::state::{StakingAccount, RewardPool};

async fn setup_test_environment() -> Result<(ProgramTest, Keypair, Pubkey), TransportError> {
    let program_id = Pubkey::from_str("YourProgramIdHere11111111111111111111111111111").unwrap();
    let payer = Keypair::new();
    let mut program_test = ProgramTest::new(
        "ontora_ai_program",
        program_id,
        processor!(process_instruction),
    );

    program_test.add_account(
        payer.pubkey(),
        Account {
            lamports: 1_000_000_000,
            data: vec![],
            owner: solana_sdk::system_program::id(),
            executable: false,
            rent_epoch: 0,
        },
    );

    Ok((program_test, payer, program_id))
}

async fn create_staking_account(
    banks_client: &mut BanksClient,
    payer: &Keypair,
    program_id: &Pubkey,
    user: &Keypair,
    stake_amount: u64,
) -> Result<Pubkey, TransportError> {
    let staking_account = Keypair::new();
    let rent = banks_client.get_rent().await.unwrap();
    let space = std::mem::size_of::<StakingAccount>() as u64;
    let lamports = rent.minimum_balance(space as usize);

    let create_account_ix = system_instruction::create_account(
        &payer.pubkey(),
        &staking_account.pubkey(),
        lamports,
        space,
        program_id,
    );

    let stake_ix = Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(staking_account.pubkey(), false),
            AccountMeta::new(user.pubkey(), true),
        ],
        data: vec![0, stake_amount as u8], // Mock instruction data for staking
    };

    let tx = Transaction::new_signed_with_payer(
        &[create_account_ix, stake_ix],
        Some(&payer.pubkey()),
        &[payer, &staking_account, user],
        banks_client.get_latest_blockhash().await.unwrap(),
    );

    banks_client.process_transaction(tx).await?;

    Ok(staking_account.pubkey())
}

async fn create_reward_pool(
    banks_client: &mut BanksClient,
    payer: &Keypair,
    program_id: &Pubkey,
    total_rewards: u64,
) -> Result<Pubkey, TransportError> {
    let reward_pool = Keypair::new();
    let rent = banks_client.get_rent().await.unwrap();
    let space = std::mem::size_of::<RewardPool>() as u64;
    let lamports = rent.minimum_balance(space as usize) + total_rewards;

    let create_account_ix = system_instruction::create_account(
        &payer.pubkey(),
        &reward_pool.pubkey(),
        lamports,
        space,
        program_id,
    );

    let init_pool_ix = Instruction {
        program_id: *program_id,
        accounts: vec![AccountMeta::new(reward_pool.pubkey(), false)],
        data: vec![1], // Mock instruction data for initializing reward pool
    };

    let tx = Transaction::new_signed_with_payer(
        &[create_account_ix, init_pool_ix],
        Some(&payer.pubkey()),
        &[payer, &reward_pool],
        banks_client.get_latest_blockhash().await.unwrap(),
    );

    banks_client.process_transaction(tx).await?;

    Ok(reward_pool.pubkey())
}

#[tokio::test]
async fn test_reward_distribution_basic() {
    let (program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let mut banks_client = program_test.start().await;

    let user1 = Keypair::new();
    let user2 = Keypair::new();
    let stake_amount1 = 100;
    let stake_amount2 = 200;
    let total_rewards = 30;

    let staking_account1 = create_staking_account(
        &mut banks_client,
        &payer,
        &program_id,
        &user1,
        stake_amount1,
    ).await.unwrap();

    let staking_account2 = create_staking_account(
        &mut banks_client,
        &payer,
        &program_id,
        &user2,
        stake_amount2,
    ).await.unwrap();

    let reward_pool = create_reward_pool(
        &mut banks_client,
        &payer,
        &program_id,
        total_rewards,
    ).await.unwrap();

    let distribute_ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(reward_pool, false),
            AccountMeta::new(staking_account1, false),
            AccountMeta::new(staking_account2, false),
            AccountMeta::new(user1.pubkey(), false),
            AccountMeta::new(user2.pubkey(), false),
        ],
        data: vec![2], // Mock instruction data for reward distribution
    };

    let tx = Transaction::new_signed_with_payer(
        &[distribute_ix],
        Some(&payer.pubkey()),
        &[&payer],
        banks_client.get_latest_blockhash().await.unwrap(),
    );

    let result = banks_client.process_transaction(tx).await;
    assert!(result.is_ok());

    let user1_balance = banks_client.get_balance(user1.pubkey()).await.unwrap();
    let user2_balance = banks_client.get_balance(user2.pubkey()).await.unwrap();

    assert_eq!(user1_balance, 10); // 1/3 of rewards (100/300 * 30)
    assert_eq!(user2_balance, 20); // 2/3 of rewards (200/300 * 30)
}

#[tokio::test]
async fn test_reward_distribution_zero_stake() {
    let (program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let mut banks_client = program_test.start().await;

    let user1 = Keypair::new();
    let user2 = Keypair::new();
    let stake_amount1 = 100;
    let stake_amount2 = 0;
    let total_rewards = 30;

    let staking_account1 = create_staking_account(
        &mut banks_client,
        &payer,
        &program_id,
        &user1,
        stake_amount1,
    ).await.unwrap();

    let staking_account2 = create_staking_account(
        &mut banks_client,
        &payer,
        &program_id,
        &user2,
        stake_amount2,
    ).await.unwrap();

    let reward_pool = create_reward_pool(
        &mut banks_client,
        &payer,
        &program_id,
        total_rewards,
    ).await.unwrap();

    let distribute_ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(reward_pool, false),
            AccountMeta::new(staking_account1, false),
            AccountMeta::new(staking_account2, false),
            AccountMeta::new(user1.pubkey(), false),
            AccountMeta::new(user2.pubkey(), false),
        ],
        data: vec![2],
    };

    let tx = Transaction::new_signed_with_payer(
        &[distribute_ix],
        Some(&payer.pubkey()),
        &[&payer],
        banks_client.get_latest_blockhash().await.unwrap(),
    );

    let result = banks_client.process_transaction(tx).await;
    assert!(result.is_ok());

    let user1_balance = banks_client.get_balance(user1.pubkey()).await.unwrap();
    let user2_balance = banks_client.get_balance(user2.pubkey()).await.unwrap();

    assert_eq!(user1_balance, 30); // All rewards go to user1
    assert_eq!(user2_balance, 0);  // No rewards for zero stake
}

#[tokio::test]
async fn test_reward_distribution_insufficient_pool() {
    let (program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let mut banks_client = program_test.start().await;

    let user1 = Keypair::new();
    let stake_amount1 = 100;
    let total_rewards = 0;

    let staking_account1 = create_staking_account(
        &mut banks_client,
        &payer,
        &program_id,
        &user1,
        stake_amount1,
    ).await.unwrap();

    let reward_pool = create_reward_pool(
        &mut banks_client,
        &payer,
        &program_id,
        total_rewards,
    ).await.unwrap();

    let distribute_ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(reward_pool, false),
            AccountMeta::new(staking_account1, false),
            AccountMeta::new(user1.pubkey(), false),
        ],
        data: vec![2],
    };

    let tx = Transaction::new_signed_with_payer(
        &[distribute_ix],
        Some(&payer.pubkey()),
        &[&payer],
        banks_client.get_latest_blockhash().await.unwrap(),
    );

    let result = banks_client.process_transaction(tx).await;
    assert!(result.is_err()); // Should fail due to insufficient rewards
}

#[tokio::test]
async fn test_reward_distribution_uneven_split() {
    let (program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let mut banks_client = program_test.start().await;

    let user1 = Keypair::new();
    let user2 = Keypair::new();
    let stake_amount1 = 1;
    let stake_amount2 = 2;
    let total_rewards = 10;

    let staking_account1 = create_staking_account(
        &mut banks_client,
        &payer,
        &program_id,
        &user1,
        stake_amount1,
    ).await.unwrap();

    let staking_account2 = create_staking_account(
        &mut banks_client,
        &payer,
        &program_id,
        &user2,
        stake_amount2,
    ).await.unwrap();

    let reward_pool = create_reward_pool(
        &mut banks_client,
        &payer,
        &program_id,
        total_rewards,
    ).await.unwrap();

    let distribute_ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(reward_pool, false),
            AccountMeta::new(staking_account1, false),
            AccountMeta::new(staking_account2, false),
            AccountMeta::new(user1.pubkey(), false),
            AccountMeta::new(user2.pubkey(), false),
        ],
        data: vec![2],
    };

    let tx = Transaction::new_signed_with_payer(
        &[distribute_ix],
        Some(&payer.pubkey()),
        &[&payer],
        banks_client.get_latest_blockhash().await.unwrap(),
    );

    let result = banks_client.process_transaction(tx).await;
    assert!(result.is_ok());

    let user1_balance = banks_client.get_balance(user1.pubkey()).await.unwrap();
    let user2_balance = banks_client.get_balance(user2.pubkey()).await.unwrap();

    assert_eq!(user1_balance, 3); // Approx 1/3 of rewards (rounded)
    assert_eq!(user2_balance, 7); // Approx 2/3 of rewards (rounded)
}

#[tokio::test]
async fn test_reward_distribution_unauthorized_access() {
    let (program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let mut banks_client = program_test.start().await;

    let user1 = Keypair::new();
    let unauthorized_user = Keypair::new();
    let stake_amount1 = 100;
    let total_rewards = 30;

    let staking_account1 = create_staking_account(
        &mut banks_client,
        &payer,
        &program_id,
        &user1,
        stake_amount1,
    ).await.unwrap();

    let reward_pool = create_reward_pool(
        &mut banks_client,
        &payer,
        &program_id,
        total_rewards,
    ).await.unwrap();

    let distribute_ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(reward_pool, false),
            AccountMeta::new(staking_account1, false),
            AccountMeta::new(unauthorized_user.pubkey(), false), // Wrong user
        ],
        data: vec![2],
    };

    let tx = Transaction::new_signed_with_payer(
        &[distribute_ix],
        Some(&payer.pubkey()),
        &[&payer],
        banks_client.get_latest_blockhash().await.unwrap(),
    );

    let result = banks_client.process_transaction(tx).await;
    assert!(result.is_err()); // Should fail due to unauthorized access
}

#[tokio::test]
async fn test_reward_distribution_multiple_epochs() {
    let (program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let mut banks_client = program_test.start().await;

    let user1 = Keypair::new();
    let stake_amount1 = 100;
    let total_rewards_per_epoch = 10;

    let staking_account1 = create_staking_account(
        &mut banks_client,
        &payer,
        &program_id,
        &user1,
        stake_amount1,
    ).await.unwrap();

    let reward_pool = create_reward_pool(
        &mut banks_client,
        &payer,
        &program_id,
        total_rewards_per_epoch * 2,
    ).await.unwrap();

    for _ in 0..2 {
        let distribute_ix = Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new(reward_pool, false),
                AccountMeta::new(staking_account1, false),
                AccountMeta::new(user1.pubkey(), false),
            ],
            data: vec![2],
        };

        let tx = Transaction::new_signed_with_payer(
            &[distribute_ix],
            Some(&payer.pubkey()),
            &[&payer],
            banks_client.get_latest_blockhash().await.unwrap(),
        );

        let result = banks_client.process_transaction(tx).await;
        assert!(result.is_ok());
    }

    let user1_balance = banks_client.get_balance(user1.pubkey()).await.unwrap();
    assert_eq!(user1_balance, 20); // Rewards accumulated over 2 epochs
}
