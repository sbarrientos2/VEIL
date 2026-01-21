/**
 * VEIL SDK Client
 *
 * Main client class for interacting with the VEIL prediction market
 * and Arcium MPC.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  Connection,
  Commitment,
} from "@solana/web3.js";
import {
  getClusterAccAddress,
  getMXEAccAddress,
  getCompDefAccAddress,
  getComputationAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getFeePoolAccAddress,
  awaitComputationFinalization,
  getMXEPublicKey,
} from "@arcium-hq/client";

import {
  VEIL_PROGRAM_ID,
  ARCIUM_PROGRAM_ID,
  CLUSTER_OFFSETS,
  ORACLE_TYPES,
  MIN_BET_LAMPORTS,
  MAX_BET_LAMPORTS,
} from "./constants";

// Import IDL statically for browser compatibility
import idlJson from "../target/idl/veil.json";
import {
  getMarketPda,
  getVaultPda,
  getBetRecordPda,
  getSignPda,
  getMarketPdas,
  getBetPdas,
} from "./pdas";
import {
  encryptBet,
  generateComputationOffset,
  generateNonce,
  toNumberArray,
} from "./encryption";
import type {
  Market,
  BetRecord,
  CreateMarketParams,
  PlaceBetParams,
  ResolveMarketParams,
  ClaimPayoutParams,
  OracleType,
  ComputationResult,
} from "./types";

// Import the generated IDL type
import type { Veil } from "../target/types/veil";

export type ClusterType = "localnet" | "devnet" | "mainnet";

export interface VeilClientConfig {
  /** The Solana connection */
  connection: Connection;
  /** The wallet/payer */
  wallet: anchor.Wallet;
  /** Cluster type for Arcium offset */
  cluster: ClusterType;
  /** Optional custom program ID */
  programId?: PublicKey;
  /** Commitment level */
  commitment?: Commitment;
}

/**
 * VEIL Client for interacting with the prediction market
 */
export class VeilClient {
  public readonly connection: Connection;
  public readonly wallet: anchor.Wallet;
  public readonly provider: AnchorProvider;
  public readonly program: Program<Veil>;
  public readonly programId: PublicKey;
  public readonly cluster: ClusterType;
  public readonly clusterOffset: number;

  // Arcium account addresses (cached)
  private _mxeAccount: PublicKey | null = null;
  private _clusterAccount: PublicKey | null = null;
  private _mempoolAccount: PublicKey | null = null;
  private _executingPoolAccount: PublicKey | null = null;
  private _feePoolAccount: PublicKey | null = null;

  // MXE public key (cached for encryption)
  private _mxePublicKey: Uint8Array | null = null;

  constructor(config: VeilClientConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.programId = config.programId ?? VEIL_PROGRAM_ID;
    this.cluster = config.cluster;
    this.clusterOffset = CLUSTER_OFFSETS[config.cluster];

    // Create provider
    this.provider = new AnchorProvider(
      this.connection,
      this.wallet,
      { commitment: config.commitment ?? "confirmed" }
    );

    // Load program with statically imported IDL (browser compatible)
    this.program = new Program(
      idlJson as any,
      this.provider
    ) as Program<Veil>;
  }

  // ===========================================================================
  // ARCIUM ACCOUNT HELPERS
  // ===========================================================================

  /**
   * Get MXE account address
   */
  get mxeAccount(): PublicKey {
    if (!this._mxeAccount) {
      this._mxeAccount = getMXEAccAddress(this.programId);
    }
    return this._mxeAccount;
  }

  /**
   * Get cluster account address
   */
  get clusterAccount(): PublicKey {
    if (!this._clusterAccount) {
      this._clusterAccount = getClusterAccAddress(this.clusterOffset);
    }
    return this._clusterAccount;
  }

  /**
   * Get mempool account address
   */
  get mempoolAccount(): PublicKey {
    if (!this._mempoolAccount) {
      this._mempoolAccount = getMempoolAccAddress(this.clusterOffset);
    }
    return this._mempoolAccount;
  }

  /**
   * Get executing pool account address
   */
  get executingPoolAccount(): PublicKey {
    if (!this._executingPoolAccount) {
      this._executingPoolAccount = getExecutingPoolAccAddress(this.clusterOffset);
    }
    return this._executingPoolAccount;
  }

