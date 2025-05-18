use anchor_lang::prelude::*;
use chainlink_solana as chainlink;

// Declare the program ID (replace with your actual program ID during deployment)
declare_id!("YourProgramIdHere11111111111111111111111111111111");

// Constants for price feed configuration
const MAX_DESCRIPTION_LEN: usize = 32;
const STALE_PRICE_THRESHOLD: i64 = 3600; // 1 hour in seconds

#[program]
pub mod price_feed {
    use super::*;

    /// Initialize a new price feed account for a specific asset (e.g., SOL/USD)
    pub fn initialize_price_feed(
        ctx: Context<InitializePriceFeed>,
        feed_id: Pubkey, // Chainlink feed ID for the price data
        description: String,
    ) -> Result<()> {
        let price_feed = &mut ctx.accounts.price_feed;
        require!(
            description.len() <= MAX_DESCRIPTION_LEN,
            PriceFeedError::DescriptionTooLong
        );

        price_feed.feed_id = feed_id;
        price_feed.description = description;
        price_feed.price = 0;
        price_feed.decimals = 0;
        price_feed.last_updated = 0;
        price_feed.is_initialized = true;

        emit!(PriceFeedInitialized {
            feed_id,
            description: price_feed.description.clone(),
        });

        Ok(())
    }

    /// Update the price feed with the latest data from Chainlink oracle
    pub fn update_price_feed(ctx: Context<UpdatePriceFeed>) -> Result<()> {
        let price_feed = &mut ctx.accounts.price_feed;
        let chainlink_feed = &ctx.accounts.chainlink_feed;
        let chainlink_program = &ctx.accounts.chainlink_program;

        require!(
            price_feed.is_initialized,
            PriceFeedError::NotInitialized
        );
        require!(
            price_feed.feed_id == chainlink_feed.key(),
            PriceFeedError::InvalidFeedId
        );

        // Fetch the latest price data from Chainlink
        let price_data = chainlink::latest_round_data(
            chainlink_program.key(),
            chainlink_feed.key(),
        )?;

        let current_time = Clock::get()?.unix_timestamp;
        let updated_at = price_data.updated_at;
        require!(
            current_time - updated_at <= STALE_PRICE_THRESHOLD,
            PriceFeedError::StalePriceData
        );

        // Update the price feed account with the latest data
        price_feed.price = price_data.answer;
        price_feed.decimals = price_data.decimals;
        price_feed.last_updated = updated_at;

        emit!(PriceFeedUpdated {
            feed_id: price_feed.feed_id,
            price: price_feed.price,
            updated_at: price_feed.last_updated,
        });

        Ok(())
    }

    /// Read the current price from the price feed (view function, no state change)
    pub fn get_price(ctx: Context<GetPrice>) -> Result<i128> {
        let price_feed = &ctx.accounts.price_feed;
        require!(
            price_feed.is_initialized,
            PriceFeedError::NotInitialized
        );
        require!(
            Clock::get()?.unix_timestamp - price_feed.last_updated <= STALE_PRICE_THRESHOLD,
            PriceFeedError::StalePriceData
        );

        Ok(price_feed.price)
    }
}

#[derive(Accounts)]
pub struct InitializePriceFeed<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + std::mem::size_of::<PriceFeedData>(),
        seeds = [b"price_feed", authority.key().as_ref()],
        bump
    )]
    pub price_feed: Account<'info, PriceFeedData>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePriceFeed<'info> {
    #[account(mut, has_one = feed_id)]
    pub price_feed: Account<'info, PriceFeedData>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// Chainlink feed account (price data source)
    pub chainlink_feed: UncheckedAccount<'info>,

    /// Chainlink program (for CPI to fetch price data)
    pub chainlink_program: Program<'info, chainlink::program::Chainlink>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetPrice<'info> {
    #[account(has_one = feed_id)]
    pub price_feed: Account<'info, PriceFeedData>,
}

#[account]
#[derive(Default)]
pub struct PriceFeedData {
    /// Chainlink feed ID (public key of the Chainlink price feed)
    pub feed_id: Pubkey,

    /// Description of the price feed (e.g., "SOL/USD")
    pub description: String,

    /// Latest price value from the oracle (raw, unscaled)
    pub price: i128,

    /// Number of decimals for the price value
    pub decimals: u8,

    /// Timestamp when the price was last updated
    pub last_updated: i64,

    /// Flag to indicate if the price feed is initialized
    pub is_initialized: bool,
}

#[event]
pub struct PriceFeedInitialized {
    pub feed_id: Pubkey,
    pub description: String,
}

#[event]
pub struct PriceFeedUpdated {
    pub feed_id: Pubkey,
    pub price: i128,
    pub updated_at: i64,
}

#[error_code]
pub enum PriceFeedError {
    #[msg("Price feed is not initialized.")]
    NotInitialized,

    #[msg("Invalid Chainlink feed ID.")]
    InvalidFeedId,

    #[msg("Price data is stale.")]
    StalePriceData,

    #[msg("Description exceeds maximum length.")]
    DescriptionTooLong,
}
