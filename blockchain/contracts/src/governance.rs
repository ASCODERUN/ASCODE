use anchor_lang::prelude::*;
use crate::state::{PlatformConfig, Proposal, UserStake};
use crate::events::{ProposalCreated, VoteCast, ProposalFinalized};
use crate::error::OntoraError;

/// Context for creating a new governance proposal.
#[derive(Accounts)]
pub struct CreateProposal<'info> {
    /// The creator of the proposal, must have staked tokens to propose.
    #[account(mut)]
    pub creator: Signer<'info>,
    /// The platform configuration account to ensure governance is enabled.
    #[account(has_one = authority @ NivaroError::UnauthorizedAccess)]
    pub platform_config: Account<'info, PlatformConfig>,
    /// The proposal account to be initialized.
    #[account(
        init,
        payer = creator,
        space = Proposal::LEN,
        seeds = [b"proposal", platform_config.proposal_count.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    /// The system program for account initialization.
    pub system_program: Program<'info, System>,
}

impl<'info> CreateProposal<'info> {
    /// Validates that the creator has sufficient stake to create a proposal.
    pub fn validate(&self) -> Result<()> {
        // Check if governance is enabled in platform config.
        if !self.platform_config.governance_enabled {
            return err!(OntoraError::GovernanceDisabled);
        }
        // Placeholder for stake check (assumes a separate stake account or logic).
        // In a real implementation, check if creator has staked tokens.
        Ok(())
    }
}

/// Instruction to create a new governance proposal.
pub fn create_proposal(
    ctx: Context<CreateProposal>,
    title: String,
    description: String,
    voting_duration: u64,
    options: Vec<String>,
) -> Result<()> {
    // Validate the input and context.
    ctx.accounts.validate()?;

    // Ensure the title and description are within size limits.
    if title.len() > 100 || description.len() > 1000 {
        return err!(OntoraError::InvalidInput);
    }
    if options.len() < 2 || options.len() > 10 {
        return err!(OntoraError::InvalidVoteOptions);
    }

    let clock = Clock::get()?;
    let proposal = &mut ctx.accounts.proposal;
    let platform_config = &mut ctx.accounts.platform_config;

    // Initialize the proposal data.
    proposal.id = platform_config.proposal_count;
    proposal.creator = ctx.accounts.creator.key();
    proposal.title = title.clone();
    proposal.description = description;
    proposal.options = options.clone();
    proposal.votes = vec![0; options.len()];
    proposal.start_time = clock.unix_timestamp;
    proposal.end_time = clock.unix_timestamp + voting_duration as i64;
    proposal.status = 0; // 0 = Active
    proposal.bump = *ctx.bumps.get("proposal").unwrap();

    // Increment the proposal counter in platform config.
    platform_config.proposal_count += 1;

    // Emit an event for proposal creation.
    emit!(ProposalCreated {
        proposal_id: proposal.id,
        creator: proposal.creator,
        timestamp: clock.unix_timestamp,
        title,
        voting_duration,
    });

    Ok(())
}

/// Context for casting a vote on a proposal.
#[derive(Accounts)]
pub struct CastVote<'info> {
    /// The voter, must have staked tokens to vote.
    #[account(mut)]
    pub voter: Signer<'info>,
    /// The platform configuration account to ensure governance is enabled.
    #[account(has_one = authority @ OntoraError::UnauthorizedAccess)]
    pub platform_config: Account<'info, PlatformConfig>,
    /// The proposal account to vote on.
    #[account(mut, seeds = [b"proposal", proposal.id.to_le_bytes().as_ref()], bump = proposal.bump)]
    pub proposal: Account<'info, Proposal>,
    /// The user's stake account to determine voting power (optional placeholder).
    #[account(mut)]
    pub user_stake: Option<Account<'info, UserStake>>,
    /// The system program for account operations.
    pub system_program: Program<'info, System>,
}

impl<'info> CastVote<'info> {
    /// Validates that the voter can cast a vote.
    pub fn validate(&self) -> Result<()> {
        // Check if governance is enabled.
        if !self.platform_config.governance_enabled {
            return err!(OntoraError::GovernanceDisabled);
        }
        // Check if the proposal is active.
        let clock = Clock::get()?;
        if self.proposal.status != 0 || clock.unix_timestamp < self.proposal.start_time || clock.unix_timestamp > self.proposal.end_time {
            return err!(OntoraError::ProposalNotActive);
        }
        // Placeholder for checking if the voter has already voted.
        // In a real implementation, track votes per user to prevent double voting.
        Ok(())
    }
}

