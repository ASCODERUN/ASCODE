use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::ErrorCode;

// Initialize the platform configuration
#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(
        init,
        payer = admin,
        space = PlatformConfig::SPACE,
        seeds = [b"platform-config"],
        bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_platform(
    ctx: Context<InitializePlatform>,
    reward_rate_bps: u64,
    min_stake_amount: u64,
    epoch_duration: i64,
) -> Result<()> {
    let platform_config = &mut ctx.accounts.platform_config;
    let bump = ctx.bumps.platform_config;

    platform_config.init(
        ctx.accounts.admin.key(),
        reward_rate_bps,
        min_stake_amount,
        epoch_duration,
        bump,
    );

    msg!("Platform initialized with admin: {}", ctx.accounts.admin.key());
    Ok(())
}

// Update platform configuration (admin only)
#[derive(Accounts)]
pub struct UpdatePlatformConfig<'info> {
    #[account(
        mut,
        seeds = [b"platform-config"],
        bump = platform_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

pub fn update_platform_config(
    ctx: Context<UpdatePlatformConfig>,
    reward_rate_bps: u64,
    min_stake_amount: u64,
    epoch_duration: i64,
) -> Result<()> {
    let platform_config = &mut ctx.accounts.platform_config;

    platform_config.reward_rate_bps = reward_rate_bps;
    platform_config.min_stake_amount = min_stake_amount;
    platform_config.epoch_duration = epoch_duration;

    msg!("Platform config updated by admin: {}", ctx.accounts.admin.key());
    Ok(())
}

// Register a new AI agent
#[derive(Accounts)]
pub struct RegisterAiAgent<'info> {
    #[account(
        init,
        payer = owner,
        space = AiAgent::SPACE,
        seeds = [b"ai-agent", owner.key().as_ref(), &agent_id.to_le_bytes()],
        bump
    )]
    pub ai_agent: Account<'info, AiAgent>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn register_ai_agent(
    ctx: Context<RegisterAiAgent>,
    agent_id: u64,
    name: String,
    description: String,
) -> Result<()> {
    let ai_agent = &mut ctx.accounts.ai_agent;
    let bump = ctx.bumps.ai_agent;
    let clock = Clock::get()?;

    // Validate input lengths
    require!(name.len() <= MAX_NAME_LENGTH, ErrorCode::MetadataTooLarge);
    require!(description.len() <= MAX_DESCRIPTION_LENGTH, ErrorCode::MetadataTooLarge);

    ai_agent.init(
        agent_id,
        ctx.accounts.owner.key(),
        name,
        description,
        clock.unix_timestamp,
        bump,
    );

    msg!("AI Agent registered: ID {} by owner {}", agent_id, ctx.accounts.owner.key());
    Ok(())
}

// Stake tokens on an AI agent
#[derive(Accounts)]
pub struct StakeOnAgent<'info> {
    #[account(
        mut,
        seeds = [b"platform-config"],
        bump = platform_config.bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(
        mut,
        seeds = [b"ai-agent", user.key().as_ref(), &agent_id.to_le_bytes()],
        bump = ai_agent.bump,
        has_one = owner @ ErrorCode::Unauthorized
    )]
    pub ai_agent: Account<'info, AiAgent>,
    #[account(
        init_if_needed,
        payer = user,
        space = UserStake::SPACE,
        seeds = [b"user-stake", user.key().as_ref()],
        bump
    )]
    pub user_stake: Account<'info, UserStake>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub platform_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn stake_on_agent(
    ctx: Context<StakeOnAgent>,
    agent_id: u64,
    amount: u64,
) -> Result<()> {
    let platform_config = &mut ctx.accounts.platform_config;
    let ai_agent = &mut ctx.accounts.ai_agent;
    let user_stake = &mut ctx.accounts.user_stake;
    let clock = Clock::get()?;

    // Validate stake amount
    require!(amount >= platform_config.min_stake_amount, ErrorCode::InvalidStakeAmount);

    // Initialize user stake if newly created
    if user_stake.user == Pubkey::default() {
        user_stake.init(ctx.accounts.user.key(), ctx.bumps.user_stake);
    }

    // Add agent to user's staked agents list
    user_stake.add_staked_agent(agent_id)?;

    // Update stake amounts
    user_stake.staked_amount = user_stake.staked_amount.checked_add(amount).ok_or(ErrorCode::InvalidStakeAmount)?;
    ai_agent.staked_amount = ai_agent.staked_amount.checked_add(amount).ok_or(ErrorCode::InvalidStakeAmount)?;
    platform_config.total_staked = platform_config.total_staked.checked_add(amount).ok_or(ErrorCode::InvalidStakeAmount)?;

    // Update timestamps
    user_stake.last_stake_update = clock.unix_timestamp;

    // Transfer tokens from user to platform vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.platform_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    msg!("User {} staked {} on agent {}", ctx.accounts.user.key(), amount, agent_id);
    Ok(())
}

