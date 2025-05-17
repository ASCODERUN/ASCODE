#[cfg(test)]
mod tests {
    use anchor_lang::prelude::*;
    use solana_program_test::*;
    use solana_sdk::{
        account::Account,
        clock::Clock,
        instruction::Instruction,
        pubkey::Pubkey,
        signature::Keypair,
        signer::Signer,
        system_instruction,
        transaction::Transaction,
    };
    use std::str::FromStr;

    // Import test setup utilities (assumed to be in a separate module)
    mod test_setup;
    use test_setup::{setup_test_environment, TestContext};

    // Placeholder for your program's ID (replace with actual program ID)
    const PROGRAM_ID: &str = "YourProgramIdHere1111111111111111111111111111";

    // Helper function to create a governance proposal (placeholder)
    async fn create_proposal(
        context: &mut ProgramTestContext,
        proposer: &Keypair,
        governance: &Pubkey,
        proposal_data: Vec<u8>,
    ) -> Result<Pubkey, BanksClientError> {
        let proposal_keypair = Keypair::new();
        let rent = context.banks_client.get_rent().await.unwrap();
        let space = 8 + 32 + 32 + 8 + proposal_data.len() as u64; // Adjust based on your proposal account structure
        let lamports = rent.minimum_balance(space as usize);

        // Create proposal account
        let create_account_ix = system_instruction::create_account(
            &proposer.pubkey(),
            &proposal_keypair.pubkey(),
            lamports,
            space,
            &Pubkey::from_str(PROGRAM_ID).unwrap(),
        );

        // Placeholder instruction for creating a proposal (replace with actual program instruction)
        let create_proposal_ix = Instruction {
            program_id: Pubkey::from_str(PROGRAM_ID).unwrap(),
            accounts: vec![],
            data: vec![], // Replace with actual serialized data for proposal creation
        };

        let tx = Transaction::new_signed_with_payer(
            &[create_account_ix, create_proposal_ix],
            Some(&proposer.pubkey()),
            &[proposer, &proposal_keypair],
            context.last_blockhash,
        );

        context.banks_client.process_transaction(tx).await?;
        Ok(proposal_keypair.pubkey())
    }

    // Helper function to cast a vote on a proposal (placeholder)
    async fn cast_vote(
        context: &mut ProgramTestContext,
        voter: &Keypair,
        proposal: &Pubkey,
        in_favor: bool,
    ) -> Result<(), BanksClientError> {
        // Placeholder instruction for voting (replace with actual program instruction)
        let vote_ix = Instruction {
            program_id: Pubkey::from_str(PROGRAM_ID).unwrap(),
            accounts: vec![],
            data: vec![], // Replace with actual serialized data for voting
        };

        let tx = Transaction::new_signed_with_payer(
            &[vote_ix],
            Some(&voter.pubkey()),
            &[voter],
            context.last_blockhash,
        );

        context.banks_client.process_transaction(tx).await
    }

    // Helper function to execute a proposal (placeholder)
    async fn execute_proposal(
        context: &mut ProgramTestContext,
        executor: &Keypair,
        proposal: &Pubkey,
    ) -> Result<(), BanksClientError> {
        // Placeholder instruction for executing a proposal (replace with actual program instruction)
        let execute_ix = Instruction {
            program_id: Pubkey::from_str(PROGRAM_ID).unwrap(),
            accounts: vec![],
            data: vec![], // Replace with actual serialized data for execution
        };

        let tx = Transaction::new_signed_with_payer(
            &[execute_ix],
            Some(&executor.pubkey()),
            &[executor],
            context.last_blockhash,
        );

        context.banks_client.process_transaction(tx).await
    }

    #[tokio::test]
    async fn test_create_proposal_success() {
        let mut test_context = setup_test_environment().await;
        let proposer = Keypair::new();
        let governance = Keypair::new().pubkey();

        // Fund the proposer account
        test_context.fund_account(&proposer.pubkey(), 10_000_000_000).await;

        // Create a proposal
        let proposal_data = vec![1, 2, 3]; // Dummy data for proposal
        let proposal_pubkey = create_proposal(
            &mut test_context.context,
            &proposer,
            &governance,
            proposal_data,
        )
        .await
        .unwrap();

        // Verify the proposal account exists
        let proposal_account = test_context
            .context
            .banks_client
            .get_account(proposal_pubkey)
            .await
            .unwrap()
            .unwrap();

        assert_eq!(proposal_account.owner, Pubkey::from_str(PROGRAM_ID).unwrap());
    }

