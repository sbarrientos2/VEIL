"use client";

import { FC, useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMarket, usePlaceBet, usePotentialPayout } from "@/hooks/useVeil";
import type { UIMarket, MarketStatus } from "@/lib/veil-types";

// Mock market data - shown when market not found on-chain
const mockMarkets: Record<string, {
  id: string;
  question: string;
  description: string;
  category: string;
  status: "open" | "closed" | "resolving" | "resolved";
  totalPool: number;
  yesPool: number;
  noPool: number;
  endTime: Date;
  createdAt: Date;
  participantCount: number;
  authority: string;
  oracle: string;
  minBet: number;
  maxBet: number;
  resolution?: "yes" | "no";
}> = {
  "btc-100k-jan": {
    id: "btc-100k-jan",
    question: "Will BTC reach $100,000 by January 31st, 2025?",
    description:
      "This market resolves YES if Bitcoin's price reaches or exceeds $100,000 USD on any major exchange (Coinbase, Binance, Kraken) before January 31st, 2025 23:59:59 UTC. The market resolves NO otherwise. Price data will be sourced from CoinGecko's aggregate price.",
    category: "Crypto",
    status: "open",
    totalPool: 125000,
    yesPool: 75000,
    noPool: 50000,
    endTime: new Date("2025-01-31T23:59:59Z"),
    createdAt: new Date("2025-01-01T00:00:00Z"),
    participantCount: 342,
    authority: "7xKX...8JdM",
    oracle: "9mRV...3kLp",
    minBet: 10,
    maxBet: 10000,
  },
  "eth-pos-upgrade": {
    id: "eth-pos-upgrade",
    question: "Will Ethereum implement EIP-4844 proto-danksharding by Q1 2025?",
    description:
      "This market resolves YES if EIP-4844 (proto-danksharding) is implemented on Ethereum mainnet before March 31st, 2025 23:59:59 UTC. Implementation is defined as the upgrade being active on mainnet, not just announced or scheduled.",
    category: "Crypto",
    status: "open",
    totalPool: 89000,
    yesPool: 52000,
    noPool: 37000,
    endTime: new Date("2025-03-31T23:59:59Z"),
    createdAt: new Date("2025-01-05T00:00:00Z"),
    participantCount: 218,
    authority: "4kLM...9pRt",
    oracle: "2nXY...7vWq",
    minBet: 10,
    maxBet: 5000,
  },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTimeRemaining(endTime: Date): { value: string; unit: string; isUrgent: boolean } {
  const now = new Date();
  const diff = endTime.getTime() - now.getTime();

  if (diff <= 0) return { value: "0", unit: "Ended", isUrgent: true };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return { value: days.toString(), unit: days === 1 ? "day" : "days", isUrgent: days <= 1 };
  }
  if (hours > 0) {
    return { value: hours.toString(), unit: hours === 1 ? "hour" : "hours", isUrgent: hours <= 6 };
  }
  return { value: minutes.toString(), unit: "min", isUrgent: true };
}

