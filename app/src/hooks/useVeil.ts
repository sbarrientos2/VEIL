"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import type {
  Market,
  BetRecord,
  MarketStatus,
  UIMarket,
  UIBet,
} from "@/lib/veil-types";
import {
  transformMarket,
  transformBet,
  solToLamports,
} from "@/lib/veil-types";

// Get network from environment variable
const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";

// Dynamically import VeilClient to avoid SSR issues
let VeilClient: any = null;
let VEIL_PROGRAM_ID: PublicKey | null = null;
let VEIL_PROGRAM_IDS: any = null;

/**
 * Initialize SDK imports (browser-only)
 */
async function initializeSdk() {
  if (typeof window === "undefined") return null;
  if (VeilClient) return VeilClient;

  try {
    const sdk = await import("../../../sdk");
    VeilClient = sdk.VeilClient;
    VEIL_PROGRAM_IDS = sdk.VEIL_PROGRAM_IDS;
    // Use the correct program ID based on network
    VEIL_PROGRAM_ID = VEIL_PROGRAM_IDS[NETWORK as keyof typeof VEIL_PROGRAM_IDS] || sdk.VEIL_PROGRAM_ID;
    console.log(`[VEIL] Initialized for ${NETWORK}, Program ID: ${VEIL_PROGRAM_ID?.toBase58()}`);
    return VeilClient;
  } catch (err) {
    console.error("Failed to load VEIL SDK:", err);
    return null;
  }
}

/**
 * Hook for creating and managing the Veil client
 */
export function useVeilClient() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [client, setClient] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
      setClient(null);
      return;
    }

    const initClient = async () => {
      setIsInitializing(true);
      setError(null);

      try {
        const ClientClass = await initializeSdk();
        if (!ClientClass) {
          throw new Error("Failed to load SDK");
        }

        // Create anchor wallet adapter (compatible with browser wallets)
        const anchorWallet = {
          publicKey: wallet.publicKey!,
          signTransaction: wallet.signTransaction!,
          signAllTransactions: wallet.signAllTransactions!,
          payer: wallet.publicKey! as any, // Wallet adapter doesn't have payer, SDK handles this
        } as anchor.Wallet;

        // Create client with environment-based configuration
        const veilClient = new ClientClass({
          connection,
          wallet: anchorWallet,
          cluster: NETWORK as "localnet" | "devnet" | "mainnet",
          programId: VEIL_PROGRAM_ID,
        });

        setClient(veilClient);
        initRef.current = true;
      } catch (err) {
        console.error("Failed to initialize VeilClient:", err);
        setError(err instanceof Error ? err : new Error("Failed to initialize client"));
      } finally {
        setIsInitializing(false);
      }
    };

    initClient();
  }, [connection, wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions]);

  // Reset client when wallet disconnects
  useEffect(() => {
    if (!wallet.connected) {
      setClient(null);
      initRef.current = false;
    }
  }, [wallet.connected]);

  return { client, isInitializing, error };
}

/**
 * Hook for fetching a single market by pubkey
 */
export function useMarket(marketPubkey: string | PublicKey | null) {
  const { client } = useVeilClient();
  const [market, setMarket] = useState<UIMarket | null>(null);
  const [rawMarket, setRawMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMarket = useCallback(async () => {
    if (!marketPubkey) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const pubkey = typeof marketPubkey === "string"
        ? new PublicKey(marketPubkey)
        : marketPubkey;

      if (client) {
        const sdkMarket = await client.getMarket(pubkey);
        if (sdkMarket) {
          setRawMarket(sdkMarket);
          setMarket(transformMarket(sdkMarket, pubkey));
        } else {
          setMarket(null);
          setRawMarket(null);
        }
      } else {
        // Client not available yet
        setMarket(null);
        setRawMarket(null);
      }
    } catch (err) {
      console.error("Failed to fetch market:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch market"));
    } finally {
      setIsLoading(false);
    }
  }, [client, marketPubkey]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  return { market, rawMarket, isLoading, error, refetch: fetchMarket };
}

/**
 * Hook for fetching all markets
 */
