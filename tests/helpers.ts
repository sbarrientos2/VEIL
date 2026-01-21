/**
 * VEIL Test Helpers
 *
 * Utility functions for testing the prediction market.
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { randomBytes } from "crypto";

// ============================================================================
// PDA DERIVATION
// ============================================================================

/**
 * Derive market PDA
 */
export function getMarketPda(
  programId: PublicKey,
  authority: PublicKey,
  marketId: number | anchor.BN
): [PublicKey, number] {
  const marketIdBn =
    typeof marketId === "number" ? new anchor.BN(marketId) : marketId;

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("market"),
      authority.toBuffer(),
      marketIdBn.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
}

/**
 * Derive market vault PDA
 */
export function getVaultPda(
  programId: PublicKey,
  market: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), market.toBuffer()],
    programId
  );
}

/**
 * Derive bet record PDA
 */
export function getBetRecordPda(
  programId: PublicKey,
  market: PublicKey,
  bettor: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), market.toBuffer(), bettor.toBuffer()],
    programId
  );
}

/**
 * Derive user stats PDA
 */
export function getUserStatsPda(
  programId: PublicKey,
  user: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_stats"), user.toBuffer()],
    programId
  );
}

// ============================================================================
// ENCRYPTION HELPERS (Mock for testing)
// ============================================================================

/**
 * Generate mock encrypted data
 * In production, this would use Arcium's RescueCipher
 */
export function mockEncrypt(
  value: boolean | bigint | number
): {
  ciphertext: number[];
  nonce: bigint;
  publicKey: number[];
} {
  // Generate random bytes for mock encryption
  const ciphertext = Array.from(randomBytes(32));
  const nonce = BigInt("0x" + randomBytes(16).toString("hex"));
  const publicKey = Array.from(randomBytes(32));

  return { ciphertext, nonce, publicKey };
}

/**
 * Generate a random computation offset
 */
export function randomComputationOffset(): anchor.BN {
  return new anchor.BN(randomBytes(8), "hex");
}

// ============================================================================
// AIRDROP & FUNDING
// ============================================================================

/**
 * Airdrop SOL to an account
 */
export async function airdropSol(
  connection: Connection,
  publicKey: PublicKey,
  amount: number = 2
): Promise<void> {
  const signature = await connection.requestAirdrop(
    publicKey,
    amount * anchor.web3.LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(signature);
}

/**
 * Create and fund a new keypair
 * On devnet, skips airdrop if balance is sufficient
 */
export async function createFundedKeypair(
  connection: Connection,
  lamports: number = 2 * anchor.web3.LAMPORTS_PER_SOL
): Promise<Keypair> {
  const keypair = Keypair.generate();

  // Check if we're on devnet (to avoid rate limits)
  const genesisHash = await connection.getGenesisHash();
  const isDevnet = genesisHash === "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

  if (isDevnet) {
    // On devnet, use provider wallet to transfer instead of airdrop
    console.log("  [Devnet] Skipping airdrop, using keypair without funding");
    return keypair;
  }

  const signature = await connection.requestAirdrop(keypair.publicKey, lamports);
  await connection.confirmTransaction(signature);
  return keypair;
}

// ============================================================================
// TIME HELPERS
// ============================================================================

/**
 * Get current Unix timestamp
 */
export function now(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get timestamp N seconds in the future
 */
export function futureTimestamp(seconds: number): number {
  return now() + seconds;
}

/**
 * Get timestamp N seconds in the past
 */
export function pastTimestamp(seconds: number): number {
  return now() - seconds;
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert account doesn't exist
 */
export async function assertAccountDoesNotExist(
  connection: Connection,
  address: PublicKey
): Promise<void> {
  const account = await connection.getAccountInfo(address);
  if (account !== null) {
    throw new Error(`Account ${address.toBase58()} should not exist`);
  }
}

/**
 * Assert account exists
 */
export async function assertAccountExists(
  connection: Connection,
  address: PublicKey
): Promise<void> {
  const account = await connection.getAccountInfo(address);
  if (account === null) {
    throw new Error(`Account ${address.toBase58()} should exist`);
  }
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const MIN_BET_LAMPORTS = 1_000_000; // 0.001 SOL
export const MAX_BET_LAMPORTS = 1_000_000_000_000; // 1000 SOL
export const DEFAULT_FEE_BPS = 300; // 3%
