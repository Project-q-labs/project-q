"use client";

import { useEffect, useState } from "react";

type MarketData = {
  symbol: string;
  markPx: number;
  funding: number;
  openInterest: number;
  dayNtlVlm: number;
  dayBaseVlm: number;
  premium: number;
  oraclePx: number;
};

type MarketResponse = {
  data: MarketData;
  meta: { source: string; fetchedAt: string };
};

type Props = {
  symbol: string;
};

export function MarketStats({ symbol }: Props) {
  const [market, setMarket] = useState<MarketData | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/v1/markets/${symbol}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: MarketResponse = await res.json();
        if (!cancelled) setMarket(json.data);
      } catch {
        // Silent — header shows the error state
      }
    };

    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  // Compute derived values
  const fundingHourlyPct = market ? market.funding * 100 : 0;
  const fundingAnnualPct = fundingHourlyPct * 24 * 365;
  const oiNotional = market ? market.openInterest * market.markPx : 0;
  const premiumPct = market ? market.premium * 100 : 0;

  return (
    <div className="grid grid-cols-2 gap-px bg-bg-line md:grid-cols-4">
      <StatCard
        label="Funding (1h)"
        tag="01 / FUNDING"
        value={
          market
            ? `${fundingHourlyPct >= 0 ? "+" : ""}${fundingHourlyPct.toFixed(4)}%`
            : "—"
        }
        sub={market ? `~ ${fundingAnnualPct.toFixed(1)}% APR` : "loading…"}
        positive={market ? market.funding >= 0 : null}
      />
      <StatCard
        label="Open Interest"
        tag="02 / OI"
        value={
          market
            ? `$${formatCompactUSD(oiNotional)}`
            : "—"
        }
        sub={
          market
            ? `${formatCompact(market.openInterest)} ${market.symbol}`
            : "loading…"
        }
      />
      <StatCard
        label="24h Volume"
        tag="03 / VOLUME"
        value={market ? `$${formatCompactUSD(market.dayNtlVlm)}` : "—"}
        sub={
          market
            ? `${formatCompact(market.dayBaseVlm)} ${market.symbol}`
            : "loading…"
        }
      />
      <StatCard
        label="Mark vs Oracle"
        tag="04 / PREMIUM"
        value={
          market
            ? `${premiumPct >= 0 ? "+" : ""}${premiumPct.toFixed(3)}%`
            : "—"
        }
        sub={market ? `oracle $${formatPrice(market.oraclePx)}` : "loading…"}
      />
    </div>
  );
}

function StatCard({
  label,
  tag,
  value,
  sub,
  positive,
}: {
  label: string;
  tag: string;
  value: string;
  sub: string;
  positive?: boolean | null;
}) {
  let valueClass = "text-ink";
  if (positive === true) valueClass = "text-signal";
  else if (positive === false) valueClass = "text-[#ff6b6b]";

  return (
    <div className="bg-bg p-6">
      <div className="font-mono text-[10px] uppercase tracking-widest text-signal-dim">
        {tag}
      </div>
      <div className="mt-3 font-mono text-[11px] text-ink-mute">{label}</div>
      <div
        className={`mt-2 font-mono text-[24px] font-medium leading-tight ${valueClass}`}
      >
        {value}
      </div>
      <div className="mt-1 font-mono text-[11px] text-ink-faint">{sub}</div>
    </div>
  );
}

function formatCompactUSD(n: number): string {
  return formatCompact(n);
}

function formatCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(1);
  if (price >= 100) return price.toFixed(2);
  if (price >= 1) return price.toFixed(3);
  return price.toFixed(5);
}