  /**
   * Get fee pool account address
   */
  get feePoolAccount(): PublicKey {
    if (!this._feePoolAccount) {
      this._feePoolAccount = getFeePoolAccAddress();
    }
    return this._feePoolAccount;
  }

  /**
   * Get computation definition account address
   */
  getCompDefAccount(offset: number): PublicKey {
    return getCompDefAccAddress(this.programId, offset);
  }

  /**
   * Get computation account address
   */
  getComputationAccount(computationOffset: bigint): PublicKey {
    return getComputationAccAddress(this.clusterOffset, computationOffset as any);
  }

  /**
   * Get MXE X25519 public key for encryption
   *
   * This key is used to create shared secrets for encrypting bets.
   * The key is cached after the first fetch.
   */
  async getMxePublicKey(): Promise<Uint8Array> {
    if (this._mxePublicKey) {
      return this._mxePublicKey;
    }

    // Fetch from on-chain MXE account
    const mxePublicKey = await getMXEPublicKey(this.provider, this.programId);

    if (!mxePublicKey || mxePublicKey.every((b) => b === 0)) {
      throw new Error(
        "MXE public key not available. Ensure the MXE is initialized for this program."
      );
    }

    this._mxePublicKey = mxePublicKey;
    return mxePublicKey;
  }

  /**
   * Clear cached MXE public key (useful if MXE is re-initialized)
   */
  clearMxePublicKeyCache(): void {
    this._mxePublicKey = null;
  }

  // ===========================================================================
  // MARKET MANAGEMENT
  // ===========================================================================

