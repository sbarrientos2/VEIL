//! VEIL - Private Parimutuel Prediction Market
//!
//! Arcis MPC Circuits for encrypted betting
//!
//! These circuits run in Arcium's Multi-Party Computation environment,
//! ensuring no single party ever sees individual bet data.

use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    // =========================================================================
    // DATA STRUCTURES
    // =========================================================================

    /// Encrypted bet submitted by user
    /// - outcome: true = YES, false = NO
    /// - amount: bet amount in lamports
    pub struct Bet {
        pub outcome: bool,
        pub amount: u64,
    }

    /// Encrypted market state owned by the MXE
    /// This accumulates all bets without revealing individual positions
    pub struct MarketState {
        pub yes_pool: u64,    // Total amount bet on YES
        pub no_pool: u64,     // Total amount bet on NO
        pub bet_count: u32,   // Number of bets placed
    }

    /// Revealed market totals (only exposed after resolution)
    pub struct MarketTotals {
        pub yes_pool: u64,
        pub no_pool: u64,
        pub total_pool: u64,
    }

    /// Payout calculation result
    pub struct PayoutResult {
        pub winning_pool: u64,
        pub losing_pool: u64,
        pub total_pool: u64,
        pub outcome: bool,
    }

    /// Bet verification for claims
    pub struct BetClaim {
        pub claimed_outcome: bool,
        pub claimed_amount: u64,
    }

    // =========================================================================
    // ENCRYPTED INSTRUCTIONS
    // =========================================================================

    /// Initialize market state with zero pools
    ///
    /// Called once when a new market is created.
    /// Returns MXE-encrypted state that only the MPC nodes can access.
    ///
    /// # Arguments
    /// * `mxe` - MXE encryption context
    ///
    /// # Returns
    /// * `Enc<Mxe, MarketState>` - Encrypted initial state
    #[instruction]
    pub fn init_market_state(mxe: Mxe) -> Enc<Mxe, MarketState> {
        let initial_state = MarketState {
            yes_pool: 0,
            no_pool: 0,
            bet_count: 0,
        };
        mxe.from_arcis(initial_state)
    }

    /// Place an encrypted bet
    ///
    /// Aggregates the user's bet into the appropriate pool without
    /// revealing the bet details to anyone. The market state remains
    /// encrypted throughout.
    ///
    /// # Arguments
    /// * `bet_ctxt` - User's encrypted bet (outcome + amount)
    /// * `state_ctxt` - Current encrypted market state
    ///
    /// # Returns
    /// * `Enc<Mxe, MarketState>` - Updated encrypted state
    #[instruction]
    pub fn place_bet(
        bet_ctxt: Enc<Shared, Bet>,
        state_ctxt: Enc<Mxe, MarketState>,
    ) -> Enc<Mxe, MarketState> {
        let bet = bet_ctxt.to_arcis();
        let mut state = state_ctxt.to_arcis();

        // Aggregate bet into appropriate pool
        // This happens inside MPC - no one sees the individual bet
        if bet.outcome {
            state.yes_pool = state.yes_pool + bet.amount;
        } else {
            state.no_pool = state.no_pool + bet.amount;
        }
        state.bet_count = state.bet_count + 1;

        // Return updated encrypted state
        state_ctxt.owner.from_arcis(state)
    }

    /// Reveal market totals at resolution
    ///
    /// Called when the market closes and resolution begins.
    /// Reveals only the aggregate pool sizes, never individual bets.
    ///
    /// # Arguments
    /// * `state_ctxt` - Encrypted market state
    ///
    /// # Returns
    /// * `MarketTotals` - Plaintext totals (revealed to all)
    #[instruction]
    pub fn reveal_market_totals(
        state_ctxt: Enc<Mxe, MarketState>,
    ) -> MarketTotals {
        let state = state_ctxt.to_arcis();

        MarketTotals {
            yes_pool: state.yes_pool,
            no_pool: state.no_pool,
            total_pool: state.yes_pool + state.no_pool,
        }.reveal()
    }

    /// Calculate payout pools given the oracle outcome
    ///
    /// Determines winning/losing pools for payout calculation.
    /// Called after oracle provides the market outcome.
    ///
    /// # Arguments
    /// * `state_ctxt` - Encrypted market state
    /// * `outcome` - Oracle-determined outcome (true = YES wins)
    ///
    /// # Returns
    /// * `PayoutResult` - Plaintext payout info
    #[instruction]
    pub fn calculate_payout_pools(
        state_ctxt: Enc<Mxe, MarketState>,
        outcome: bool,
    ) -> PayoutResult {
        let state = state_ctxt.to_arcis();

        let (winning_pool, losing_pool) = if outcome {
            (state.yes_pool, state.no_pool)
        } else {
            (state.no_pool, state.yes_pool)
        };

        PayoutResult {
            winning_pool,
            losing_pool,
            total_pool: state.yes_pool + state.no_pool,
            outcome,
        }.reveal()
    }

    /// Verify a bet claim matches the original encrypted bet
    ///
    /// Used during payout to verify user's claimed bet details
    /// match what they actually bet. Returns true/false without
    /// revealing the actual bet to anyone else.
    ///
    /// # Arguments
    /// * `original_bet` - The encrypted bet stored on-chain
    /// * `claim` - User's claimed bet details
    ///
    /// # Returns
    /// * `bool` - Whether the claim matches (revealed)
    #[instruction]
    pub fn verify_bet_claim(
        original_bet: Enc<Shared, Bet>,
        claim: Enc<Shared, BetClaim>,
    ) -> bool {
        let bet = original_bet.to_arcis();
        let claimed = claim.to_arcis();

        let matches = bet.outcome == claimed.claimed_outcome
            && bet.amount == claimed.claimed_amount;

        matches.reveal()
    }

    // =========================================================================
    // OPTIONAL: Advanced features for future iterations
    // =========================================================================

    /// Get encrypted bet count (for UI without revealing pools)
    /// Returns only the count, keeping pool sizes private
    #[instruction]
    pub fn get_bet_count(state_ctxt: Enc<Mxe, MarketState>) -> u32 {
        let state = state_ctxt.to_arcis();
        state.bet_count.reveal()
    }
}
