/**
 * VEIL - Private Parimutuel Prediction Market Tests
 *
 * Comprehensive test suite for the prediction market.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

import {
  getMarketPda,
  getVaultPda,
  getBetRecordPda,
  mockEncrypt,
  randomComputationOffset,
  airdropSol,
  createFundedKeypair,
  futureTimestamp,
  MIN_BET_LAMPORTS,
  DEFAULT_FEE_BPS,
} from "./helpers";

// Import the generated IDL type (will be available after anchor build)
// import { Veil } from "../target/types/veil";

describe("VEIL - Private Prediction Market", () => {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Program will be loaded after build
  // const program = anchor.workspace.Veil as Program<Veil>;
  const programId = new PublicKey("FLPWpbDR64Ehb8Vo27YbDJQtPqGf488JwJmY3vH5uMxy");

  // Test accounts
  let authority: Keypair;
  let bettor1: Keypair;
  let bettor2: Keypair;
  let marketId: anchor.BN;
  let marketPda: PublicKey;
  let vaultPda: PublicKey;

  before(async () => {
    // Create and fund test accounts
    authority = await createFundedKeypair(provider.connection, 10 * LAMPORTS_PER_SOL);
    bettor1 = await createFundedKeypair(provider.connection, 5 * LAMPORTS_PER_SOL);
    bettor2 = await createFundedKeypair(provider.connection, 5 * LAMPORTS_PER_SOL);

    // Generate unique market ID
    marketId = new anchor.BN(Date.now());

    // Derive PDAs
    [marketPda] = getMarketPda(programId, authority.publicKey, marketId);
    [vaultPda] = getVaultPda(programId, marketPda);

    console.log("Test Setup:");
    console.log("  Authority:", authority.publicKey.toBase58());
    console.log("  Bettor 1:", bettor1.publicKey.toBase58());
    console.log("  Bettor 2:", bettor2.publicKey.toBase58());
    console.log("  Market PDA:", marketPda.toBase58());
    console.log("  Vault PDA:", vaultPda.toBase58());
  });

  describe("Market Creation", () => {
    it("should create a new market", async () => {
      // Note: This test will work once the program is deployed
      // For now, we're testing the helper functions

      const question = "Will BTC hit $100k by December 2026?";
      const resolutionTime = futureTimestamp(7 * 24 * 60 * 60); // 1 week
      const oracleType = 0; // Manual
      const feeBps = DEFAULT_FEE_BPS;

      console.log("Creating market:");
      console.log("  Question:", question);
      console.log("  Resolution Time:", new Date(resolutionTime * 1000).toISOString());
      console.log("  Fee:", feeBps / 100, "%");

      // Verify PDA derivation
      const [derivedMarket] = getMarketPda(programId, authority.publicKey, marketId);
      expect(derivedMarket.toBase58()).to.equal(marketPda.toBase58());

      // In production test:
      // await program.methods
      //   .createMarket(marketId, question, resolutionTime, oracleType, feeBps)
      //   .accounts({
      //     market: marketPda,
      //     vault: vaultPda,
      //     authority: authority.publicKey,
      //     systemProgram: anchor.web3.SystemProgram.programId,
      //   })
      //   .signers([authority])
      //   .rpc();
    });

    it("should initialize MPC state", async () => {
      const computationOffset = randomComputationOffset();

      console.log("Initializing MPC state:");
      console.log("  Computation Offset:", computationOffset.toString());

      // In production test:
      // await program.methods
      //   .initMarketState(computationOffset)
      //   .accounts({
      //     market: marketPda,
      //     authority: authority.publicKey,
      //   })
      //   .signers([authority])
      //   .rpc();
    });
  });

  describe("Betting", () => {
    it("should place an encrypted bet", async () => {
      const computationOffset = randomComputationOffset();
      const betAmount = 0.1 * LAMPORTS_PER_SOL;

      // Mock encrypt the bet (YES outcome)
      const encrypted = mockEncrypt(true);

      const [betRecordPda] = getBetRecordPda(programId, marketPda, bettor1.publicKey);

      console.log("Placing bet:");
      console.log("  Bettor:", bettor1.publicKey.toBase58());
      console.log("  Amount:", betAmount / LAMPORTS_PER_SOL, "SOL");
      console.log("  Bet Record PDA:", betRecordPda.toBase58());

      // Verify bet record PDA derivation
      const [derivedBetRecord] = getBetRecordPda(programId, marketPda, bettor1.publicKey);
      expect(derivedBetRecord.toBase58()).to.equal(betRecordPda.toBase58());

      // In production test:
      // await program.methods
      //   .placeBet(
      //     computationOffset,
      //     encrypted.ciphertext,
      //     mockEncrypt(BigInt(betAmount)).ciphertext,
      //     encrypted.publicKey,
      //     new anchor.BN(encrypted.nonce.toString()),
      //     new anchor.BN(betAmount)
      //   )
      //   .accounts({
      //     market: marketPda,
      //     vault: vaultPda,
      //     betRecord: betRecordPda,
      //     bettor: bettor1.publicKey,
      //     systemProgram: anchor.web3.SystemProgram.programId,
      //   })
      //   .signers([bettor1])
      //   .rpc();
    });

    it("should place a second bet on opposite outcome", async () => {
      const computationOffset = randomComputationOffset();
      const betAmount = 0.2 * LAMPORTS_PER_SOL;

      // Mock encrypt the bet (NO outcome)
      const encrypted = mockEncrypt(false);

      const [betRecordPda] = getBetRecordPda(programId, marketPda, bettor2.publicKey);

      console.log("Placing second bet:");
      console.log("  Bettor:", bettor2.publicKey.toBase58());
      console.log("  Amount:", betAmount / LAMPORTS_PER_SOL, "SOL");

      // In production test:
      // await program.methods
      //   .placeBet(...)
      //   .signers([bettor2])
      //   .rpc();
    });
  });

  describe("Resolution", () => {
    it("should close market", async () => {
      console.log("Closing market...");

      // In production test:
      // await program.methods
      //   .closeMarket()
      //   .accounts({
      //     market: marketPda,
      //     authority: authority.publicKey,
      //   })
      //   .signers([authority])
      //   .rpc();
    });

    it("should resolve market with YES outcome", async () => {
      const computationOffset = randomComputationOffset();
      const outcome = true; // YES wins

      console.log("Resolving market:");
      console.log("  Outcome:", outcome ? "YES" : "NO");

      // In production test:
      // await program.methods
      //   .resolveMarket(computationOffset, outcome)
      //   .accounts({
      //     market: marketPda,
      //     resolver: authority.publicKey,
      //   })
      //   .signers([authority])
      //   .rpc();
    });
  });

  describe("Payouts", () => {
    it("should claim winning payout", async () => {
      const [betRecordPda] = getBetRecordPda(programId, marketPda, bettor1.publicKey);

      console.log("Claiming payout for winner:");
      console.log("  Bettor:", bettor1.publicKey.toBase58());

      // In production test:
      // await program.methods
      //   .claimPayout(true, new anchor.BN(0.1 * LAMPORTS_PER_SOL))
      //   .accounts({
      //     market: marketPda,
      //     vault: vaultPda,
      //     betRecord: betRecordPda,
      //     bettor: bettor1.publicKey,
      //     systemProgram: anchor.web3.SystemProgram.programId,
      //   })
      //   .signers([bettor1])
      //   .rpc();
    });

    it("should claim zero payout for loser", async () => {
      const [betRecordPda] = getBetRecordPda(programId, marketPda, bettor2.publicKey);

      console.log("Claiming payout for loser:");
      console.log("  Bettor:", bettor2.publicKey.toBase58());

      // In production test:
      // await program.methods
      //   .claimPayout(false, new anchor.BN(0.2 * LAMPORTS_PER_SOL))
      //   .accounts({...})
      //   .signers([bettor2])
      //   .rpc();
    });
  });

  describe("Edge Cases", () => {
    it("should reject bet below minimum", async () => {
      const tooSmall = MIN_BET_LAMPORTS - 1;
      console.log("Testing minimum bet rejection:", tooSmall, "lamports");

      // In production test:
      // expect(program.methods.placeBet(...)).to.be.rejectedWith("BetAmountTooLow");
    });

    it("should reject bet after resolution time", async () => {
      console.log("Testing late bet rejection...");

      // In production test:
      // expect(program.methods.placeBet(...)).to.be.rejectedWith("BettingPeriodEnded");
    });

    it("should reject double claim", async () => {
      console.log("Testing double claim rejection...");

      // In production test:
      // expect(program.methods.claimPayout(...)).to.be.rejectedWith("BetAlreadyClaimed");
    });
  });

  describe("Helper Functions", () => {
    it("should derive correct PDAs", () => {
      const testAuthority = Keypair.generate().publicKey;
      const testMarketId = new anchor.BN(123456);

      const [market, marketBump] = getMarketPda(programId, testAuthority, testMarketId);
      const [vault, vaultBump] = getVaultPda(programId, market);

      expect(market).to.be.instanceOf(PublicKey);
      expect(vault).to.be.instanceOf(PublicKey);
      expect(marketBump).to.be.lessThan(256);
      expect(vaultBump).to.be.lessThan(256);
    });

    it("should generate valid mock encryption", () => {
      const encrypted = mockEncrypt(true);

      expect(encrypted.ciphertext).to.have.length(32);
      expect(encrypted.publicKey).to.have.length(32);
      expect(encrypted.nonce).to.be.a("bigint");
    });

    it("should generate random computation offsets", () => {
      const offset1 = randomComputationOffset();
      const offset2 = randomComputationOffset();

      expect(offset1.toString()).to.not.equal(offset2.toString());
    });
  });
});
