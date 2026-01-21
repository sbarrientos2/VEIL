//! VEIL - Private Parimutuel Prediction Market
//!
//! A prediction market where bets are encrypted until resolution,
//! powered by Arcium Multi-Party Computation.
//!
//! ## Architecture
//!
//! The program uses Arcium MPC for:
//! - Aggregating encrypted bets without revealing individual positions
//! - Calculating payout pools at resolution
//! - Verifying bet claims
//!
//! ## Instruction Flow
//!
//! 1. Authority creates market with `create_market`
//! 2. Authority initializes MPC state with `init_market_state`
//! 3. Users place encrypted bets with `place_bet`
//! 4. Authority closes betting with `close_market`
//! 5. Authority resolves with oracle outcome via `resolve_market`
//! 6. Winners claim payouts with `claim_payout`

use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;

pub mod arcium;
pub mod state;

// Constants for betting
pub const MIN_BET_LAMPORTS: u64 = 1_000_000;         // 0.001 SOL minimum
pub const MAX_BET_LAMPORTS: u64 = 1_000_000_000_000; // 1000 SOL maximum
pub const MAX_QUESTION_LEN: usize = 200;

declare_id!("VEiL111111111111111111111111111111111111111");

// =============================================================================
// COMPUTATION DEFINITION OFFSETS
// =============================================================================
// These must match the function names in encrypted-ixs/src/lib.rs

const COMP_DEF_OFFSET_INIT_MARKET_STATE: u32 = comp_def_offset("init_market_state");
const COMP_DEF_OFFSET_PLACE_BET: u32 = comp_def_offset("place_bet");
const COMP_DEF_OFFSET_REVEAL_MARKET_TOTALS: u32 = comp_def_offset("reveal_market_totals");
const COMP_DEF_OFFSET_CALCULATE_PAYOUT_POOLS: u32 = comp_def_offset("calculate_payout_pools");
const COMP_DEF_OFFSET_VERIFY_BET_CLAIM: u32 = comp_def_offset("verify_bet_claim");
const COMP_DEF_OFFSET_GET_BET_COUNT: u32 = comp_def_offset("get_bet_count");

#[arcium_program]
pub mod veil {
    use super::*;

    // =========================================================================
    // COMPUTATION DEFINITION INITIALIZERS
    // =========================================================================
    // These must be called once before using each MPC circuit

    /// Initialize computation definition for init_market_state circuit
    pub fn init_market_state_comp_def(ctx: Context<InitMarketStateCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        msg!("Initialized init_market_state computation definition");
        Ok(())
    }

    /// Initialize computation definition for place_bet circuit
    pub fn init_place_bet_comp_def(ctx: Context<InitPlaceBetCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        msg!("Initialized place_bet computation definition");
        Ok(())
    }

