/**
 * VEIL SDK Encryption Helpers
 *
 * Provides encryption utilities for private betting using Arcium's
 * RescueCipher and X25519 key exchange.
 */

import { x25519 } from "@noble/curves/ed25519";
import { RescueCipher, deserializeLE } from "@arcium-hq/client";
import type { EncryptedBet, EncryptedValue } from "./types";

/**
 * Cross-platform random bytes generator (works in both Node.js and browser)
 */
function getRandomBytes(size: number): Uint8Array {
  // Browser environment
  if (typeof window !== "undefined" && window.crypto) {
    return window.crypto.getRandomValues(new Uint8Array(size));
  }
  // Node.js environment with globalThis.crypto
  if (typeof globalThis !== "undefined" && (globalThis as any).crypto?.getRandomValues) {
    return (globalThis as any).crypto.getRandomValues(new Uint8Array(size));
  }
  // Fallback for Node.js without globalThis.crypto (Node.js < 19)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require("crypto");
    return new Uint8Array(crypto.getRandomBytes(size));
  } catch {
    throw new Error("No cryptographic random number generator available");
  }
}

/**
 * Generate a random X25519 keypair for encryption
 */
export function generateKeypair(): {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
} {
  const privateKey = getRandomBytes(32);
  const publicKey = x25519.getPublicKey(privateKey);

  return {
    privateKey: new Uint8Array(privateKey),
    publicKey: new Uint8Array(publicKey),
  };
}

/**
 * Generate a random 128-bit nonce
 */
export function generateNonce(): bigint {
  const bytes = getRandomBytes(16);
  let nonce = BigInt(0);
  for (let i = 0; i < 16; i++) {
    nonce = nonce | (BigInt(bytes[i]) << BigInt(i * 8));
  }
  return nonce;
}

/**
 * Generate a random computation offset
 */
export function generateComputationOffset(): bigint {
  const bytes = getRandomBytes(8);
  let offset = BigInt(0);
  for (let i = 0; i < 8; i++) {
    offset = offset | (BigInt(bytes[i]) << BigInt(i * 8));
  }
  return offset;
}

/**
 * Convert bigint nonce to u128 representation
 */
export function nonceToU128(nonce: bigint): bigint {
  return nonce & ((BigInt(1) << BigInt(128)) - BigInt(1));
}

/**
 * Encrypt a boolean value (for bet outcome)
 *
 * @param value - The boolean to encrypt (true = YES, false = NO)
 * @param mxePublicKey - The MXE's X25519 public key
 * @param userPrivateKey - Optional user private key (generates new if not provided)
 * @returns Encrypted value with ciphertext, nonce, and public key
 */
export async function encryptBool(
  value: boolean,
  mxePublicKey: Uint8Array,
  userPrivateKey?: Uint8Array
): Promise<EncryptedValue> {
  // Generate keypair if not provided
  const keypair = userPrivateKey
    ? { privateKey: userPrivateKey, publicKey: x25519.getPublicKey(userPrivateKey) }
    : generateKeypair();

  // Compute shared secret using X25519
  const sharedSecret = x25519.getSharedSecret(keypair.privateKey, mxePublicKey);

  // Create RescueCipher with shared secret
  const cipher = new RescueCipher(sharedSecret);

  // Generate 16-byte nonce
  const nonceBytes = getRandomBytes(16);
  const nonce = deserializeLE(nonceBytes);

  // Encrypt boolean as BigInt (0 or 1)
  const plaintext = [BigInt(value ? 1 : 0)];
  const ciphertexts = cipher.encrypt(plaintext, nonceBytes);

  // Convert ciphertext bytes to Uint8Array (32 bytes)
  // cipher.encrypt returns number[][] where each element is an array of bytes
  const ciphertext = new Uint8Array(32);
  const ciphertextBytes = ciphertexts[0];
  for (let i = 0; i < Math.min(ciphertextBytes.length, 32); i++) {
    ciphertext[i] = ciphertextBytes[i];
  }

  return {
    ciphertext,
    nonce,
    publicKey: new Uint8Array(keypair.publicKey),
  };
}

/**
 * Encrypt a u64 value (for bet amount)
 *
 * @param value - The u64 value to encrypt (in lamports)
 * @param mxePublicKey - The MXE's X25519 public key
 * @param userPrivateKey - Optional user private key (generates new if not provided)
 * @returns Encrypted value with ciphertext, nonce, and public key
 */
