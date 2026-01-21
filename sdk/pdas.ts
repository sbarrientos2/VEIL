/**
 * VEIL SDK PDA Derivation Helpers
 */

import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { VEIL_PROGRAM_ID, SEEDS } from "./constants";

/**
 * Derive market PDA
 */
export function getMarketPda(
  authority: PublicKey,
  marketId: BN,
  programId: PublicKey = VEIL_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.MARKET, authority.toBuffer(), marketId.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

/**
 * Derive market vault PDA
 */
export function getVaultPda(
  market: PublicKey,
  programId: PublicKey = VEIL_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.VAULT, market.toBuffer()],
    programId
  );
}

/**
 * Derive bet record PDA
 */
export function getBetRecordPda(
  market: PublicKey,
  bettor: PublicKey,
  programId: PublicKey = VEIL_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.BET, market.toBuffer(), bettor.toBuffer()],
    programId
  );
}

/**
 * Derive user stats PDA
 */
export function getUserStatsPda(
  user: PublicKey,
  programId: PublicKey = VEIL_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.USER_STATS, user.toBuffer()],
    programId
  );
}

/**
 * Derive sign PDA for MPC computations
 */
export function getSignPda(
  market: PublicKey,
  programId: PublicKey = VEIL_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.SIGN_PDA, market.toBuffer()],
    programId
  );
}

/**
 * Get all PDAs for a market
 */
export function getMarketPdas(
  authority: PublicKey,
  marketId: BN,
  programId: PublicKey = VEIL_PROGRAM_ID
): {
  market: PublicKey;
  marketBump: number;
  vault: PublicKey;
  vaultBump: number;
  signPda: PublicKey;
  signPdaBump: number;
} {
  const [market, marketBump] = getMarketPda(authority, marketId, programId);
  const [vault, vaultBump] = getVaultPda(market, programId);
  const [signPda, signPdaBump] = getSignPda(market, programId);

  return {
    market,
    marketBump,
    vault,
    vaultBump,
    signPda,
    signPdaBump,
  };
}

/**
 * Get PDAs for placing a bet
 */
export function getBetPdas(
  market: PublicKey,
  bettor: PublicKey,
  programId: PublicKey = VEIL_PROGRAM_ID
): {
  vault: PublicKey;
  vaultBump: number;
  betRecord: PublicKey;
  betRecordBump: number;
  signPda: PublicKey;
  signPdaBump: number;
} {
  const [vault, vaultBump] = getVaultPda(market, programId);
  const [betRecord, betRecordBump] = getBetRecordPda(market, bettor, programId);
  const [signPda, signPdaBump] = getSignPda(market, programId);

  return {
    vault,
    vaultBump,
    betRecord,
    betRecordBump,
    signPda,
    signPdaBump,
  };
}