    /// Initialize computation definition for calculate_payout_pools circuit
    pub fn init_calculate_payout_pools_comp_def(
        ctx: Context<InitCalculatePayoutPoolsCompDef>,
    ) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        msg!("Initialized calculate_payout_pools computation definition");
        Ok(())
    }

    // =========================================================================
    // MARKET MANAGEMENT
    // =========================================================================

    /// Create a new prediction market
    ///
    /// This creates the market account and vault. The encrypted MPC state
    /// must be initialized separately via `init_market_state`.
    ///
    /// # Arguments
    /// * `market_id` - Unique identifier for this market
    /// * `question` - The prediction question (max 200 chars)
    /// * `resolution_time` - Unix timestamp when betting closes
    /// * `oracle_type` - 0=Manual, 1=Switchboard, 2=Jury
    /// * `fee_bps` - Fee in basis points (100 = 1%, max 1000 = 10%)
    pub fn create_market(
        ctx: Context<CreateMarket>,
        market_id: u64,
        question: String,
        resolution_time: i64,
        oracle_type: u8,
        fee_bps: u16,
    ) -> Result<()> {
        // Validate inputs
        require!(
            question.len() <= MAX_QUESTION_LEN,
            ErrorCode::InvalidInput
        );
        require!(
            resolution_time > Clock::get()?.unix_timestamp,
            ErrorCode::InvalidInput
        );
        require!(fee_bps <= 1000, ErrorCode::InvalidInput); // Max 10% fee

        let market = &mut ctx.accounts.market;
        let vault = &mut ctx.accounts.vault;
        let clock = Clock::get()?;

        // Initialize market
        market.bump = ctx.bumps.market;
        market.market_id = market_id;
        market.authority = ctx.accounts.authority.key();
        market.question = question.clone();
        market.resolution_time = resolution_time;
        market.created_at = clock.unix_timestamp;
        market.fee_bps = fee_bps;
        market.oracle_type = state::OracleType::from(oracle_type);
        market.oracle_feed = None;
        market.status = state::MarketStatus::Open;
        market.outcome = None;

        // Initialize encrypted state as empty (will be set by MPC init_market_state)
        market.encrypted_state = [[0u8; 32]; 3];
        market.state_nonce = 0;
        market.mpc_initialized = false;

        // Initialize revealed state
        market.revealed_yes_pool = 0;
        market.revealed_no_pool = 0;
        market.revealed_total_pool = 0;

        // Initialize counters
        market.bet_count = 0;
        market.total_liquidity_approx = 0;

        // Set vault reference
        market.vault = vault.key();

        // Initialize vault
        vault.bump = ctx.bumps.vault;
        vault.market = market.key();
        vault.total_deposits = 0;
        vault.total_withdrawals = 0;

        // Emit event
        emit!(MarketCreated {
            market: market.key(),
            market_id,
            authority: ctx.accounts.authority.key(),
            question,
            resolution_time,
            fee_bps,
        });

        Ok(())
    }

    /// Initialize encrypted market state via MPC
    ///
    /// This queues an MPC computation that creates the initial encrypted
    /// state (zero pools). Must be called after `create_market`.
    ///
    /// # Arguments
    /// * `computation_offset` - Random u64 identifier for this computation
    /// * `nonce` - Random u128 nonce for encryption
    pub fn init_market_state(
        ctx: Context<InitMarketState>,
        computation_offset: u64,
        nonce: u128,
    ) -> Result<()> {
        let market = &ctx.accounts.market;

        msg!("Initializing MPC state for market: {}", market.key());

        // Build arguments for init_market_state circuit (only needs nonce)
        let args = ArgBuilder::new().plaintext_u128(nonce).build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        // Queue MPC computation
        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![InitMarketStateCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[CallbackAccount {
                    pubkey: ctx.accounts.market.key(),
                    is_writable: true,
                }],
            )?],
            1,
            0,
        )?;

        emit!(MarketStateInitRequested {
            market: market.key(),
            computation_offset,
        });

        Ok(())
    }

    /// Callback for init_market_state MPC computation
    #[arcium_callback(encrypted_ix = "init_market_state")]
    pub fn init_market_state_callback(
        ctx: Context<InitMarketStateCallback>,
        output: SignedComputationOutputs<InitMarketStateOutput>,
    ) -> Result<()> {
        // Verify MPC cluster signature
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(InitMarketStateOutput { field_0 }) => field_0,
            Err(_) => return Err(VeilError::MpcComputationFailed.into()),
        };

        let market = &mut ctx.accounts.market;

        // Store encrypted state (3 ciphertexts: yes_pool, no_pool, bet_count)
        market.encrypted_state = o.ciphertexts;
        market.state_nonce = o.nonce;
        market.mpc_initialized = true;

        emit!(MarketStateInitialized {
            market: market.key(),
            nonce: o.nonce,
        });

        msg!("MPC state initialized for market: {}", market.key());

        Ok(())
    }

    // =========================================================================
    // BETTING
    // =========================================================================

    /// Place an encrypted bet on a market
    ///
    /// The bet outcome and amount are encrypted client-side using the
    /// MXE public key. The MPC aggregates them into the pool totals
    /// without revealing individual positions.
    ///
    /// # Arguments
    /// * `computation_offset` - Random u64 identifier for this computation
    /// * `encrypted_outcome` - Encrypted bool (true=YES, false=NO)
    /// * `encrypted_amount` - Encrypted u64 amount in lamports
    /// * `user_pubkey` - User's X25519 public key for encryption
    /// * `nonce` - Encryption nonce
    /// * `bet_lamports` - Plaintext amount for vault tracking
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        computation_offset: u64,
        encrypted_outcome: [u8; 32],
        encrypted_amount: [u8; 32],
        user_pubkey: [u8; 32],
        nonce: u128,
        bet_lamports: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;

        // Capture values before any mutable borrows
        let market_key = ctx.accounts.market.key();
        let bettor_key = ctx.accounts.bettor.key();
        let bet_record_key = ctx.accounts.bet_record.key();
        let bet_index = ctx.accounts.market.bet_count;
        let state_nonce = ctx.accounts.market.state_nonce;
        let resolution_time = ctx.accounts.market.resolution_time;

        // Validate market is open
        require!(ctx.accounts.market.is_open(), VeilError::MarketNotOpen);
        require!(ctx.accounts.market.mpc_initialized, VeilError::MpcNotInitialized);
        require!(
            clock.unix_timestamp < resolution_time,
            VeilError::BettingPeriodEnded
        );

        // Validate bet amount
        require!(
            bet_lamports >= MIN_BET_LAMPORTS,
            VeilError::BetAmountTooLow
        );
        require!(
            bet_lamports <= MAX_BET_LAMPORTS,
            VeilError::BetAmountTooHigh
        );

        // Transfer funds to vault
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.bettor.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            bet_lamports,
        )?;

        // Update vault
        ctx.accounts.vault.total_deposits = ctx.accounts.vault
            .total_deposits
            .checked_add(bet_lamports)
            .ok_or(VeilError::Overflow)?;

        // Initialize bet record
        ctx.accounts.bet_record.bump = ctx.bumps.bet_record;
        ctx.accounts.bet_record.market = market_key;
        ctx.accounts.bet_record.bettor = bettor_key;
        ctx.accounts.bet_record.bet_index = bet_index;
        ctx.accounts.bet_record.encrypted_bet = [encrypted_outcome, encrypted_amount];
        ctx.accounts.bet_record.user_pubkey = user_pubkey;
        ctx.accounts.bet_record.user_nonce = nonce;
        ctx.accounts.bet_record.bet_lamports = bet_lamports;
        ctx.accounts.bet_record.status = state::BetStatus::Pending;
        ctx.accounts.bet_record.placed_at = clock.unix_timestamp;
        ctx.accounts.bet_record.confirmed_at = None;
        ctx.accounts.bet_record.claimed = false;
        ctx.accounts.bet_record.payout_amount = None;

        // Build arguments for place_bet circuit
        let args = ArgBuilder::new()
            .x25519_pubkey(user_pubkey)
            .plaintext_u128(nonce)
            .encrypted_bool(encrypted_outcome)
            .encrypted_u64(encrypted_amount)
            .plaintext_u128(state_nonce)
            .account(
                market_key,
                state::Market::ENCRYPTED_STATE_OFFSET,
                state::Market::ENCRYPTED_STATE_SIZE,
            )
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        // Queue MPC computation
        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![PlaceBetCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[
                    CallbackAccount {
                        pubkey: market_key,
                        is_writable: true,
                    },
                    CallbackAccount {
                        pubkey: bet_record_key,
                        is_writable: true,
                    },
                ],
            )?],
            1,
            0,
        )?;

        emit!(BetPlaced {
            market: market_key,
            bettor: bettor_key,
            bet_index,
            bet_lamports,
            computation_offset,
        });

        msg!(
            "Bet placed: market={}, bettor={}, amount={} lamports",
            market_key,
            bettor_key,
            bet_lamports
        );

        Ok(())
    }

    /// Callback for place_bet MPC computation
    #[arcium_callback(encrypted_ix = "place_bet")]
    pub fn place_bet_callback(
        ctx: Context<PlaceBetCallback>,
        output: SignedComputationOutputs<PlaceBetOutput>,
    ) -> Result<()> {
        // Verify MPC cluster signature
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(PlaceBetOutput { field_0 }) => field_0,
            Err(_) => return Err(VeilError::MpcComputationFailed.into()),
        };

        let market = &mut ctx.accounts.market;
        let bet_record = &mut ctx.accounts.bet_record;
        let clock = Clock::get()?;

        // Update market encrypted state
        market.encrypted_state = o.ciphertexts;
        market.state_nonce = o.nonce;
        market.bet_count = market.bet_count.checked_add(1).ok_or(VeilError::Overflow)?;

        // Confirm bet
        bet_record.status = state::BetStatus::Confirmed;
        bet_record.confirmed_at = Some(clock.unix_timestamp);

        emit!(BetConfirmed {
            market: market.key(),
            bettor: bet_record.bettor,
            bet_index: bet_record.bet_index,
        });

        msg!(
            "Bet confirmed: market={}, bet_index={}",
            market.key(),
            bet_record.bet_index
        );

        Ok(())
    }

    // =========================================================================
    // RESOLUTION
    // =========================================================================

    /// Close market to new bets
    ///
    /// Can be called by authority at any time, or by anyone after
    /// resolution_time has passed.
    pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;

        // Anyone can close if resolution time has passed
        // Only authority can close early
        let is_authority = market.authority == ctx.accounts.authority.key();
        let time_passed = clock.unix_timestamp >= market.resolution_time;

        require!(
            is_authority || time_passed,
            ErrorCode::Unauthorized
        );

        // Close the market
        market.status = state::MarketStatus::Closed;

        emit!(MarketClosed {
            market: market.key(),
            closed_by: ctx.accounts.authority.key(),
            bet_count: market.bet_count,
            total_liquidity: market.total_liquidity_approx,
        });

        msg!(
            "Market closed: {}, {} bets, {} lamports",
            market.key(),
            market.bet_count,
            market.total_liquidity_approx
        );

        Ok(())
    }

    /// Resolve market with oracle outcome
    ///
    /// Triggers MPC to calculate payout pools based on the outcome.
    /// Only authority can call this for Manual oracle type.
    ///
    /// # Arguments
    /// * `computation_offset` - Random u64 identifier for this computation
    /// * `outcome` - The oracle-determined outcome (true=YES wins)
    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        computation_offset: u64,
        outcome: bool,
    ) -> Result<()> {
        // Capture values before mutable borrows
        let market_key = ctx.accounts.market.key();
        let resolver_key = ctx.accounts.resolver.key();
        let state_nonce = ctx.accounts.market.state_nonce;
        let oracle_type = ctx.accounts.market.oracle_type.clone();
        let authority = ctx.accounts.market.authority;

        // Validate market state
        require!(ctx.accounts.market.can_resolve(), VeilError::MarketNotClosed);
        require!(ctx.accounts.market.mpc_initialized, VeilError::MpcNotInitialized);

        // Validate resolver authorization
        match oracle_type {
            state::OracleType::Manual => {
                require!(authority == resolver_key, VeilError::Unauthorized);
            }
            state::OracleType::Switchboard => {
                // TODO: Verify Switchboard oracle signature
                require!(authority == resolver_key, VeilError::Unauthorized);
            }
            state::OracleType::Jury => {
                // TODO: Verify jury consensus
                require!(authority == resolver_key, VeilError::Unauthorized);
            }
        }

        // Mark as resolving
        ctx.accounts.market.status = state::MarketStatus::Resolving;

        // Build arguments for calculate_payout_pools circuit
        let args = ArgBuilder::new()
            .plaintext_u128(state_nonce)
            .account(
                market_key,
                state::Market::ENCRYPTED_STATE_OFFSET,
                state::Market::ENCRYPTED_STATE_SIZE,
            )
            .plaintext_bool(outcome)
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        // Queue MPC computation
        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![CalculatePayoutPoolsCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[CallbackAccount {
                    pubkey: market_key,
                    is_writable: true,
                }],
            )?],
            1,
            0,
        )?;

        emit!(MarketResolutionRequested {
            market: market_key,
            resolver: resolver_key,
            outcome,
            computation_offset,
        });

        msg!(
            "Market resolution requested: {}, outcome={}",
            market_key,
            outcome
        );

        Ok(())
    }

    /// Callback for calculate_payout_pools MPC computation
    #[arcium_callback(encrypted_ix = "calculate_payout_pools")]
    pub fn calculate_payout_pools_callback(
        ctx: Context<CalculatePayoutPoolsCallback>,
        output: SignedComputationOutputs<CalculatePayoutPoolsOutput>,
    ) -> Result<()> {
        // Verify MPC cluster signature and extract payout result
        let payout = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(CalculatePayoutPoolsOutput {
                field_0:
                    CalculatePayoutPoolsOutputStruct0 {
                        field_0: winning_pool,
                        field_1: losing_pool,
                        field_2: total_pool,
                        field_3: outcome,
                    },
            }) => (winning_pool, losing_pool, total_pool, outcome),
            Err(_) => return Err(VeilError::MpcComputationFailed.into()),
        };

        let market = &mut ctx.accounts.market;

        // Store revealed values
        market.outcome = Some(payout.3);
        market.status = state::MarketStatus::Resolved;

        // Store revealed pools
        if payout.3 {
            // YES won
            market.revealed_yes_pool = payout.0;
            market.revealed_no_pool = payout.1;
        } else {
            // NO won
            market.revealed_yes_pool = payout.1;
            market.revealed_no_pool = payout.0;
        }
        market.revealed_total_pool = payout.2;

        emit!(MarketResolved {
            market: market.key(),
            outcome: payout.3,
            yes_pool: market.revealed_yes_pool,
            no_pool: market.revealed_no_pool,
            total_pool: payout.2,
        });

        msg!(
            "Market resolved: {}, outcome={}, YES={}, NO={}, total={}",
            market.key(),
            payout.3,
            market.revealed_yes_pool,
            market.revealed_no_pool,
            payout.2
        );

        Ok(())
    }

    // =========================================================================
    // PAYOUTS
    // =========================================================================

    /// Claim payout for a winning bet
    ///
    /// User provides their bet details (outcome and amount) which are
    /// verified against their stored encrypted bet. Winners receive
    /// their proportional share of the losing pool minus fees.
    ///
    /// Payout formula: (user_bet / winning_pool) * (total_pool - fee)
    pub fn claim_payout(
        ctx: Context<ClaimPayout>,
        claimed_outcome: bool,
        claimed_amount: u64,
    ) -> Result<()> {
        let market = &ctx.accounts.market;
        let vault = &mut ctx.accounts.vault;
        let bet_record = &mut ctx.accounts.bet_record;
        let bettor = &ctx.accounts.bettor;

        // Get the winning outcome
        let winning_outcome = market.outcome.ok_or(ErrorCode::MarketNotResolved)?;

        // Verify the claim matches the stored bet
        require!(
            claimed_amount == bet_record.bet_lamports,
            ErrorCode::InvalidBetClaim
        );

        // Calculate payout
        let payout = if claimed_outcome == winning_outcome {
            // Winner! Calculate share of pool
            let winning_pool = if winning_outcome {
                market.revealed_yes_pool
            } else {
                market.revealed_no_pool
            };

            // Calculate fee
            let fee = (market.revealed_total_pool as u128 * market.fee_bps as u128 / 10000) as u64;
            let payout_pool = market.revealed_total_pool.saturating_sub(fee);

            // User's share: (user_bet / winning_pool) * payout_pool
            if winning_pool > 0 {
                ((claimed_amount as u128 * payout_pool as u128) / winning_pool as u128) as u64
            } else {
                0
            }
        } else {
            // Loser gets nothing
            0
        };

        // Transfer payout from vault
        if payout > 0 {
            **vault.to_account_info().try_borrow_mut_lamports()? -= payout;
            **bettor.to_account_info().try_borrow_mut_lamports()? += payout;

            vault.total_withdrawals = vault.total_withdrawals
                .checked_add(payout)
                .ok_or(ErrorCode::Overflow)?;
        }

        // Mark as claimed
        bet_record.claimed = true;
        bet_record.payout_amount = Some(payout);
        bet_record.status = state::BetStatus::Claimed;

        emit!(PayoutClaimed {
            market: market.key(),
            bettor: bettor.key(),
            bet_amount: claimed_amount,
            payout_amount: payout,
            won: claimed_outcome == winning_outcome,
        });

        msg!(
            "Payout claimed: bettor={}, bet={}, payout={}, won={}",
            bettor.key(),
            claimed_amount,
            payout,
            claimed_outcome == winning_outcome
        );

        Ok(())
    }

    // =========================================================================
    // ADMIN
    // =========================================================================

    /// Cancel market and enable refunds
    ///
    /// Emergency function that allows authority to cancel a market
    /// before resolution. All bettors can then claim full refunds.
    pub fn cancel_market(ctx: Context<CancelMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;

        market.status = state::MarketStatus::Cancelled;

        emit!(MarketCancelled {
            market: market.key(),
            cancelled_by: ctx.accounts.authority.key(),
            bet_count: market.bet_count,
            total_liquidity: market.total_liquidity_approx,
        });

        msg!(
            "Market cancelled: {}, {} bets to refund",
            market.key(),
            market.bet_count
        );

        Ok(())
    }

    /// Claim refund for cancelled market
    ///
    /// Allows bettors to reclaim their original bet amount when
    /// a market has been cancelled.
    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        let market = &ctx.accounts.market;
        let vault = &mut ctx.accounts.vault;
        let bet_record = &mut ctx.accounts.bet_record;
        let bettor = &ctx.accounts.bettor;

        // Refund the original bet amount
        let refund_amount = bet_record.bet_lamports;

        // Transfer from vault to bettor
        **vault.to_account_info().try_borrow_mut_lamports()? -= refund_amount;
        **bettor.to_account_info().try_borrow_mut_lamports()? += refund_amount;

        vault.total_withdrawals = vault.total_withdrawals
            .checked_add(refund_amount)
            .ok_or(ErrorCode::Overflow)?;

        // Mark as refunded
        bet_record.claimed = true;
        bet_record.payout_amount = Some(refund_amount);
        bet_record.status = state::BetStatus::Refunded;

        emit!(RefundClaimed {
            market: market.key(),
            bettor: bettor.key(),
            refund_amount,
        });

        msg!(
            "Refund claimed: bettor={}, amount={}",
            bettor.key(),
            refund_amount
        );

        Ok(())
    }
}

