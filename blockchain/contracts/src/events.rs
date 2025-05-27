use anchor_lang::prelude::*;

/// Event definitions for on-chain logging and tracking of Nivaro AI platform activities.
/// These events are emitted during key contract operations to provide transparency and enable off-chain tracking.
#[event]
pub struct PlatformInitialized {
    /// The authority (admin) who initialized the platform.
    pub authority: Pubkey,
    /// The timestamp when the platform was initialized.
    pub timestamp: i64,
    /// Initial configuration parameters like reward rate (in basis points).
    pub initial_reward_rate: u64,
}

#[event]
pub struct PlatformUpdated {
    /// The authority (admin) who updated the platform configuration.
    pub authority: Pubkey,
    /// The timestamp when the update occurred.
    pub timestamp: i64,
    /// The new reward rate (in basis points) after the update.
    pub new_reward_rate: u64,
    /// Any additional metadata or notes about the update (e.g., reason or version).
    pub update_metadata: String,
}

#[event]
pub struct AgentRegistered {
    /// The unique ID of the AI agent.
    pub agent_id: u64,
    /// The owner of the AI agent.
    pub owner: Pubkey,
    /// The timestamp when the agent was registered.
    pub timestamp: i64,
    /// Metadata associated with the AI agent (e.g., name, description).
    pub metadata: String,
}

#[event]
pub struct AgentUpdated {
    /// The unique ID of the AI agent.
    pub agent_id: u64,
    /// The owner of the AI agent.
    pub owner: Pubkey,
    /// The timestamp when the agent was updated.
    pub timestamp: i64,
    /// Updated metadata for the AI agent.
    pub new_metadata: String,
}

#[event]
pub struct StakeDeposited {
    /// The user who deposited the stake.
    pub user: Pubkey,
    /// The unique ID of the AI agent staked on.
    pub agent_id: u64,
    /// The amount staked (in lamports or token units).
    pub amount: u64,
    /// The timestamp when the stake was deposited.
    pub timestamp: i64,
    /// The duration of the staking period (in seconds), if applicable.
    pub staking_duration: u64,
}

#[event]
pub struct StakeWithdrawn {
    /// The user who withdrew the stake.
    pub user: Pubkey,
    /// The unique ID of the AI agent staked on.
    pub agent_id: u64,
    /// The amount withdrawn (in lamports or token units).
    pub amount: u64,
    /// The timestamp when the stake was withdrawn.
    pub timestamp: i64,
}

#[event]
pub struct RewardClaimed {
    /// The user who claimed the reward.
    pub user: Pubkey,
    /// The unique ID of the AI agent associated with the reward.
    pub agent_id: u64,
    /// The amount of reward claimed (in lamports or token units).
    pub reward_amount: u64,
    /// The timestamp when the reward was claimed.
    pub timestamp: i64,
}

#[event]
pub struct ProposalCreated {
    /// The unique ID of the governance proposal.
    pub proposal_id: u64,
    /// The creator of the proposal.
    pub creator: Pubkey,
    /// The timestamp when the proposal was created.
    pub timestamp: i64,
    /// The title or short description of the proposal.
    pub title: String,
    /// The duration of the voting period (in seconds).
    pub voting_duration: u64,
}

#[event]
pub struct VoteCast {
    /// The unique ID of the governance proposal.
    pub proposal_id: u64,
    /// The user who cast the vote.
    pub voter: Pubkey,
    /// The timestamp when the vote was cast.
    pub timestamp: i64,
    /// The option chosen (e.g., 0 for No, 1 for Yes).
    pub vote_option: u8,
    /// The weight of the vote (based on staked amount or other criteria).
    pub vote_weight: u64,
}

#[event]
pub struct ProposalFinalized {
    /// The unique ID of the governance proposal.
    pub proposal_id: u64,
    /// The timestamp when the proposal was finalized.
    pub timestamp: i64,
    /// The result of the proposal (e.g., 0 for Rejected, 1 for Approved).
    pub result: u8,
    /// Total votes for each option (serialized as a string for simplicity).
    pub vote_summary: String,
}

#[event]
pub struct RewardDistributed {
    /// The authority or system account that triggered the distribution.
    pub authority: Pubkey,
    /// The timestamp when the reward distribution occurred.
    pub timestamp: i64,
    /// The total amount of rewards distributed (in lamports or token units).
    pub total_amount: u64,
    /// The number of eligible users or agents who received rewards.
    pub eligible_count: u64,
}
