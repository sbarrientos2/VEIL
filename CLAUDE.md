# VEIL - Development Guide

> Private Parimutuel Prediction Market on Solana with Arcium MPC

This document contains all the knowledge needed to build VEIL, including Arcium integration patterns, architecture decisions, and implementation details.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Arcium Integration Guide](#arcium-integration-guide)
4. [Encrypted Instructions (Arcis)](#encrypted-instructions-arcis)
5. [Solana Program Patterns](#solana-program-patterns)
6. [Client-Side Encryption](#client-side-encryption)
7. [Account Structures](#account-structures)
8. [Instruction Reference](#instruction-reference)
9. [Testing Patterns](#testing-patterns)
10. [Deployment](#deployment)
11. [Development Checklist](#development-checklist)

---

## Project Overview

### The Problem
Traditional prediction markets suffer from:
- **Whale manipulation** - Large bettors visibly move markets
- **Herding behavior** - Users follow "smart money" instead of thinking independently
- **Front-running** - Bots exploit visible pending transactions
- **Doxxing risk** - High-profile bettors face harassment

### The Solution
VEIL uses a **sealed envelope** approach:
1. Users place encrypted bets (amount + direction hidden)
2. Bets aggregate in MPC without revealing individual positions
3. At resolution, only pool totals are revealed (never individual bets)
4. Winners share the losing pool (parimutuel payout)

### Tech Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Blockchain | Solana | 2.3.0+ |
| Smart Contracts | Anchor | 0.32.1 |
| MPC | Arcium | 0.6.3 |
| Frontend | Next.js | 14+ |
| Oracle | Switchboard | (planned) |

---

## Architecture

### System Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              USER FLOW                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐  │
│  │   Create    │───▶│  Init MPC   │───▶│      Place Bets             │  │
│  │   Market    │    │   State     │    │  (encrypted, aggregated)    │  │
│  └─────────────┘    └─────────────┘    └─────────────────────────────┘  │
│         │                                            │                   │
│         │              ┌─────────────────────────────┘                   │
│         ▼              ▼                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐  │
│  │    Close    │───▶│   Resolve   │───▶│      Claim Payouts          │  │
│  │   Market    │    │   Market    │    │   (winners get share)       │  │
│  └─────────────┘    └─────────────┘    └─────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input                    MPC Network                  On-Chain
─────────────────────────────────────────────────────────────────────

  outcome (YES/NO) ──┐
                     ├──▶ Encrypt ──▶ Queue ──▶ MPC Nodes
  amount (lamports) ─┘     (client)    (CPI)      │
                                                  │
                                          ┌───────┘
                                          ▼
                              Aggregate into pools
                              (encrypted state)
                                          │
                                          ▼
                              Callback to program
                                          │
                                          ▼
                              Store encrypted state
                              on Market account
```

### Account Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ACCOUNT HIERARCHY                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Market (PDA: ["market", authority, market_id])                         │
│  ├── Configuration (question, resolution_time, fee_bps, oracle_type)   │
│  ├── Encrypted State ([yes_pool, no_pool, bet_count] as ciphertexts)   │
│  ├── State Nonce (u128 for MPC state tracking)                         │
│  ├── Revealed State (yes_pool, no_pool, total - after resolution)      │
│  └── Status (Open → Closed → Resolving → Resolved | Cancelled)         │
│                                                                         │
│  MarketVault (PDA: ["vault", market])                                   │
│  ├── Holds all SOL deposits                                            │
│  └── Tracks deposits/withdrawals                                        │
│                                                                         │
│  BetRecord (PDA: ["bet", market, bettor])                               │
│  ├── Encrypted bet (outcome, amount as ciphertexts)                    │
│  ├── User pubkey (for verification)                                    │
│  ├── Plaintext lamports (for vault tracking)                           │
│  └── Status (Pending → Confirmed → Claimed | Refunded)                 │
│                                                                         │
│  UserStats (PDA: ["user_stats", user]) - Optional                       │
│  └── Leaderboard data                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Arcium Integration Guide

### Dependencies

```toml
# programs/veil/Cargo.toml
[dependencies]
anchor-lang = "0.32.1"
anchor-spl = "0.32.1"
arcium-anchor = "0.6.3"
arcium-client = "0.6.3"
```

```json
// package.json
{
  "dependencies": {
    "@coral-xyz/anchor": "^0.32.1",
    "@solana/web3.js": "^1.95.0",
    "@arcium-hq/client": "0.5.4"
  }
}
```

### Core Macros

| Macro | Purpose | Usage |
|-------|---------|-------|
| `#[arcium_program]` | Enable Arcium features | Place after `#[program]` |
| `#[queue_computation_accounts("name", payer)]` | Queue MPC computation | On account structs |
| `#[callback_accounts("name")]` | Receive MPC results | On callback account structs |
| `#[init_computation_definition_accounts("name", payer)]` | Initialize circuit | On init structs |
| `#[arcium_callback(encrypted_ix = "name")]` | Mark callback handler | On callback functions |
| `comp_def_offset("name")` | Get circuit offset | For constants |

### Required Imports

```rust
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;
```

### Computation Definition Offsets

```rust
// Define at top of lib.rs
const COMP_DEF_OFFSET_INIT_MARKET_STATE: u32 = comp_def_offset("init_market_state");
const COMP_DEF_OFFSET_PLACE_BET: u32 = comp_def_offset("place_bet");
const COMP_DEF_OFFSET_REVEAL_MARKET_TOTALS: u32 = comp_def_offset("reveal_market_totals");
const COMP_DEF_OFFSET_CALCULATE_PAYOUT_POOLS: u32 = comp_def_offset("calculate_payout_pools");
const COMP_DEF_OFFSET_VERIFY_BET_CLAIM: u32 = comp_def_offset("verify_bet_claim");
const COMP_DEF_OFFSET_GET_BET_COUNT: u32 = comp_def_offset("get_bet_count");
```

### Arcium Account PDAs

These accounts are required for every MPC computation:

```rust
// MXE Account - Program's MPC execution environment
#[account(address = derive_mxe_pda!())]
pub mxe_account: Account<'info, MXEAccount>,

// Sign PDA - Signing authority for MPC
#[account(
    init_if_needed,
    space = 9,
    payer = payer,
    seeds = [&SIGN_PDA_SEED],
    bump,
    address = derive_sign_pda!(),
)]
pub sign_pda_account: Account<'info, ArciumSignerAccount>,

// Mempool - Queue for pending computations
#[account(mut, address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
pub mempool_account: UncheckedAccount<'info>,

// Executing Pool - Currently running computations
#[account(mut, address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
pub executing_pool: UncheckedAccount<'info>,

// Computation Account - Stores computation data
#[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet))]
pub computation_account: UncheckedAccount<'info>,

// Computation Definition - Circuit definition
#[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_XXX))]
pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

// Cluster - MPC cluster account
#[account(mut, address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
pub cluster_account: Account<'info, Cluster>,

// Fee Pool - Arcium fees
#[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
pub pool_account: Account<'info, FeePool>,

// Clock - Arcium clock
#[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
pub clock_account: Account<'info, ClockAccount>,

// Programs
pub system_program: Program<'info, System>,
pub arcium_program: Program<'info, Arcium>,
```

---

## Encrypted Instructions (Arcis)

### File: `encrypted-ixs/src/lib.rs`

```rust
use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    // ═══════════════════════════════════════════════════════════════════
    // DATA STRUCTURES
    // ═══════════════════════════════════════════════════════════════════

    /// Encrypted bet submitted by user
    pub struct Bet {
        pub outcome: bool,    // true = YES, false = NO
        pub amount: u64,      // bet amount in lamports
    }

    /// Encrypted market state (MXE-owned, only MPC nodes can read)
    pub struct MarketState {
        pub yes_pool: u64,    // Total bet on YES
        pub no_pool: u64,     // Total bet on NO
        pub bet_count: u32,   // Number of bets
    }

    /// Revealed totals (plaintext, public after resolution)
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

    /// Bet claim for verification
    pub struct BetClaim {
        pub claimed_outcome: bool,
        pub claimed_amount: u64,
    }

    // ═══════════════════════════════════════════════════════════════════
    // INSTRUCTIONS
    // ═══════════════════════════════════════════════════════════════════

    /// Initialize market with zero pools
    #[instruction]
    pub fn init_market_state(mxe: Mxe) -> Enc<Mxe, MarketState> {
        let initial_state = MarketState {
            yes_pool: 0,
            no_pool: 0,
            bet_count: 0,
        };
        mxe.from_arcis(initial_state)
    }

    /// Aggregate encrypted bet into pools
    #[instruction]
    pub fn place_bet(
        bet_ctxt: Enc<Shared, Bet>,
        state_ctxt: Enc<Mxe, MarketState>,
    ) -> Enc<Mxe, MarketState> {
        let bet = bet_ctxt.to_arcis();
        let mut state = state_ctxt.to_arcis();

        if bet.outcome {
            state.yes_pool = state.yes_pool + bet.amount;
        } else {
            state.no_pool = state.no_pool + bet.amount;
        }
        state.bet_count = state.bet_count + 1;

        state_ctxt.owner.from_arcis(state)
    }

    /// Reveal pool totals at resolution
    #[instruction]
    pub fn reveal_market_totals(state_ctxt: Enc<Mxe, MarketState>) -> MarketTotals {
        let state = state_ctxt.to_arcis();
        MarketTotals {
            yes_pool: state.yes_pool,
            no_pool: state.no_pool,
            total_pool: state.yes_pool + state.no_pool,
        }.reveal()
    }

    /// Calculate payout pools given outcome
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

    /// Verify bet claim matches original
    #[instruction]
    pub fn verify_bet_claim(
        original_bet: Enc<Shared, Bet>,
        claim: Enc<Shared, BetClaim>,
    ) -> bool {
        let bet = original_bet.to_arcis();
        let claimed = claim.to_arcis();
        (bet.outcome == claimed.claimed_outcome && bet.amount == claimed.claimed_amount).reveal()
    }

    /// Get bet count without revealing pools
    #[instruction]
    pub fn get_bet_count(state_ctxt: Enc<Mxe, MarketState>) -> u32 {
        let state = state_ctxt.to_arcis();
        state.bet_count.reveal()
    }
}
```

### Type Mappings

| Arcis Type | Purpose | Output Type |
|------------|---------|-------------|
| `Enc<Mxe, T>` | MXE-only encrypted data | Ciphertexts + nonce |
| `Enc<Shared, T>` | Client + MXE encrypted | Ciphertexts + nonce |
| `T` (returned) | Plaintext reveal | Direct value |
| `.reveal()` | Make value public | Plaintext output |

### Supported Types

- Integers: `u8`, `u16`, `u32`, `u64`, `u128`, `i8`-`i128`
- Boolean: `bool`
- Arrays: Fixed-length arrays of supported types
- Structs: Composed of supported types
- **NOT supported**: `Vec`, `String`, `HashMap`, dynamic types

---

## Solana Program Patterns

### Program Structure

```rust
use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;

// Computation definition offsets
const COMP_DEF_OFFSET_INIT_MARKET_STATE: u32 = comp_def_offset("init_market_state");
const COMP_DEF_OFFSET_PLACE_BET: u32 = comp_def_offset("place_bet");
// ... etc

declare_id!("VEiL111111111111111111111111111111111111111");

#[arcium_program]
pub mod veil {
    use super::*;

    // Computation definition initializers (one per circuit)
    pub fn init_market_state_comp_def(ctx: Context<InitMarketStateCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    // Instructions + Callbacks
    // ...
}
```

### Encrypted State Storage Pattern

Store encrypted state as fixed-size ciphertext arrays:

```rust
#[account]
#[derive(InitSpace)]
pub struct Market {
    pub bump: u8,
    // ... config fields ...

    // Encrypted state - 3 ciphertexts: [yes_pool, no_pool, bet_count]
    pub encrypted_state: [[u8; 32]; 3],
    pub state_nonce: u128,
    pub mpc_initialized: bool,

    // Revealed state (after resolution)
    pub revealed_yes_pool: u64,
    pub revealed_no_pool: u64,
    pub revealed_total_pool: u64,
}

impl Market {
    // Byte offset to encrypted_state for ArgBuilder
    pub const ENCRYPTED_STATE_OFFSET: u32 = 8  // discriminator
        + 1   // bump
        // ... calculate based on preceding fields
        ;
    pub const ENCRYPTED_STATE_SIZE: u32 = 32 * 3; // 3 ciphertexts
}
```

### ArgBuilder Usage

```rust
// For Enc<Shared, T> input (user-encrypted data):
let args = ArgBuilder::new()
    .x25519_pubkey(user_pubkey)          // User's X25519 public key
    .plaintext_u128(user_nonce)          // User's nonce
    .encrypted_bool(encrypted_outcome)    // Encrypted field
    .encrypted_u64(encrypted_amount)      // Encrypted field
    .build();

// For Enc<Mxe, T> input (reading on-chain state):
let args = ArgBuilder::new()
    .plaintext_u128(state_nonce)         // State nonce
    .account(
        account_key,                      // Account pubkey
        ENCRYPTED_STATE_OFFSET,           // Byte offset
        ENCRYPTED_STATE_SIZE,             // Size in bytes
    )
    .build();

// Combined (place_bet reads user input + market state):
let args = ArgBuilder::new()
    .x25519_pubkey(user_pubkey)
    .plaintext_u128(user_nonce)
    .encrypted_bool(encrypted_outcome)
    .encrypted_u64(encrypted_amount)
    .plaintext_u128(market.state_nonce)
    .account(market.key(), OFFSET, SIZE)
    .build();
```

### Queue Computation Pattern

```rust
queue_computation(
    ctx.accounts,                          // Account context (must have Arcium accounts)
    computation_offset,                    // Random u64 identifier
    args,                                  // Built arguments
    None,                                  // Optional callback server URL
    vec![XxxCallback::callback_ix(         // Callback instruction
        computation_offset,
        &ctx.accounts.mxe_account,
        &[CallbackAccount {                // Accounts to pass to callback
            pubkey: ctx.accounts.market.key(),
            is_writable: true,
        }],
    )?],
    1,                                     // Transaction count
    0,                                     // Priority fee (lamports)
)?;
```

### Callback Handler Pattern

```rust
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

    // Update on-chain state with new encrypted values
    let market = &mut ctx.accounts.market;
    market.encrypted_state = o.ciphertexts;
    market.state_nonce = o.nonce;

    // Update other state
    market.bet_count += 1;

    emit!(BetConfirmed { ... });
    Ok(())
}
```

---

## Client-Side Encryption

### TypeScript Pattern

```typescript
import {
    x25519,
    RescueCipher,
    getMXEPublicKey,
    deserializeLE,
    awaitComputationFinalization,
    getCompDefAccOffset,
    getCompDefAccAddress,
    getComputationAccAddress,
    getMXEAccAddress,
    getMempoolAccAddress,
    getExecutingPoolAccAddress,
    getClusterAccAddress,
    getArciumEnv,
} from "@arcium-hq/client";
import { randomBytes } from "crypto";

// 1. Generate user keypair
const privateKey = x25519.utils.randomSecretKey();
const publicKey = x25519.getPublicKey(privateKey);

// 2. Get MXE public key
const mxePublicKey = await getMXEPublicKey(provider, programId);

// 3. Create shared secret and cipher
const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
const cipher = new RescueCipher(sharedSecret);

// 4. Encrypt bet data
const nonce = randomBytes(16);
const plaintext = [
    BigInt(outcome ? 1 : 0),  // outcome as bool (0 or 1)
    BigInt(amount),           // amount in lamports
];
const ciphertext = cipher.encrypt(plaintext, nonce);

// 5. Generate computation offset
const computationOffset = new anchor.BN(randomBytes(8), "hex");

// 6. Call program
const arciumEnv = getArciumEnv();
await program.methods
    .placeBet(
        computationOffset,
        Array.from(ciphertext[0]),      // encrypted_outcome
        Array.from(ciphertext[1]),      // encrypted_amount
        Array.from(publicKey),          // user X25519 pubkey
        new anchor.BN(deserializeLE(nonce).toString()),
        new anchor.BN(betLamports),
    )
    .accountsPartial({
        market: marketPda,
        vault: vaultPda,
        betRecord: betRecordPda,
        bettor: wallet.publicKey,
        computationAccount: getComputationAccAddress(
            arciumEnv.arciumClusterOffset,
            computationOffset
        ),
        clusterAccount: getClusterAccAddress(arciumEnv.arciumClusterOffset),
        mxeAccount: getMXEAccAddress(programId),
        mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
        executingPool: getExecutingPoolAccAddress(arciumEnv.arciumClusterOffset),
        compDefAccount: getCompDefAccAddress(
            programId,
            Buffer.from(getCompDefAccOffset("place_bet")).readUInt32LE()
        ),
    })
    .rpc({ skipPreflight: true, commitment: "confirmed" });

// 7. Wait for MPC completion
await awaitComputationFinalization(
    provider,
    computationOffset,
    programId,
    "confirmed"
);
```

### Helper Functions

```typescript
// Get MXE public key with retry
async function getMXEPublicKeyWithRetry(
    provider: AnchorProvider,
    programId: PublicKey,
    maxRetries = 20,
    retryDelayMs = 500
): Promise<Uint8Array> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const key = await getMXEPublicKey(provider, programId);
            if (key) return key;
        } catch (error) {
            console.log(`Attempt ${attempt} failed:`, error);
        }
        if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, retryDelayMs));
        }
    }
    throw new Error(`Failed after ${maxRetries} attempts`);
}

// PDA helpers
function getMarketPda(programId: PublicKey, authority: PublicKey, marketId: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("market"), authority.toBuffer(), marketId.toArrayLike(Buffer, "le", 8)],
        programId
    );
}

function getVaultPda(programId: PublicKey, market: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), market.toBuffer()],
        programId
    );
}

function getBetRecordPda(programId: PublicKey, market: PublicKey, bettor: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("bet"), market.toBuffer(), bettor.toBuffer()],
        programId
    );
}
```

---

## Account Structures

### Market Account

```rust
#[account]
#[derive(InitSpace)]
pub struct Market {
    // Identity
    pub bump: u8,
    pub market_id: u64,
    pub authority: Pubkey,

    // Configuration
    #[max_len(200)]
    pub question: String,
    pub resolution_time: i64,
    pub created_at: i64,
    pub fee_bps: u16,

    // Oracle
    pub oracle_type: OracleType,
    pub oracle_feed: Option<Pubkey>,

    // Status
    pub status: MarketStatus,
    pub outcome: Option<bool>,

    // Encrypted State (3 ciphertexts: yes_pool, no_pool, bet_count)
    pub encrypted_state: [[u8; 32]; 3],
    pub state_nonce: u128,
    pub mpc_initialized: bool,

    // Revealed State (after resolution)
    pub revealed_yes_pool: u64,
    pub revealed_no_pool: u64,
    pub revealed_total_pool: u64,

    // Counters
    pub bet_count: u32,
    pub total_liquidity_approx: u64,

    // Vault
    pub vault: Pubkey,
}
```

### BetRecord Account

```rust
#[account]
#[derive(InitSpace)]
pub struct BetRecord {
    pub bump: u8,
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub bet_index: u32,

    // Encrypted position (2 ciphertexts: outcome, amount)
    pub encrypted_bet: [[u8; 32]; 2],
    pub user_pubkey: [u8; 32],
    pub user_nonce: u128,

    // Plaintext amount (for vault tracking)
    pub bet_lamports: u64,

    // Status
    pub status: BetStatus,
    pub placed_at: i64,
    pub confirmed_at: Option<i64>,
    pub claimed: bool,
    pub payout_amount: Option<u64>,
}
```

---

## Instruction Reference

### 1. Initialize Computation Definitions

Must be called once per circuit before any computations:

```rust
pub fn init_market_state_comp_def(ctx: Context<InitMarketStateCompDef>) -> Result<()>
pub fn init_place_bet_comp_def(ctx: Context<InitPlaceBetCompDef>) -> Result<()>
pub fn init_calculate_payout_pools_comp_def(ctx: Context<InitCalculatePayoutPoolsCompDef>) -> Result<()>
```

### 2. Create Market

Creates market account and vault. Does NOT initialize MPC state.

```rust
pub fn create_market(
    ctx: Context<CreateMarket>,
    market_id: u64,
    question: String,
    resolution_time: i64,
    oracle_type: u8,
    fee_bps: u16,
) -> Result<()>
```

### 3. Initialize Market State (MPC)

Initializes encrypted pools via MPC. Queues computation, callback sets state.

```rust
pub fn init_market_state(
    ctx: Context<InitMarketState>,
    computation_offset: u64,
    nonce: u128,
) -> Result<()>

#[arcium_callback(encrypted_ix = "init_market_state")]
pub fn init_market_state_callback(
    ctx: Context<InitMarketStateCallback>,
    output: SignedComputationOutputs<InitMarketStateOutput>,
) -> Result<()>
```

### 4. Place Bet (MPC)

Places encrypted bet, transfers SOL, queues MPC aggregation.

```rust
pub fn place_bet(
    ctx: Context<PlaceBet>,
    computation_offset: u64,
    encrypted_outcome: [u8; 32],
    encrypted_amount: [u8; 32],
    user_pubkey: [u8; 32],
    nonce: u128,
    bet_lamports: u64,
) -> Result<()>

#[arcium_callback(encrypted_ix = "place_bet")]
pub fn place_bet_callback(
    ctx: Context<PlaceBetCallback>,
    output: SignedComputationOutputs<PlaceBetOutput>,
) -> Result<()>
```

### 5. Close Market

Closes market to new bets.

```rust
pub fn close_market(ctx: Context<CloseMarket>) -> Result<()>
```

### 6. Resolve Market (MPC)

Calculates payout pools via MPC.

```rust
pub fn resolve_market(
    ctx: Context<ResolveMarket>,
    computation_offset: u64,
    outcome: bool,
) -> Result<()>

#[arcium_callback(encrypted_ix = "calculate_payout_pools")]
pub fn resolve_market_callback(
    ctx: Context<ResolveMarketCallback>,
    output: SignedComputationOutputs<CalculatePayoutPoolsOutput>,
) -> Result<()>
```

### 7. Claim Payout

Winners claim their share from vault.

```rust
pub fn claim_payout(
    ctx: Context<ClaimPayout>,
    claimed_outcome: bool,
    claimed_amount: u64,
) -> Result<()>
```

### 8. Cancel Market & Claim Refund

Emergency cancellation and refund flow.

```rust
pub fn cancel_market(ctx: Context<CancelMarket>) -> Result<()>
pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()>
```

---

## Testing Patterns

### Test Setup

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Veil } from "../target/types/veil";
import {
    x25519,
    RescueCipher,
    getMXEPublicKey,
    awaitComputationFinalization,
    // ... other imports
} from "@arcium-hq/client";

describe("VEIL", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.Veil as Program<Veil>;

    let mxePublicKey: Uint8Array;

    before(async () => {
        // Initialize computation definitions
        await initMarketStateCompDef(program, owner);
        await initPlaceBetCompDef(program, owner);
        await initCalculatePayoutPoolsCompDef(program, owner);

        // Get MXE public key
        mxePublicKey = await getMXEPublicKeyWithRetry(provider, program.programId);
    });

    // Tests...
});
```

### Full Integration Test

```typescript
it("complete market lifecycle", async () => {
    // 1. Create market
    await program.methods
        .createMarket(marketId, question, resolutionTime, 0, 300)
        .accounts({ market, vault, authority })
        .rpc();

    // 2. Init MPC state
    const initOffset = randomComputationOffset();
    await program.methods
        .initMarketState(initOffset, nonce)
        .accounts({ market, ...arciumAccounts })
        .rpc();
    await awaitComputationFinalization(provider, initOffset, programId, "confirmed");

    // 3. Place bets
    const cipher = new RescueCipher(sharedSecret);
    const betOffset = randomComputationOffset();
    const ciphertext = cipher.encrypt([BigInt(1), BigInt(betAmount)], nonce);

    await program.methods
        .placeBet(betOffset, ciphertext[0], ciphertext[1], publicKey, nonce, betAmount)
        .accounts({ market, vault, betRecord, bettor, ...arciumAccounts })
        .rpc();
    await awaitComputationFinalization(provider, betOffset, programId, "confirmed");

    // 4. Close market
    await program.methods.closeMarket().accounts({ market, authority }).rpc();

    // 5. Resolve
    const resolveOffset = randomComputationOffset();
    await program.methods
        .resolveMarket(resolveOffset, true) // YES wins
        .accounts({ market, resolver, ...arciumAccounts })
        .rpc();
    await awaitComputationFinalization(provider, resolveOffset, programId, "confirmed");

    // 6. Claim payout
    await program.methods
        .claimPayout(true, betAmount)
        .accounts({ market, vault, betRecord, bettor })
        .rpc();
});
```

### Running Tests

```bash
# Build circuits + program
arcium build

# Run with local Arcium network
arcium test

# Run on devnet
arcium test --cluster devnet
```

---

## Deployment

### Local Development

```bash
# Start local Arcium network (Docker required)
arcium localnet

# Build
arcium build

# Test
arcium test
```

### Devnet Deployment

```bash
# Deploy program + circuits
arcium deploy \
    --cluster-offset <YOUR_OFFSET> \
    --keypair-path ~/.config/solana/id.json \
    --rpc-url https://devnet.helius-rpc.com/?api-key=YOUR_KEY
```

### Configuration Files

**Arcium.toml:**
```toml
[localnet]
nodes = 2
nodes_ips = [[172, 20, 0, 100], [172, 20, 0, 101]]
localnet_timeout_secs = 60
backends = ["Cerberus"]

[clusters.devnet]
offset = 123  # Your cluster offset
```

**Anchor.toml:**
```toml
[toolchain]
anchor_version = "0.30.1"

[programs.devnet]
veil = "VEiL111111111111111111111111111111111111111"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"
```

---

## Development Checklist

### Phase 1: Core Infrastructure
- [ ] Update Cargo.toml dependencies (arcium-anchor, arcium-client)
- [ ] Update package.json dependencies (@arcium-hq/client)
- [ ] Refactor encrypted-ixs for SDK compatibility
- [ ] Add `#[arcium_program]` macro to lib.rs
- [ ] Define computation definition offset constants

### Phase 2: Computation Definitions
- [ ] Create `init_market_state_comp_def` instruction
- [ ] Create `init_place_bet_comp_def` instruction
- [ ] Create `init_calculate_payout_pools_comp_def` instruction

### Phase 3: Market Creation
- [ ] Implement `create_market` (no MPC)
- [ ] Implement `init_market_state` with queue_computation
- [ ] Implement `init_market_state_callback`

### Phase 4: Betting
- [ ] Implement `place_bet` with queue_computation
- [ ] Implement `place_bet_callback`
- [ ] Handle SOL transfers to vault

### Phase 5: Resolution
- [ ] Implement `close_market`
- [ ] Implement `resolve_market` with queue_computation
- [ ] Implement `resolve_market_callback`
- [ ] Store revealed pool values

### Phase 6: Payouts
- [ ] Implement `claim_payout` with payout calculation
- [ ] Implement `cancel_market`
- [ ] Implement `claim_refund`

### Phase 7: Testing
- [ ] Write computation definition init tests
- [ ] Write market creation tests
- [ ] Write betting flow tests
- [ ] Write resolution tests
- [ ] Write payout tests

### Phase 8: Frontend (Optional for Hackathon)
- [ ] Market creation UI
- [ ] Betting interface with encryption
- [ ] Market browser
- [ ] Payout claiming

---

## Quick Reference

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ClusterNotSet` | MXE not initialized | Run `arcium localnet` or deploy to devnet |
| `AbortedComputation` | MPC failed verification | Check cluster account, retry |
| `MpcNotInitialized` | Market state not init'd | Call `init_market_state` first |
| Account size mismatch | Wrong offset calculation | Recalculate `ENCRYPTED_STATE_OFFSET` |

### Useful Commands

```bash
# Start local network
arcium localnet

# Build everything
arcium build

# Run tests
arcium test

# View logs
arcium logs

# Deploy to devnet
arcium deploy --cluster devnet

# Check Arcium version
arcium --version
```

### Resources

- Arcium Docs: https://docs.arcium.com/developers
- Arcium Examples: https://github.com/arcium-hq/examples
- Anchor Docs: https://www.anchor-lang.com/docs
- Solana Cookbook: https://solanacookbook.com

---

*VEIL: Where your bets stay hidden until the truth is revealed.*
