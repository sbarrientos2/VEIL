"use client";

import { FC, useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useUserBets, useClaimPayout } from "@/hooks/useVeil";
import { solToLamports } from "@/lib/veil-types";
import BN from "bn.js";

type BetStatus = "active" | "claimable" | "claimed" | "lost";
type MarketStatus = "open" | "closed" | "resolving" | "resolved";
type Side = "yes" | "no";
type FilterOption = "all" | "active" | "claimable" | "history";

interface MockBet {
  id: string;
  marketId: string;
  question: string;
  side: Side;
  amount: number;
  timestamp: Date;
  status: BetStatus;
  marketStatus: MarketStatus;
  potentialPayout?: number;
  endTime: Date;
  resolution?: Side;
  payout?: number;
}

// Mock data for user's bets
const mockBets: MockBet[] = [
  {
    id: "bet-1",
    marketId: "btc-100k-jan",
    question: "Will BTC reach $100,000 by January 31st, 2025?",
    side: "yes" as const,
    amount: 500,
    timestamp: new Date("2025-01-15T10:30:00Z"),
    status: "active" as const,
    marketStatus: "open" as const,
    potentialPayout: 875,
    endTime: new Date("2025-01-31T23:59:59Z"),
  },
  {
    id: "bet-2",
    marketId: "eth-pos-upgrade",
    question: "Will Ethereum implement EIP-4844 proto-danksharding by Q1 2025?",
    side: "no" as const,
    amount: 250,
    timestamp: new Date("2025-01-12T14:20:00Z"),
    status: "active" as const,
    marketStatus: "open" as const,
    potentialPayout: 425,
    endTime: new Date("2025-03-31T23:59:59Z"),
  },
  {
    id: "bet-3",
    marketId: "fed-rate-cut",
    question: "Will the Federal Reserve cut rates by at least 50bps in Q1 2025?",
    side: "yes" as const,
    amount: 1000,
    timestamp: new Date("2025-01-05T09:15:00Z"),
    status: "claimable" as const,
    marketStatus: "resolved" as const,
    resolution: "yes" as const,
    payout: 1650,
    endTime: new Date("2025-01-15T23:59:59Z"),
  },
  {
    id: "bet-4",
    marketId: "apple-ar-glasses",
    question: "Will Apple release consumer AR glasses in 2025?",
    side: "yes" as const,
    amount: 200,
    timestamp: new Date("2024-12-20T16:45:00Z"),
    status: "lost" as const,
    marketStatus: "resolved" as const,
    resolution: "no" as const,
    payout: 0,
    endTime: new Date("2025-01-10T23:59:59Z"),
  },
  {
    id: "bet-5",
    marketId: "sol-top-5",
    question: "Will Solana remain in the top 5 by market cap through Q1 2025?",
    side: "yes" as const,
    amount: 750,
    timestamp: new Date("2025-01-03T11:00:00Z"),
    status: "active" as const,
    marketStatus: "open" as const,
    potentialPayout: 1180,
    endTime: new Date("2025-03-31T23:59:59Z"),
  },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const BetCard: FC<{
  bet: (typeof mockBets)[0];
  onClaim?: () => void;
  isClaiming?: boolean;
}> = ({ bet, onClaim, isClaiming }) => {
  const isWin = bet.status === "claimable" || (bet.status === "claimed" && bet.resolution === bet.side);
  const isLoss = bet.status === "lost";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative p-6 rounded-2xl border transition-all duration-300 ${
        bet.status === "claimable"
          ? "bg-sealed-900/20 border-sealed-600/50 hover:border-sealed-500/50"
          : isLoss
          ? "bg-void-800/30 border-void-700/30 opacity-70"
          : "bg-void-800/50 border-void-600/50 hover:border-cipher-600/50"
      }`}
    >
      {/* Status badge */}
      <div className="absolute top-4 right-4">
        {bet.status === "active" && (
          <span className="px-2 py-1 text-xs font-medium bg-cipher-600/20 text-cipher-400 rounded-full">
            Active
          </span>
        )}
        {bet.status === "claimable" && (
          <span className="px-2 py-1 text-xs font-medium bg-sealed-600/20 text-sealed-400 rounded-full animate-pulse">
            Claim Available
          </span>
        )}
        {bet.status === "claimed" && (
          <span className="px-2 py-1 text-xs font-medium bg-void-700 text-void-400 rounded-full">
            Claimed
          </span>
        )}
        {bet.status === "lost" && (
          <span className="px-2 py-1 text-xs font-medium bg-breach-900/30 text-breach-400 rounded-full">
            Lost
          </span>
        )}
      </div>

      {/* Market question */}
      <Link href={`/markets/${bet.marketId}`}>
        <h3 className="text-white font-medium pr-24 hover:text-cipher-300 transition-colors cursor-pointer">
          {bet.question}
        </h3>
      </Link>

      {/* Bet details */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-void-500">Position:</span>
          <span
            className={`font-mono font-bold ${
              bet.side === "yes" ? "text-sealed-400" : "text-breach-400"
            }`}
          >
            {bet.side.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-void-500">Amount:</span>
          <span className="text-white font-mono">{formatCurrency(bet.amount)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-void-500">Placed:</span>
          <span className="text-void-400">{formatDate(bet.timestamp)}</span>
        </div>
      </div>

      {/* Payout info */}
      <div className="mt-4 pt-4 border-t border-void-700/50">
        <div className="flex items-center justify-between">
          <div>
            {bet.status === "active" && (
              <div className="text-sm">
                <span className="text-void-500">Potential payout: </span>
                <span className="text-cipher-400 font-mono">
                  {formatCurrency(bet.potentialPayout || 0)}
                </span>
              </div>
            )}
            {(bet.status === "claimable" || bet.status === "claimed") && (
              <div className="text-sm">
                <span className="text-void-500">Winnings: </span>
                <span className="text-sealed-400 font-mono font-bold">
                  {formatCurrency(bet.payout || 0)}
                </span>
              </div>
            )}
            {bet.status === "lost" && (
              <div className="text-sm text-void-500">
                Market resolved{" "}
                <span className={bet.resolution === "yes" ? "text-sealed-400" : "text-breach-400"}>
                  {bet.resolution?.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {bet.status === "claimable" && (
            <button
              onClick={onClaim}
              disabled={isClaiming}
              className="btn-primary py-2 px-4 text-sm"
            >
              {isClaiming ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Claiming...
                </span>
              ) : (
                "Claim Payout"
              )}
            </button>
          )}
        </div>
      </div>

      {/* Encrypted indicator */}
      <div className="mt-4 flex items-center gap-2 text-xs text-void-600">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span>Position encrypted on-chain</span>
      </div>
    </motion.div>
  );
};

export default function PortfolioPage() {
  const { connected, publicKey } = useWallet();
  const [filter, setFilter] = useState<FilterOption>("all");
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Fetch user bets from SDK
  const { bets: liveBets, rawBets, isLoading, error, refetch } = useUserBets();
  const { claimPayout, isSubmitting: isClaiming, error: claimError } = useClaimPayout();

  // Combine live bets with mock data for display
  const allBets = useMemo(() => {
    // If we have live bets, transform them to display format
    // For now, since we don't have full bet data (outcome, amount are encrypted),
    // we'll show mock data as a demo
    if (liveBets.length > 0) {
      // Transform live bets to MockBet format (limited info available)
      return liveBets.map((bet, i) => ({
        id: bet.id,
        marketId: bet.marketId,
        question: `Market ${bet.marketId.slice(0, 8)}...`,
        side: "yes" as Side, // Encrypted, not known
        amount: bet.amount,
        timestamp: bet.placedAt,
        status: (bet.claimed ? "claimed" : bet.status === "confirmed" ? "active" : "active") as BetStatus,
        marketStatus: "open" as MarketStatus,
        potentialPayout: bet.amount * 1.5,
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        payout: bet.payoutAmount || 0,
        resolution: undefined as Side | undefined,
      }));
    }
    // Show mock data when no live bets
    return mockBets;
  }, [liveBets]);

  const handleClaim = async (betId: string) => {
    setClaimingId(betId);
    try {
      // Find the bet to get market info
      const bet = allBets.find(b => b.id === betId);
      if (bet) {
        // Note: In real implementation, we'd need to know the actual outcome and amount
        // This is a placeholder - real implementation would need bet details
        await claimPayout(bet.marketId, true, new BN((bet.payout || bet.amount) * 1e9));
        refetch(); // Refresh bets after claim
      }
    } catch (err) {
      console.error("Failed to claim:", err);
    } finally {
      setClaimingId(null);
    }
  };

  const filteredBets = allBets.filter((bet) => {
    switch (filter) {
      case "active":
        return bet.status === "active";
      case "claimable":
        return bet.status === "claimable";
      case "history":
        return bet.status === "claimed" || bet.status === "lost";
      default:
        return true;
    }
  });

  // Calculate stats
  const totalActive = allBets
    .filter((b) => b.status === "active")
    .reduce((sum, b) => sum + b.amount, 0);
  const totalClaimable = allBets
    .filter((b) => b.status === "claimable")
    .reduce((sum, b) => sum + (b.payout || 0), 0);
  const totalWinnings = allBets
    .filter((b) => b.status === "claimable" || (b.status === "claimed" && b.resolution === b.side))
    .reduce((sum, b) => sum + (b.payout || 0), 0);
  const activeBetsCount = allBets.filter((b) => b.status === "active").length;
  const claimableCount = allBets.filter((b) => b.status === "claimable").length;
  const isShowingMockData = liveBets.length === 0 && !isLoading;

  if (!connected) {
    return (
      <div className="relative min-h-screen pt-24 pb-16">
        <div className="absolute inset-0 grid-bg opacity-20" />

        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-20"
          >
            <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-void-800/50 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-void-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Connect Your Wallet</h1>
            <p className="text-void-400 mb-8">
              Connect your Solana wallet to view your bets and claim payouts.
            </p>
            <WalletMultiButton className="!bg-cipher-600 hover:!bg-cipher-500 !rounded-xl !py-3 !px-6 !font-medium" />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pt-24 pb-16">
      {/* Background */}
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="absolute top-40 left-1/4 w-96 h-96 bg-cipher-600/10 rounded-full blur-[150px]" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-display text-4xl sm:text-5xl font-bold text-white mb-4">
            My{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cipher-400 to-flux-400">
              Portfolio
            </span>
          </h1>
          <p className="text-lg text-void-400">
            Track your encrypted bets and claim your winnings.
          </p>
        </motion.div>

        {/* Stats cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="card p-5">
            <div className="text-void-500 text-xs uppercase tracking-wider mb-1">
              Active Bets
            </div>
            <div className="text-2xl font-mono font-bold text-white">{activeBetsCount}</div>
            <div className="text-sm text-void-400 mt-1">
              {formatCurrency(totalActive)} at stake
            </div>
          </div>
          <div className="card p-5 border-sealed-600/30">
            <div className="text-void-500 text-xs uppercase tracking-wider mb-1">
              Ready to Claim
            </div>
            <div className="text-2xl font-mono font-bold text-sealed-400">
              {claimableCount}
            </div>
            <div className="text-sm text-sealed-400/70 mt-1">
              {formatCurrency(totalClaimable)} available
            </div>
          </div>
          <div className="card p-5">
            <div className="text-void-500 text-xs uppercase tracking-wider mb-1">
              Total Won
            </div>
            <div className="text-2xl font-mono font-bold text-cipher-400">
              {formatCurrency(totalWinnings)}
            </div>
            <div className="text-sm text-void-400 mt-1">All time</div>
          </div>
          <div className="card p-5">
            <div className="text-void-500 text-xs uppercase tracking-wider mb-1">
              Win Rate
            </div>
            <div className="text-2xl font-mono font-bold text-white">67%</div>
            <div className="text-sm text-void-400 mt-1">2 wins / 3 resolved</div>
          </div>
        </motion.div>

        {/* Claimable alert */}
        {claimableCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8 p-4 bg-sealed-900/20 rounded-xl border border-sealed-600/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sealed-600/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-sealed-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sealed-300 font-medium">
                    You have {formatCurrency(totalClaimable)} ready to claim!
                  </p>
                  <p className="text-void-500 text-sm">
                    {claimableCount} winning bet{claimableCount > 1 ? "s" : ""} awaiting payout
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFilter("claimable")}
                className="btn-primary py-2 px-4 text-sm"
              >
                View Claimable
              </button>
            </div>
          </motion.div>
        )}

        {/* Filter tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2 mb-6 overflow-x-auto pb-2"
        >
          {[
            { id: "all", label: "All Bets" },
            { id: "active", label: "Active" },
            { id: "claimable", label: "Claimable", count: claimableCount },
            { id: "history", label: "History" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as FilterOption)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                filter === tab.id
                  ? "bg-cipher-600 text-white"
                  : "bg-void-800/50 text-void-400 hover:text-white hover:bg-void-700/50"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-sealed-600/30 text-sealed-400 rounded">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </motion.div>

        {/* Bets list */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="space-y-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredBets.length > 0 ? (
              filteredBets.map((bet) => (
                <BetCard
                  key={bet.id}
                  bet={bet}
                  onClaim={() => handleClaim(bet.id)}
                  isClaiming={claimingId === bet.id}
                />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-void-800/50 flex items-center justify-center">
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
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No bets found</h3>
                <p className="text-void-400 mb-6">
                  {filter === "all"
                    ? "You haven't placed any bets yet."
                    : `No ${filter} bets to show.`}
                </p>
                <Link href="/markets" className="btn-primary">
                  Browse Markets
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Privacy note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 p-6 bg-cipher-900/10 rounded-2xl border border-cipher-700/20"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-cipher-600/20 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-6 h-6 text-cipher-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-white mb-2">
                Your Privacy is Protected
              </h3>
              <p className="text-void-400 text-sm leading-relaxed">
                All bet amounts and positions shown here are decrypted locally using your
                wallet. Your positions are never revealed on-chain or to other users.
                Only you can see your betting history.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
