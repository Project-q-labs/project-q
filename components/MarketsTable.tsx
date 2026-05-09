"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWatchlist } from "@/lib/watchlist/use-watchlist";
import { WatchlistStar } from "@/components/WatchlistStar";

type Market = {
  symbol: string;
  assetIndex: number;
  maxLeverage: number;
  markPx: number;
  prevDayPx: number;
  change24hPct: number;
  funding: number;
  fundingApr: number;
  openInterest: number;
  openInterestNotional: number;
  dayNtlVlm: number;
  dayBaseVlm: number;
};

type ApiResponse = {
  data: Market[];
  meta: { count: number; source: string; fetchedAt: string };
};

type SortKey =
  | "symbol"
  | "markPx"
  | "change24hPct"
  | "funding"
  | "openInterestNotional"
  | "dayNtlVlm"
  | "maxLeverage";

type SortDir = "asc" | "desc";
type FilterMode = "all" | "watchlist";

const POLL_INTERVAL_MS = 5000;

export function MarketsTable() {
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("dayNtlVlm");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const { symbols: watchedSymbols, has: isWatched } = useWatchlist();

  // Fetch + poll
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/markets", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResponse = await res.json();
        if (!cancelled) {
          setMarkets(json.data);
          setHasError(false);
        }
      } catch {
        if (!cancelled) setHasError(true);
      }
    };
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Filter + sort
  const filteredMarkets = useMemo(() => {
    if (!markets) return null;
    let rows = markets;

    if (filterMode === "watchlist") {
      rows = rows.filter((m) => isWatched(m.symbol));
    }

    const q = search.trim().toLowerCase();
    if (q.length > 0) {
      rows = rows.filter((m) => m.symbol.toLowerCase().includes(q));
    }

    const factor = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * factor;
      }
      return ((av as number) - (bv as number)) * factor;
    });
  }, [markets, search, sortKey, sortDir, filterMode, isWatched]);

  const setSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  // Loading / error states
  if (!markets && !hasError) {
    return (
      <div className="px-6 py-12 text-center font-mono text-[12px] text-ink-faint md:px-10">
        loading market data…
      </div>
    );
  }
  if (hasError && !markets) {
    return (
      <div className="px-6 py-12 text-center font-mono text-[12px] text-ink-mute md:px-10">
        market data unavailable · retrying…
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between md:px-10">
        {/* Left: search + filter pills */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search pair…"
            className="w-full max-w-xs border border-bg-line bg-bg-panel px-3 py-2 font-mono text-[13px] text-ink placeholder-ink-faint focus:border-ink-mute focus:outline-none"
          />

          {/* Filter pills */}
          <div className="inline-flex border border-bg-line bg-bg-panel font-mono text-[11px] uppercase tracking-widest">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-2 transition-colors ${
                filterMode === "all"
                  ? "bg-bg-line text-ink"
                  : "text-ink-faint hover:text-ink-mute"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode("watchlist")}
              className={`flex items-center gap-2 px-3 py-2 transition-colors ${
                filterMode === "watchlist"
                  ? "bg-bg-line text-ink"
                  : "text-ink-faint hover:text-ink-mute"
              }`}
            >
              <span>★ Watchlist</span>
              {watchedSymbols.length > 0 && (
                <span className="text-signal">{watchedSymbols.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* Right: count */}
        <div className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          {filteredMarkets?.length ?? 0} of {markets?.length ?? 0} pairs
        </div>
      </div>

      {/* Empty watchlist state */}
      {filterMode === "watchlist" && watchedSymbols.length === 0 ? (
        <div className="border-y border-bg-line px-6 py-16 text-center md:px-10">
          <div className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">
            [ EMPTY WATCHLIST ]
          </div>
          <h3 className="mt-4 text-[18px] font-medium text-ink">
            Star any pair to add it here
          </h3>
          <p className="mt-2 text-[13px] text-ink-mute">
            Click the star (★) next to a pair&apos;s name. Saved locally —
            wallet-backed sync arrives in M3.
          </p>
          <button
            onClick={() => setFilterMode("all")}
            className="mt-6 inline-flex items-center gap-2 border border-bg-line bg-bg-panel px-4 py-2 font-mono text-[12px] uppercase tracking-widest text-ink hover:border-ink-mute"
          >
            ← Browse all pairs
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border-y border-bg-line">
          <table className="w-full min-w-[820px] font-mono text-[13px]">
            <thead className="border-b border-bg-line bg-bg-deep">
              <tr className="text-left text-[10px] uppercase tracking-widest text-ink-faint">
                <th className="w-8 px-2 py-3" aria-label="watchlist" />
                <Th label="Pair" active={sortKey === "symbol"}
                    dir={sortKey === "symbol" ? sortDir : null}
                    onClick={() => setSort("symbol")} align="left" />
                <Th label="Price" active={sortKey === "markPx"}
                    dir={sortKey === "markPx" ? sortDir : null}
                    onClick={() => setSort("markPx")} align="right" />
                <Th label="24h" active={sortKey === "change24hPct"}
                    dir={sortKey === "change24hPct" ? sortDir : null}
                    onClick={() => setSort("change24hPct")} align="right" />
                <Th label="Funding (1h)" active={sortKey === "funding"}
                    dir={sortKey === "funding" ? sortDir : null}
                    onClick={() => setSort("funding")} align="right" />
                <Th label="OI" active={sortKey === "openInterestNotional"}
                    dir={sortKey === "openInterestNotional" ? sortDir : null}
                    onClick={() => setSort("openInterestNotional")} align="right" />
                <Th label="24h Volume" active={sortKey === "dayNtlVlm"}
                    dir={sortKey === "dayNtlVlm" ? sortDir : null}
                    onClick={() => setSort("dayNtlVlm")} align="right" />
                <Th label="Max Lev" active={sortKey === "maxLeverage"}
                    dir={sortKey === "maxLeverage" ? sortDir : null}
                    onClick={() => setSort("maxLeverage")} align="right" />
              </tr>
            </thead>
            <tbody>
              {filteredMarkets?.map((m) => (
                <MarketRow key={m.symbol} market={m} />
              ))}
              {filteredMarkets?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-ink-faint">
                    no pairs match &quot;{search}&quot;
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ label, active, dir, onClick, align }: {
  label: string;
  active: boolean;
  dir: SortDir | null;
  onClick: () => void;
  align: "left" | "right";
}) {
  const arrow = dir === "asc" ? " ↑" : dir === "desc" ? " ↓" : "";
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none px-4 py-3 transition-colors hover:text-ink ${
        active ? "text-ink" : ""
      } ${align === "right" ? "text-right" : "text-left"}`}
    >
      {label}
      <span className="text-signal">{arrow}</span>
    </th>
  );
}

function MarketRow({ market }: { market: Market }) {
  const isUp = market.change24hPct >= 0;
  const fundingPositive = market.funding >= 0;
  return (
    <tr className="border-b border-bg-line/50 transition-colors hover:bg-bg-panel">
      <td className="w-8 px-2 py-3">
        <WatchlistStar symbol={market.symbol} size="sm" />
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/markets/${market.symbol}`}
          className="block text-ink hover:text-signal transition-colors"
        >
          {market.symbol}
          <span className="ml-2 text-[10px] uppercase tracking-widest text-ink-faint">
            PERP
          </span>
        </Link>
      </td>
      <td className="px-4 py-3 text-right text-ink">${formatPrice(market.markPx)}</td>
      <td className={`px-4 py-3 text-right ${isUp ? "text-signal" : "text-[#ff6b6b]"}`}>
        {isUp ? "+" : ""}{market.change24hPct.toFixed(2)}%
      </td>
      <td className={`px-4 py-3 text-right ${fundingPositive ? "text-signal" : "text-[#ff6b6b]"}`}>
        {fundingPositive ? "+" : ""}{(market.funding * 100).toFixed(4)}%
        <div className="text-[10px] text-ink-faint">{market.fundingApr.toFixed(1)}% APR</div>
      </td>
      <td className="px-4 py-3 text-right text-ink">${formatCompact(market.openInterestNotional)}</td>
      <td className="px-4 py-3 text-right text-ink">${formatCompact(market.dayNtlVlm)}</td>
      <td className="px-4 py-3 text-right text-ink-mute">{market.maxLeverage}x</td>
    </tr>
  );
}

function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  if (price >= 100) return price.toFixed(2);
  if (price >= 1) return price.toFixed(3);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

function formatCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}
