"use client";

import { useEffect, useRef, useState } from "react";

/**
 * PriceTicker
 *
 * Fetches /api/v1/prices every 5 seconds and renders a horizontal strip
 * of selected pairs with live mid prices. Tracks per-pair price direction
 * to show subtle up/down indicators.
 */

const TICKER_PAIRS = [
  "BTC",
  "ETH",
  "SOL",
  "HYPE",
  "DOGE",
  "XRP",
  "AVAX",
  "LINK",
  "ARB",
];

const POLL_INTERVAL_MS = 5000;

type PriceMap = Record<string, number>;
type DirectionMap = Record<string, "up" | "down" | "flat">;

type ApiResponse = {
  data: Array<{ symbol: string; mid: number }>;
  meta: { count: number; source: string; fetchedAt: string };
};

export function PriceTicker() {
  const [prices, setPrices] = useState<PriceMap | null>(null);
  const [directions, setDirections] = useState<DirectionMap>({});
  const [hasError, setHasError] = useState(false);
  const previousPricesRef = useRef<PriceMap>({});

  useEffect(() => {
    let cancelled = false;

    const fetchPrices = async () => {
      try {
        const res = await fetch("/api/v1/prices", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json: ApiResponse = await res.json();
        if (cancelled) return;

        const next: PriceMap = {};
        const dir: DirectionMap = {};

        for (const { symbol, mid } of json.data) {
          next[symbol] = mid;
          const prev = previousPricesRef.current[symbol];
          if (prev === undefined) dir[symbol] = "flat";
          else if (mid > prev) dir[symbol] = "up";
          else if (mid < prev) dir[symbol] = "down";
          else dir[symbol] = "flat";
        }

        previousPricesRef.current = next;
        setPrices(next);
        setDirections(dir);
        setHasError(false);
      } catch {
        if (!cancelled) setHasError(true);
      }
    };

    fetchPrices(); // initial load
    const interval = setInterval(fetchPrices, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Loading state
  if (!prices && !hasError) {
    return (
      <div className="border-b border-bg-line bg-bg-deep">
        <div className="px-6 py-2 font-mono text-[11px] text-ink-faint md:px-10">
          <span className="opacity-60">loading market data…</span>
        </div>
      </div>
    );
  }

  // Error state — keep the strip but show muted message
  if (hasError && !prices) {
    return (
      <div className="border-b border-bg-line bg-bg-deep">
        <div className="px-6 py-2 font-mono text-[11px] text-ink-faint md:px-10">
          <span>market data unavailable · retrying…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-bg-line bg-bg-deep">
      <div className="flex items-center gap-6 overflow-x-auto px-6 py-2 font-mono text-[12px] md:px-10 [scrollbar-width:none] [&amp;::-webkit-scrollbar]:hidden">
        {TICKER_PAIRS.map((symbol) => {
          const price = prices?.[symbol];
          if (price === undefined) return null;
          const dir = directions[symbol] ?? "flat";
          return (
            <div
              key={symbol}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap"
            >
              <span className="text-ink-faint">{symbol}</span>
              <span
                className={
                  dir === "up"
                    ? "text-signal"
                    : dir === "down"
                      ? "text-[#ff6b6b]"
                      : "text-ink"
                }
              >
                ${formatPrice(price)}
              </span>
            </div>
          );
        })}

        {/* Live indicator */}
        <div className="ml-auto flex shrink-0 items-center gap-2 pl-6">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
          </span>
          <span className="text-[10px] uppercase tracking-widest text-ink-faint">
            Live · Hyperliquid
          </span>
        </div>
      </div>
    </div>
  );
}

function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  if (price >= 100) return price.toFixed(1);
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}
