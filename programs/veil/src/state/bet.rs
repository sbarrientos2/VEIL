//! Bet Record Account
//!
//! Stores individual bet records with encrypted position data.

use anchor_lang::prelude::*;

/// Number of encrypted bet fields: [outcome, amount]
pub const ENCRYPTED_BET_LEN: usize = 2;

/// Bet status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default, InitSpace)]
pub enum BetStatus {
    /// Bet placed, awaiting MPC confirmation
    #[default]
    Pending,
    /// Bet confirmed by MPC
    Confirmed,
    /// Payout claimed
    Claimed,
    /// Refund claimed (cancelled market)
    Refunded,
}

/// Individual bet record
///
/// Each bet creates a BetRecord PDA that stores the encrypted
/// bet details. The user can decrypt their own bet, but no one
/// else can see the position.
#[account]
#[derive(InitSpace)]
pub struct BetRecord {
    // === Identity ===
    /// Bump seed for PDA
    pub bump: u8,
    /// Market this bet belongs to
    pub market: Pubkey,
    /// Bettor's wallet address
    pub bettor: Pubkey,
    /// Sequential bet index in this market
    pub bet_index: u32,

    // === Encrypted Position ===
    // Stored as array of ciphertexts: [outcome, amount]
    pub encrypted_bet: [[u8; 32]; ENCRYPTED_BET_LEN],
    /// User's X25519 public key for encryption/decryption
    pub user_pubkey: [u8; 32],
    /// Encryption nonce used for this bet
    pub user_nonce: u128,

    // === Plaintext Amount (for vault tracking) ===
    /// Actual bet amount in lamports (needed for vault)
    /// Note: This reveals amount but not outcome
    pub bet_lamports: u64,

    // === Status ===
    /// Current bet status
    pub status: BetStatus,
    /// Unix timestamp when bet was placed
    pub placed_at: i64,
    /// Unix timestamp when confirmed by MPC
    pub confirmed_at: Option<i64>,

    // === Payout ===
    /// Whether user has claimed
    pub claimed: bool,
    /// Payout amount (set after claim)
    pub payout_amount: Option<u64>,
}

impl BetRecord {
    /// Check if bet is confirmed and eligible for payout
    pub fn can_claim(&self) -> bool {
        self.status == BetStatus::Confirmed && !self.claimed
    }

    /// Check if bet is eligible for refund
    pub fn can_refund(&self) -> bool {
        !self.claimed && (self.status == BetStatus::Confirmed || self.status == BetStatus::Pending)
    }
}

/// User stats account (optional, for leaderboard)
#[account]
#[derive(InitSpace)]
pub struct UserStats {
    pub bump: u8,
    pub user: Pubkey,
    pub total_bets: u32,
    pub total_wagered: u64,
    pub total_won: u64,
    pub total_lost: u64,
    pub markets_participated: u32,
    pub correct_predictions: u32,
}