// =============================================================================
// COMPUTATION DEFINITION ACCOUNT STRUCTS
// =============================================================================

#[init_computation_definition_accounts("init_market_state", payer)]
#[derive(Accounts)]
pub struct InitMarketStateCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    /// CHECK: comp_def_account, checked by arcium program
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("place_bet", payer)]
#[derive(Accounts)]
pub struct InitPlaceBetCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    /// CHECK: comp_def_account, checked by arcium program
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("calculate_payout_pools", payer)]
#[derive(Accounts)]
pub struct InitCalculatePayoutPoolsCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    /// CHECK: comp_def_account, checked by arcium program
    #[account(mut)]
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

// =============================================================================
// INIT MARKET STATE ACCOUNTS
// =============================================================================

#[queue_computation_accounts("init_market_state", authority)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct InitMarketState<'info> {
    /// The market to initialize
    #[account(
        mut,
        constraint = !market.mpc_initialized @ VeilError::MpcAlreadyInitialized,
        constraint = market.authority == authority.key() @ VeilError::Unauthorized,
    )]
    pub market: Account<'info, state::Market>,

    /// Market authority
    #[account(mut)]
    pub authority: Signer<'info>,

    // === Arcium Accounts ===
    #[account(
        init_if_needed,
        space = 9,
        payer = authority,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,

    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(mut, address = derive_mempool_pda!(mxe_account, VeilError::MpcComputationFailed))]
    /// CHECK: mempool_account, checked by arcium program
    pub mempool_account: UncheckedAccount<'info>,

    #[account(mut, address = derive_execpool_pda!(mxe_account, VeilError::MpcComputationFailed))]
    /// CHECK: executing_pool, checked by arcium program
    pub executing_pool: UncheckedAccount<'info>,

    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, VeilError::MpcComputationFailed))]
    /// CHECK: computation_account, checked by arcium program
    pub computation_account: UncheckedAccount<'info>,

    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_MARKET_STATE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(mut, address = derive_cluster_pda!(mxe_account, VeilError::MpcComputationFailed))]
    pub cluster_account: Account<'info, Cluster>,

    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,

    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("init_market_state")]
