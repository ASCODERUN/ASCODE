use anchor_lang::prelude::*;

/// Custom error types for the Nivaro AI platform.
/// Each error has a unique code and a descriptive message for debugging and user feedback.
#[error_code]
pub enum OntoraError {
    /// Error when the platform is already initialized.
    #[msg("Platform is already initialized.")]
    AlreadyInitialized = 100,

    /// Error when the platform has not been initialized yet.
    #[msg("Platform has not been initialized.")]
    NotInitialized = 101,

    /// Error when the provided authority does not match the expected admin.
    #[msg("Unauthorized: Caller is not the admin.")]
    UnauthorizedAdmin = 102,

    /// Error when the provided user does not have the required permissions.
    #[msg("Unauthorized: Caller does not have required permissions.")]
    UnauthorizedUser = 103,

    /// Error when an AI agent is already registered with the given ID.
    #[msg("AI agent is already registered with this ID.")]
    AgentAlreadyRegistered = 200,

    /// Error when an AI agent is not found for the given ID.
    #[msg("AI agent not found for the given ID.")]
    AgentNotFound = 201,

    /// Error when the AI agent's metadata is invalid or incomplete.
    #[msg("Invalid AI agent metadata provided.")]
    InvalidAgentMetadata = 202,

    /// Error when the stake amount is zero or negative.
    #[msg("Stake amount must be greater than zero.")]
    InvalidStakeAmount = 300,

    /// Error when the user has insufficient balance to stake.
    #[msg("Insufficient balance to stake the specified amount.")]
    InsufficientBalance = 301,

    /// Error when the user stake account is not found.
    #[msg("User stake account not found.")]
    StakeAccountNotFound = 302,

    /// Error when the user has no staked amount to claim rewards for.
    #[msg("No staked amount available to claim rewards.")]
    NoStakeToClaim = 303,

    /// Error when the reward calculation fails or results in zero.
    #[msg("No rewards available to claim at this time.")]
    NoRewardsAvailable = 304,

    /// Error when the token transfer fails during staking or reward claiming.
    #[msg("Token transfer failed.")]
    TokenTransferFailed = 305,

    /// Error when the staking period has not ended yet.
    #[msg("Staking period has not ended yet.")]
    StakingPeriodNotEnded = 306,

    /// Error when the user tries to unstake more than the staked amount.
    #[msg("Unstake amount exceeds staked balance.")]
    InvalidUnstakeAmount = 307,

    /// Error when the provided vote weight or option is invalid.
    #[msg("Invalid vote weight or option provided.")]
    InvalidVote = 400,

    /// Error when the proposal is not active or does not exist.
    #[msg("Proposal is not active or does not exist.")]
    InvalidProposal = 401,

    /// Error when the user has already voted on the proposal.
    #[msg("User has already voted on this proposal.")]
    AlreadyVoted = 402,

    /// Error when the proposal creation parameters are invalid.
    #[msg("Invalid proposal parameters provided.")]
    InvalidProposalParameters = 403,

    /// Error when the governance action is not allowed at this time.
    #[msg("Governance action is not allowed at this time.")]
    GovernanceActionNotAllowed = 404,

    /// Error when the platform configuration parameters are invalid.
    #[msg("Invalid platform configuration parameters.")]
    InvalidConfig = 500,

    /// Error when the reward rate or distribution parameters are invalid.
    #[msg("Invalid reward rate or distribution parameters.")]
    InvalidRewardRate = 501,

    /// Error when the metadata provided exceeds the maximum allowed size.
    #[msg("Metadata size exceeds the maximum allowed limit.")]
    MetadataTooLarge = 502,

    /// Error when an arithmetic operation overflows or underflows.
    #[msg("Arithmetic overflow or underflow occurred.")]
    ArithmeticError = 600,

    /// Error when the account data deserialization or serialization fails.
    #[msg("Failed to serialize or deserialize account data.")]
    SerializationError = 601,

    /// Error when the provided account does not match the expected type or owner.
    #[msg("Invalid account type or owner.")]
    InvalidAccount = 602,

    /// Error when the system clock or timestamp is invalid.
    #[msg("Invalid timestamp or clock data.")]
    InvalidTimestamp = 603,

    /// Generic error for unexpected or unhandled cases.
    #[msg("An unexpected error occurred.")]
    UnexpectedError = 999,
}
