#[cfg(test)]
mod tests {
    // Import necessary testing utilities from Anchor.
    use anchor_lang::prelude::*;
    use anchor_lang::solana_program::clock::Clock;
    use anchor_lang::solana_program::system_program;
    use solana_sdk::signature::Keypair;
    use solana_sdk::signer::Signer;
    use solana_program_test::*;
    use solana_sdk::transport::TransportError;

    // Import the program to test (adjust based on your program name).
    use ontora_ai::program::NivaroAi; 
    use ontora_ai::state::{PlatformConfig, Proposal, UserStake};
    use ontora_ai::instructions::{initialize_platform, stake_tokens, create_proposal, cast_vote, finalize_proposal};

    // Define constants for testing.
    const PLATFORM_CONFIG_SEED: &[u8] = b"platform_config";
    const INITIAL_REWARD_RATE: u64 = 100; // Simplified reward rate for testing.
    const STAKE_AMOUNT: u64 = 1_000_000; // Simplified stake amount for testing (1M lamports).
    const VOTING_DURATION: u64 = 86_400; // 1 day in seconds for voting duration.

    // Helper function to set up the test environment.
    async fn setup_test_env() -> (ProgramTestContext, Keypair, Keypair) {
        let mut program_test = ProgramTest::new(
            "ontora_ai",
            ontora_ai::ID,
            processor!(OntoraAi::process_instruction),
        );

        // Start the test environment.
        let context = program_test.start_with_context().await;
        let payer = context.payer.clone();
        let authority = Keypair::new();

        // Return the context and keypairs for testing.
        (context, payer, authority)
    }

    // Test module for platform initialization.
    #[tokio::test]
    async fn test_initialize_platform() {
        let (mut context, payer, authority) = setup_test_env().await;

        // Derive the platform config PDA.
        let (platform_config_pda, platform_config_bump) = Pubkey::find_program_address(
            &[PLATFORM_CONFIG_SEED],
            &ontora_ai::ID,
        );

        // Call the initialize_platform instruction.
        let result = initialize_platform(
            &mut context,
            &payer,
            &authority,
            platform_config_pda,
            platform_config_bump,
            INITIAL_REWARD_RATE,
            true, // Governance enabled.
        ).await;

        // Assert the result is successful.
        assert!(result.is_ok(), "Platform initialization failed: {:?}", result.err());

        // Fetch the platform config account to verify initialization.
        let platform_config_account = context.banks_client
            .get_account(platform_config_pda)
            .await
            .expect("Failed to fetch platform config account")
            .expect("Platform config account not found");

        // Deserialize the account data.
        let platform_config_data = PlatformConfig::try_deserialize(&mut platform_config_account.data.as_ref())
            .expect("Failed to deserialize platform config");

        // Verify the initialized values.
        assert_eq!(platform_config_data.authority, authority.pubkey(), "Authority mismatch");
        assert_eq!(platform_config_data.reward_rate, INITIAL_REWARD_RATE, "Reward rate mismatch");
        assert!(platform_config_data.governance_enabled, "Governance should be enabled");
    }

    // Test module for staking tokens.
    #[tokio::test]
    async fn test_stake_tokens() {
        let (mut context, payer, authority) = setup_test_env().await;

        // Derive the platform config PDA.
        let (platform_config_pda, platform_config_bump) = Pubkey::find_program_address(
            &[PLATFORM_CONFIG_SEED],
            &ontora_ai::ID,
        );

        // Initialize the platform first.
        initialize_platform(
            &mut context,
            &payer,
            &authority,
            platform_config_pda,
            platform_config_bump,
            INITIAL_REWARD_RATE,
            true,
        ).await.unwrap();

        // Create a user keypair for staking.
        let user = Keypair::new();

        // Derive the user stake PDA.
        let (user_stake_pda, user_stake_bump) = Pubkey::find_program_address(
            &[b"user_stake", user.pubkey().as_ref()],
            &ontora_ai::ID,
        );

        // Call the stake_tokens instruction.
        let result = stake_tokens(
            &mut context,
            &payer,
            &user,
            platform_config_pda,
            user_stake_pda,
            user_stake_bump,
            STAKE_AMOUNT,
        ).await;

        // Assert the result is successful.
        assert!(result.is_ok(), "Staking tokens failed: {:?}", result.err());

        // Fetch the user stake account to verify staking.
        let user_stake_account = context.banks_client
            .get_account(user_stake_pda)
            .await
            .expect("Failed to fetch user stake account")
            .expect("User stake account not found");

        // Deserialize the account data.
        let user_stake_data = UserStake::try_deserialize(&mut user_stake_account.data.as_ref())
            .expect("Failed to deserialize user stake");

        // Verify the staked amount.
        assert_eq!(user_stake_data.user, user.pubkey(), "User pubkey mismatch");
        assert_eq!(user_stake_data.amount, STAKE_AMOUNT, "Staked amount mismatch");
    }