#[derive(Accounts)]
pub struct InitMarketStateCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,

    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_MARKET_STATE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    /// CHECK: computation_account, checked by arcium program
    pub computation_account: UncheckedAccount<'info>,

    #[account(address = derive_cluster_pda!(mxe_account, VeilError::MpcComputationFailed))]
    pub cluster_account: Account<'info, Cluster>,

    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar
    pub instructions_sysvar: AccountInfo<'info>,

    #[account(mut)]
    pub market: Account<'info, state::Market>,
}

// =============================================================================
// PLACE BET ACCOUNTS
// =============================================================================

#[queue_computation_accounts("place_bet", bettor)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct PlaceBet<'info> {
    /// The market to bet on
    #[account(mut)]
    pub market: Account<'info, state::Market>,

    /// Market vault to receive funds
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = vault.bump,
        constraint = vault.market == market.key() @ VeilError::InvalidVault,
    )]
    pub vault: Account<'info, state::MarketVault>,

    /// Bet record for this user
    #[account(
        init,
        payer = bettor,
        space = 8 + state::BetRecord::INIT_SPACE,
        seeds = [b"bet", market.key().as_ref(), bettor.key().as_ref()],
        bump
    )]
    pub bet_record: Account<'info, state::BetRecord>,

    /// The bettor placing the bet
    #[account(mut)]
    pub bettor: Signer<'info>,

    // === Arcium Accounts ===
    #[account(
        init_if_needed,
        space = 9,
        payer = bettor,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,

    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(mut, address = derive_mempool_pda!(mxe_account, VeilError::MpcComputationFailed))]
    /// CHECK: mempool_account
    pub mempool_account: UncheckedAccount<'info>,

    #[account(mut, address = derive_execpool_pda!(mxe_account, VeilError::MpcComputationFailed))]
    /// CHECK: executing_pool
    pub executing_pool: UncheckedAccount<'info>,

    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, VeilError::MpcComputationFailed))]
    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,

    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_PLACE_BET))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(mut, address = derive_cluster_pda!(mxe_account, VeilError::MpcComputationFailed))]
    pub cluster_account: Account<'info, Cluster>,

    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,

    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("place_bet")]
