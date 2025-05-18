#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::prelude::*;
    use anchor_lang::solana_program::clock::Clock;
    use anchor_lang::solana_program::system_program;
    use std::cell::RefCell;
    use std::rc::Rc;

    // Mock program ID for testing
    declare_id!("TestPriceFeedProgram1111111111111111111111111111");

    // Mock Chainlink feed data structure for testing
    #[derive(Clone, Copy, Debug, Default, PartialEq)]
    struct MockChainlinkFeed {
        price: i64,
        decimals: u8,
        last_updated: i64,
    }

    // Mock context and state for testing
    struct TestContext {
        accounts: PriceFeedAccounts,
        clock: Clock,
        bumps: Bumps,
    }

    #[derive(Clone)]
    struct PriceFeedAccounts {
        price_feed: Rc<RefCell<PriceFeedData>>,
        authority: Pubkey,
        chainlink_feed: Pubkey,
        system_program: Pubkey,
    }

    #[derive(Clone, Copy)]
    struct Bumps {
        price_feed: u8,
    }

    // Mock PriceFeedData (must match the structure in price_feed.rs)
    #[account]
    #[derive(Default)]
    struct PriceFeedData {
        price: i64,
        decimals: u8,
        last_updated: i64,
        is_initialized: bool,
        update_authority: Pubkey,
    }

    // Test setup helper to create a fresh context
    fn setup_test_context() -> TestContext {
        let authority = Pubkey::new_unique();
        let chainlink_feed = Pubkey::new_unique();
        let price_feed_data = PriceFeedData {
            price: 0,
            decimals: 0,
            last_updated: 0,
            is_initialized: false,
            update_authority: authority,
        };

        let accounts = PriceFeedAccounts {
            price_feed: Rc::new(RefCell::new(price_feed_data)),
            authority,
            chainlink_feed,
            system_program: system_program::ID,
        };

        let clock = Clock {
            slot: 1,
            epoch_start_timestamp: 0,
            epoch: 0,
            leader_schedule_epoch: 0,
            unix_timestamp: 1630000000, // Mock timestamp
        };

        TestContext {
            accounts,
            clock,
            bumps: Bumps { price_feed: 0 },
        }
    }

    // Mock function to simulate fetching price from Chainlink feed
    fn mock_fetch_chainlink_price(feed: &Pubkey, price: i64, decimals: u8, timestamp: i64) -> MockChainlinkFeed {
        // In a real test, this would interact with Chainlink's Solana program
        // For now, return mock data
        MockChainlinkFeed {
            price,
            decimals,
            last_updated: timestamp,
        }
    }

    #[test]
    fn test_initialize_price_feed_success() {
        let mut ctx = setup_test_context();
        let description = "Test Price Feed".to_string();

        // Simulate initialization
        let result = initialize_price_feed(
            &mut ctx.accounts,
            &ctx.clock,
            ctx.bumps.price_feed,
            description.clone(),
        );

        assert!(result.is_ok());
        let price_feed = ctx.accounts.price_feed.borrow();
        assert!(price_feed.is_initialized);
        assert_eq!(price_feed.update_authority, ctx.accounts.authority);
        assert_eq!(price_feed.price, 0);
        assert_eq!(price_feed.decimals, 0);
        assert_eq!(price_feed.last_updated, ctx.clock.unix_timestamp);
    }

    #[test]
    fn test_initialize_price_feed_already_initialized() {
        let mut ctx = setup_test_context();
        let description = "Test Price Feed".to_string();

        // First initialization
        let result = initialize_price_feed(
            &mut ctx.accounts,
            &ctx.clock,
            ctx.bumps.price_feed,
            description.clone(),
        );
        assert!(result.is_ok());

        // Second initialization should fail
        let result = initialize_price_feed(
            &mut ctx.accounts,
            &ctx.clock,
            ctx.bumps.price_feed,
            description,
        );
        assert!(matches!(result, Err(ProgramError::Custom(_))));
    }

    #[test]
    fn test_update_price_feed_success() {
        let mut ctx = setup_test_context();
        let description = "Test Price Feed".to_string();
        let mock_price = 50000_00000000; // 50,000 with 8 decimals
        let mock_decimals = 8;
        let mock_timestamp = ctx.clock.unix_timestamp;

        // Initialize first
        let result = initialize_price_feed(
            &mut ctx.accounts,
            &ctx.clock,
            ctx.bumps.price_feed,
            description,
        );
        assert!(result.is_ok());

        // Update price feed
        let result = update_price_feed(
            &mut ctx.accounts,
            &ctx.clock,
            mock_price,
            mock_decimals,
            mock_timestamp,
        );
        assert!(result.is_ok());

        let price_feed = ctx.accounts.price_feed.borrow();
        assert_eq!(price_feed.price, mock_price);
        assert_eq!(price_feed.decimals, mock_decimals);
        assert_eq!(price_feed.last_updated, mock_timestamp);
    }

    #[test]
    fn test_update_price_feed_not_initialized() {
        let mut ctx = setup_test_context();
        let mock_price = 50000_00000000;
        let mock_decimals = 8;
        let mock_timestamp = ctx.clock.unix_timestamp;

        // Attempt update without initialization
        let result = update_price_feed(
            &mut ctx.accounts,
            &ctx.clock,
            mock_price,
            mock_decimals,
            mock_timestamp,
        );
        assert!(matches!(result, Err(ProgramError::Custom(_))));
    }

    #[test]
    fn test_update_price_feed_unauthorized() {
        let mut ctx = setup_test_context();
        let description = "Test Price Feed".to_string();
        let mock_price = 50000_00000000;
        let mock_decimals = 8;
        let mock_timestamp = ctx.clock.unix_timestamp;

        // Initialize first
        let result = initialize_price_feed(
            &mut ctx.accounts,
            &ctx.clock,
            ctx.bumps.price_feed,
            description,
        );
        assert!(result.is_ok());

        // Change authority to simulate unauthorized access
        let original_authority = ctx.accounts.authority;
        ctx.accounts.authority = Pubkey::new_unique();

        // Attempt update with wrong authority
        let result = update_price_feed(
            &mut ctx.accounts,
            &ctx.clock,
            mock_price,
            mock_decimals,
            mock_timestamp,
        );
        assert!(matches!(result, Err(ProgramError::Custom(_))));

        // Restore authority for cleanup or further tests if needed
        ctx.accounts.authority = original_authority;
    }

    #[test]
    fn test_update_price_feed_stale_data() {
        let mut ctx = setup_test_context();
        let description = "Test Price Feed".to_string();
        let mock_price = 50000_00000000;
        let mock_decimals = 8;
        let mock_timestamp = ctx.clock.unix_timestamp - 86400; // 24 hours ago

        // Initialize first
        let result = initialize_price_feed(
            &mut ctx.accounts,
            &ctx.clock,
            ctx.bumps.price_feed,
            description,
        );
        assert!(result.is_ok());

        // Attempt update with stale timestamp
        let result = update_price_feed(
            &mut ctx.accounts,
            &ctx.clock,
            mock_price,
            mock_decimals,
            mock_timestamp,
        );
        assert!(matches!(result, Err(ProgramError::Custom(_))));
    }

    #[test]
    fn test_get_latest_price_success() {
        let mut ctx = setup_test_context();
        let description = "Test Price Feed".to_string();
        let mock_price = 50000_00000000;
        let mock_decimals = 8;
        let mock_timestamp = ctx.clock.unix_timestamp;

        // Initialize and update
        let result = initialize_price_feed(
            &mut ctx.accounts,
            &ctx.clock,
            ctx.bumps.price_feed,
            description,
        );
        assert!(result.is_ok());

        let result = update_price_feed(
            &mut ctx.accounts,
            &ctx.clock,
            mock_price,
            mock_decimals,
            mock_timestamp,
        );
        assert!(result.is_ok());

        // Get latest price
        let price_result = get_latest_price(&ctx.accounts);
        assert!(price_result.is_ok());
        let (price, decimals) = price_result.unwrap();
        assert_eq!(price, mock_price);
        assert_eq!(decimals, mock_decimals);
    }

    #[test]
    fn test_get_latest_price_not_initialized() {
        let ctx = setup_test_context();

        // Attempt to get price without initialization
        let price_result = get_latest_price(&ctx.accounts);
        assert!(matches!(price_result, Err(ProgramError::Custom(_))));
    }

    // Mock implementations of program functions for testing
    // These should match the logic in price_feed.rs
    fn initialize_price_feed(
        accounts: &mut PriceFeedAccounts,
        clock: &Clock,
        _bump: u8,
        _description: String,
    ) -> Result<()> {
        let price_feed = &mut accounts.price_feed.borrow_mut();
        if price_feed.is_initialized {
            return Err(ProgramError::Custom(1001)); // Already initialized error
        }

        price_feed.is_initialized = true;
        price_feed.update_authority = accounts.authority;
        price_feed.last_updated = clock.unix_timestamp;
        Ok(())
    }

    fn update_price_feed(
        accounts: &mut PriceFeedAccounts,
        clock: &Clock,
        price: i64,
        decimals: u8,
        chainlink_timestamp: i64,
    ) -> Result<()> {
        let price_feed = &mut accounts.price_feed.borrow_mut();
        if !price_feed.is_initialized {
            return Err(ProgramError::Custom(1002)); // Not initialized error
        }
        if accounts.authority != price_feed.update_authority {
            return Err(ProgramError::Custom(1003)); // Unauthorized error
        }
        if chainlink_timestamp < clock.unix_timestamp - 3600 {
            return Err(ProgramError::Custom(1004)); // Stale data error
        }

        price_feed.price = price;
        price_feed.decimals = decimals;
        price_feed.last_updated = clock.unix_timestamp;
        Ok(())
    }

    fn get_latest_price(accounts: &PriceFeedAccounts) -> Result<(i64, u8)> {
        let price_feed = accounts.price_feed.borrow();
        if !price_feed.is_initialized {
            return Err(ProgramError::Custom(1002)); // Not initialized error
        }
        Ok((price_feed.price, price_feed.decimals))
    }
}
