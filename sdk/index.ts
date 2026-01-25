/**
 * VEIL SDK - Private Parimutuel Prediction Market
 *
 * A TypeScript SDK for interacting with the VEIL prediction market
 * powered by Arcium Multi-Party Computation.
 *
 * @example
 * ```typescript
 * import { VeilClient, createVeilClient } from "@veil/sdk";
 * import { Connection } from "@solana/web3.js";
 * import { Wallet } from "@coral-xyz/anchor";
 *
 * const client = createVeilClient({
 *   connection: new Connection("https://api.devnet.solana.com"),
 *   wallet: myWallet,
 *   cluster: "devnet",
 * });
 *
 * // Create a market
 * const marketId = new BN(Date.now());
 * await client.createMarket({
 *   marketId,
 *   question: "Will BTC hit $100k by December 2026?",
 *   resolutionTime: Math.floor(Date.now() / 1000) + 86400 * 7,
 *   oracleType: "manual",
 *   feeBps: 300,
 * });
 *
 * // Initialize MPC state
 * const market = client.getMarketPda(wallet.publicKey, marketId);
 * await client.initMarketState(market);
 *
 * // Place a bet
 * await client.placeBet({
 *   market,
 *   outcome: true, // YES
 *   amountLamports: new BN(100_000_000), // 0.1 SOL
 * });
 * ```
 */

// Client
export { VeilClient, createVeilClient } from "./client";
export type { VeilClientConfig, ClusterType } from "./client";

// Types
export type {
  Market,
  Vault,
  BetRecord,
  MarketConfig,
  EncryptedValue,
  EncryptedBet,
  CreateMarketParams,
  PlaceBetParams,
  ResolveMarketParams,
  ClaimPayoutParams,
  MarketCreatedEvent,
  BetPlacedEvent,
  BetConfirmedEvent,
  MarketResolvedEvent,
  ComputationResult,
  MpcState,
  OracleType,
  MarketStatus,
  BetStatus,
} from "./types";

// PDA Helpers
export {
  getMarketPda,
  getVaultPda,
  getBetRecordPda,
  getUserStatsPda,
  getSignPda,
  getMarketPdas,
  getBetPdas,
} from "./pdas";

// Encryption Helpers
export {
  generateKeypair,
  generateNonce,
  generateComputationOffset,
  encryptBool,
  encryptU64,
  encryptBet,
  toNumberArray,
  fromNumberArray,
} from "./encryption";

// Constants
export {
  VEIL_PROGRAM_ID,
  VEIL_PROGRAM_IDS,
  ARCIUM_PROGRAM_ID,
  CLUSTER_OFFSETS,
  MIN_BET_LAMPORTS,
  MAX_BET_LAMPORTS,
  MAX_QUESTION_LENGTH,
  MAX_FEE_BPS,
  SEEDS,
  ORACLE_TYPES,
  MARKET_STATUS,
  BET_STATUS,
} from "./constants";
