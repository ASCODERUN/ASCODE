use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

// Declare the program ID for the smart contract
declare_id!("YourProgramIDHere"); // Replace with your actual program ID after deployment

// Constants for staking and rewards
const STAKING_COOLDOWN: i64 = 86400; // 24 hours in seconds for unstaking cooldown
const REWARD_RATE: u64 = 100; // Reward rate per epoch (adjustable)
const EPOCH_DURATION: i64 = 604800; // 7 days in seconds for reward epoch

// Custom error codes for the program
#[error_code]
pub enum OntoraError {
    #[msg("Insufficient stake amount")]
    InsufficientStake,
    #[msg("Staking cooldown not completed")]
    CooldownNotCompleted,
    #[msg("Invalid AI agent owner")]
    InvalidOwner,
    #[msg("Governance proposal already active")]
    ProposalActive,
    #[msg("Insufficient voting power")]
    InsufficientVotingPower,
    #[msg("Reward pool depleted")]
    RewardPoolDepleted,
}

// Account structure for an AI Agent
#[account]
pub struct AIAgent {
    pub owner: Pubkey, // Owner of the AI agent
    pub staked_amount: u64, // Amount of tokens staked
    pub last_stake_time: i64, // Timestamp of last staking action
    pub accumulated_rewards: u64, // Accumulated rewards for this agent
    pub is_active: bool, // Whether the agent is active
    pub bump: u8, // Bump seed for PDA derivation
}

// Account structure for Governance Proposal
#[account]
pub struct GovernanceProposal {
    pub proposer: Pubkey, // Who proposed this
    pub description: String, // Description of the proposal (limited length)
    pub yes_votes: u64, // Votes in favor
    pub no_votes: u64, // Votes against
    pub start_time: i64, // When voting started
    pub end_time: i64, // When voting ends
    pub is_active: bool, // Whether the proposal is active
    pub bump: u8, // Bump seed for PDA derivation
}

// Account structure for Reward Pool
#[account]
pub struct RewardPool {
    pub total_rewards: u64, // Total rewards available in the pool
    pub last_updated: i64, // Last time the pool was updated
    pub bump: u8, // Bump seed for PDA derivation
}

// Program entrypoint and instructions
#[program]
pub mod ontora_ai {
    use super::*;

    // Initialize the reward pool
    pub fn initialize_reward_pool(ctx: Context<InitializeRewardPool>, initial_rewards: u64) -> Result<()> {
        let reward_pool = &mut ctx.accounts.reward_pool;
        reward_pool.total_rewards = initial_rewards;
        reward_pool.last_updated = Clock::get()?.unix_timestamp;
        reward_pool.bump = ctx.bumps.reward_pool;
        Ok(())
    }

    // Register a new AI agent with staking
    pub fn register_ai_agent(ctx: Context<RegisterAIAgent>, stake_amount: u64) -> Result<()> {
        let ai_agent = &mut ctx.accounts.ai_agent;
        let token_program = &ctx.accounts.token_program;
        let user_token_account = &ctx.accounts.user_token_account;
        let staking_vault = &ctx.accounts.staking_vault;

        // Ensure stake amount is greater than zero
        require!(stake_amount > 0, OntoraError::InsufficientStake);

        // Transfer tokens from user to staking vault
        let cpi_accounts = Transfer {
            from: user_token_account.to_account_info(),
            to: staking_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, stake_amount)?;

        // Initialize AI agent data
        ai_agent.owner = ctx.accounts.user.key();
        ai_agent.staked_amount = stake_amount;
        ai_agent.last_stake_time = Clock::get()?.unix_timestamp;
        ai_agent.accumulated_rewards = 0;
        ai_agent.is_active = true;
        ai_agent.bump = ctx.bumps.ai_agent;

        Ok(())
    }

    // Unstake tokens from an AI agent
    pub fn unstake_ai_agent(ctx: Context<UnstakeAIAgent>) -> Result<()> {
        let ai_agent = &mut ctx.accounts.ai_agent;
        let token_program = &ctx.accounts.token_program;
        let user_token_account = &ctx.accounts.user_token_account;
        let staking_vault = &ctx.accounts.staking_vault;
        let current_time = Clock::get()?.unix_timestamp;

        // Check if cooldown period has passed
        require!(
            current_time >= ai_agent.last_stake_time + STAKING_COOLDOWN,
            OntoraError::CooldownNotCompleted
        );

        // Check if the caller is the owner
        require!(ai_agent.owner == ctx.accounts.user.key(), OntoraError::InvalidOwner);

        // Transfer staked tokens back to user
        let seeds = &[b"ai_agent", ai_agent.owner.as_ref(), &[ai_agent.bump]];
        let signer = &[&seeds[..]];
        let cpi_accounts = Transfer {
            from: staking_vault.to_account_info(),
            to: user_token_account.to_account_info(),
            authority: ai_agent.to_account_info(),
        };
        let cpi_program = token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, ai_agent.staked_amount)?;

        // Update AI agent state
        ai_agent.staked_amount = 0;
        ai_agent.is_active = false;
        ai_agent.last_stake_time = current_time;

