"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MarketData = {
  symbol: string;
  maxLeverage: number;
  markPx: number;
  midPx: number | null;
  oraclePx: number;
  prevDayPx: number;
  funding: number;
  openInterest: number;
  dayNtlVlm: number;
  dayBaseVlm: number;
};

type MarketResponse = {
  data: MarketData;
  meta: { source: string; fetchedAt: string };
};

type Props = {
  symbol: string;
};

export function MarketHeader({ symbol }: Props) {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/v1/markets/${symbol}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: MarketResponse = await res.json();
        if (!cancelled) {
          setMarket(json.data);
          setHasError(false);
        }
      } catch {
        if (!cancelled) setHasError(true);
      }
    };

    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  if (hasError && !market) {
    return (
      <div className="border-b border-bg-line bg-bg-deep px-6 py-6 md:px-10">
        <div className="font-mono text-[12px] text-ink-mute">
          Market data unavailable. Retrying…
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="border-b border-bg-line bg-bg-deep px-6 py-6 md:px-10">
        <div className="font-mono text-[12px] text-ink-faint">
          loading {symbol}…
        </div>
      </div>
    );
  }

  const change24h = market.markPx - market.prevDayPx;
  const change24hPct = (change24h / market.prevDayPx) * 100;
  const isUp = change24h >= 0;

  return (
    <div className="border-b border-bg-line bg-bg-deep">
      <div className="mx-auto max-w-7xl px-6 py-6 md:px-10 md:py-8">
        {/* Breadcrumb */}
        <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          <Link href="/" className="hover:text-ink transition-colors">
            ←&nbsp;&nbsp;back
          </Link>
        </div>

        {/* Pair name + price + 24h */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-8">
          <div className="flex items-baseline gap-4">
            <h1 className="font-sans text-[36px] font-semibold leading-none tracking-tightest text-ink md:text-[52px]">
              {market.symbol}
            </h1>
            <span className="font-mono text-[12px] uppercase tracking-widest text-ink-faint">
              PERP · max {market.maxLeverage}x
            </span>
          </div>

          <div className="flex items-baseline gap-4">
            <div className="font-mono text-[28px] font-medium leading-none text-ink md:text-[36px]">
              ${formatPrice(market.markPx)}
            </div>
            <div
              className={`font-mono text-[14px] ${
                isUp ? "text-signal" : "text-[#ff6b6b]"
              }`}
            >
              {isUp ? "+" : ""}
              {change24h.toFixed(market.markPx >= 100 ? 1 : 4)}{" "}
              <span className="opacity-70">
                ({isUp ? "+" : ""}
                {change24hPct.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }
  if (price >= 100) return price.toFixed(2);
  if (price >= 1) return price.toFixed(3);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}