    // Test module for governance: creating a proposal.
    #[tokio::test]
    async fn test_create_proposal() {
        let (mut context, payer, authority) = setup_test_env().await;

        // Derive the platform config PDA.
        let (platform_config_pda, platform_config_bump) = Pubkey::find_program_address(
            &[PLATFORM_CONFIG_SEED],
            &ontora_ai::ID,
        );

        // Initialize the platform first.
        initialize_platform(
            &mut context,
            &payer,
            &authority,
            platform_config_pda,
            platform_config_bump,
            INITIAL_REWARD_RATE,
            true,
        ).await.unwrap();

        // Create a user keypair as the proposal creator.
        let creator = Keypair::new();

        // Derive the proposal PDA (proposal ID 0 since it's the first proposal).
        let proposal_id = 0;
        let (proposal_pda, proposal_bump) = Pubkey::find_program_address(
            &[b"proposal", proposal_id.to_le_bytes().as_ref()],
            &ontora_ai::ID,
        );

        // Call the create_proposal instruction.
        let title = "Test Proposal".to_string();
        let description = "A test proposal for Ontora AI governance.".to_string();
        let options = vec!["Yes".to_string(), "No".to_string()];
        let result = create_proposal(
            &mut context,
            &payer,
            &creator,
            platform_config_pda,
            proposal_pda,
            proposal_bump,
            title.clone(),
            description.clone(),
            VOTING_DURATION,
            options.clone(),
        ).await;

        // Assert the result is successful.
        assert!(result.is_ok(), "Creating proposal failed: {:?}", result.err());

        // Fetch the proposal account to verify creation.
        let proposal_account = context.banks_client
            .get_account(proposal_pda)
            .await
            .expect("Failed to fetch proposal account")
            .expect("Proposal account not found");

        // Deserialize the account data.
        let proposal_data = Proposal::try_deserialize(&mut proposal_account.data.as_ref())
            .expect("Failed to deserialize proposal");

        // Verify the proposal details.
        assert_eq!(proposal_data.id, proposal_id, "Proposal ID mismatch");
        assert_eq!(proposal_data.creator, creator.pubkey(), "Creator mismatch");
        assert_eq!(proposal_data.title, title, "Title mismatch");
        assert_eq!(proposal_data.options, options, "Options mismatch");
        assert_eq!(proposal_data.status, 0, "Proposal status should be active");
    }