#[derive(Accounts)]
pub struct PlaceBetCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,

    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_PLACE_BET))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,

    #[account(address = derive_cluster_pda!(mxe_account, VeilError::MpcComputationFailed))]
    pub cluster_account: Account<'info, Cluster>,

    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar
    pub instructions_sysvar: AccountInfo<'info>,

    #[account(mut)]
    pub market: Account<'info, state::Market>,

    #[account(mut)]
    pub bet_record: Account<'info, state::BetRecord>,
}

// =============================================================================
// RESOLVE MARKET ACCOUNTS
// =============================================================================

#[queue_computation_accounts("calculate_payout_pools", resolver)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct ResolveMarket<'info> {
    /// The market to resolve
    #[account(mut)]
    pub market: Account<'info, state::Market>,

    /// Authority or oracle resolver
    #[account(mut)]
    pub resolver: Signer<'info>,

    // === Arcium Accounts ===
    #[account(
        init_if_needed,
        space = 9,
        payer = resolver,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,

    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(mut, address = derive_mempool_pda!(mxe_account, VeilError::MpcComputationFailed))]
    /// CHECK: mempool_account
    pub mempool_account: UncheckedAccount<'info>,

    #[account(mut, address = derive_execpool_pda!(mxe_account, VeilError::MpcComputationFailed))]
    /// CHECK: executing_pool
    pub executing_pool: UncheckedAccount<'info>,

    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, VeilError::MpcComputationFailed))]
    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,

    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_CALCULATE_PAYOUT_POOLS))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(mut, address = derive_cluster_pda!(mxe_account, VeilError::MpcComputationFailed))]
    pub cluster_account: Account<'info, Cluster>,

    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,

    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("calculate_payout_pools")]
