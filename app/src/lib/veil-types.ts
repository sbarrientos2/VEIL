/**
 * VEIL SDK Types & Helpers
 *
 * Re-exports SDK types and provides UI transformation helpers.
 */

import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

// ============================================================================
// CORE TYPES (matching SDK)
// ============================================================================

export type OracleType = "manual" | "switchboard" | "jury";

export type MarketStatus =
  | "open"
  | "closed"
  | "resolving"
  | "resolved"
  | "cancelled";

export type BetStatus = "pending" | "confirmed" | "claimed" | "refunded";

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
  // Computed values
  yesPool: number;
  noPool: number;
  totalPool: number;
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

export interface ClaimPayoutParams {
  market: PublicKey;
  outcome: boolean;
  amountLamports: BN;
}

export interface ComputationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// UI TYPES (for frontend display)
// ============================================================================

export interface UIMarket {
  /** Market pubkey as string for routing */
  id: string;
  /** Market PDA */
  pubkey: PublicKey;
  /** The prediction question */
  question: string;
  /** Current status */
  status: MarketStatus;
  /** YES pool in SOL */
  yesPool: number;
  /** NO pool in SOL */
  noPool: number;
  /** Total pool in SOL */
  totalPool: number;
  /** Resolution time as Date */
  endTime: Date;
  /** Created at as Date */
  createdAt: Date;
  /** Number of bets placed */
  participantCount: number;
  /** Fee percentage (0-100) */
  feePercent: number;
  /** Oracle type */
  oracleType: OracleType;
  /** Resolved outcome (null if not resolved) */
  outcome: boolean | null;
  /** Whether MPC is initialized */
  mpcInitialized: boolean;
  /** Market authority */
  authority: string;
}

export interface UIBet {
  /** Bet record pubkey as string */
  id: string;
  /** Market pubkey as string */
  marketId: string;
  /** Market PDA */
  marketPubkey: PublicKey;
  /** Bet amount in SOL */
  amount: number;
  /** Bet status */
  status: BetStatus;
  /** When the bet was placed */
  placedAt: Date;
  /** When the bet was confirmed */
  confirmedAt: Date | null;
  /** Whether the bet has been claimed */
  claimed: boolean;
  /** Payout amount in SOL (if claimed) */
  payoutAmount: number | null;
}

// ============================================================================
// TRANSFORMATION HELPERS
// ============================================================================

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Transform SDK Market to UI-friendly format
 */
export function transformMarket(sdkMarket: Market, marketPubkey: PublicKey): UIMarket {
  return {
    id: marketPubkey.toBase58(),
    pubkey: marketPubkey,
    question: sdkMarket.question,
    status: sdkMarket.status,
    yesPool: sdkMarket.revealedYesPool.toNumber() / LAMPORTS_PER_SOL,
    noPool: sdkMarket.revealedNoPool.toNumber() / LAMPORTS_PER_SOL,
    totalPool: sdkMarket.revealedTotalPool.toNumber() / LAMPORTS_PER_SOL,
    endTime: new Date(sdkMarket.resolutionTime.toNumber() * 1000),
    createdAt: new Date(sdkMarket.createdAt.toNumber() * 1000),
    participantCount: sdkMarket.betCount,
    feePercent: sdkMarket.feeBps / 100,
    oracleType: sdkMarket.oracleType,
    outcome: sdkMarket.outcome,
    mpcInitialized: sdkMarket.mpcInitialized,
    authority: sdkMarket.authority.toBase58(),
  };
}

/**
 * Transform SDK BetRecord to UI-friendly format
 */
export function transformBet(sdkBet: BetRecord, betPubkey: PublicKey): UIBet {
  return {
    id: betPubkey.toBase58(),
    marketId: sdkBet.market.toBase58(),
    marketPubkey: sdkBet.market,
    amount: sdkBet.betLamports.toNumber() / LAMPORTS_PER_SOL,
    status: sdkBet.status,
    placedAt: new Date(sdkBet.placedAt.toNumber() * 1000),
    confirmedAt: sdkBet.confirmedAt
      ? new Date(sdkBet.confirmedAt.toNumber() * 1000)
      : null,
    claimed: sdkBet.claimed,
    payoutAmount: sdkBet.payoutAmount
      ? sdkBet.payoutAmount.toNumber() / LAMPORTS_PER_SOL
      : null,
  };
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): BN {
  return new BN(Math.floor(sol * LAMPORTS_PER_SOL));
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: BN | number): number {
  const value = typeof lamports === "number" ? lamports : lamports.toNumber();
  return value / LAMPORTS_PER_SOL;
}

/**
 * Format SOL amount for display
 */
export function formatSol(sol: number, decimals = 2): string {
  return sol.toFixed(decimals);
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format date with time for display
 */
export function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Calculate time remaining until a date
 */
export function getTimeRemaining(endTime: Date): string {
  const now = new Date();
  const diff = endTime.getTime() - now.getTime();

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Get status display properties
 */
export function getStatusDisplay(status: MarketStatus): {
  label: string;
  color: string;
} {
  switch (status) {
    case "open":
      return { label: "Open", color: "green" };
    case "closed":
      return { label: "Closed", color: "yellow" };
    case "resolving":
      return { label: "Resolving", color: "blue" };
    case "resolved":
      return { label: "Resolved", color: "purple" };
    case "cancelled":
      return { label: "Cancelled", color: "red" };
    default:
      return { label: "Unknown", color: "gray" };
  }
}

/**
 * Get bet status display properties
 */
export function getBetStatusDisplay(status: BetStatus): {
  label: string;
  color: string;
} {
  switch (status) {
    case "pending":
      return { label: "Pending", color: "yellow" };
    case "confirmed":
      return { label: "Confirmed", color: "green" };
    case "claimed":
      return { label: "Claimed", color: "purple" };
    case "refunded":
      return { label: "Refunded", color: "blue" };
    default:
      return { label: "Unknown", color: "gray" };
  }
}

// ============================================================================
// VEIL CLIENT INTERFACE (for type safety)
// ============================================================================

/**
 * VeilClient interface matching the SDK
 */
export interface VeilClient {
  getMarket(market: PublicKey): Promise<Market | null>;
  getAllMarkets(): Promise<Market[]>;
  getUserBets(bettor: PublicKey): Promise<BetRecord[]>;
  createMarket(params: CreateMarketParams): Promise<string>;
  initMarketState(market: PublicKey): Promise<ComputationResult<{ transactionSignature: string; computationOffset: bigint }>>;
  placeBet(params: PlaceBetParams): Promise<ComputationResult<{ transactionSignature: string; computationOffset: bigint }>>;
  closeMarket(market: PublicKey): Promise<string>;
  resolveMarket(params: { market: PublicKey; outcome: boolean }): Promise<ComputationResult<{ transactionSignature: string; computationOffset: bigint }>>;
  claimPayout(params: ClaimPayoutParams): Promise<string>;
  cancelMarket(market: PublicKey): Promise<string>;
  claimRefund(market: PublicKey): Promise<string>;
  isMxeInitialized(): Promise<boolean>;
  getMarketPda(authority: PublicKey, marketId: BN): PublicKey;
  programId: PublicKey;
}
