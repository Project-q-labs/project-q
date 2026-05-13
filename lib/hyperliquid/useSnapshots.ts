"use client";

import { useEffect, useState, useRef } from "react";
import type { MarketSnapshot, Symbol } from "@/lib/hyperliquid/sdk";

type SnapshotsResponse = {
  data: Record<Symbol, MarketSnapshot>;
  meta: { source: string; fetchedAt: string; symbolCount: number };
};

type State = {
  snapshots: Record<Symbol, MarketSnapshot> | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
};

const POLL_INTERVAL_MS = 5000;

/**
 * useSnapshots — polls /api/v1/snapshots every 5 seconds.
 *
 * Returns the latest market data for all supported symbols, plus loading/error state.
 *
 * Usage:
 *   const { snapshots, loading, error } = useSnapshots();
 *   if (snapshots) {
 *     const btc = snapshots.BTC;
 *     // btc.markPx, btc.fundingAprPct, etc.
 *   }
 *
 * Auto-cleans up on unmount. Only one fetch at a time (no overlapping).
 */
export function useSnapshots() {
  const [state, setState] = useState<State>({
    snapshots: null,
    loading: true,
    error: null,
    lastUpdated: null,
  });
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function fetchSnapshots() {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const res = await fetch("/api/v1/snapshots", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as SnapshotsResponse;
        if (!mountedRef.current) return;
        setState({
          snapshots: json.data,
          loading: false,
          error: null,
          lastUpdated: Date.now(),
        });
      } catch (err) {
        if (!mountedRef.current) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        setState((s) => ({ ...s, loading: false, error: msg }));
      } finally {
        inFlightRef.current = false;
      }
    }

    // Initial fetch
    fetchSnapshots();

    // Poll every 5 seconds
    const interval = setInterval(fetchSnapshots, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return state;
}