#[derive(Accounts)]
pub struct CalculatePayoutPoolsCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,

    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_CALCULATE_PAYOUT_POOLS))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,

    #[account(address = derive_cluster_pda!(mxe_account, VeilError::MpcComputationFailed))]
    pub cluster_account: Account<'info, Cluster>,

    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar
    pub instructions_sysvar: AccountInfo<'info>,

    #[account(mut)]
    pub market: Account<'info, state::Market>,
}

// =============================================================================
// NON-MPC INSTRUCTION ACCOUNT STRUCTS
// =============================================================================

/// Accounts for creating a new market
#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct CreateMarket<'info> {
    /// The market account to create
    #[account(
        init,
        payer = authority,
        space = 8 + state::Market::INIT_SPACE,
        seeds = [b"market", authority.key().as_ref(), &market_id.to_le_bytes()],
        bump
    )]
    pub market: Account<'info, state::Market>,

    /// Market vault to hold funds
    #[account(
        init,
        payer = authority,
        space = state::MarketVault::LEN,
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, state::MarketVault>,

    /// Market creator and authority
    #[account(mut)]
    pub authority: Signer<'info>,

    /// System program
    pub system_program: Program<'info, System>,
}

/// Accounts for closing a market
#[derive(Accounts)]
pub struct CloseMarket<'info> {
    /// The market to close
    #[account(
        mut,
        constraint = market.status == state::MarketStatus::Open @ ErrorCode::MarketNotOpen,
    )]
    pub market: Account<'info, state::Market>,

    /// Authority or anyone (if resolution time passed)
    pub authority: Signer<'info>,
}

