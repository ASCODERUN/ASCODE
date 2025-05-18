use anchor_lang::prelude::*;

declare_id!("YourProgramIdHere11111111111111111111111111111111");

// Constants for AI data feed configuration
const MAX_DATA_SIZE: usize = 1024; // Maximum size for inference data payload (1KB)
const MAX_METADATA_SIZE: usize = 128; // Maximum size for metadata (e.g., model version)
const MAX_DESCRIPTION_SIZE: usize = 64; // Maximum size for description

#[program]
pub mod ai_data_feed {
    use super::*;

    /// Initialize a new AI data feed for a specific user or AI agent
    pub fn initialize_data_feed(
        ctx: Context<InitializeDataFeed>,
        description: String,
        metadata: String,
    ) -> Result<()> {
        let data_feed = &mut ctx.accounts.data_feed;
        require!(
            description.len() <= MAX_DESCRIPTION_SIZE,
            AiDataFeedError::DescriptionTooLong
        );
        require!(
            metadata.len() <= MAX_METADATA_SIZE,
            AiDataFeedError::MetadataTooLong
        );

        data_feed.owner = ctx.accounts.authority.key();
        data_feed.description = description;
        data_feed.metadata = metadata;
        data_feed.data = Vec::new();
        data_feed.last_updated = Clock::get()?.unix_timestamp;
        data_feed.is_initialized = true;
        data_feed.update_authority = ctx.accounts.authority.key();

        emit!(DataFeedInitialized {
            feed_id: data_feed.key(),
            owner: data_feed.owner,
            description: data_feed.description.clone(),
        });

        Ok(())
    }

    /// Update the AI data feed with new inference data
    pub fn update_data_feed(
        ctx: Context<UpdateDataFeed>,
        data: Vec<u8>,
        metadata: String,
    ) -> Result<()> {
        let data_feed = &mut ctx.accounts.data_feed;
        require!(
            data_feed.is_initialized,
            AiDataFeedError::NotInitialized
        );
        require!(
            ctx.accounts.authority.key() == data_feed.update_authority,
            AiDataFeedError::Unauthorized
        );
        require!(data.len() <= MAX_DATA_SIZE, AiDataFeedError::DataTooLarge);
        require!(
            metadata.len() <= MAX_METADATA_SIZE,
            AiDataFeedError::MetadataTooLong
        );

        data_feed.data = data;
        data_feed.metadata = metadata;
        data_feed.last_updated = Clock::get()?.unix_timestamp;

        emit!(DataFeedUpdated {
            feed_id: data_feed.key(),
            owner: data_feed.owner,
            data_size: data_feed.data.len() as u64,
            last_updated: data_feed.last_updated,
        });

        Ok(())
    }

    /// Transfer update authority to a new account
    pub fn transfer_update_authority(
        ctx: Context<TransferUpdateAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let data_feed = &mut ctx.accounts.data_feed;
        require!(
            data_feed.is_initialized,
            AiDataFeedError::NotInitialized
        );
        require!(
            ctx.accounts.authority.key() == data_feed.owner
                || ctx.accounts.authority.key() == data_feed.update_authority,
            AiDataFeedError::Unauthorized
        );
        require!(
            new_authority != Pubkey::default(),
            AiDataFeedError::InvalidAuthority
        );

        data_feed.update_authority = new_authority;

        emit!(UpdateAuthorityTransferred {
            feed_id: data_feed.key(),
            old_authority: ctx.accounts.authority.key(),
            new_authority,
        });

        Ok(())
    }

    /// Retrieve the latest AI inference data (view function, no state change)
    pub fn get_data_feed(ctx: Context<GetDataFeed>) -> Result<Vec<u8>> {
        let data_feed = &ctx.accounts.data_feed;
        require!(
            data_feed.is_initialized,
            AiDataFeedError::NotInitialized
        );

        Ok(data_feed.data.clone())
    }
}

#[derive(Accounts)]
pub struct InitializeDataFeed<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + std::mem::size_of::<AiDataFeedData>() + MAX_DATA_SIZE + MAX_METADATA_SIZE + MAX_DESCRIPTION_SIZE,
        seeds = [b"ai_data_feed", authority.key().as_ref()],
        bump
    )]
    pub data_feed: Account<'info, AiDataFeedData>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateDataFeed<'info> {
    #[account(mut)]
    pub data_feed: Account<'info, AiDataFeedData>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferUpdateAuthority<'info> {
    #[account(mut)]
    pub data_feed: Account<'info, AiDataFeedData>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetDataFeed<'info> {
    pub data_feed: Account<'info, AiDataFeedData>,
}

#[account]
#[derive(Default)]
pub struct AiDataFeedData {
    /// Owner of the data feed (initial authority)
    pub owner: Pubkey,

    /// Authority allowed to update the data feed
    pub update_authority: Pubkey,

    /// Description of the data feed (e.g., "Ontora AI Agent #123")
    pub description: String,

    /// Metadata about the AI model or inference (e.g., model version, timestamp)
    pub metadata: String,

    /// Raw AI inference data (e.g., serialized prediction or behavior data)
    pub data: Vec<u8>,

    /// Timestamp of the last update
    pub last_updated: i64,

    /// Flag to indicate if the data feed is initialized
    pub is_initialized: bool,
}

#[event]
pub struct DataFeedInitialized {
    pub feed_id: Pubkey,
    pub owner: Pubkey,
    pub description: String,
}

#[event]
pub struct DataFeedUpdated {
    pub feed_id: Pubkey,
    pub owner: Pubkey,
    pub data_size: u64,
    pub last_updated: i64,
}

#[event]
pub struct UpdateAuthorityTransferred {
    pub feed_id: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[error_code]
pub enum AiDataFeedError {
    #[msg("Data feed is not initialized.")]
    NotInitialized,

    #[msg("Unauthorized access to update or modify data feed.")]
    Unauthorized,

    #[msg("Inference data exceeds maximum size.")]
    DataTooLarge,

    #[msg("Metadata exceeds maximum size.")]
    MetadataTooLong,

    #[msg("Description exceeds maximum size.")]
    DescriptionTooLong,

    #[msg("Invalid authority provided.")]
    InvalidAuthority,
}