export async function encryptU64(
  value: bigint,
  mxePublicKey: Uint8Array,
  userPrivateKey?: Uint8Array
): Promise<EncryptedValue> {
  // Generate keypair if not provided
  const keypair = userPrivateKey
    ? { privateKey: userPrivateKey, publicKey: x25519.getPublicKey(userPrivateKey) }
    : generateKeypair();

  // Compute shared secret using X25519
  const sharedSecret = x25519.getSharedSecret(keypair.privateKey, mxePublicKey);

  // Create RescueCipher with shared secret
  const cipher = new RescueCipher(sharedSecret);

  // Generate 16-byte nonce
  const nonceBytes = getRandomBytes(16);
  const nonce = deserializeLE(nonceBytes);

  // Encrypt u64 value directly as BigInt
  const plaintext = [value];
  const ciphertexts = cipher.encrypt(plaintext, nonceBytes);

  // Convert ciphertext bytes to Uint8Array (32 bytes)
  // cipher.encrypt returns number[][] where each element is an array of bytes
  const ciphertext = new Uint8Array(32);
  const ciphertextBytes = ciphertexts[0];
  for (let i = 0; i < Math.min(ciphertextBytes.length, 32); i++) {
    ciphertext[i] = ciphertextBytes[i];
  }

  return {
    ciphertext,
    nonce,
    publicKey: new Uint8Array(keypair.publicKey),
  };
}

/**
 * Encrypt a bet (outcome and amount together)
 *
 * Uses a single shared secret and nonce for both values to ensure
 * they can be decrypted together by the MPC network.
 *
 * @param outcome - The bet outcome (true = YES, false = NO)
 * @param amountLamports - The bet amount in lamports
 * @param mxePublicKey - The MXE's X25519 public key
 * @returns Encrypted bet data ready for the program
 */
export async function encryptBet(
  outcome: boolean,
  amountLamports: bigint,
  mxePublicKey: Uint8Array
): Promise<EncryptedBet> {
  // Generate a single keypair for the bet
  const keypair = generateKeypair();

  // Compute shared secret using X25519
  const sharedSecret = x25519.getSharedSecret(keypair.privateKey, mxePublicKey);

  // Create RescueCipher with shared secret
  const cipher = new RescueCipher(sharedSecret);

  // Generate single 16-byte nonce for both encryptions
  const nonceBytes = getRandomBytes(16);
  const nonce = deserializeLE(nonceBytes);

  // Encrypt both outcome (as bool: 0 or 1) and amount together
  const plaintext = [BigInt(outcome ? 1 : 0), amountLamports];
  const ciphertexts = cipher.encrypt(plaintext, nonceBytes);

  // Convert outcome ciphertext bytes to Uint8Array (32 bytes)
  // cipher.encrypt returns number[][] where each element is an array of bytes
  const encryptedOutcome = new Uint8Array(32);
  const outcomeCiphertextBytes = ciphertexts[0];
  for (let i = 0; i < Math.min(outcomeCiphertextBytes.length, 32); i++) {
    encryptedOutcome[i] = outcomeCiphertextBytes[i];
  }

  // Convert amount ciphertext bytes to Uint8Array (32 bytes)
  const encryptedAmount = new Uint8Array(32);
  const amountCiphertextBytes = ciphertexts[1];
  for (let i = 0; i < Math.min(amountCiphertextBytes.length, 32); i++) {
    encryptedAmount[i] = amountCiphertextBytes[i];
  }

  return {
    encryptedOutcome,
    encryptedAmount,
    userPubkey: keypair.publicKey,
    nonce,
  };
}

/**
 * Convert Uint8Array to number array (for Anchor compatibility)
 */
export function toNumberArray(arr: Uint8Array): number[] {
  return Array.from(arr);
}

/**
 * Convert number array to Uint8Array
 */
export function fromNumberArray(arr: number[]): Uint8Array {
  return new Uint8Array(arr);
}

/**
 * Convert BigInt ciphertext to 32-byte Uint8Array (little-endian)
 */
export function ciphertextToBytes(ciphertext: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number((ciphertext >> BigInt(i * 8)) & BigInt(0xff));
  }
  return bytes;
}

/**
 * Convert 32-byte Uint8Array to BigInt (little-endian)
 */
export function bytesToCiphertext(bytes: Uint8Array): bigint {
  let value = BigInt(0);
  for (let i = 0; i < bytes.length && i < 32; i++) {
    value = value | (BigInt(bytes[i]) << BigInt(i * 8));
  }
  return value;
}
