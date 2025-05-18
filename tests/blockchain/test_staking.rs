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
            lamports: 10_000_000_000,
            data: vec![],
            owner: solana_sdk::system_program::id(),
            executable: false,
            rent_epoch: 0,
        },
    );

    let (banks_client, payer, recent_blockhash) = program_test.start().await;
    Ok((program_test, payer, program_id))
}

async fn create_token_account(
    banks_client: &mut BanksClient,
    payer: &Keypair,
    token_account: &Keypair,
    token_mint: &Pubkey,
    recent_blockhash: solana_sdk::hash::Hash,
) -> Result<(), TransportError> {
    let rent = banks_client.get_rent().await.unwrap();
    let rent_lamports = rent.minimum_balance(spl_token::state::Account::LEN);

    let create_account_ix = system_instruction::create_account(
        &payer.pubkey(),
        &token_account.pubkey(),
        rent_lamports,
        spl_token::state::Account::LEN as u64,
        &spl_token::id(),
    );

    let init_token_account_ix = spl_token::instruction::initialize_account(
        &spl_token::id(),
        &token_account.pubkey(),
        token_mint,
        &payer.pubkey(),
    ).unwrap();

    let transaction = Transaction::new_signed_with_payer(
        &[create_account_ix, init_token_account_ix],
        Some(&payer.pubkey()),
        &[payer, token_account],
        recent_blockhash,
    );

    banks_client.process_transaction(transaction).await
}

#[tokio::test]
async fn test_initialize_staking_pool() {
    let (program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let mut banks_client = program_test.start().await.0;
    let recent_blockhash = program_test.start().await.2;

    let staking_pool_account = Keypair::new();
    let staking_pool_pubkey = staking_pool_account.pubkey();

    let instruction_data = vec![0u8; 1]; // Instruction type 0 for initialize staking pool
    let accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(payer.pubkey(), true),
    ];

    let instruction = Instruction {
        program_id,
        accounts,
        data: instruction_data,
    };

    let transaction = Transaction::new_signed_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
        &[&payer, &staking_pool_account],
        recent_blockhash,
    );

    let result = banks_client.process_transaction(transaction).await;
    assert!(result.is_ok());

    let account_data = banks_client
        .get_account(staking_pool_pubkey)
        .await
        .unwrap()
        .unwrap()
        .data;

    let pool_state = RewardPool::deserialize(&account_data).unwrap();
    assert_eq!(pool_state.is_initialized, true);
    assert_eq!(pool_state.admin, payer.pubkey());
    assert_eq!(pool_state.total_staked, 0);
}

#[tokio::test]
async fn test_stake_tokens() {
    let (program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let mut banks_client = program_test.start().await.0;
    let recent_blockhash = program_test.start().await.2;

    let staking_pool_account = Keypair::new();
    let staking_pool_pubkey = staking_pool_account.pubkey();
    let user_staking_account = Keypair::new();
    let user_staking_pubkey = user_staking_account.pubkey();
    let token_mint = Pubkey::new_unique();
    let user_token_account = Keypair::new();

    // Initialize staking pool
    let init_pool_data = vec![0u8; 1]; // Instruction type 0 for initialize staking pool
    let init_pool_accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(payer.pubkey(), true),
    ];

    let init_pool_instruction = Instruction {
        program_id,
        accounts: init_pool_accounts,
        data: init_pool_data,
    };

    let init_pool_tx = Transaction::new_signed_with_payer(
        &[init_pool_instruction],
        Some(&payer.pubkey()),
        &[&payer, &staking_pool_account],
        recent_blockhash,
    );

    banks_client.process_transaction(init_pool_tx).await.unwrap();

    // Create token account for user
    create_token_account(
        &mut banks_client,
        &payer,
        &user_token_account,
        &token_mint,
        recent_blockhash,
    ).await.unwrap();

    // Stake tokens
    let stake_amount = 1000u64;
    let mut stake_data = vec![1u8; 1]; // Instruction type 1 for stake
    stake_data.extend_from_slice(&stake_amount.to_le_bytes());
    let stake_accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(user_staking_pubkey, false),
        AccountMeta::new(user_token_account.pubkey(), false),
        AccountMeta::new(payer.pubkey(), true),
    ];

    let stake_instruction = Instruction {
        program_id,
        accounts: stake_accounts,
        data: stake_data,
    };

    let stake_tx = Transaction::new_signed_with_payer(
        &[stake_instruction],
        Some(&payer.pubkey()),
        &[&payer, &user_staking_account],
        recent_blockhash,
    );

    let result = banks_client.process_transaction(stake_tx).await;
    assert!(result.is_ok());

    let staking_data = banks_client
        .get_account(user_staking_pubkey)
        .await
        .unwrap()
        .unwrap()
        .data;

    let staking_state = StakingAccount::deserialize(&staking_data).unwrap();
    assert_eq!(staking_state.amount, stake_amount);
    assert_eq!(staking_state.owner, payer.pubkey());

    let pool_data = banks_client
        .get_account(staking_pool_pubkey)
        .await
        .unwrap()
        .unwrap()
        .data;

    let pool_state = RewardPool::deserialize(&pool_data).unwrap();
    assert_eq!(pool_state.total_staked, stake_amount);
}

