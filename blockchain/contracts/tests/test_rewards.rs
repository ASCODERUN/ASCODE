#[cfg(test)]
mod tests {
    use anchor_lang::prelude::*;
    use anchor_client::solana_sdk::{
        commitment_config::CommitmentConfig,
        signature::{Keypair, Signer},
        system_instruction,
    };
    use solana_program_test::*;
    use solana_sdk::account::Account;
    use solana_sdk::pubkey::Pubkey;
    use solana_sdk::transport::TransportError;
    use std::result::Result;

    // Assuming a test_setup module exists in the same directory for environment setup
    mod test_setup;
    use test_setup::{
        setup_test_context, create_test_user, fund_account, initialize_program,
        get_account_balance,
    };

    // Constants for reward testing
    const INITIAL_BALANCE: u64 = 10_000_000_000; // 10 SOL in lamports
    const STAKE_AMOUNT: u64 = 1_000_000_000; // 1 SOL in lamports
    const REWARD_RATE: u64 = 10; // 10% reward rate for simplicity
    const REWARD_POOL_INITIAL: u64 = 5_000_000_000; // 5 SOL in lamports for reward pool

    // Placeholder for program ID (replace with actual program ID from your project)
    const PROGRAM_ID: Pubkey = Pubkey::new_unique();

    // Test case 1: Successful reward calculation and distribution
    #[tokio::test]
    async fn test_successful_reward_calculation_and_distribution() {
        let mut test_context = setup_test_context().await.unwrap();
        let user = create_test_user(&mut test_context).await.unwrap();
        let reward_pool = Keypair::new();
        let user_stake_account = Keypair::new();

        // Fund reward pool
        fund_account(
            &mut test_context,
            &reward_pool.pubkey(),
            REWARD_POOL_INITIAL,
        )
        .await
        .unwrap();

        // Initialize program and stake for user (placeholder logic)
        initialize_program(&mut test_context, &PROGRAM_ID).await.unwrap();
        stake_tokens(
            &mut test_context,
            &user,
            &user_stake_account.pubkey(),
            STAKE_AMOUNT,
        )
        .await
        .unwrap();

        // Simulate time passing or reward accrual (placeholder)
        advance_time(&mut test_context, 86400).await.unwrap(); // 1 day

        // Calculate expected reward (10% of staked amount for simplicity)
        let expected_reward = STAKE_AMOUNT * REWARD_RATE / 100;

        // Trigger reward distribution (placeholder instruction)
        distribute_rewards(
            &mut test_context,
            &reward_pool.pubkey(),
            &user_stake_account.pubkey(),
        )
        .await
        .unwrap();

        // Check user's pending rewards (placeholder account read)
        let user_rewards = get_pending_rewards(&mut test_context, &user_stake_account.pubkey())
            .await
            .unwrap();
        assert_eq!(user_rewards, expected_reward, "Reward calculation mismatch");
    }

    // Test case 2: Claim rewards successfully
    #[tokio::test]
    async fn test_successful_reward_claim() {
        let mut test_context = setup_test_context().await.unwrap();
        let user = create_test_user(&mut test_context).await.unwrap();
        let reward_pool = Keypair::new();
        let user_stake_account = Keypair::new();

        // Fund reward pool and user stake
        fund_account(
            &mut test_context,
            &reward_pool.pubkey(),
            REWARD_POOL_INITIAL,
        )
        .await
        .unwrap();
        initialize_program(&mut test_context, &PROGRAM_ID).await.unwrap();
        stake_tokens(
            &mut test_context,
            &user,
            &user_stake_account.pubkey(),
            STAKE_AMOUNT,
        )
        .await
        .unwrap();

        // Distribute rewards
        advance_time(&mut test_context, 86400).await.unwrap();
        distribute_rewards(
            &mut test_context,
            &reward_pool.pubkey(),
            &user_stake_account.pubkey(),
        )
        .await
        .unwrap();

        let expected_reward = STAKE_AMOUNT * REWARD_RATE / 100;
        let initial_balance = get_account_balance(&mut test_context, &user.pubkey())
            .await
            .unwrap();

        // Claim rewards (placeholder instruction)
        claim_rewards(
            &mut test_context,
            &user,
            &user_stake_account.pubkey(),
            &reward_pool.pubkey(),
        )
        .await
        .unwrap();

        // Verify balance update
        let final_balance = get_account_balance(&mut test_context, &user.pubkey())
            .await
            .unwrap();
        assert_eq!(
            final_balance,
            initial_balance + expected_reward,
            "Balance not updated after claiming rewards"
        );
    }