        Ok(())
    }

    // Distribute rewards to AI agents
    pub fn distribute_rewards(ctx: Context<DistributeRewards>) -> Result<()> {
        let reward_pool = &mut ctx.accounts.reward_pool;
        let ai_agent = &mut ctx.accounts.ai_agent;
        let current_time = Clock::get()?.unix_timestamp;

        // Check if enough time has passed since last update (epoch duration)
        require!(
            current_time >= reward_pool.last_updated + EPOCH_DURATION,
            OntoraError::CooldownNotCompleted
        );

        // Calculate rewards based on staked amount and reward rate
        let reward = ai_agent.staked_amount * REWARD_RATE / 1000; // Example: 0.1% of staked amount per epoch
        require!(reward_pool.total_rewards >= reward, OntoraError::RewardPoolDepleted);

        // Update reward pool and agent rewards
        reward_pool.total_rewards -= reward;
        ai_agent.accumulated_rewards += reward;
        reward_pool.last_updated = current_time;

        Ok(())
    }

    // Claim accumulated rewards
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let ai_agent = &mut ctx.accounts.ai_agent;
        let token_program = &ctx.accounts.token_program;
        let user_token_account = &ctx.accounts.user_token_account;
        let reward_vault = &ctx.accounts.reward_vault;

        // Check if the caller is the owner
        require!(ai_agent.owner == ctx.accounts.user.key(), OntoraError::InvalidOwner);

        // Check if there are rewards to claim
        require!(ai_agent.accumulated_rewards > 0, OntoraError::RewardPoolDepleted);

        // Transfer rewards from vault to user
        let seeds = &[b"reward_vault", &[ctx.accounts.reward_pool.bump]];
        let signer = &[&seeds[..]];
        let cpi_accounts = Transfer {
            from: reward_vault.to_account_info(),
            to: user_token_account.to_account_info(),
            authority: ctx.accounts.reward_pool.to_account_info(),
        };
        let cpi_program = token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, ai_agent.accumulated_rewards)?;

        // Reset accumulated rewards
        ai_agent.accumulated_rewards = 0;

        Ok(())
    }

    // Create a governance proposal
    pub fn create_proposal(ctx: Context<CreateProposal>, description: String, duration: i64) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let current_time = Clock::get()?.unix_timestamp;

        // Ensure description is not empty and within length limits (e.g., 200 characters)
        require!(description.len() > 0 && description.len() <= 200, OntoraError::InvalidOwner);

        // Initialize proposal data
        proposal.proposer = ctx.accounts.user.key();
        proposal.description = description;
        proposal.yes_votes = 0;
        proposal.no_votes = 0;
        proposal.start_time = current_time;
        proposal.end_time = current_time + duration;
        proposal.is_active = true;
        proposal.bump = ctx.bumps.proposal;

        Ok(())
    }

    // Vote on a governance proposal
    pub fn vote_proposal(ctx: Context<VoteProposal>, in_favor: bool) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let ai_agent = &ctx.accounts.ai_agent;
        let current_time = Clock::get()?.unix_timestamp;

        // Ensure proposal is active and voting period is ongoing
        require!(proposal.is_active, OntoraError::ProposalActive);
        require!(current_time < proposal.end_time, OntoraError::ProposalActive);

        // Ensure voter is the owner of the AI agent
        require!(ai_agent.owner == ctx.accounts.user.key(), OntoraError::InvalidOwner);

        // Calculate voting power based on staked amount
        let voting_power = ai_agent.staked_amount / 100; // Example: 1 vote per 100 tokens staked
        require!(voting_power > 0, OntoraError::InsufficientVotingPower);

        // Record the vote
        if in_favor {
            proposal.yes_votes += voting_power;
        } else {
            proposal.no_votes += voting_power;
        }

        Ok(())
    }
}

// Context structs for instruction validation
#[derive(Accounts)]
pub struct InitializeRewardPool<'info> {
    #[account(init, payer = user, space = 8 + 16 + 8, seeds = [b"reward_pool"], bump)]
    pub reward_pool: Account<'info, RewardPool>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterAIAgent<'info> {
    #[account(init, payer = user, space = 8 + 32 + 8 + 8 + 8 + 1 + 1, seeds = [b"ai_agent", user.key().as_ref()], bump)]
    pub ai_agent: Account<'info, AIAgent>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub staking_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnstakeAIAgent<'info> {
    #[account(mut, has_one = owner @ OntoraError::InvalidOwner)]
    pub ai_agent: Account<'info, AIAgent>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub staking_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DistributeRewards<'info> {
    #[account(mut)]
    pub reward_pool: Account<'info, RewardPool>,
    #[account(mut)]
    pub ai_agent: Account<'info, AIAgent>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub ai_agent: Account<'info, AIAgent>,
    #[account(mut)]
    pub reward_pool: Account<'info, RewardPool>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub reward_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(init, payer = user, space = 8 + 32 + 200 + 8 + 8 + 8 + 8 + 1 + 1, seeds = [b"proposal", user.key().as_ref()], bump)]
    pub proposal: Account<'info, GovernanceProposal>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VoteProposal<'info> {
    #[account(mut)]
    pub proposal: Account<'info, GovernanceProposal>,
    #[account(has_one = owner @ OntoraError::InvalidOwner)]
    pub ai_agent: Account<'info, AIAgent>,
    #[account(mut)]
    pub user: Signer<'info>,
}