  /**
   * Create a new prediction market
   */
  async createMarket(params: CreateMarketParams): Promise<string> {
    const { marketId, question, resolutionTime, oracleType, feeBps } = params;

    // Validate inputs
    if (question.length > 200) {
      throw new Error("Question too long (max 200 characters)");
    }
    if (feeBps > 1000) {
      throw new Error("Fee too high (max 10%)");
    }

    // Get PDAs
    const { market, vault } = getMarketPdas(
      this.wallet.publicKey,
      marketId,
      this.programId
    );

    // Convert oracle type
    const oracleTypeValue =
      oracleType === "manual"
        ? ORACLE_TYPES.MANUAL
        : oracleType === "switchboard"
        ? ORACLE_TYPES.SWITCHBOARD
        : ORACLE_TYPES.JURY;

    // Build and send transaction
    const tx = await this.program.methods
      .createMarket(
        marketId,
        question,
        new BN(resolutionTime),
        oracleTypeValue,
        feeBps
      )
      .accounts({
        market,
        vault,
        authority: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    return tx;
  }

  /**
   * Initialize MPC state for a market
   *
   * This queues an MPC computation to create the initial encrypted state.
   * Must be called after createMarket.
   */
  async initMarketState(
    market: PublicKey
  ): Promise<ComputationResult<{ transactionSignature: string; computationOffset: bigint }>> {
    try {
      // Generate computation offset and nonce
      const computationOffset = generateComputationOffset();
      const nonce = generateNonce();

      // Get PDAs
      const [signPda] = getSignPda(market, this.programId);

      // Get comp def account for init_market_state (offset 0)
      const compDefAccount = this.getCompDefAccount(0);

      // Build and send transaction
      const tx = await this.program.methods
        .initMarketState(new BN(computationOffset.toString()), new BN(nonce.toString()))
        .accounts({
          market,
          authority: this.wallet.publicKey,
          signPdaAccount: signPda,
          arciumProgram: ARCIUM_PROGRAM_ID,
          mxeAccount: this.mxeAccount,
          compDefAccount,
          clusterAccount: this.clusterAccount,
          mempoolAccount: this.mempoolAccount,
          executingPoolAccount: this.executingPoolAccount,
          poolAccount: this.feePoolAccount,
          clockAccount: new PublicKey("7EbMUTLo5DjdzbN7s8BXeZwXzEwNQb1hScfRvWg8a6ot"), // Arcium clock
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

      // Wait for computation to finalize
      await awaitComputationFinalization(
        this.provider,
        new BN(computationOffset.toString()),
        this.programId,
        "confirmed"
      );

      return {
        success: true,
        data: {
          transactionSignature: tx,
          computationOffset,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Place an encrypted bet on a market
   */
  async placeBet(params: PlaceBetParams): Promise<ComputationResult<{ transactionSignature: string; computationOffset: bigint }>> {
    const { market, outcome, amountLamports } = params;

    try {
      // Validate amount
      if (amountLamports.lt(new BN(MIN_BET_LAMPORTS))) {
        throw new Error(`Bet amount too low (min ${MIN_BET_LAMPORTS} lamports)`);
      }
      if (amountLamports.gt(new BN(MAX_BET_LAMPORTS))) {
        throw new Error(`Bet amount too high (max ${MAX_BET_LAMPORTS} lamports)`);
      }

      // Generate computation offset
      const computationOffset = generateComputationOffset();

      // Fetch MXE public key for encryption
      const mxePublicKey = await this.getMxePublicKey();

      // Encrypt the bet
      const encryptedBet = await encryptBet(
        outcome,
        BigInt(amountLamports.toString()),
        mxePublicKey
      );

      // Get PDAs
      const { vault, betRecord, signPda } = getBetPdas(
        market,
        this.wallet.publicKey,
        this.programId
      );

      // Get comp def account for place_bet (offset 1)
      const compDefAccount = this.getCompDefAccount(1);

      // Build and send transaction
      const tx = await this.program.methods
        .placeBet(
          new BN(computationOffset.toString()),
          toNumberArray(encryptedBet.encryptedOutcome) as any,
          toNumberArray(encryptedBet.encryptedAmount) as any,
          toNumberArray(encryptedBet.userPubkey) as any,
          new BN(encryptedBet.nonce.toString()),
          amountLamports
        )
        .accounts({
          market,
          vault,
          betRecord,
          bettor: this.wallet.publicKey,
          signPdaAccount: signPda,
          arciumProgram: ARCIUM_PROGRAM_ID,
          mxeAccount: this.mxeAccount,
          compDefAccount,
          clusterAccount: this.clusterAccount,
          mempoolAccount: this.mempoolAccount,
          executingPoolAccount: this.executingPoolAccount,
          poolAccount: this.feePoolAccount,
          clockAccount: new PublicKey("7EbMUTLo5DjdzbN7s8BXeZwXzEwNQb1hScfRvWg8a6ot"),
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

      // Wait for computation to finalize
      await awaitComputationFinalization(
        this.provider,
        new BN(computationOffset.toString()),
        this.programId,
        "confirmed"
      );

      return {
        success: true,
        data: {
          transactionSignature: tx,
          computationOffset,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Close a market to new bets
   */
  async closeMarket(market: PublicKey): Promise<string> {
    const tx = await this.program.methods
      .closeMarket()
      .accounts({
        market,
        authority: this.wallet.publicKey,
      } as any)
      .rpc();

    return tx;
  }

  /**
   * Resolve a market with the oracle outcome
   */
  async resolveMarket(params: ResolveMarketParams): Promise<ComputationResult<{ transactionSignature: string; computationOffset: bigint }>> {
    const { market, outcome } = params;

    try {
      // Generate computation offset
      const computationOffset = generateComputationOffset();

      // Get PDAs
      const [signPda] = getSignPda(market, this.programId);

      // Get comp def account for calculate_payout_pools (offset 3)
      const compDefAccount = this.getCompDefAccount(3);

      // Build and send transaction
      const tx = await this.program.methods
        .resolveMarket(new BN(computationOffset.toString()), outcome)
        .accounts({
          market,
          resolver: this.wallet.publicKey,
          signPdaAccount: signPda,
          arciumProgram: ARCIUM_PROGRAM_ID,
          mxeAccount: this.mxeAccount,
          compDefAccount,
          clusterAccount: this.clusterAccount,
          mempoolAccount: this.mempoolAccount,
          executingPoolAccount: this.executingPoolAccount,
          poolAccount: this.feePoolAccount,
          clockAccount: new PublicKey("7EbMUTLo5DjdzbN7s8BXeZwXzEwNQb1hScfRvWg8a6ot"),
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

      // Wait for computation to finalize
      await awaitComputationFinalization(
        this.provider,
        new BN(computationOffset.toString()),
        this.programId,
        "confirmed"
      );

      return {
        success: true,
        data: {
          transactionSignature: tx,
          computationOffset,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Claim payout for a resolved bet
   */
  async claimPayout(params: ClaimPayoutParams): Promise<string> {
    const { market, outcome, amountLamports } = params;

    // Get PDAs
    const [vault] = getVaultPda(market, this.programId);
    const [betRecord] = getBetRecordPda(market, this.wallet.publicKey, this.programId);

    const tx = await this.program.methods
      .claimPayout(outcome, amountLamports)
      .accounts({
        market,
        vault,
        betRecord,
        bettor: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    return tx;
  }

  /**
   * Cancel a market (authority only)
   */
  async cancelMarket(market: PublicKey): Promise<string> {
    const tx = await this.program.methods
      .cancelMarket()
      .accounts({
        market,
        authority: this.wallet.publicKey,
      } as any)
      .rpc();

    return tx;
  }

  /**
   * Claim refund for a cancelled market
   */
  async claimRefund(market: PublicKey): Promise<string> {
    const [vault] = getVaultPda(market, this.programId);
    const [betRecord] = getBetRecordPda(market, this.wallet.publicKey, this.programId);

    const tx = await this.program.methods
      .claimRefund()
      .accounts({
        market,
        vault,
        betRecord,
        bettor: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    return tx;
  }

  // ===========================================================================
  // READ METHODS
  // ===========================================================================

  /**
   * Fetch a market account
   */
  async fetchMarket(market: PublicKey): Promise<Market | null> {
    try {
      const account = await this.program.account.market.fetch(market);
      return account as unknown as Market;
    } catch {
      return null;
    }
  }

  /**
   * Alias for fetchMarket (frontend compatibility)
   */
  async getMarket(market: PublicKey): Promise<Market | null> {
    return this.fetchMarket(market);
  }

  /**
   * Fetch a bet record
   */
  async fetchBetRecord(market: PublicKey, bettor: PublicKey): Promise<BetRecord | null> {
    try {
      const [betRecord] = getBetRecordPda(market, bettor, this.programId);
      const account = await this.program.account.betRecord.fetch(betRecord);
      return account as unknown as BetRecord;
    } catch {
      return null;
    }
  }

  /**
   * Fetch all markets
   */
  async getAllMarkets(): Promise<Market[]> {
    const accounts = await this.program.account.market.all();
    return accounts.map((a) => a.account as unknown as Market);
  }

  /**
   * Fetch all markets created by an authority
   */
  async fetchMarketsByAuthority(authority: PublicKey): Promise<Market[]> {
    const accounts = await this.program.account.market.all([
      {
        memcmp: {
          offset: 8 + 1, // After discriminator and bump
          bytes: authority.toBase58(),
        },
      },
    ]);

    return accounts.map((a) => a.account as unknown as Market);
  }

  /**
   * Fetch all bets for a market
   */
  async fetchBetsByMarket(market: PublicKey): Promise<BetRecord[]> {
    const accounts = await this.program.account.betRecord.all([
      {
        memcmp: {
          offset: 8 + 1, // After discriminator and bump
          bytes: market.toBase58(),
        },
      },
    ]);

    return accounts.map((a) => a.account as unknown as BetRecord);
  }

  /**
   * Fetch all bets by a user
   */
  async fetchBetsByUser(bettor: PublicKey): Promise<BetRecord[]> {
    const accounts = await this.program.account.betRecord.all([
      {
        memcmp: {
          offset: 8 + 1 + 32, // After discriminator, bump, and market
          bytes: bettor.toBase58(),
        },
      },
    ]);

    return accounts.map((a) => a.account as unknown as BetRecord);
  }

  /**
   * Alias for fetchBetsByUser (frontend compatibility)
   */
  async getUserBets(bettor: PublicKey): Promise<BetRecord[]> {
    return this.fetchBetsByUser(bettor);
  }

  /**
   * Check if MXE is initialized
   */
  async isMxeInitialized(): Promise<boolean> {
    try {
      const accountInfo = await this.connection.getAccountInfo(this.mxeAccount);
      return accountInfo !== null;
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Get market PDA for given authority and market ID
   */
  getMarketPda(authority: PublicKey, marketId: BN): PublicKey {
    const [market] = getMarketPda(authority, marketId, this.programId);
    return market;
  }

  /**
   * Check if a market exists
   */
  async marketExists(market: PublicKey): Promise<boolean> {
    const account = await this.connection.getAccountInfo(market);
    return account !== null;
  }

  /**
   * Get the current Unix timestamp
   */
  async getCurrentTimestamp(): Promise<number> {
    const slot = await this.connection.getSlot();
    const timestamp = await this.connection.getBlockTime(slot);
    return timestamp ?? Math.floor(Date.now() / 1000);
  }
}

/**
 * Create a VeilClient instance
 */
export function createVeilClient(config: VeilClientConfig): VeilClient {
  return new VeilClient(config);
}