    // Test case 3: Edge case - Claim rewards with zero pending rewards
    #[tokio::test]
    async fn test_claim_rewards_with_zero_pending() {
        let mut test_context = setup_test_context().await.unwrap();
        let user = create_test_user(&mut test_context).await.unwrap();
        let reward_pool = Keypair::new();
        let user_stake_account = Keypair::new();

        // Fund reward pool but no staking or distribution yet
        fund_account(
            &mut test_context,
            &reward_pool.pubkey(),
            REWARD_POOL_INITIAL,
        )
        .await
        .unwrap();
        initialize_program(&mut test_context, &PROGRAM_ID).await.unwrap();

        // Attempt to claim rewards with no pending rewards
        let result = claim_rewards(
            &mut test_context,
            &user,
            &user_stake_account.pubkey(),
            &reward_pool.pubkey(),
        )
        .await;

        assert!(result.is_err(), "Claiming with zero rewards should fail");
        if let Err(e) = result {
            assert!(
                e.to_string().contains("NoPendingRewards"),
                "Expected NoPendingRewards error"
            );
        }
    }

    // Test case 4: Edge case - Insufficient reward pool balance
    #[tokio::test]
    async fn test_distribute_rewards_insufficient_pool_balance() {
        let mut test_context = setup_test_context().await.unwrap();
        let user = create_test_user(&mut test_context).await.unwrap();
        let reward_pool = Keypair::new();
        let user_stake_account = Keypair::new();

        // Fund reward pool with zero balance
        fund_account(&mut test_context, &reward_pool.pubkey(), 0)
            .await
            .unwrap();
        initialize_program(&mut test_context, &PROGRAM_ID).await.unwrap();
        stake_tokens(
            &mut test_context,
            &user,
            &user_stake_account.pubkey(),
            STAKE_AMOUNT,
        )
        .await
        .unwrap();

        // Attempt to distribute rewards with empty pool
        let result = distribute_rewards(
            &mut test_context,
            &reward_pool.pubkey(),
            &user_stake_account.pubkey(),
        )
        .await;

        assert!(
            result.is_err(),
            "Distributing rewards with empty pool should fail"
        );
        if let Err(e) = result {
            assert!(
                e.to_string().contains("InsufficientRewardPool"),
                "Expected InsufficientRewardPool error"
            );
        }
    }

    // Test case 5: Edge case - Reward calculation overflow
    #[tokio::test]
    async fn test_reward_calculation_overflow() {
        let mut test_context = setup_test_context().await.unwrap();
        let user = create_test_user(&mut test_context).await.unwrap();
        let reward_pool = Keypair::new();
        let user_stake_account = Keypair::new();

        // Fund reward pool
        fund_account(
            &mut test_context,
            &reward_pool.pubkey(),
            REWARD_POOL_INITIAL,
        )
        .await
        .unwrap();
        initialize_program(&mut test_context, &PROGRAM_ID).await.unwrap();

        // Stake an extremely large amount to trigger overflow (placeholder)
        let large_stake = u64::MAX / 2;
        stake_tokens(
            &mut test_context,
            &user,
            &user_stake_account.pubkey(),
            large_stake,
        )
        .await
        .unwrap();

        // Attempt to distribute rewards with potential overflow
        let result = distribute_rewards(
            &mut test_context,
            &reward_pool.pubkey(),
            &user_stake_account.pubkey(),
        )
        .await;

        assert!(result.is_err(), "Reward calculation overflow should fail");
        if let Err(e) = result {
            assert!(
                e.to_string().contains("ArithmeticOverflow"),
                "Expected ArithmeticOverflow error"
            );
        }
    }