#[tokio::test]
async fn test_unstake_tokens() {
    let (program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let mut banks_client = program_test.start().await.0;
    let recent_blockhash = program_test.start().await.2;

    let staking_pool_account = Keypair::new();
    let staking_pool_pubkey = staking_pool_account.pubkey();
    let user_staking_account = Keypair::new();
    let user_staking_pubkey = user_staking_account.pubkey();
    let token_mint = Pubkey::new_unique();
    let user_token_account = Keypair::new();

    // Initialize staking pool
    let init_pool_data = vec![0u8; 1]; // Instruction type 0 for initialize staking pool
    let init_pool_accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(payer.pubkey(), true),
    ];

    let init_pool_instruction = Instruction {
        program_id,
        accounts: init_pool_accounts,
        data: init_pool_data,
    };

    let init_pool_tx = Transaction::new_signed_with_payer(
        &[init_pool_instruction],
        Some(&payer.pubkey()),
        &[&payer, &staking_pool_account],
        recent_blockhash,
    );

    banks_client.process_transaction(init_pool_tx).await.unwrap();

    // Create token account for user
    create_token_account(
        &mut banks_client,
        &payer,
        &user_token_account,
        &token_mint,
        recent_blockhash,
    ).await.unwrap();

    // Stake tokens
    let stake_amount = 1000u64;
    let mut stake_data = vec![1u8; 1]; // Instruction type 1 for stake
    stake_data.extend_from_slice(&stake_amount.to_le_bytes());
    let stake_accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(user_staking_pubkey, false),
        AccountMeta::new(user_token_account.pubkey(), false),
        AccountMeta::new(payer.pubkey(), true),
    ];

    let stake_instruction = Instruction {
        program_id,
        accounts: stake_accounts,
        data: stake_data,
    };

    let stake_tx = Transaction::new_signed_with_payer(
        &[stake_instruction],
        Some(&payer.pubkey()),
        &[&payer, &user_staking_account],
        recent_blockhash,
    );

    banks_client.process_transaction(stake_tx).await.unwrap();

    // Unstake tokens
    let unstake_amount = 500u64;
    let mut unstake_data = vec![2u8; 1]; // Instruction type 2 for unstake
    unstake_data.extend_from_slice(&unstake_amount.to_le_bytes());
    let unstake_accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(user_staking_pubkey, false),
        AccountMeta::new(user_token_account.pubkey(), false),
        AccountMeta::new(payer.pubkey(), true),
    ];

    let unstake_instruction = Instruction {
        program_id,
        accounts: unstake_accounts,
        data: unstake_data,
    };

    let unstake_tx = Transaction::new_signed_with_payer(
        &[unstake_instruction],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    let result = banks_client.process_transaction(unstake_tx).await;
    assert!(result.is_ok());

    let staking_data = banks_client
        .get_account(user_staking_pubkey)
        .await
        .unwrap()
        .unwrap()
        .data;

    let staking_state = StakingAccount::deserialize(&staking_data).unwrap();
    assert_eq!(staking_state.amount, stake_amount - unstake_amount);

    let pool_data = banks_client
        .get_account(staking_pool_pubkey)
        .await
        .unwrap()
        .unwrap()
        .data;

    let pool_state = RewardPool::deserialize(&pool_data).unwrap();
    assert_eq!(pool_state.total_staked, stake_amount - unstake_amount);
}

