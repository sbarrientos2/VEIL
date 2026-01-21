//! Market Account
//!
//! Stores market configuration and encrypted state.

use anchor_lang::prelude::*;

/// Maximum length of market question
pub const MAX_QUESTION_LEN: usize = 200;

/// Number of encrypted state fields: [yes_pool, no_pool, bet_count]
pub const ENCRYPTED_STATE_LEN: usize = 3;

/// Market status enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default, InitSpace)]
pub enum MarketStatus {
    /// Market is open for betting
    #[default]
    Open,
    /// Betting closed, awaiting resolution
    Closed,
    /// MPC resolution in progress
    Resolving,
    /// Market resolved, payouts available
    Resolved,
    /// Market cancelled, refunds available
    Cancelled,
}

/// Oracle type for market resolution
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default, InitSpace)]
pub enum OracleType {
    /// Authority manually resolves
    #[default]
    Manual,
    /// Automated via Switchboard price feed
    Switchboard,
    /// Decentralized jury (future)
    Jury,
}

impl From<u8> for OracleType {
    fn from(value: u8) -> Self {
        match value {
            0 => OracleType::Manual,
            1 => OracleType::Switchboard,
            2 => OracleType::Jury,
            _ => OracleType::Manual,
        }
    }
}

/// Main market account
///
/// Stores all market configuration and state, including
/// encrypted pool data from MPC operations.
#[account]
#[derive(InitSpace)]
pub struct Market {
    // === Identity ===
    /// Bump seed for PDA
    pub bump: u8,
    /// Unique market identifier
    pub market_id: u64,
    /// Market creator/authority
    pub authority: Pubkey,

    // === Configuration ===
    /// Market question (e.g., "Will BTC hit $100k by Dec 2026?")
    #[max_len(MAX_QUESTION_LEN)]
    pub question: String,
    /// Unix timestamp when betting closes
    pub resolution_time: i64,
    /// Unix timestamp when market was created
    pub created_at: i64,
    /// Fee in basis points (100 = 1%)
    pub fee_bps: u16,

    // === Oracle ===
    /// Type of oracle for resolution
    pub oracle_type: OracleType,
    /// Switchboard feed address (if applicable)
    pub oracle_feed: Option<Pubkey>,

    // === Status ===
    /// Current market status
    pub status: MarketStatus,
    /// Resolved outcome (None until resolved)
    pub outcome: Option<bool>,

    // === Encrypted State (from MPC) ===
    // Stored as array of ciphertexts: [yes_pool, no_pool, bet_count]
    // This format matches Arcium's callback output structure
    pub encrypted_state: [[u8; 32]; ENCRYPTED_STATE_LEN],
    /// Nonce for MPC state encryption
    pub state_nonce: u128,
    /// Whether MPC state has been initialized
    pub mpc_initialized: bool,

    // === Revealed State (after resolution) ===
    /// Revealed YES pool (0 until resolved)
    pub revealed_yes_pool: u64,
    /// Revealed NO pool (0 until resolved)
    pub revealed_no_pool: u64,
    /// Total pool (0 until resolved)
    pub revealed_total_pool: u64,

    // === Counters ===
    /// Number of bets placed (also tracked in encrypted state)
    pub bet_count: u32,
    /// Approximate total liquidity (for UI, sum of bet_lamports)
    pub total_liquidity_approx: u64,

    // === Vault ===
    /// Vault holding all bet funds
    pub vault: Pubkey,
}

impl Market {
    /// Byte offset where encrypted_state begins (for ArgBuilder.account())
    /// This must be calculated precisely for MPC to read the correct data
    pub const ENCRYPTED_STATE_OFFSET: u32 = 8   // discriminator
        + 1   // bump
        + 8   // market_id
        + 32  // authority
        + 4 + MAX_QUESTION_LEN as u32  // question (4 bytes len + content)
        + 8   // resolution_time
        + 8   // created_at
        + 2   // fee_bps
        + 1   // oracle_type
        + 33  // oracle_feed (Option<Pubkey>: 1 byte discriminant + 32 bytes)
        + 1   // status
        + 2;  // outcome (Option<bool>: 1 byte discriminant + 1 byte value)

    /// Size of encrypted state data to read (3 ciphertexts × 32 bytes each)
    pub const ENCRYPTED_STATE_SIZE: u32 = 32 * ENCRYPTED_STATE_LEN as u32;

    /// Check if market is open for betting
    pub fn is_open(&self) -> bool {
        self.status == MarketStatus::Open
    }

    /// Check if market can be resolved
    pub fn can_resolve(&self) -> bool {
        self.status == MarketStatus::Closed
    }

    /// Check if payouts are available
    pub fn payouts_available(&self) -> bool {
        self.status == MarketStatus::Resolved
    }

    /// Check if market is cancelled
    pub fn is_cancelled(&self) -> bool {
        self.status == MarketStatus::Cancelled
    }
}

/// Market vault account (holds all bet funds)
#[account]
pub struct MarketVault {
    pub bump: u8,
    pub market: Pubkey,
    pub total_deposits: u64,
    pub total_withdrawals: u64,
}

impl MarketVault {
    pub const LEN: usize = 8 + 1 + 32 + 8 + 8;
}
