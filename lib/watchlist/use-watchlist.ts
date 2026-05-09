"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Anonymous watchlist — symbols saved to localStorage.
 *
 * In M3 we'll migrate this to a server-side watchlist tied to the user's
 * wallet (via SIWE auth). The hook signature stays the same, so the
 * component layer doesn't change.
 */

const STORAGE_KEY = "pq_watchlist_v1";

/**
 * Read watchlist from localStorage. Returns empty array on first load
 * or if storage is unavailable (SSR, blocked).
 */
function readWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => typeof s === "string");
  } catch {
    return [];
  }
}

function writeWatchlist(symbols: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
    // Notify other tabs / components in same tab
    window.dispatchEvent(new CustomEvent("pq-watchlist-changed"));
  } catch {
    // Quota exceeded, private mode, etc. — fail silently
  }
}

export function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);

  // Initial load + listen for changes
  useEffect(() => {
    setSymbols(readWatchlist());

    const onChange = () => setSymbols(readWatchlist());
    window.addEventListener("pq-watchlist-changed", onChange);
    window.addEventListener("storage", onChange); // cross-tab
    return () => {
      window.removeEventListener("pq-watchlist-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const add = useCallback((symbol: string) => {
    const sym = symbol.toUpperCase();
    const current = readWatchlist();
    if (current.includes(sym)) return;
    writeWatchlist([...current, sym]);
  }, []);

  const remove = useCallback((symbol: string) => {
    const sym = symbol.toUpperCase();
    const current = readWatchlist();
    writeWatchlist(current.filter((s) => s !== sym));
  }, []);

  const toggle = useCallback((symbol: string) => {
    const sym = symbol.toUpperCase();
    const current = readWatchlist();
    if (current.includes(sym)) {
      writeWatchlist(current.filter((s) => s !== sym));
    } else {
      writeWatchlist([...current, sym]);
    }
  }, []);

  const has = useCallback(
    (symbol: string) => symbols.includes(symbol.toUpperCase()),
    [symbols]
  );

  return { symbols, add, remove, toggle, has };
}
