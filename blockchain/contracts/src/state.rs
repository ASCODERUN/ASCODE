use anchor_lang::prelude::*;

// Constants for maximum sizes to prevent excessive memory allocation
pub const MAX_NAME_LENGTH: usize = 32;
pub const MAX_DESCRIPTION_LENGTH: usize = 256;
pub const MAX_AGENTS_PER_USER: usize = 10;

// Global configuration account for the Nivaro AI platform
#[account]
#[derive(Default)]
pub struct PlatformConfig {
    // Platform administrator (can update settings)
    pub admin: Pubkey,
    // Reward rate per epoch (in basis points, e.g., 100 = 1%)
    pub reward_rate_bps: u64,
    // Minimum stake required to participate (in lamports or token units)
    pub min_stake_amount: u64,
    // Epoch duration in seconds (e.g., 86400 for 1 day)
    pub epoch_duration: i64,
    // Timestamp of the last reward distribution
    pub last_reward_timestamp: i64,
    // Total staked amount across the platform
    pub total_staked: u64,
    // Bump seed for PDA derivation
    pub bump: u8,
}

impl PlatformConfig {
    // Initialize the platform configuration with default values
    pub fn init(&mut self, admin: Pubkey, reward_rate_bps: u64, min_stake_amount: u64, epoch_duration: i64, bump: u8) {
        self.admin = admin;
        self.reward_rate_bps = reward_rate_bps;
        self.min_stake_amount = min_stake_amount;
        self.epoch_duration = epoch_duration;
        self.last_reward_timestamp = 0;
        self.total_staked = 0;
        self.bump = bump;
    }

    // Calculate space required for the account
    pub const SPACE: usize = 8 + // discriminator
        32 + // admin (Pubkey)
        8 + // reward_rate_bps (u64)
        8 + // min_stake_amount (u64)
        8 + // epoch_duration (i64)
        8 + // last_reward_timestamp (i64)
        8 + // total_staked (u64)
        1; // bump (u8)
}

// AI Agent data structure to store agent-specific information
#[account]
#[derive(Default)]
pub struct AiAgent {
    // Unique identifier for the agent
    pub agent_id: u64,
    // Owner of the agent (user who registered it)
    pub owner: Pubkey,
    // Name of the AI agent (e.g., "Ontora-Alpha")
    pub name: String,
    // Description or metadata about the agent's purpose
    pub description: String,
    // Total amount staked on this agent
    pub staked_amount: u64,
    // Performance score (e.g., based on accuracy or tasks completed)
    pub performance_score: u64,
    // Timestamp when the agent was registered
    pub created_at: i64,
    // Bump seed for PDA derivation
    pub bump: u8,
}

impl AiAgent {
    // Initialize a new AI agent with provided data
    pub fn init(&mut self, agent_id: u64, owner: Pubkey, name: String, description: String, created_at: i64, bump: u8) {
        self.agent_id = agent_id;
        self.owner = owner;
        self.name = name;
        self.description = description;
        self.staked_amount = 0;
        self.performance_score = 0;
        self.created_at = created_at;
        self.bump = bump;
    }

    // Calculate space required for the account
    pub const SPACE: usize = 8 + // discriminator
        8 + // agent_id (u64)
        32 + // owner (Pubkey)
        4 + MAX_NAME_LENGTH + // name (String with max length)
        4 + MAX_DESCRIPTION_LENGTH + // description (String with max length)
        8 + // staked_amount (u64)
        8 + // performance_score (u64)
        8 + // created_at (i64)
        1; // bump (u8)
}

// User staking data to track individual user balances and rewards
#[account]
#[derive(Default)]
pub struct UserStake {
    // User public key (owner of this stake)
    pub user: Pubkey,
    // Total amount staked by the user
    pub staked_amount: u64,
    // Accumulated rewards (unclaimed)
    pub accumulated_rewards: u64,
    // List of agent IDs the user has staked on
    pub staked_agents: Vec<u64>,
    // Timestamp of the last stake update
    pub last_stake_update: i64,
    // Timestamp of the last reward claim
    pub last_reward_claim: i64,
    // Bump seed for PDA derivation
    pub bump: u8,
}

impl UserStake {
    // Initialize a new user stake account
    pub fn init(&mut self, user: Pubkey, bump: u8) {
        self.user = user;
        self.staked_amount = 0;
        self.accumulated_rewards = 0;
        self.staked_agents = Vec::new();
        self.last_stake_update = 0;
        self.last_reward_claim = 0;
        self.bump = bump;
    }

    // Add an agent ID to the user's staked agents list
    pub fn add_staked_agent(&mut self, agent_id: u64) -> Result<()> {
        if self.staked_agents.len() >= MAX_AGENTS_PER_USER {
            return err!(ErrorCode::TooManyAgents);
        }
        if !self.staked_agents.contains(&agent_id) {
            self.staked_agents.push(agent_id);
        }
        Ok(())
    }

    // Remove an agent ID from the user's staked agents list
    pub fn remove_staked_agent(&mut self, agent_id: u64) {
        self.staked_agents.retain(|&id| id != agent_id);
    }

    // Calculate space required for the account
    pub const SPACE: usize = 8 + // discriminator
        32 + // user (Pubkey)
        8 + // staked_amount (u64)
        8 + // accumulated_rewards (u64)
        4 + (8 * MAX_AGENTS_PER_USER) + // staked_agents (Vec<u64> with max length)
        8 + // last_stake_update (i64)
        8 + // last_reward_claim (i64)
        1; // bump (u8)
}

// Metadata account for additional platform or agent-specific data
#[account]
#[derive(Default)]
pub struct Metadata {
    // Associated entity (e.g., agent ID or platform-wide metadata)
    pub entity_id: u64,
    // Key-value pair or JSON-like data (stored as string)
    pub data: String,
    // Timestamp of last update
    pub updated_at: i64,
    // Bump seed for PDA derivation
    pub bump: u8,
}

impl Metadata {
    // Initialize metadata with provided data
    pub fn init(&mut self, entity_id: u64, data: String, updated_at: i64, bump: u8) {
        self.entity_id = entity_id;
        self.data = data;
        self.updated_at = updated_at;
        self.bump = bump;
    }

    // Calculate space required for the account
    pub const SPACE: usize = 8 + // discriminator
        8 + // entity_id (u64)
        4 + MAX_DESCRIPTION_LENGTH + // data (String with max length)
        8 + // updated_at (i64)
        1; // bump (u8)
}

// Custom error codes for state management
#[error_code]
pub enum ErrorCode {
    #[msg("Too many agents staked by user.")]
    TooManyAgents,
    #[msg("Invalid stake amount.")]
    InvalidStakeAmount,
    #[msg("Metadata data too large.")]
    MetadataTooLarge,
}
