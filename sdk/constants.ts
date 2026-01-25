/**
 * VEIL SDK Constants
 */

import { PublicKey } from "@solana/web3.js";

// Program IDs for different environments
export const VEIL_PROGRAM_IDS = {
  localnet: new PublicKey("8LnpCJFjGfqKZskG4Y59F3qkzk6VVrVh2MtgmiknL6sP"),
  devnet: new PublicKey("FLPWpbDR64Ehb8Vo27YbDJQtPqGf488JwJmY3vH5uMxy"),
  mainnet: new PublicKey("FLPWpbDR64Ehb8Vo27YbDJQtPqGf488JwJmY3vH5uMxy"), // TBD
} as const;

// Default program ID (for backwards compatibility)
export const VEIL_PROGRAM_ID = VEIL_PROGRAM_IDS.devnet;

export const ARCIUM_PROGRAM_ID = new PublicKey(
  "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
);

// Cluster offsets for different environments
export const CLUSTER_OFFSETS = {
  localnet: 0,
  devnet: 456, // v0.6.3
  mainnet: 0, // TBD
} as const;

// Betting constraints
export const MIN_BET_LAMPORTS = 1_000_000; // 0.001 SOL
export const MAX_BET_LAMPORTS = 1_000_000_000_000; // 1000 SOL
export const MAX_QUESTION_LENGTH = 200;
export const MAX_FEE_BPS = 1000; // 10%

// PDA Seeds
export const SEEDS = {
  MARKET: Buffer.from("market"),
  VAULT: Buffer.from("vault"),
  BET: Buffer.from("bet"),
  USER_STATS: Buffer.from("user_stats"),
  SIGN_PDA: Buffer.from("sign_pda"),
} as const;

// Oracle types
export const ORACLE_TYPES = {
  MANUAL: 0,
  SWITCHBOARD: 1,
  JURY: 2,
} as const;

// Market status values
export const MARKET_STATUS = {
  OPEN: 0,
  CLOSED: 1,
  RESOLVING: 2,
  RESOLVED: 3,
  CANCELLED: 4,
} as const;

// Bet status values
export const BET_STATUS = {
  PENDING: 0,
  CONFIRMED: 1,
  CLAIMED: 2,
  REFUNDED: 3,
} as const;