/// Accounts for claiming payout
#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    /// The resolved market
    #[account(
        constraint = market.status == state::MarketStatus::Resolved @ ErrorCode::MarketNotResolved,
    )]
    pub market: Account<'info, state::Market>,

    /// Market vault holding funds
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, state::MarketVault>,

    /// User's bet record
    #[account(
        mut,
        seeds = [b"bet", market.key().as_ref(), bettor.key().as_ref()],
        bump = bet_record.bump,
        constraint = bet_record.market == market.key() @ ErrorCode::InvalidAccount,
        constraint = bet_record.bettor == bettor.key() @ ErrorCode::Unauthorized,
        constraint = !bet_record.claimed @ ErrorCode::BetAlreadyClaimed,
        constraint = bet_record.status == state::BetStatus::Confirmed @ ErrorCode::BetNotConfirmed,
    )]
    pub bet_record: Account<'info, state::BetRecord>,

    /// The bettor claiming
    #[account(mut)]
    pub bettor: Signer<'info>,

    /// System program
    pub system_program: Program<'info, System>,
}

/// Accounts for cancelling a market
#[derive(Accounts)]
pub struct CancelMarket<'info> {
    /// The market to cancel
    #[account(
        mut,
        constraint = market.authority == authority.key() @ ErrorCode::Unauthorized,
        constraint = market.status != state::MarketStatus::Resolved @ ErrorCode::MarketAlreadyResolved,
        constraint = market.status != state::MarketStatus::Cancelled @ ErrorCode::MarketCancelled,
    )]
    pub market: Account<'info, state::Market>,

    /// Market authority
    pub authority: Signer<'info>,
}