// Claim accumulated rewards
#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(
        mut,
        seeds = [b"platform-config"],
        bump = platform_config.bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(
        mut,
        seeds = [b"user-stake", user.key().as_ref()],
        bump = user_stake.bump,
        has_one = user @ ErrorCode::Unauthorized
    )]
    pub user_stake: Account<'info, UserStake>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub platform_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
    let platform_config = &mut ctx.accounts.platform_config;
    let user_stake = &mut ctx.accounts.user_stake;
    let clock = Clock::get()?;

    // Calculate elapsed epochs since last claim
    let elapsed_time = clock.unix_timestamp - user_stake.last_reward_claim;
    let elapsed_epochs = elapsed_time / platform_config.epoch_duration;
    if elapsed_epochs <= 0 {
        return err!(ErrorCode::NoRewardsToClaim);
    }

    // Calculate rewards based on staked amount and reward rate
    let reward_per_epoch = (user_stake.staked_amount as u128)
        .checked_mul(platform_config.reward_rate_bps as u128)
        .ok_or(ErrorCode::InvalidStakeAmount)?
        .checked_div(10000) // Convert basis points to percentage
        .ok_or(ErrorCode::InvalidStakeAmount)? as u64;
    let total_reward = reward_per_epoch
        .checked_mul(elapsed_epochs as u64)
        .ok_or(ErrorCode::InvalidStakeAmount)?;

    // Update accumulated rewards and reset claim timestamp
    user_stake.accumulated_rewards = user_stake.accumulated_rewards
        .checked_add(total_reward)
        .ok_or(ErrorCode::InvalidStakeAmount)?;
    let reward_to_claim = user_stake.accumulated_rewards;
    user_stake.accumulated_rewards = 0;
    user_stake.last_reward_claim = clock.unix_timestamp;

    // Transfer rewards from platform vault to user
    let cpi_accounts = Transfer {
        from: ctx.accounts.platform_vault.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.platform_vault.to_account_info(), // Assumes vault has delegated authority or program owns it
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, reward_to_claim)?;

    msg!("User {} claimed rewards: {}", ctx.accounts.user.key(), reward_to_claim);
    Ok(())
}

// Vote on governance proposals (e.g., update reward rates)
#[derive(Accounts)]
pub struct VoteOnProposal<'info> {
    #[account(
        mut,
        seeds = [b"platform-config"],
        bump = platform_config.bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(
        mut,
        seeds = [b"user-stake", voter.key().as_ref()],
        bump = user_stake.bump,
        has_one = voter @ ErrorCode::Unauthorized
    )]
    pub user_stake: Account<'info, UserStake>,
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(
        init_if_needed,
        payer = voter,
        space = Metadata::SPACE,
        seeds = [b"proposal-vote", &proposal_id.to_le_bytes(), voter.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, Metadata>,
    pub system_program: Program<'info, System>,
}

pub fn vote_on_proposal(
    ctx: Context<VoteOnProposal>,
    proposal_id: u64,
    in_favor: bool,
) -> Result<()> {
    let user_stake = &ctx.accounts.user_stake;
    let vote_record = &mut ctx.accounts.vote_record;
    let clock = Clock::get()?;

    // Ensure user has staked tokens to have voting power
    require!(user_stake.staked_amount > 0, ErrorCode::InvalidStakeAmount);

    // Record the vote (simplified as metadata)
    let vote_data = format!("Vote: {}", if in_favor { "Yes" } else { "No" });
    vote_record.init(
        proposal_id,
        vote_data,
        clock.unix_timestamp,
        ctx.bumps.vote_record,
    );

    msg!("User {} voted on proposal {}: {}", ctx.accounts.voter.key(), proposal_id, in_favor);
    Ok(())
}

// Custom error for reward claiming
#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized access.")]
    Unauthorized,
    #[msg("Invalid stake amount.")]
    InvalidStakeAmount,
    #[msg("Metadata data too large.")]
    MetadataTooLarge,
    #[msg("No rewards available to claim.")]
    NoRewardsToClaim,
}