    #[tokio::test]
    async fn test_create_proposal_insufficient_funds() {
        let mut test_context = setup_test_environment().await;
        let proposer = Keypair::new();
        let governance = Keypair::new().pubkey();

        // Do not fund the proposer account to simulate insufficient funds
        let result = create_proposal(
            &mut test_context.context,
            &proposer,
            &governance,
            vec![1, 2, 3],
        )
        .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_cast_vote_success() {
        let mut test_context = setup_test_environment().await;
        let proposer = Keypair::new();
        let voter = Keypair::new();
        let governance = Keypair::new().pubkey();

        // Fund accounts
        test_context.fund_account(&proposer.pubkey(), 10_000_000_000).await;
        test_context.fund_account(&voter.pubkey(), 10_000_000_000).await;

        // Create a proposal
        let proposal_pubkey = create_proposal(
            &mut test_context.context,
            &proposer,
            &governance,
            vec![1, 2, 3],
        )
        .await
        .unwrap();

        // Cast a vote
        let result = cast_vote(&mut test_context.context, &voter, &proposal_pubkey, true).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_cast_vote_unauthorized_voter() {
        let mut test_context = setup_test_environment().await;
        let proposer = Keypair::new();
        let unauthorized_voter = Keypair::new();
        let governance = Keypair::new().pubkey();

        // Fund only proposer
        test_context.fund_account(&proposer.pubkey(), 10_000_000_000).await;

        // Create a proposal
        let proposal_pubkey = create_proposal(
            &mut test_context.context,
            &proposer,
            &governance,
            vec![1, 2, 3],
        )
        .await
        .unwrap();

        // Attempt to vote with unauthorized voter (logic depends on program constraints)
        let result = cast_vote(
            &mut test_context.context,
            &unauthorized_voter,
            &proposal_pubkey,
            true,
        )
        .await;

        // Expect failure if program enforces voter authorization
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_execute_proposal_success() {
        let mut test_context = setup_test_environment().await;
        let proposer = Keypair::new();
        let executor = Keypair::new();
        let governance = Keypair::new().pubkey();

        // Fund accounts
        test_context.fund_account(&proposer.pubkey(), 10_000_000_000).await;
        test_context.fund_account(&executor.pubkey(), 10_000_000_000).await;

        // Create a proposal
        let proposal_pubkey = create_proposal(
            &mut test_context.context,
            &proposer,
            &governance,
            vec![1, 2, 3],
        )
        .await
        .unwrap();

        // Execute the proposal
        let result = execute_proposal(&mut test_context.context, &executor, &proposal_pubkey).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_execute_proposal_not_passed() {
        let mut test_context = setup_test_environment().await;
        let proposer = Keypair::new();
        let executor = Keypair::new();
        let governance = Keypair::new().pubkey();

        // Fund accounts
        test_context.fund_account(&proposer.pubkey(), 10_000_000_000).await;
        test_context.fund_account(&executor.pubkey(), 10_000_000_000).await;

        // Create a proposal
        let proposal_pubkey = create_proposal(
            &mut test_context.context,
            &proposer,
            &governance,
            vec![1, 2, 3],
        )
        .await
        .unwrap();

        // Attempt to execute before voting or passing (logic depends on program)
        let result = execute_proposal(&mut test_context.context, &executor, &proposal_pubkey).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_execute_proposal_unauthorized_executor() {
        let mut test_context = setup_test_environment().await;
        let proposer = Keypair::new();
        let unauthorized_executor = Keypair::new();
        let governance = Keypair::new().pubkey();

        // Fund only proposer
        test_context.fund_account(&proposer.pubkey(), 10_000_000_000).await;

        // Create a proposal
        let proposal_pubkey = create_proposal(
            &mut test_context.context,
            &proposer,
            &governance,
            vec![1, 2, 3],
        )
        .await
        .unwrap();

        // Attempt to execute with unauthorized executor
        let result = execute_proposal(
            &mut test_context.context,
            &unauthorized_executor,
            &proposal_pubkey,
        )
        .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_proposal_voting_period_expired() {
        let mut test_context = setup_test_environment().await;
        let proposer = Keypair::new();
        let voter = Keypair::new();
        let governance = Keypair::new().pubkey();

        // Fund accounts
        test_context.fund_account(&proposer.pubkey(), 10_000_000_000).await;
        test_context.fund_account(&voter.pubkey(), 10_000_000_000).await;

        // Create a proposal
        let proposal_pubkey = create_proposal(
            &mut test_context.context,
            &proposer,
            &governance,
            vec![1, 2, 3],
        )
        .await
        .unwrap();

        // Fast-forward clock to simulate expired voting period (adjust based on program logic)
        test_context.warp_to_slot(100_000).await;

        // Attempt to vote after expiration
        let result = cast_vote(&mut test_context.context, &voter, &proposal_pubkey, true).await;
        assert!(result.is_err());
    }
}