    // Test module for governance: casting a vote.
    #[tokio::test]
    async fn test_cast_vote() {
        let (mut context, payer, authority) = setup_test_env().await;

        // Derive the platform config PDA.
        let (platform_config_pda, platform_config_bump) = Pubkey::find_program_address(
            &[PLATFORM_CONFIG_SEED],
            &ontora_ai::ID,
        );

        // Initialize the platform first.
        initialize_platform(
            &mut context,
            &payer,
            &authority,
            platform_config_pda,
            platform_config_bump,
            INITIAL_REWARD_RATE,
            true,
        ).await.unwrap();

        // Create a user keypair as the proposal creator.
        let creator = Keypair::new();
        let proposal_id = 0;
        let (proposal_pda, proposal_bump) = Pubkey::find_program_address(
            &[b"proposal", proposal_id.to_le_bytes().as_ref()],
            &ontora_ai::ID,
        );

        // Create a proposal.
        let title = "Test Proposal".to_string();
        let description = "A test proposal for Ontora AI governance.".to_string();
        let options = vec!["Yes".to_string(), "No".to_string()];
        create_proposal(
            &mut context,
            &payer,
            &creator,
            platform_config_pda,
            proposal_pda,
            proposal_bump,
            title,
            description,
            VOTING_DURATION,
            options,
        ).await.unwrap();

        // Create a voter keypair.
        let voter = Keypair::new();

        // Call the cast_vote instruction.
        let vote_option = 0; // Vote for "Yes".
        let result = cast_vote(
            &mut context,
            &payer,
            &voter,
            platform_config_pda,
            proposal_pda,
            proposal_id,
            vote_option,
        ).await;

        // Assert the result is successful.
        assert!(result.is_ok(), "Casting vote failed: {:?}", result.err());

        // Fetch the proposal account to verify the vote.
        let proposal_account = context.banks_client
            .get_account(proposal_pda)
            .await
            .expect("Failed to fetch proposal account")
            .expect("Proposal account not found");

        // Deserialize the account data.
        let proposal_data = Proposal::try_deserialize(&mut proposal_account.data.as_ref())
            .expect("Failed to deserialize proposal");

        // Verify the vote was recorded (assuming vote weight is 1).
        assert_eq!(proposal_data.votes[vote_option as usize], 1, "Vote count mismatch");
    }

    // Test module for governance: finalizing a proposal.
    #[tokio::test]
    async fn test_finalize_proposal() {
        let (mut context, payer, authority) = setup_test_env().await;

        // Derive the platform config PDA.
        let (platform_config_pda, platform_config_bump) = Pubkey::find_program_address(
            &[PLATFORM_CONFIG_SEED],
            &ontora_ai::ID,
        );

        // Initialize the platform first.
        initialize_platform(
            &mut context,
            &payer,
            &authority,
            platform_config_pda,
            platform_config_bump,
            INITIAL_REWARD_RATE,
            true,
        ).await.unwrap();

        // Create a user keypair as the proposal creator.
        let creator = Keypair::new();
        let proposal_id = 0;
        let (proposal_pda, proposal_bump) = Pubkey::find_program_address(
            &[b"proposal", proposal_id.to_le_bytes().as_ref()],
            &ontora_ai::ID,
        );

        // Create a proposal with a short voting duration for testing.
        let title = "Test Proposal".to_string();
        let description = "A test proposal for Ontora AI governance.".to_string();
        let options = vec!["Yes".to_string(), "No".to_string()];
        create_proposal(
            &mut context,
            &payer,
            &creator,
            platform_config_pda,
            proposal_pda,
            proposal_bump,
            title,
            description,
            10, // Very short duration for testing (10 seconds).
            options,
        ).await.unwrap();

        // Fast-forward the clock to simulate the end of the voting period.
        context.warp_to_slot(context.last_blockhash_slot + 100).unwrap();

        // Call the finalize_proposal instruction.
        let result = finalize_proposal(
            &mut context,
            &payer,
            &authority,
            platform_config_pda,
            proposal_pda,
            proposal_id,
        ).await;

        // Assert the result is successful.
        assert!(result.is_ok(), "Finalizing proposal failed: {:?}", result.err());

        // Fetch the proposal account to verify finalization.
        let proposal_account = context.banks_client
            .get_account(proposal_pda)
            .await
            .expect("Failed to fetch proposal account")
            .expect("Proposal account not found");

        // Deserialize the account data.
        let proposal_data = Proposal::try_deserialize(&mut proposal_account.data.as_ref())
            .expect("Failed to deserialize proposal");

        // Verify the proposal status (should be 2 = Rejected since no votes were cast with weight).
        assert_eq!(proposal_data.status, 2, "Proposal status should be rejected");
    }
}
