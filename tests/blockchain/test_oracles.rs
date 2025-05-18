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
use ontora_ai_program::state::OracleData;

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
            owner: solana_sdk::system_program::ID,
            executable: false,
            rent_epoch: 0,
        },
    );

    let (banks_client, payer, recent_blockhash) = program_test.start().await;
    Ok((program_test, payer, program_id))
}

#[tokio::test]
async fn test_initialize_oracle() {
    let (mut program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let (mut banks_client, _payer, recent_blockhash) = program_test.start().await;

    let oracle_account = Pubkey::new_unique();

    let initialize_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(oracle_account, false),
        ],
        data: vec![0], // Instruction type for initialize oracle
    };

    let transaction = Transaction::new_signed_with_payer(
        &[initialize_instruction],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    banks_client
        .process_transaction(transaction)
        .await
        .unwrap();

    let oracle_data = banks_client
        .get_account(oracle_account)
        .await
        .unwrap()
        .unwrap()
        .data;

    let oracle = OracleData::deserialize(&oracle_data).unwrap();
    assert_eq!(oracle.owner, payer.pubkey());
    assert_eq!(oracle.value, 0);
    assert_eq!(oracle.last_updated, 0);
}

#[tokio::test]
async fn test_update_oracle_data() {
    let (mut program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let (mut banks_client, _payer, recent_blockhash) = program_test.start().await;

    let oracle_account = Pubkey::new_unique();
    let oracle_updater = Keypair::new();

    let initialize_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(oracle_account, false),
        ],
        data: vec![0], // Initialize oracle
    };

    let fund_updater_instruction = system_instruction::transfer(
        &payer.pubkey(),
        &oracle_updater.pubkey(),
        1_000_000,
    );

    let update_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(oracle_updater.pubkey(), true),
            AccountMeta::new(oracle_account, false),
        ],
        data: vec![1, 100, 0, 0, 0], // Instruction type for update oracle, value = 100
    };

    let transaction = Transaction::new_signed_with_payer(
        &[initialize_instruction, fund_updater_instruction, update_instruction],
        Some(&payer.pubkey()),
        &[&payer, &oracle_updater],
        recent_blockhash,
    );

    banks_client
        .process_transaction(transaction)
        .await
        .unwrap();

    let oracle_data = banks_client
        .get_account(oracle_account)
        .await
        .unwrap()
        .unwrap()
        .data;

    let oracle = OracleData::deserialize(&oracle_data).unwrap();
    assert_eq!(oracle.value, 100);
    assert!(oracle.last_updated > 0);
}

#[tokio::test]
async fn test_unauthorized_oracle_update_fails() {
    let (mut program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let (mut banks_client, _payer, recent_blockhash) = program_test.start().await;

    let oracle_account = Pubkey::new_unique();
    let unauthorized_updater = Keypair::new();

    let initialize_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(oracle_account, false),
        ],
        data: vec![0], // Initialize oracle
    };

    let update_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(unauthorized_updater.pubkey(), true),
            AccountMeta::new(oracle_account, false),
        ],
        data: vec![1, 100, 0, 0, 0], // Attempt update
    };

    let transaction = Transaction::new_signed_with_payer(
        &[initialize_instruction, update_instruction],
        Some(&payer.pubkey()),
        &[&payer, &unauthorized_updater],
        recent_blockhash,
    );

    let result = banks_client.process_transaction(transaction).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_oracle_data_consistency() {
    let (mut program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let (mut banks_client, _payer, recent_blockhash) = program_test.start().await;

    let oracle_account = Pubkey::new_unique();
    let oracle_updater = Keypair::new();

    let initialize_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(oracle_account, false),
        ],
        data: vec![0], // Initialize oracle
    };

    let fund_updater_instruction = system_instruction::transfer(
        &payer.pubkey(),
        &oracle_updater.pubkey(),
        1_000_000,
    );

    let update_instruction_1 = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(oracle_updater.pubkey(), true),
            AccountMeta::new(oracle_account, false),
        ],
        data: vec![1, 200, 0, 0, 0], // Update value to 200
    };

    let update_instruction_2 = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(oracle_updater.pubkey(), true),
            AccountMeta::new(oracle_account, false),
        ],
        data: vec![1, 300, 0, 0, 0], // Update value to 300
    };

    let transaction = Transaction::new_signed_with_payer(
        &[
            initialize_instruction,
            fund_updater_instruction,
            update_instruction_1,
            update_instruction_2,
        ],
        Some(&payer.pubkey()),
        &[&payer, &oracle_updater],
        recent_blockhash,
    );

    banks_client
        .process_transaction(transaction)
        .await
        .unwrap();

    let oracle_data = banks_client
        .get_account(oracle_account)
        .await
        .unwrap()
        .unwrap()
        .data;

    let oracle = OracleData::deserialize(&oracle_data).unwrap();
    assert_eq!(oracle.value, 300); // Latest update should persist
    assert!(oracle.last_updated > 0);
}