#[tokio::test]
async fn test_claim_rewards() {
    let (program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let mut banks_client = program_test.start().await.0;
    let recent_blockhash = program_test.start().await.2;

    let staking_pool_account = Keypair::new();
    let staking_pool_pubkey = staking_pool_account.pubkey();
    let user_staking_account = Keypair::new();
    let user_staking_pubkey = user_staking_account.pubkey();
    let token_mint = Pubkey::new_unique();
    let user_token_account = Keypair::new();

    // Initialize staking pool
    let init_pool_data = vec![0u8; 1]; // Instruction type 0 for initialize staking pool
    let init_pool_accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(payer.pubkey(), true),
    ];

    let init_pool_instruction = Instruction {
        program_id,
        accounts: init_pool_accounts,
        data: init_pool_data,
    };

    let init_pool_tx = Transaction::new_signed_with_payer(
        &[init_pool_instruction],
        Some(&payer.pubkey()),
        &[&payer, &staking_pool_account],
        recent_blockhash,
    );

    banks_client.process_transaction(init_pool_tx).await.unwrap();

    // Create token account for user
    create_token_account(
        &mut banks_client,
        &payer,
        &user_token_account,
        &token_mint,
        recent_blockhash,
    ).await.unwrap();

    // Stake tokens
    let stake_amount = 1000u64;
    let mut stake_data = vec![1u8; 1]; // Instruction type 1 for stake
    stake_data.extend_from_slice(&stake_amount.to_le_bytes());
    let stake_accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(user_staking_pubkey, false),
        AccountMeta::new(user_token_account.pubkey(), false),
        AccountMeta::new(payer.pubkey(), true),
    ];

    let stake_instruction = Instruction {
        program_id,
        accounts: stake_accounts,
        data: stake_data,
    };

    let stake_tx = Transaction::new_signed_with_payer(
        &[stake_instruction],
        Some(&payer.pubkey()),
        &[&payer, &user_staking_account],
        recent_blockhash,
    );

    banks_client.process_transaction(stake_tx).await.unwrap();

    // Claim rewards
    let claim_data = vec![3u8; 1]; // Instruction type 3 for claim rewards
    let claim_accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(user_staking_pubkey, false),
        AccountMeta::new(user_token_account.pubkey(), false),
        AccountMeta::new(payer.pubkey(), true),
    ];

    let claim_instruction = Instruction {
        program_id,
        accounts: claim_accounts,
        data: claim_data,
    };

    let claim_tx = Transaction::new_signed_with_payer(
        &[claim_instruction],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    let result = banks_client.process_transaction(claim_tx).await;
    assert!(result.is_ok());

    let staking_data = banks_client
        .get_account(user_staking_pubkey)
        .await
        .unwrap()
        .unwrap()
        .data;

    let staking_state = StakingAccount::deserialize(&staking_data).unwrap();
    assert_eq!(staking_state.pending_rewards, 0);
}

