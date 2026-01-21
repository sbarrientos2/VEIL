/**
 * VEIL SDK Basic Usage Example
 *
 * This example demonstrates the full lifecycle of a prediction market:
 * 1. Create a market
 * 2. Initialize MPC state
 * 3. Place encrypted bets
 * 4. Close and resolve the market
 * 5. Claim payouts
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Wallet, BN } from "@coral-xyz/anchor";
import {
  createVeilClient,
  VeilClient,
  VEIL_PROGRAM_ID,
} from "../index";

async function main() {
  // ==========================================================================
  // SETUP
  // ==========================================================================

  console.log("VEIL SDK Example - Private Prediction Market\n");

  // Connect to devnet
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  // Load wallet (replace with your keypair)
  const secretKey = Uint8Array.from(
    JSON.parse(require("fs").readFileSync(
      require("os").homedir() + "/.config/solana/id.json",
      "utf-8"
    ))
  );
  const payer = Keypair.fromSecretKey(secretKey);
  const wallet = new Wallet(payer);

  console.log("Wallet:", wallet.publicKey.toBase58());

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL\n");

  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.error("Insufficient balance. Need at least 0.5 SOL");
    return;
  }

  // Create client
  const client = createVeilClient({
    connection,
    wallet,
    cluster: "devnet",
  });

  // ==========================================================================
  // 1. CREATE MARKET
  // ==========================================================================

  console.log("=== Creating Market ===");

  const marketId = new BN(Date.now());
  const question = "Will BTC reach $100,000 by December 2026?";
  const resolutionTime = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 1 week
  const feeBps = 300; // 3% fee

  try {
    const createTx = await client.createMarket({
      marketId,
      question,
      resolutionTime,
      oracleType: "manual",
      feeBps,
    });

    console.log("Market created! Tx:", createTx);

    const market = client.getMarketPda(wallet.publicKey, marketId);
    console.log("Market address:", market.toBase58());

    // ==========================================================================
    // 2. INITIALIZE MPC STATE
    // ==========================================================================

    console.log("\n=== Initializing MPC State ===");

    const initResult = await client.initMarketState(market);

    if (initResult.success) {
      console.log("MPC state initialized! Tx:", initResult.data?.transactionSignature);
      console.log("Computation offset:", initResult.data?.computationOffset.toString());
    } else {
      console.error("Failed to initialize MPC state:", initResult.error);
      return;
    }

    // Fetch market to verify
    const marketAccount = await client.fetchMarket(market);
    console.log("MPC initialized:", marketAccount?.mpcInitialized);

    // ==========================================================================
    // 3. PLACE ENCRYPTED BETS
    // ==========================================================================

    console.log("\n=== Placing Encrypted Bets ===");

    // Place a YES bet
    const yesBetResult = await client.placeBet({
      market,
      outcome: true, // YES
      amountLamports: new BN(0.1 * LAMPORTS_PER_SOL),
    });

    if (yesBetResult.success) {
      console.log("YES bet placed! Tx:", yesBetResult.data?.transactionSignature);
    } else {
      console.error("Failed to place YES bet:", yesBetResult.error);
    }

    // In a real scenario, different users would place bets
    // For this example, we'll simulate by placing multiple bets

    // ==========================================================================
    // 4. CLOSE AND RESOLVE MARKET
    // ==========================================================================

    console.log("\n=== Closing and Resolving Market ===");

    // Close market to new bets
    const closeTx = await client.closeMarket(market);
    console.log("Market closed! Tx:", closeTx);

    // Resolve market with outcome (YES wins in this example)
    const resolveResult = await client.resolveMarket({
      market,
      outcome: true, // YES wins
    });

    if (resolveResult.success) {
      console.log("Market resolved! Tx:", resolveResult.data?.transactionSignature);
    } else {
      console.error("Failed to resolve market:", resolveResult.error);
      return;
    }

    // Fetch resolved market
    const resolvedMarket = await client.fetchMarket(market);
    console.log("Outcome:", resolvedMarket?.outcome ? "YES" : "NO");
    console.log("Yes pool:", resolvedMarket?.revealedYesPool.toString());
    console.log("No pool:", resolvedMarket?.revealedNoPool.toString());

    // ==========================================================================
    // 5. CLAIM PAYOUT
    // ==========================================================================

    console.log("\n=== Claiming Payout ===");

    // Fetch bet record
    const betRecord = await client.fetchBetRecord(market, wallet.publicKey);

    if (betRecord) {
      const claimTx = await client.claimPayout({
        market,
        outcome: true,
        amountLamports: betRecord.betLamports,
      });

      console.log("Payout claimed! Tx:", claimTx);
    }

    // ==========================================================================
    // SUMMARY
    // ==========================================================================

    console.log("\n=== Summary ===");
    console.log("Market:", market.toBase58());
    console.log("Question:", question);
    console.log("Status: Resolved");
    console.log("Outcome: YES");

  } catch (error) {
    console.error("Error:", error);
  }
}

// Run example
main().catch(console.error);