/// Accounts for claiming refund
#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    /// The cancelled market
    #[account(
        constraint = market.status == state::MarketStatus::Cancelled @ ErrorCode::MarketCancelled,
    )]
    pub market: Account<'info, state::Market>,

    /// Market vault holding funds
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, state::MarketVault>,

    /// User's bet record
    #[account(
        mut,
        seeds = [b"bet", market.key().as_ref(), bettor.key().as_ref()],
        bump = bet_record.bump,
        constraint = bet_record.market == market.key() @ ErrorCode::InvalidAccount,
        constraint = bet_record.bettor == bettor.key() @ ErrorCode::Unauthorized,
        constraint = !bet_record.claimed @ ErrorCode::BetAlreadyClaimed,
    )]
    pub bet_record: Account<'info, state::BetRecord>,

    /// The bettor claiming refund
    #[account(mut)]
    pub bettor: Signer<'info>,

    /// System program
    pub system_program: Program<'info, System>,
}

// =============================================================================
// EVENTS
// =============================================================================

#[event]
pub struct MarketStateInitRequested {
    pub market: Pubkey,
    pub computation_offset: u64,
}

#[event]
pub struct MarketStateInitialized {
    pub market: Pubkey,
    pub nonce: u128,
}

#[event]
pub struct BetPlaced {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub bet_index: u32,
    pub bet_lamports: u64,
    pub computation_offset: u64,
}

#[event]
pub struct BetConfirmed {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub bet_index: u32,
}

#[event]
pub struct MarketResolutionRequested {
    pub market: Pubkey,
    pub resolver: Pubkey,
    pub outcome: bool,
    pub computation_offset: u64,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub outcome: bool,
    pub yes_pool: u64,
    pub no_pool: u64,
    pub total_pool: u64,
}

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub market_id: u64,
    pub authority: Pubkey,
    pub question: String,
    pub resolution_time: i64,
    pub fee_bps: u16,
}

#[event]
pub struct MarketClosed {
    pub market: Pubkey,
    pub closed_by: Pubkey,
    pub bet_count: u32,
    pub total_liquidity: u64,
}

#[event]
pub struct PayoutClaimed {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub bet_amount: u64,
    pub payout_amount: u64,
    pub won: bool,
}

#[event]
pub struct MarketCancelled {
    pub market: Pubkey,
    pub cancelled_by: Pubkey,
    pub bet_count: u32,
    pub total_liquidity: u64,
}

#[event]
pub struct RefundClaimed {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub refund_amount: u64,
}

// =============================================================================
// ERROR CODES
// =============================================================================

/// Error codes for the VEIL program
#[error_code]
pub enum ErrorCode {
    // === Market Errors ===
    #[msg("Market is not open for betting")]
    MarketNotOpen,

    #[msg("Market is not closed")]
    MarketNotClosed,

    #[msg("Market is not resolved")]
    MarketNotResolved,

    #[msg("Market has already been resolved")]
    MarketAlreadyResolved,

    #[msg("Market has been cancelled")]
    MarketCancelled,

    #[msg("Betting period has ended")]
    BettingPeriodEnded,

    #[msg("Resolution time has not been reached")]
    ResolutionTimeNotReached,

    #[msg("MPC state not initialized")]
    MpcNotInitialized,

    #[msg("MPC state already initialized")]
    MpcAlreadyInitialized,

    // === Bet Errors ===
    #[msg("Bet amount too low")]
    BetAmountTooLow,

    #[msg("Bet amount too high")]
    BetAmountTooHigh,

    #[msg("Bet already claimed")]
    BetAlreadyClaimed,

    #[msg("Bet not confirmed")]
    BetNotConfirmed,

    #[msg("Invalid bet claim")]
    InvalidBetClaim,

    #[msg("Bet verification failed")]
    BetVerificationFailed,

    // === Authorization Errors ===
    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Invalid authority")]
    InvalidAuthority,

    #[msg("Invalid oracle")]
    InvalidOracle,

    // === MPC Errors ===
    #[msg("MPC computation failed")]
    MpcComputationFailed,

    #[msg("Invalid MPC callback")]
    InvalidMpcCallback,

    #[msg("MPC verification failed")]
    MpcVerificationFailed,

    #[msg("MPC cluster not set")]
    ClusterNotSet,

    #[msg("Computation was aborted")]
    AbortedComputation,

    // === Vault Errors ===
    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,

    #[msg("Invalid vault")]
    InvalidVault,

    // === General Errors ===
    #[msg("Invalid input")]
    InvalidInput,

    #[msg("Overflow")]
    Overflow,

    #[msg("Invalid account")]
    InvalidAccount,
}

/// Alias for backwards compatibility
pub type VeilError = ErrorCode;