/// Instruction to cast a vote on a proposal.
pub fn cast_vote(
    ctx: Context<CastVote>,
    proposal_id: u64,
    vote_option: u8,
) -> Result<()> {
    // Validate the input and context.
    ctx.accounts.validate()?;

    let proposal = &mut ctx.accounts.proposal;
    // Ensure the proposal ID matches (redundant but for clarity).
    if proposal.id != proposal_id {
        return err!(OntoraError::InvalidProposal);
    }
    // Ensure the vote option is valid.
    if vote_option as usize >= proposal.options.len() {
        return err!(OntoraError::InvalidVoteOption);
    }

    let clock = Clock::get()?;
    // Calculate voting weight (placeholder logic).
    // In a real implementation, derive weight from staked amount in user_stake.
    let vote_weight = 1; // Simplified for now.

    // Record the vote.
    proposal.votes[vote_option as usize] += vote_weight;

    // Emit an event for vote casting.
    emit!(VoteCast {
        proposal_id,
        voter: ctx.accounts.voter.key(),
        timestamp: clock.unix_timestamp,
        vote_option,
        vote_weight: vote_weight as u64,
    });

    Ok(())
}

/// Context for finalizing a proposal after voting ends.
#[derive(Accounts)]
pub struct FinalizeProposal<'info> {
    /// The caller who finalizes the proposal (can be anyone since it's permissionless).
    #[account(mut)]
    pub caller: Signer<'info>,
    /// The platform configuration account to ensure governance is enabled.
    #[account(has_one = authority @ OntoraError::UnauthorizedAccess)]
    pub platform_config: Account<'info, PlatformConfig>,
    /// The proposal account to finalize.
    #[account(mut, seeds = [b"proposal", proposal.id.to_le_bytes().as_ref()], bump = proposal.bump)]
    pub proposal: Account<'info, Proposal>,
    /// The system program for account operations.
    pub system_program: Program<'info, System>,
}

impl<'info> FinalizeProposal<'info> {
    /// Validates that the proposal can be finalized.
    pub fn validate(&self) -> Result<()> {
        // Check if governance is enabled.
        if !self.platform_config.governance_enabled {
            return err!(OntoraError::GovernanceDisabled);
        }
        // Check if the proposal is still active and voting period has ended.
        let clock = Clock::get()?;
        if self.proposal.status != 0 {
            return err!(OntoraError::ProposalAlreadyFinalized);
        }
        if clock.unix_timestamp <= self.proposal.end_time {
            return err!(OntoraError::VotingPeriodNotEnded);
        }
        Ok(())
    }
}

/// Instruction to finalize a proposal and determine the result.
pub fn finalize_proposal(
    ctx: Context<FinalizeProposal>,
    proposal_id: u64,
) -> Result<()> {
    // Validate the input and context.
    ctx.accounts.validate()?;

    let proposal = &mut ctx.accounts.proposal;
    // Ensure the proposal ID matches.
    if proposal.id != proposal_id {
        return err!(OntoraError::InvalidProposal);
    }

    let clock = Clock::get()?;
    // Determine the winning option (highest votes).
    let mut max_votes = 0;
    let mut winning_option = 0;
    for (index, &votes) in proposal.votes.iter().enumerate() {
        if votes > max_votes {
            max_votes = votes;
            winning_option = index as u8;
        }
    }

    // Update proposal status (1 = Approved if there's a clear winner, 2 = Rejected if no votes or tied).
    proposal.status = if max_votes > 0 { 1 } else { 2 };

    // Serialize vote summary as a string for the event (simplified).
    let vote_summary = format!("{:?}", proposal.votes);

    // Emit an event for proposal finalization.
    emit!(ProposalFinalized {
        proposal_id,
        timestamp: clock.unix_timestamp,
        result: proposal.status,
        vote_summary,
    });

    // Optionally, trigger platform updates if the proposal is approved.
    // This is a placeholder; in a real implementation, apply changes based on proposal content.
    if proposal.status == 1 {
        msg!("Proposal {} approved with option {}", proposal_id, winning_option);
    }

    Ok(())
}
