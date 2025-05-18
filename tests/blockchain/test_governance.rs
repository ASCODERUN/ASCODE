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
use ontora_ai_program::state::{Governance, Proposal, Vote};

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
async fn test_initialize_governance() {
    let (mut program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let (mut banks_client, _payer, recent_blockhash) = program_test.start().await;

    let governance_key = Keypair::new();
    let governance_account = Pubkey::new_unique();

    let initialize_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(governance_account, false),
        ],
        data: vec![0], // Instruction type for initialize governance
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

    let governance_data = banks_client
        .get_account(governance_account)
        .await
        .unwrap()
        .unwrap()
        .data;

    let governance = Governance::deserialize(&governance_data).unwrap();
    assert_eq!(governance.admin, payer.pubkey());
    assert_eq!(governance.proposal_count, 0);
}

#[tokio::test]
async fn test_create_proposal() {
    let (mut program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let (mut banks_client, _payer, recent_blockhash) = program_test.start().await;

    let governance_account = Pubkey::new_unique();
    let proposal_account = Pubkey::new_unique();

    let initialize_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(governance_account, false),
        ],
        data: vec![0], // Initialize governance
    };

    let create_proposal_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(governance_account, false),
            AccountMeta::new(proposal_account, false),
        ],
        data: vec![1], // Instruction type for create proposal
    };

    let transaction = Transaction::new_signed_with_payer(
        &[initialize_instruction, create_proposal_instruction],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    banks_client
        .process_transaction(transaction)
        .await
        .unwrap();

    let proposal_data = banks_client
        .get_account(proposal_account)
        .await
        .unwrap()
        .unwrap()
        .data;

    let proposal = Proposal::deserialize(&proposal_data).unwrap();
    assert_eq!(proposal.creator, payer.pubkey());
    assert_eq!(proposal.votes_for, 0);
    assert_eq!(proposal.votes_against, 0);
    assert_eq!(proposal.is_active, true);
}

#[tokio::test]
async fn test_vote_on_proposal() {
    let (mut program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let (mut banks_client, _payer, recent_blockhash) = program_test.start().await;

    let governance_account = Pubkey::new_unique();
    let proposal_account = Pubkey::new_unique();
    let voter = Keypair::new();

    let initialize_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(governance_account, false),
        ],
        data: vec![0], // Initialize governance
    };

    let create_proposal_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(governance_account, false),
            AccountMeta::new(proposal_account, false),
        ],
        data: vec![1], // Create proposal
    };

    let fund_voter_instruction = system_instruction::transfer(
        &payer.pubkey(),
        &voter.pubkey(),
        1_000_000,
    );

    let vote_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(voter.pubkey(), true),
            AccountMeta::new(proposal_account, false),
        ],
        data: vec![2, 1], // Instruction type for vote, 1 for "vote for"
    };

    let transaction = Transaction::new_signed_with_payer(
        &[
            initialize_instruction,
            create_proposal_instruction,
            fund_voter_instruction,
            vote_instruction,
        ],
        Some(&payer.pubkey()),
        &[&payer, &voter],
        recent_blockhash,
    );

    banks_client
        .process_transaction(transaction)
        .await
        .unwrap();

    let proposal_data = banks_client
        .get_account(proposal_account)
        .await
        .unwrap()
        .unwrap()
        .data;

    let proposal = Proposal::deserialize(&proposal_data).unwrap();
    assert_eq!(proposal.votes_for, 1);
    assert_eq!(proposal.votes_against, 0);
}

#[tokio::test]
async fn test_execute_proposal() {
    let (mut program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let (mut banks_client, _payer, recent_blockhash) = program_test.start().await;

    let governance_account = Pubkey::new_unique();
    let proposal_account = Pubkey::new_unique();
    let voter = Keypair::new();

    let initialize_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(governance_account, false),
        ],
        data: vec![0], // Initialize governance
    };

    let create_proposal_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(governance_account, false),
            AccountMeta::new(proposal_account, false),
        ],
        data: vec![1], // Create proposal
    };

    let fund_voter_instruction = system_instruction::transfer(
        &payer.pubkey(),
        &voter.pubkey(),
        1_000_000,
    );

    let vote_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(voter.pubkey(), true),
            AccountMeta::new(proposal_account, false),
        ],
        data: vec![2, 1], // Vote for
    };

    let execute_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(proposal_account, false),
            AccountMeta::new(governance_account, false),
        ],
        data: vec![3], // Execute proposal
    };

    let transaction = Transaction::new_signed_with_payer(
        &[
            initialize_instruction,
            create_proposal_instruction,
            fund_voter_instruction,
            vote_instruction,
            execute_instruction,
        ],
        Some(&payer.pubkey()),
        &[&payer, &voter],
        recent_blockhash,
    );

    banks_client
        .process_transaction(transaction)
        .await
        .unwrap();

    let proposal_data = banks_client
        .get_account(proposal_account)
        .await
        .unwrap()
        .unwrap()
        .data;

    let proposal = Proposal::deserialize(&proposal_data).unwrap();
    assert_eq!(proposal.is_active, false);
    assert_eq!(proposal.executed, true);
}

#[tokio::test]
async fn test_unauthorized_vote_fails() {
    let (mut program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let (mut banks_client, _payer, recent_blockhash) = program_test.start().await;

    let governance_account = Pubkey::new_unique();
    let proposal_account = Pubkey::new_unique();
    let unauthorized_voter = Keypair::new();

    let initialize_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(governance_account, false),
        ],
        data: vec![0], // Initialize governance
    };

    let create_proposal_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(governance_account, false),
            AccountMeta::new(proposal_account, false),
        ],
        data: vec![1], // Create proposal
    };

    let vote_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(unauthorized_voter.pubkey(), true),
            AccountMeta::new(proposal_account, false),
        ],
        data: vec![2, 1], // Vote for
    };

    let transaction = Transaction::new_signed_with_payer(
        &[initialize_instruction, create_proposal_instruction, vote_instruction],
        Some(&payer.pubkey()),
        &[&payer, &unauthorized_voter],
        recent_blockhash,
    );

    let result = banks_client.process_transaction(transaction).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_double_vote_fails() {
    let (mut program_test, payer, program_id) = setup_test_environment().await.unwrap();
    let (mut banks_client, _payer, recent_blockhash) = program_test.start().await;

    let governance_account = Pubkey::new_unique();
    let proposal_account = Pubkey::new_unique();
    let voter = Keypair::new();

    let initialize_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(governance_account, false),
        ],
        data: vec![0], // Initialize governance
    };

    let create_proposal_instruction = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(governance_account, false),
            AccountMeta::new(proposal_account, false),
        ],
        data: vec![1], // Create proposal
    };

    let fund_voter_instruction = system_instruction::transfer(
        &payer.pubkey(),
        &voter.pubkey(),
        1_000_000,
    );

    let vote_instruction_1 = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(voter.pubkey(), true),
            AccountMeta::new(proposal_account, false),
        ],
        data: vec![2, 1], // Vote for
    };

    let vote_instruction_2 = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(voter.pubkey(), true),
            AccountMeta::new(proposal_account, false),
        ],
        data: vec![2, 1], // Vote for again
    };

    let transaction = Transaction::new_signed_with_payer(
        &[
            initialize_instruction,
            create_proposal_instruction,
            fund_voter_instruction,
            vote_instruction_1,
            vote_instruction_2,
        ],
        Some(&payer.pubkey()),
        &[&payer, &voter],
        recent_blockhash,
    );

    let result = banks_client.process_transaction(transaction).await;
    assert!(result.is_err());
}