export function useMarkets(filters?: { status?: MarketStatus }) {
  const { client } = useVeilClient();
  const [markets, setMarkets] = useState<UIMarket[]>([]);
  const [rawMarkets, setRawMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMarkets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (client) {
        const sdkMarkets = await client.getAllMarkets();
        setRawMarkets(sdkMarkets);

        // Transform to UI format (need to get pubkeys from program.account)
        // For now, use vault as identifier
        let transformedMarkets = sdkMarkets.map((m: Market) =>
          transformMarket(m, m.vault)
        );

        // Apply status filter if provided
        if (filters?.status) {
          transformedMarkets = transformedMarkets.filter(
            (m: UIMarket) => m.status === filters.status
          );
        }

        setMarkets(transformedMarkets);
      } else {
        setMarkets([]);
        setRawMarkets([]);
      }
    } catch (err) {
      console.error("Failed to fetch markets:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch markets"));
    } finally {
      setIsLoading(false);
    }
  }, [client, filters?.status]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return { markets, rawMarkets, isLoading, error, refetch: fetchMarkets };
}

/**
 * Hook for placing encrypted bets
 */
export function usePlaceBet() {
  const { client } = useVeilClient();
  const wallet = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const placeBet = useCallback(
    async (
      marketPubkey: string | PublicKey,
      side: "yes" | "no",
      amountSol: number
    ): Promise<string | null> => {
      if (!wallet.publicKey) {
        setError(new Error("Wallet not connected"));
        return null;
      }

      if (!client) {
        setError(new Error("Client not initialized"));
        return null;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const pubkey = typeof marketPubkey === "string"
          ? new PublicKey(marketPubkey)
          : marketPubkey;

        const result = await client.placeBet({
          market: pubkey,
          outcome: side === "yes",
          amountLamports: solToLamports(amountSol),
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to place bet");
        }

        return result.data?.transactionSignature || null;
      } catch (err) {
        console.error("Failed to place bet:", err);
        setError(err instanceof Error ? err : new Error("Failed to place bet"));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [client, wallet.publicKey]
  );

  return { placeBet, isSubmitting, error };
}

/**
 * Hook for creating markets (authority only)
 */
export function useCreateMarket() {
  const { client } = useVeilClient();
  const wallet = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createMarket = useCallback(
    async (params: {
      marketId: BN;
      question: string;
      resolutionTime: number;
      oracleType: "manual" | "switchboard" | "jury";
      feeBps: number;
    }): Promise<{ marketPubkey: string; txSignature: string } | null> => {
      if (!wallet.publicKey) {
        setError(new Error("Wallet not connected"));
        return null;
      }

      if (!client) {
        setError(new Error("Client not initialized"));
        return null;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        // Create the market
        const txSignature = await client.createMarket(params);

        // Get the market PDA
        const marketPubkey = client.getMarketPda(wallet.publicKey, params.marketId);

        // Initialize MPC state
        const initResult = await client.initMarketState(marketPubkey);
        if (!initResult.success) {
          console.warn("Market created but MPC init failed:", initResult.error);
        }

        return {
          marketPubkey: marketPubkey.toBase58(),
          txSignature,
        };
      } catch (err) {
        console.error("Failed to create market:", err);
        setError(err instanceof Error ? err : new Error("Failed to create market"));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [client, wallet.publicKey]
  );

  return { createMarket, isSubmitting, error };
}

/**
 * Hook for claiming payouts
 */
export function useClaimPayout() {
  const { client } = useVeilClient();
  const wallet = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const claimPayout = useCallback(
    async (
      marketPubkey: string | PublicKey,
      outcome: boolean,
      amountLamports: BN
    ): Promise<string | null> => {
      if (!wallet.publicKey) {
        setError(new Error("Wallet not connected"));
        return null;
      }

      if (!client) {
        setError(new Error("Client not initialized"));
        return null;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const pubkey = typeof marketPubkey === "string"
          ? new PublicKey(marketPubkey)
          : marketPubkey;

        const txSignature = await client.claimPayout({
          market: pubkey,
          outcome,
          amountLamports,
        });

        return txSignature;
      } catch (err) {
        console.error("Failed to claim payout:", err);
        setError(err instanceof Error ? err : new Error("Failed to claim payout"));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [client, wallet.publicKey]
  );

  return { claimPayout, isSubmitting, error };
}

/**
 * Hook for fetching user's bet records
 */
export function useUserBets() {
  const { client } = useVeilClient();
  const wallet = useWallet();
  const [bets, setBets] = useState<UIBet[]>([]);
  const [rawBets, setRawBets] = useState<BetRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBets = useCallback(async () => {
    if (!wallet.publicKey) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (client) {
        const sdkBets = await client.getUserBets(wallet.publicKey);
        setRawBets(sdkBets);

        // Transform to UI format
        // Use market as part of the identifier
        const transformedBets = sdkBets.map((b: BetRecord, i: number) =>
          transformBet(b, new PublicKey(b.market.toBase58() + wallet.publicKey!.toBase58().slice(0, 10)))
        );

        setBets(transformedBets);
      } else {
        setBets([]);
        setRawBets([]);
      }
    } catch (err) {
      console.error("Failed to fetch user bets:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch bets"));
    } finally {
      setIsLoading(false);
    }
  }, [client, wallet.publicKey]);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  return { bets, rawBets, isLoading, error, refetch: fetchBets };
}

/**
 * Hook for MXE initialization status
 */
export function useMxeStatus() {
  const { client } = useVeilClient();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkMxe = async () => {
      if (!client) {
        setIsInitialized(false);
        setIsChecking(false);
        return;
      }

      try {
        const initialized = await client.isMxeInitialized();
        setIsInitialized(initialized);
      } catch (err) {
        console.error("Failed to check MXE status:", err);
        setIsInitialized(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkMxe();
  }, [client]);

  return { isInitialized, isChecking };
}

/**
 * Utility hook for computing potential payout
 */
export function usePotentialPayout(
  market: UIMarket | null,
  side: "yes" | "no",
  amountSol: number
) {
  return useMemo(() => {
    if (!market || amountSol <= 0) return 0;

    const pool = side === "yes" ? market.yesPool : market.noPool;
    const oppositePool = side === "yes" ? market.noPool : market.yesPool;

    // Parimutuel calculation
    const yourShare = amountSol / (pool + amountSol);
    const winnings = yourShare * oppositePool;

    // Account for fees
    const fee = market.feePercent / 100;
    const netWinnings = winnings * (1 - fee);

    return amountSol + netWinnings;
  }, [market, side, amountSol]);
}

/**
 * Hook for resolving a market (oracle/authority only)
 */
export function useResolveMarket() {
  const { client } = useVeilClient();
  const wallet = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const resolveMarket = useCallback(
    async (
      marketPubkey: string | PublicKey,
      outcome: boolean
    ): Promise<string | null> => {
      if (!wallet.publicKey) {
        setError(new Error("Wallet not connected"));
        return null;
      }

      if (!client) {
        setError(new Error("Client not initialized"));
        return null;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const pubkey = typeof marketPubkey === "string"
          ? new PublicKey(marketPubkey)
          : marketPubkey;

        // First close the market if not already closed
        try {
          await client.closeMarket(pubkey);
        } catch {
          // Market might already be closed
        }

        // Then resolve
        const result = await client.resolveMarket({
          market: pubkey,
          outcome,
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to resolve market");
        }

        return result.data?.transactionSignature || null;
      } catch (err) {
        console.error("Failed to resolve market:", err);
        setError(err instanceof Error ? err : new Error("Failed to resolve market"));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [client, wallet.publicKey]
  );

  return { resolveMarket, isSubmitting, error };
}

/**
 * Hook for cancelling a market (authority only)
 */
export function useCancelMarket() {
  const { client } = useVeilClient();
  const wallet = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cancelMarket = useCallback(
    async (marketPubkey: string | PublicKey): Promise<string | null> => {
      if (!wallet.publicKey) {
        setError(new Error("Wallet not connected"));
        return null;
      }

      if (!client) {
        setError(new Error("Client not initialized"));
        return null;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const pubkey = typeof marketPubkey === "string"
          ? new PublicKey(marketPubkey)
          : marketPubkey;

        const txSignature = await client.cancelMarket(pubkey);
        return txSignature;
      } catch (err) {
        console.error("Failed to cancel market:", err);
        setError(err instanceof Error ? err : new Error("Failed to cancel market"));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [client, wallet.publicKey]
  );

  return { cancelMarket, isSubmitting, error };
}

/**
 * Hook for claiming refund from cancelled market
 */
export function useClaimRefund() {
  const { client } = useVeilClient();
  const wallet = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const claimRefund = useCallback(
    async (marketPubkey: string | PublicKey): Promise<string | null> => {
      if (!wallet.publicKey) {
        setError(new Error("Wallet not connected"));
        return null;
      }

      if (!client) {
        setError(new Error("Client not initialized"));
        return null;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const pubkey = typeof marketPubkey === "string"
          ? new PublicKey(marketPubkey)
          : marketPubkey;

        const txSignature = await client.claimRefund(pubkey);
        return txSignature;
      } catch (err) {
        console.error("Failed to claim refund:", err);
        setError(err instanceof Error ? err : new Error("Failed to claim refund"));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [client, wallet.publicKey]
  );

  return { claimRefund, isSubmitting, error };
}