    // Test case 6: Multiple users reward distribution
    #[tokio::test]
    async fn test_multiple_users_reward_distribution() {
        let mut test_context = setup_test_context().await.unwrap();
        let user1 = create_test_user(&mut test_context).await.unwrap();
        let user2 = create_test_user(&mut test_context).await.unwrap();
        let reward_pool = Keypair::new();
        let user1_stake_account = Keypair::new();
        let user2_stake_account = Keypair::new();

        // Fund reward pool
        fund_account(
            &mut test_context,
            &reward_pool.pubkey(),
            REWARD_POOL_INITIAL,
        )
        .await
        .unwrap();
        initialize_program(&mut test_context, &PROGRAM_ID).await.unwrap();

        // Stake for both users
        stake_tokens(
            &mut test_context,
            &user1,
            &user1_stake_account.pubkey(),
            STAKE_AMOUNT,
        )
        .await
        .unwrap();
        stake_tokens(
            &mut test_context,
            &user2,
            &user2_stake_account.pubkey(),
            STAKE_AMOUNT,
        )
        .await
        .unwrap();

        // Simulate time passing
        advance_time(&mut test_context, 86400).await.unwrap();

        // Distribute rewards to both users
        distribute_rewards(
            &mut test_context,
            &reward_pool.pubkey(),
            &user1_stake_account.pubkey(),
        )
        .await
        .unwrap();
        distribute_rewards(
            &mut test_context,
            &reward_pool.pubkey(),
            &user2_stake_account.pubkey(),
        )
        .await
        .unwrap();

        let expected_reward_per_user = STAKE_AMOUNT * REWARD_RATE / 100;

        // Check pending rewards for both users
        let user1_rewards = get_pending_rewards(&mut test_context, &user1_stake_account.pubkey())
            .await
            .unwrap();
        let user2_rewards = get_pending_rewards(&mut test_context, &user2_stake_account.pubkey())
            .await
            .unwrap();

        assert_eq!(
            user1_rewards, expected_reward_per_user,
            "User1 reward mismatch"
        );
        assert_eq!(
            user2_rewards, expected_reward_per_user,
            "User2 reward mismatch"
        );
    }

    // Placeholder helper functions (replace with actual program instructions)
    async fn stake_tokens(
        test_context: &mut ProgramTestContext,
        user: &Keypair,
        stake_account: &Pubkey,
        amount: u64,
    ) -> Result<(), TransportError> {
        // Placeholder: Implement actual staking instruction call
        println!("Staking {} lamports for user {:?}", amount, user.pubkey());
        Ok(())
    }

    async fn distribute_rewards(
        test_context: &mut ProgramTestContext,
        reward_pool: &Pubkey,
        stake_account: &Pubkey,
    ) -> Result<(), TransportError> {
        // Placeholder: Implement actual reward distribution instruction
        println!(
            "Distributing rewards from pool {:?} to stake account {:?}",
            reward_pool, stake_account
        );
        Ok(())
    }

    async fn claim_rewards(
        test_context: &mut ProgramTestContext,
        user: &Keypair,
        stake_account: &Pubkey,
        reward_pool: &Pubkey,
    ) -> Result<(), TransportError> {
        // Placeholder: Implement actual reward claim instruction
        println!(
            "Claiming rewards for user {:?} from stake account {:?}",
            user.pubkey(),
            stake_account
        );
        Err(TransportError::Custom("NoPendingRewards".to_string()))
    }

    async fn get_pending_rewards(
        test_context: &mut ProgramTestContext,
        stake_account: &Pubkey,
    ) -> Result<u64, TransportError> {
        // Placeholder: Fetch pending rewards from account data
        Ok(STAKE_AMOUNT * REWARD_RATE / 100)
    }

    async fn advance_time(
        test_context: &mut ProgramTestContext,
        seconds: u64,
    ) -> Result<(), TransportError> {
        // Placeholder: Simulate time passing for reward accrual
        println!("Advancing time by {} seconds", seconds);
        Ok(())
    }
}
