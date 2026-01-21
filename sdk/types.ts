/**
 * VEIL SDK Type Definitions
 */

import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

// ============================================================================
// MARKET TYPES
// ============================================================================

export type OracleType = "manual" | "switchboard" | "jury";

export type MarketStatus =
  | "open"
  | "closed"
  | "resolving"
  | "resolved"
  | "cancelled";

export type BetStatus = "pending" | "confirmed" | "claimed" | "refunded";

export interface MarketConfig {
  /** Unique identifier for this market */
  marketId: BN;
  /** The prediction question (max 200 chars) */
  question: string;
  /** Unix timestamp when betting closes */
  resolutionTime: number;
  /** Oracle type: manual, switchboard, or jury */
  oracleType: OracleType;
  /** Fee in basis points (100 = 1%, max 1000 = 10%) */
  feeBps: number;
}

export interface Market {
  bump: number;
  marketId: BN;
  authority: PublicKey;
  question: string;
  resolutionTime: BN;
  createdAt: BN;
  feeBps: number;
  oracleType: OracleType;
  oracleFeed: PublicKey | null;
  status: MarketStatus;
  outcome: boolean | null;
  encryptedState: Uint8Array[];
  stateNonce: BN;
  mpcInitialized: boolean;
  revealedYesPool: BN;
  revealedNoPool: BN;
  revealedTotalPool: BN;
  betCount: number;
  totalLiquidityApprox: BN;
  vault: PublicKey;
  // Convenience getters for frontend (computed from revealed pools)
  yesPool: number;
  noPool: number;
  totalPool: number;
}

export interface Vault {
  bump: number;
  market: PublicKey;
  totalDeposits: BN;
  totalWithdrawals: BN;
}

export interface BetRecord {
  bump: number;
  market: PublicKey;
  bettor: PublicKey;
  betIndex: number;
  encryptedBet: Uint8Array[];
  userPubkey: Uint8Array;
  userNonce: BN;
  betLamports: BN;
  status: BetStatus;
  placedAt: BN;
  confirmedAt: BN | null;
  claimed: boolean;
  payoutAmount: BN | null;
}

// ============================================================================
// ENCRYPTION TYPES
// ============================================================================

export interface EncryptedValue {
  /** The encrypted ciphertext (32 bytes) */
  ciphertext: Uint8Array;
  /** The encryption nonce */
  nonce: bigint;
  /** User's X25519 public key */
  publicKey: Uint8Array;
}

export interface EncryptedBet {
  /** Encrypted outcome (true = YES, false = NO) */
  encryptedOutcome: Uint8Array;
  /** Encrypted amount in lamports */
  encryptedAmount: Uint8Array;
  /** User's X25519 public key */
  userPubkey: Uint8Array;
  /** Encryption nonce */
  nonce: bigint;
}

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

export interface CreateMarketParams {
  marketId: BN;
  question: string;
  resolutionTime: number;
  oracleType: OracleType;
  feeBps: number;
}

export interface PlaceBetParams {
  market: PublicKey;
  outcome: boolean;
  amountLamports: BN;
}

export interface ResolveMarketParams {
  market: PublicKey;
  outcome: boolean;
}

export interface ClaimPayoutParams {
  market: PublicKey;
  outcome: boolean;
  amountLamports: BN;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface MarketCreatedEvent {
  market: PublicKey;
  marketId: BN;
  authority: PublicKey;
  question: string;
  resolutionTime: BN;
  feeBps: number;
}

export interface BetPlacedEvent {
  market: PublicKey;
  bettor: PublicKey;
  betIndex: number;
  betLamports: BN;
  computationOffset: BN;
}

export interface BetConfirmedEvent {
  market: PublicKey;
  bettor: PublicKey;
  betIndex: number;
}

export interface MarketResolvedEvent {
  market: PublicKey;
  outcome: boolean;
  yesPool: BN;
  noPool: BN;
  totalPool: BN;
}

// ============================================================================
// COMPUTATION TYPES
// ============================================================================

export interface ComputationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  transactionSignature?: string;
}

export interface MpcState {
  /** Encrypted ciphertexts for pools */
  ciphertexts: Uint8Array[];
  /** Current state nonce */
  nonce: bigint;
}
