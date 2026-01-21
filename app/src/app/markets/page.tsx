"use client";

import { FC, useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useMarkets } from "@/hooks/useVeil";
import type { UIMarket, MarketStatus } from "@/lib/veil-types";
import { getTimeRemaining, getStatusDisplay, formatSol } from "@/lib/veil-types";

type Resolution = "yes" | "no";
type SortOption = "newest" | "ending-soon" | "most-volume" | "most-participants";

interface DisplayMarket {
  id: string;
  question: string;
  category: string;
  status: MarketStatus;
  totalPool: number;
  yesPool: number;
  noPool: number;
  endTime: Date;
  createdAt: Date;
  participantCount: number;
  resolution?: Resolution;
}

// Mock data for markets - shown when no live markets exist
const mockMarkets: DisplayMarket[] = [
  {
    id: "btc-100k-jan",
    question: "Will BTC reach $100,000 by January 31st, 2026?",
    category: "Crypto",
    status: "open" as const,
    totalPool: 125.5,
    yesPool: 75.3,
    noPool: 50.2,
    endTime: new Date("2026-01-31T23:59:59Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    participantCount: 342,
  },
  {
    id: "eth-pos-upgrade",
    question: "Will Ethereum implement EIP-4844 proto-danksharding by Q1 2026?",
    category: "Crypto",
    status: "open" as const,
    totalPool: 89.0,
    yesPool: 52.0,
    noPool: 37.0,
    endTime: new Date("2026-03-31T23:59:59Z"),
    createdAt: new Date("2026-01-05T00:00:00Z"),
    participantCount: 218,
  },
  {
    id: "sol-top-5",
    question: "Will Solana remain in the top 5 by market cap through Q1 2026?",
    category: "Crypto",
    status: "open" as const,
    totalPool: 156.0,
    yesPool: 98.0,
    noPool: 58.0,
    endTime: new Date("2026-03-31T23:59:59Z"),
    createdAt: new Date("2026-01-02T00:00:00Z"),
    participantCount: 489,
  },
  {
    id: "arcium-mainnet",
    question: "Will Arcium launch mainnet by Q2 2026?",
    category: "Crypto",
    status: "open" as const,
    totalPool: 67.0,
    yesPool: 45.0,
    noPool: 22.0,
    endTime: new Date("2026-06-30T23:59:59Z"),
    createdAt: new Date("2026-01-12T00:00:00Z"),
    participantCount: 156,
  },
];

const categories = ["All", "Crypto", "Finance", "Technology", "Politics", "Science", "Sports"];

const statusLabels: Record<MarketStatus, string> = {
  open: "Open",
  closed: "Closed",
  resolving: "Resolving",
  resolved: "Resolved",
  cancelled: "Cancelled",
};

function formatPoolAmount(amount: number): string {
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K SOL`;
  }
  return `${amount.toFixed(2)} SOL`;
}

function formatTimeRemaining(endTime: Date): string {
  const now = new Date();
  const diff = endTime.getTime() - now.getTime();

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 30) {
    const months = Math.floor(days / 30);
    return `${months}mo remaining`;
  }
  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m remaining`;
}

// Convert UIMarket to DisplayMarket
function toDisplayMarket(uiMarket: UIMarket): DisplayMarket {
  return {
    id: uiMarket.id,
    question: uiMarket.question,
    category: "Crypto", // Category not stored on-chain, default to Crypto
    status: uiMarket.status,
    totalPool: uiMarket.totalPool,
    yesPool: uiMarket.yesPool,
    noPool: uiMarket.noPool,
    endTime: uiMarket.endTime,
    createdAt: uiMarket.createdAt,
    participantCount: uiMarket.participantCount,
    resolution: uiMarket.outcome === null ? undefined : uiMarket.outcome ? "yes" : "no",
  };
}

const MarketCard: FC<{ market: DisplayMarket; index: number }> = ({
  market,
  index,
}) => {
  const yesPercentage = market.totalPool > 0
    ? (market.yesPool / market.totalPool) * 100
    : 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/markets/${market.id}`}>
        <div className="group relative p-6 bg-void-800/50 rounded-2xl border border-void-600/50 hover:border-cipher-600/50 transition-all duration-300 hover:shadow-cipher cursor-pointer">
          {/* Status badge */}
          <div className="absolute top-4 right-4">
            <span className={`status-${market.status}`}>
              {statusLabels[market.status]}
            </span>
          </div>

          {/* Category */}
          <div className="mb-3">
            <span className="text-xs font-mono text-cipher-500 uppercase tracking-wider">
              {market.category}
            </span>
          </div>

          {/* Question */}
          <h3 className="text-lg font-medium text-white mb-4 pr-20 leading-snug group-hover:text-cipher-100 transition-colors">
            {market.question}
          </h3>

          {/* Pool distribution bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-sealed-400 font-mono">
                YES {yesPercentage.toFixed(0)}%
              </span>
              <span className="text-breach-400 font-mono">
                NO {(100 - yesPercentage).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-void-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sealed-500 to-sealed-400 rounded-full transition-all duration-500"
                style={{ width: `${yesPercentage}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-void-400">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="font-mono">{formatPoolAmount(market.totalPool)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-void-400">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>{market.participantCount}</span>
              </div>
            </div>
            <div className="text-void-500 text-xs">
              {market.status === "resolved" ? (
                <span className={market.resolution === "yes" ? "text-sealed-400" : "text-breach-400"}>
                  Resolved: {market.resolution?.toUpperCase()}
                </span>
              ) : (
                formatTimeRemaining(market.endTime)
              )}
            </div>
          </div>

          {/* Hover glow effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cipher-600/0 to-cipher-600/0 group-hover:from-cipher-600/5 group-hover:to-transparent transition-all duration-300 pointer-events-none" />
        </div>
      </Link>
    </motion.div>
  );
};

// Loading skeleton for markets
const MarketSkeleton: FC<{ index: number }> = ({ index }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: index * 0.05 }}
    className="p-6 bg-void-800/50 rounded-2xl border border-void-600/50 animate-pulse"
  >
    <div className="h-4 w-20 bg-void-700 rounded mb-3" />
    <div className="h-6 w-3/4 bg-void-700 rounded mb-4" />
    <div className="h-2 w-full bg-void-700 rounded mb-4" />
    <div className="flex justify-between">
      <div className="h-4 w-24 bg-void-700 rounded" />
      <div className="h-4 w-24 bg-void-700 rounded" />
    </div>
  </motion.div>
);

export default function MarketsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState<MarketStatus | "all">("all");
  const [sortBy, setSortBy] = useState<SortOption>("most-volume");

  // Fetch markets from SDK
  const { markets: liveMarkets, isLoading, error, refetch } = useMarkets();

  // Combine live markets with mock data for display
  const allMarkets = useMemo(() => {
    // Convert live UIMarkets to DisplayMarkets
    const liveDisplayMarkets = liveMarkets.map(toDisplayMarket);

    // If we have live markets, use them; otherwise show mock data
    if (liveDisplayMarkets.length > 0) {
      return liveDisplayMarkets;
    }

    // Show mock data when no live markets
    return mockMarkets;
  }, [liveMarkets]);

  const filteredMarkets = useMemo(() => {
    let filtered = [...allMarkets];

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.question.toLowerCase().includes(query) ||
          m.category.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory !== "All") {
      filtered = filtered.filter((m) => m.category === selectedCategory);
    }

    // Filter by status
    if (selectedStatus !== "all") {
      filtered = filtered.filter((m) => m.status === selectedStatus);
    }

    // Sort
    switch (sortBy) {
      case "newest":
        filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case "ending-soon":
        filtered.sort((a, b) => a.endTime.getTime() - b.endTime.getTime());
        break;
      case "most-volume":
        filtered.sort((a, b) => b.totalPool - a.totalPool);
        break;
      case "most-participants":
        filtered.sort((a, b) => b.participantCount - a.participantCount);
        break;
    }

    return filtered;
  }, [allMarkets, searchQuery, selectedCategory, selectedStatus, sortBy]);

  const openMarketsCount = allMarkets.filter((m) => m.status === "open").length;
  const totalVolume = allMarkets.reduce((sum, m) => sum + m.totalPool, 0);
  const isShowingMockData = liveMarkets.length === 0 && !isLoading;

  return (
    <div className="relative min-h-screen pt-24 pb-16">
      {/* Background */}
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute top-40 right-1/4 w-96 h-96 bg-cipher-600/10 rounded-full blur-[150px]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <h1 className="text-display text-4xl sm:text-5xl font-bold text-white mb-4">
            Prediction{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cipher-400 to-flux-400">
              Markets
            </span>
          </h1>
          <p className="text-lg text-void-400 max-w-2xl">
            Browse open markets and place encrypted bets. Your position stays hidden
            until resolution.
          </p>

          {/* Demo mode banner */}
          {isShowingMockData && (
            <div className="mt-4 p-3 bg-cipher-900/50 border border-cipher-600/50 rounded-lg flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-cipher-400 animate-pulse" />
              <span className="text-sm text-cipher-300">
                Demo mode: Connect wallet to see live markets from Solana devnet
              </span>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mt-4 p-3 bg-breach-900/50 border border-breach-600/50 rounded-lg flex items-center justify-between">
              <span className="text-sm text-breach-300">
                Failed to load markets: {error.message}
              </span>
              <button
                onClick={() => refetch()}
                className="text-sm text-breach-400 hover:text-breach-300 underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="flex flex-wrap gap-6 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-sealed-400 animate-pulse" />
              <span className="text-void-400">
                <span className="text-white font-mono">{openMarketsCount}</span> open
                markets
              </span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-cipher-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-void-400">
                <span className="text-white font-mono">{formatPoolAmount(totalVolume)}</span>{" "}
                total volume
              </span>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          {/* Search */}
          <div className="relative mb-6">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-void-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-12 w-full"
            />
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Categories */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    selectedCategory === category
                      ? "bg-cipher-600 text-white"
                      : "bg-void-800/50 text-void-400 hover:text-white hover:bg-void-700/50"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            {/* Status filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as MarketStatus | "all")}
              className="input-field py-2 min-w-[140px]"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="resolving">Resolving</option>
              <option value="resolved">Resolved</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="input-field py-2 min-w-[160px]"
            >
              <option value="most-volume">Most Volume</option>
              <option value="most-participants">Most Participants</option>
              <option value="newest">Newest</option>
              <option value="ending-soon">Ending Soon</option>
            </select>
          </div>
        </motion.div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <MarketSkeleton key={i} index={i} />
            ))}
          </div>
        )}

        {/* Markets grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredMarkets.map((market, index) => (
                <MarketCard key={market.id} market={market} index={index} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredMarkets.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
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
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No markets found</h3>
            <p className="text-void-400 mb-6">
              Try adjusting your filters or search query.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
                setSelectedStatus("all");
              }}
              className="btn-secondary"
            >
              Clear filters
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