const CountdownTimer: FC<{ endTime: Date }> = ({ endTime }) => {
  const [timeLeft, setTimeLeft] = useState(formatTimeRemaining(endTime));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(formatTimeRemaining(endTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  return (
    <div className={`text-center ${timeLeft.isUrgent ? "text-flux-400" : "text-void-300"}`}>
      <div className="text-4xl sm:text-5xl font-mono font-bold">{timeLeft.value}</div>
      <div className="text-sm uppercase tracking-wider">{timeLeft.unit}</div>
    </div>
  );
};

const EncryptionIndicator: FC<{ isEncrypting: boolean }> = ({ isEncrypting }) => {
  return (
    <AnimatePresence>
      {isEncrypting && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/90 backdrop-blur-sm"
        >
          <div className="text-center">
            <motion.div
              className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-cipher-600/20 flex items-center justify-center"
              animate={{
                boxShadow: [
                  "0 0 20px rgba(124, 58, 237, 0.3)",
                  "0 0 60px rgba(124, 58, 237, 0.6)",
                  "0 0 20px rgba(124, 58, 237, 0.3)",
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <motion.svg
                className="w-12 h-12 text-cipher-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </motion.svg>
            </motion.div>
            <h3 className="text-xl font-medium text-white mb-2">Encrypting your bet</h3>
            <p className="text-void-400 text-sm">
              Your position is being sealed using Arcium MPC...
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default function MarketDetailPage() {
  const params = useParams();
  const marketId = params.id as string;
  const { connected, publicKey } = useWallet();
  const [selectedSide, setSelectedSide] = useState<"yes" | "no" | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch market from SDK
  const { market: liveMarket, isLoading, error, refetch } = useMarket(marketId);

  // Use live market data if available, otherwise fall back to mock
  const mockMarket = mockMarkets[marketId] || mockMarkets["btc-100k-jan"];
  const market = useMemo(() => {
    if (liveMarket) {
      return {
        id: liveMarket.id,
        question: liveMarket.question,
        description: `This market resolves based on the outcome of: "${liveMarket.question}". Created by ${liveMarket.authority.slice(0, 8)}...`,
        category: "Crypto",
        status: liveMarket.status as "open" | "closed" | "resolving" | "resolved",
        totalPool: liveMarket.totalPool,
        yesPool: liveMarket.yesPool,
        noPool: liveMarket.noPool,
        endTime: liveMarket.endTime,
        createdAt: liveMarket.createdAt,
        participantCount: liveMarket.participantCount,
        authority: liveMarket.authority,
        oracle: liveMarket.oracleType,
        minBet: 0.01, // 0.01 SOL min
        maxBet: 100,  // 100 SOL max
        resolution: liveMarket.outcome === null ? undefined : liveMarket.outcome ? "yes" as const : "no" as const,
      };
    }
    return mockMarket;
  }, [liveMarket, mockMarket]);

  // SDK hooks for placing bets
  const { placeBet, isSubmitting: isBetting, error: betError } = usePlaceBet();

  const yesPercentage = market.totalPool > 0 ? (market.yesPool / market.totalPool) * 100 : 50;
  const noPercentage = market.totalPool > 0 ? (market.noPool / market.totalPool) * 100 : 50;

  // Calculate potential payout
  const potentialPayout = useMemo(() => {
    const amount = parseFloat(betAmount) || 0;
    if (amount <= 0 || !selectedSide) return 0;

    const pool = selectedSide === "yes" ? market.yesPool : market.noPool;
    const oppositePool = selectedSide === "yes" ? market.noPool : market.yesPool;

    // Parimutuel calculation: your share of the losing pool
    const yourShare = amount / (pool + amount);
    const winnings = yourShare * oppositePool;

    return amount + winnings;
  }, [betAmount, selectedSide, market]);

  const handlePlaceBet = async () => {
    if (!connected || !selectedSide || !betAmount) return;

    setIsEncrypting(true);

    try {
      // Use real SDK to place bet
      const txSignature = await placeBet(market.id, selectedSide, parseFloat(betAmount));

      if (txSignature) {
        setShowSuccess(true);
        refetch(); // Refresh market data
        setTimeout(() => {
          setShowSuccess(false);
          setSelectedSide(null);
          setBetAmount("");
        }, 3000);
      } else {
        // Handle error
        console.error("Failed to place bet:", betError);
      }
    } catch (err) {
      console.error("Error placing bet:", err);
    } finally {
      setIsEncrypting(false);
    }
  };

  const isValidBet =
    connected &&
    selectedSide &&
    parseFloat(betAmount) >= market.minBet &&
    parseFloat(betAmount) <= market.maxBet;

  return (
    <div className="relative min-h-screen pt-24 pb-16">
      <EncryptionIndicator isEncrypting={isEncrypting} />

      {/* Background */}
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="absolute top-40 left-1/4 w-96 h-96 bg-cipher-600/10 rounded-full blur-[150px]" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Link
            href="/markets"
            className="inline-flex items-center gap-2 text-void-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to markets
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Market header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-glow p-8"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-xs font-mono text-cipher-500 uppercase tracking-wider">
                  {market.category}
                </span>
                <span className={`status-${market.status}`}>
                  {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4 leading-tight">
                {market.question}
              </h1>

              <p className="text-void-400 leading-relaxed">{market.description}</p>

              {/* Market stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-void-700/50">
                <div>
                  <div className="text-void-500 text-xs uppercase tracking-wider mb-1">
                    Total Pool
                  </div>
                  <div className="text-white font-mono text-lg">
                    {formatCurrency(market.totalPool)}
                  </div>
                </div>
                <div>
                  <div className="text-void-500 text-xs uppercase tracking-wider mb-1">
                    Participants
                  </div>
                  <div className="text-white font-mono text-lg">
                    {market.participantCount}
                  </div>
                </div>
                <div>
                  <div className="text-void-500 text-xs uppercase tracking-wider mb-1">
                    Min Bet
                  </div>
                  <div className="text-white font-mono text-lg">
                    {formatCurrency(market.minBet)}
                  </div>
                </div>
                <div>
                  <div className="text-void-500 text-xs uppercase tracking-wider mb-1">
                    Max Bet
                  </div>
                  <div className="text-white font-mono text-lg">
                    {formatCurrency(market.maxBet)}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Pool distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card p-6"
            >
              <h3 className="text-lg font-medium text-white mb-6">Pool Distribution</h3>

              <div className="space-y-6">
                {/* YES pool */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-sealed-400" />
                      <span className="text-white font-medium">YES</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sealed-400 font-mono">
                        {yesPercentage.toFixed(1)}%
                      </span>
                      <span className="text-void-500 ml-2">
                        ({formatCurrency(market.yesPool)})
                      </span>
                    </div>
                  </div>
                  <div className="h-3 bg-void-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-sealed-600 to-sealed-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${yesPercentage}%` }}
                      transition={{ duration: 1, delay: 0.3 }}
                    />
                  </div>
                </div>

                {/* NO pool */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-breach-400" />
                      <span className="text-white font-medium">NO</span>
                    </div>
                    <div className="text-right">
                      <span className="text-breach-400 font-mono">
                        {noPercentage.toFixed(1)}%
                      </span>
                      <span className="text-void-500 ml-2">
                        ({formatCurrency(market.noPool)})
                      </span>
                    </div>
                  </div>
                  <div className="h-3 bg-void-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-breach-600 to-breach-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${noPercentage}%` }}
                      transition={{ duration: 1, delay: 0.4 }}
                    />
                  </div>
                </div>
              </div>

              {/* Privacy note */}
              <div className="mt-6 p-4 bg-cipher-900/20 rounded-xl border border-cipher-700/30">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-cipher-400 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm text-cipher-300">
                      Pool totals are aggregated using Arcium MPC.
                    </p>
                    <p className="text-xs text-void-500 mt-1">
                      Individual bet amounts and positions are encrypted and never revealed.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Market details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card p-6"
            >
              <h3 className="text-lg font-medium text-white mb-4">Market Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-void-700/50">
                  <span className="text-void-400">Authority</span>
                  <span className="text-white font-mono">{market.authority}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-void-700/50">
                  <span className="text-void-400">Oracle</span>
                  <span className="text-white font-mono">{market.oracle}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-void-700/50">
                  <span className="text-void-400">Created</span>
                  <span className="text-white">
                    {market.createdAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-void-400">End Time</span>
                  <span className="text-white">
                    {market.endTime.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZoneName: "short",
                    })}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Betting panel */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="sticky top-24"
            >
              <div className="card-glow p-6">
                {/* Countdown */}
                <div className="text-center mb-6 pb-6 border-b border-void-700/50">
                  <div className="text-void-500 text-xs uppercase tracking-wider mb-3">
                    Time Remaining
                  </div>
                  <CountdownTimer endTime={market.endTime} />
                </div>

                {market.status === "open" ? (
                  <>
                    {/* Side selection */}
                    <div className="mb-6">
                      <label className="input-label">Your Prediction</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setSelectedSide("yes")}
                          className={`btn-bet-yes ${
                            selectedSide === "yes" ? "ring-2 ring-sealed-400 ring-offset-2 ring-offset-void-900" : ""
                          }`}
                        >
                          <span className="text-lg font-bold">YES</span>
                          <span className="text-xs opacity-70">
                            {yesPercentage.toFixed(0)}% pool
                          </span>
                        </button>
                        <button
                          onClick={() => setSelectedSide("no")}
                          className={`btn-bet-no ${
                            selectedSide === "no" ? "ring-2 ring-breach-400 ring-offset-2 ring-offset-void-900" : ""
                          }`}
                        >
                          <span className="text-lg font-bold">NO</span>
                          <span className="text-xs opacity-70">
                            {noPercentage.toFixed(0)}% pool
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Amount input */}
                    <div className="mb-6">
                      <label className="input-label">Bet Amount (USDC)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-void-500">
                          $
                        </span>
                        <input
                          type="number"
                          value={betAmount}
                          onChange={(e) => setBetAmount(e.target.value)}
                          placeholder="0.00"
                          min={market.minBet}
                          max={market.maxBet}
                          className="input-field pl-8 w-full text-lg"
                        />
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-void-500">
                        <span>Min: {formatCurrency(market.minBet)}</span>
                        <span>Max: {formatCurrency(market.maxBet)}</span>
                      </div>
                      {/* Quick amounts */}
                      <div className="flex gap-2 mt-3">
                        {[100, 500, 1000].map((amount) => (
                          <button
                            key={amount}
                            onClick={() => setBetAmount(amount.toString())}
                            className="flex-1 py-1.5 text-xs font-mono bg-void-700/50 hover:bg-void-600/50 text-void-300 hover:text-white rounded-lg transition-colors"
                          >
                            ${amount}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Potential payout */}
                    {selectedSide && parseFloat(betAmount) > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mb-6 p-4 bg-void-700/30 rounded-xl"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-void-400 text-sm">Potential Payout</span>
                          <span className="text-2xl font-mono font-bold text-cipher-400">
                            {formatCurrency(potentialPayout)}
                          </span>
                        </div>
                        <div className="text-xs text-void-500 mt-1">
                          If {selectedSide.toUpperCase()} wins (parimutuel)
                        </div>
                      </motion.div>
                    )}

                    {/* Submit button */}
                    {!connected ? (
                      <button className="btn-primary w-full py-4 text-lg">
                        Connect Wallet to Bet
                      </button>
                    ) : (
                      <button
                        onClick={handlePlaceBet}
                        disabled={!isValidBet}
                        className="btn-primary w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {!selectedSide
                          ? "Select YES or NO"
                          : !betAmount
                          ? "Enter Amount"
                          : `Place Encrypted Bet`}
                      </button>
                    )}

                    {/* Privacy badge */}
                    <div className="mt-4 flex items-center justify-center gap-2 text-xs text-void-500">
                      <svg
                        className="w-4 h-4 text-cipher-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                      <span>Your bet will be encrypted client-side</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-void-700/50 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-void-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">
                      Betting Closed
                    </h3>
                    <p className="text-void-400 text-sm">
                      This market is no longer accepting bets.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Success modal */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="text-center"
            >
              <motion.div
                className="w-24 h-24 mx-auto mb-6 rounded-full bg-sealed-600/20 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
              >
                <svg
                  className="w-12 h-12 text-sealed-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </motion.div>
              <h3 className="text-2xl font-bold text-white mb-2">Bet Placed!</h3>
              <p className="text-void-400">
                Your encrypted bet has been submitted to the network.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