#[tokio::test]
async fn test_stake_zero_amount_edge_case() {
    let (program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let mut banks_client = program_test.start().await.0;
    let recent_blockhash = program_test.start().await.2;

    let staking_pool_account = Keypair::new();
    let staking_pool_pubkey = staking_pool_account.pubkey();
    let user_staking_account = Keypair::new();
    let user_staking_pubkey = user_staking_account.pubkey();
    let token_mint = Pubkey::new_unique();
    let user_token_account = Keypair::new();

    // Initialize staking pool
    let init_pool_data = vec![0u8; 1]; // Instruction type 0 for initialize staking pool
    let init_pool_accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(payer.pubkey(), true),
    ];

    let init_pool_instruction = Instruction {
        program_id,
        accounts: init_pool_accounts,
        data: init_pool_data,
    };

    let init_pool_tx = Transaction::new_signed_with_payer(
        &[init_pool_instruction],
        Some(&payer.pubkey()),
        &[&payer, &staking_pool_account],
        recent_blockhash,
    );

    banks_client.process_transaction(init_pool_tx).await.unwrap();

    // Create token account for user
    create_token_account(
        &mut banks_client,
        &payer,
        &user_token_account,
        &token_mint,
        recent_blockhash,
    ).await.unwrap();

    // Attempt to stake zero amount
    let stake_amount = 0u64;
    let mut stake_data = vec![1u8; 1]; // Instruction type 1 for stake
    stake_data.extend_from_slice(&stake_amount.to_le_bytes());
    let stake_accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(user_staking_pubkey, false),
        AccountMeta::new(user_token_account.pubkey(), false),
        AccountMeta::new(payer.pubkey(), true),
    ];

    let stake_instruction = Instruction {
        program_id,
        accounts: stake_accounts,
        data: stake_data,
    };

    let stake_tx = Transaction::new_signed_with_payer(
        &[stake_instruction],
        Some(&payer.pubkey()),
        &[&payer, &user_staking_account],
        recent_blockhash,
    );

    let result = banks_client.process_transaction(stake_tx).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_unstake_more_than_staked_edge_case() {
    let (program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let mut banks_client = program_test.start().await.0;
    let recent_blockhash = program_test.start().await.2;

    let staking_pool_account = Keypair::new();
    let staking_pool_pubkey = staking_pool_account.pubkey();
    let user_staking_account = Keypair::new();
    let user_staking_pubkey = user_staking_account.pubkey();
    let token_mint = Pubkey::new_unique();
    let user_token_account = Keypair::new();

    // Initialize staking pool
    let init_pool_data = vec![0u8; 1]; // Instruction type 0 for initialize staking pool
    let init_pool_accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(payer.pubkey(), true),
    ];

    let init_pool_instruction = Instruction {
        program_id,
        accounts: init_pool_accounts,
        data: init_pool_data,
    };

    let init_pool_tx = Transaction::new_signed_with_payer(
        &[init_pool_instruction],
        Some(&payer.pubkey()),
        &[&payer, &staking_pool_account],
        recent_blockhash,
    );

    banks_client.process_transaction(init_pool_tx).await.unwrap();

    // Create token account for user
    create_token_account(
        &mut banks_client,
        &payer,
        &user_token_account,
        &token_mint,
        recent_blockhash,
    ).await.unwrap();

    // Stake tokens
    let stake_amount = 1000u64;
    let mut stake_data = vec![1u8; 1]; // Instruction type 1 for stake
    stake_data.extend_from_slice(&stake_amount.to_le_bytes());
    let stake_accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(user_staking_pubkey, false),
        AccountMeta::new(user_token_account.pubkey(), false),
        AccountMeta::new(payer.pubkey(), true),
    ];

    let stake_instruction = Instruction {
        program_id,
        accounts: stake_accounts,
        data: stake_data,
    };

    let stake_tx = Transaction::new_signed_with_payer(
        &[stake_instruction],
        Some(&payer.pubkey()),
        &[&payer, &user_staking_account],
        recent_blockhash,
    );

    banks_client.process_transaction(stake_tx).await.unwrap();

    // Attempt to unstake more than staked
    let unstake_amount = 2000u64;
    let mut unstake_data = vec![2u8; 1]; // Instruction type 2 for unstake
    unstake_data.extend_from_slice(&unstake_amount.to_le_bytes());
    let unstake_accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(user_staking_pubkey, false),
        AccountMeta::new(user_token_account.pubkey(), false),
        AccountMeta::new(payer.pubkey(), true),
    ];

    let unstake_instruction = Instruction {
        program_id,
        accounts: unstake_accounts,
        data: unstake_data,
    };

    let unstake_tx = Transaction::new_signed_with_payer(
        &[unstake_instruction],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    let result = banks_client.process_transaction(unstake_tx).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_unauthorized_stake_access() {
    let (program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let mut banks_client = program_test.start().await.0;
    let recent_blockhash = program_test.start().await.2;

    let staking_pool_account = Keypair::new();
    let staking_pool_pubkey = staking_pool_account.pubkey();
    let user_staking_account = Keypair::new();
    let user_staking_pubkey = user_staking_account.pubkey();
    let token_mint = Pubkey::new_unique();
    let user_token_account = Keypair::new();
    let unauthorized_user = Keypair::new();

    // Initialize staking pool
    let init_pool_data = vec![0u8; 1]; // Instruction type 0 for initialize staking pool
    let init_pool_accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(payer.pubkey(), true),
    ];

    let init_pool_instruction = Instruction {
        program_id,
        accounts: init_pool_accounts,
        data: init_pool_data,
    };

    let init_pool_tx = Transaction::new_signed_with_payer(
        &[init_pool_instruction],
        Some(&payer.pubkey()),
        &[&payer, &staking_pool_account],
        recent_blockhash,
    );

    banks_client.process_transaction(init_pool_tx).await.unwrap();

    // Create token account for user
    create_token_account(
        &mut banks_client,
        &payer,
        &user_token_account,
        &token_mint,
        recent_blockhash,
    ).await.unwrap();

    // Attempt stake with unauthorized user
    let stake_amount = 1000u64;
    let mut stake_data = vec![1u8; 1]; // Instruction type 1 for stake
    stake_data.extend_from_slice(&stake_amount.to_le_bytes());
    let stake_accounts = vec![
        AccountMeta::new(staking_pool_pubkey, false),
        AccountMeta::new(user_staking_pubkey, false),
        AccountMeta::new(user_token_account.pubkey(), false),
        AccountMeta::new(unauthorized_user.pubkey(), true),
    ];

    let stake_instruction = Instruction {
        program_id,
        accounts: stake_accounts,
        data: stake_data,
    };

    let stake_tx = Transaction::new_signed_with_payer(
        &[stake_instruction],
        Some(&unauthorized_user.pubkey()),
        &[&unauthorized_user, &user_staking_account],
        recent_blockhash,
    );

    let result = banks_client.process_transaction(stake_tx).await;
    assert!(result.is_err());
}