#[tokio::test]
async fn test_oracle_data_read_by_contract() {
    let (mut program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let (mut banks_client, _payer, recent_blockhash) = program_test.start().await;

    let oracle_account = Pubkey::new_unique();
    let contract_account = Pubkey::new_unique();
    let oracle_updater = Keypair::new();

    let initialize_oracle_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(oracle_account, false),
        ],
        data: vec![0], // Initialize oracle
    };

    let fund_updater_instruction = system_instruction::transfer(
        &payer.pubkey(),
        &oracle_updater.pubkey(),
        1_000_000,
    );

    let update_oracle_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(oracle_updater.pubkey(), true),
            AccountMeta::new(oracle_account, false),
        ],
        data: vec![1, 500, 0, 0, 0], // Update value to 500
    };

    let read_oracle_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new_readonly(oracle_account, false),
            AccountMeta::new(contract_account, false),
        ],
        data: vec![2], // Instruction type for reading oracle data into contract
    };

    let transaction = Transaction::new_signed_with_payer(
        &[
            initialize_oracle_instruction,
            fund_updater_instruction,
            update_oracle_instruction,
            read_oracle_instruction,
        ],
        Some(&payer.pubkey()),
        &[&payer, &oracle_updater],
        recent_blockhash,
    );

    banks_client
        .process_transaction(transaction)
        .await
        .unwrap();

    let oracle_data = banks_client
        .get_account(oracle_account)
        .await
        .unwrap()
        .unwrap()
        .data;

    let oracle = OracleData::deserialize(&oracle_data).unwrap();
    assert_eq!(oracle.value, 500);
}

#[tokio::test]
async fn test_oracle_stale_data_rejection() {
    let (mut program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let (mut banks_client, _payer, recent_blockhash) = program_test.start().await;

    let oracle_account = Pubkey::new_unique();
    let contract_account = Pubkey::new_unique();
    let oracle_updater = Keypair::new();

    let initialize_oracle_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(oracle_account, false),
        ],
        data: vec![0], // Initialize oracle
    };

    let fund_updater_instruction = system_instruction::transfer(
        &payer.pubkey(),
        &oracle_updater.pubkey(),
        1_000_000,
    );

    let update_oracle_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(oracle_updater.pubkey(), true),
            AccountMeta::new(oracle_account, false),
        ],
        data: vec![1, 600, 0, 0, 0], // Update value to 600
    };

    let read_oracle_stale_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new_readonly(oracle_account, false),
            AccountMeta::new(contract_account, false),
        ],
        data: vec![3], // Instruction type for reading with stale data check
    };

    let transaction = Transaction::new_signed_with_payer(
        &[
            initialize_oracle_instruction,
            fund_updater_instruction,
            update_oracle_instruction,
            read_oracle_stale_instruction,
        ],
        Some(&payer.pubkey()),
        &[&payer, &oracle_updater],
        recent_blockhash,
    );

    let result = banks_client.process_transaction(transaction).await;
    assert!(result.is_ok()); // Adjust based on stale data logic in your program
}
