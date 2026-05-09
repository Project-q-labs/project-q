"use client";

import { useEffect, useState } from "react";

type Entry = {
  time: number;
  fundingRate: number;
  premium: number;
};

type Summary = {
  currentFunding: number;
  averageFunding7d: number;
  averageFundingApr7d: number;
  minFunding: number;
  maxFunding: number;
  positiveHours: number;
  negativeHours: number;
  totalSampleSize: number;
};

type ApiResponse = {
  data: {
    symbol: string;
    entries: Entry[];
    summary: Summary | null;
  };
  meta: { source: string; fetchedAt: string; lookbackDays: number };
};

type Props = {
  symbol: string;
};

/**
 * Funding rate history widget for a perpetual pair.
 *
 * Shows:
 *  - 7-day funding sparkline (hourly bars, color-coded long/short)
 *  - Current funding vs 7-day average
 *  - Min/Max range
 *  - Long-paying-short vs Short-paying-long hours ratio
 */
export function FundingHistory({ symbol }: Props) {
  const [data, setData] = useState<ApiResponse["data"] | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/v1/markets/${symbol}/funding?days=7`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResponse = await res.json();
        if (!cancelled) {
          setData(json.data);
          setHasError(false);
        }
      } catch {
        if (!cancelled) setHasError(true);
      }
    };

    load();
    // Funding refreshes every hour, so polling at 60s is plenty
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  if (hasError && !data) {
    return (
      <div className="border border-bg-line bg-bg-deep p-6 font-mono text-[12px] text-ink-mute">
        Funding history unavailable. Retrying…
      </div>
    );
  }

  if (!data || !data.summary) {
    return (
      <div className="border border-bg-line bg-bg-deep p-6 font-mono text-[12px] text-ink-faint">
        loading funding history…
      </div>
    );
  }

  const { entries, summary } = data;
  const currentVsAvg = summary.currentFunding - summary.averageFunding7d;
  const positiveRatio =
    summary.totalSampleSize > 0
      ? (summary.positiveHours / summary.totalSampleSize) * 100
      : 0;

  return (
    <div className="border border-bg-line bg-bg-deep">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-bg-line px-6 py-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-signal-dim">
          FUNDING · 7 DAYS
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          {entries.length} hourly samples
        </div>
      </div>

      {/* Sparkline */}
      <div className="px-6 pt-6">
        <FundingSparkline entries={entries} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-bg-line md:grid-cols-4">
        <Stat
          label="Current"
          value={`${summary.currentFunding >= 0 ? "+" : ""}${(summary.currentFunding * 100).toFixed(4)}%`}
          sub={`${summary.currentFunding >= 0 ? "long pays short" : "short pays long"}`}
          positive={summary.currentFunding >= 0}
        />
        <Stat
          label="7d Average"
          value={`${summary.averageFunding7d >= 0 ? "+" : ""}${(summary.averageFunding7d * 100).toFixed(4)}%`}
          sub={`${summary.averageFundingApr7d.toFixed(1)}% APR`}
          positive={summary.averageFunding7d >= 0}
        />
        <Stat
          label="Range (7d)"
          value={`${(summary.maxFunding * 100).toFixed(3)}%`}
          sub={`min ${(summary.minFunding * 100).toFixed(3)}%`}
        />
        <Stat
          label="Bias"
          value={`${positiveRatio.toFixed(0)}% +`}
          sub={`${summary.positiveHours}h long / ${summary.negativeHours}h short`}
        />
      </div>

      {/* Bottom note — current vs avg */}
      <div className="border-t border-bg-line px-6 py-3 font-mono text-[11px] text-ink-mute">
        Current funding is{" "}
        <span
          className={
            Math.abs(currentVsAvg) < summary.averageFunding7d * 0.2
              ? "text-ink"
              : currentVsAvg > 0
                ? "text-signal"
                : "text-[#ff6b6b]"
          }
        >
          {currentVsAvg >= 0 ? "+" : ""}
          {(currentVsAvg * 100).toFixed(4)}%
        </span>{" "}
        vs 7-day avg
        {Math.abs(currentVsAvg) > Math.abs(summary.averageFunding7d) * 1.5 && (
          <span className="ml-2 text-signal">· extreme reading</span>
        )}
      </div>
    </div>
  );
}

/**
 * Inline SVG sparkline. Each bar = one hour's funding rate.
 * Bars above zero = long-pays-short (signal green).
 * Bars below zero = short-pays-long (red).
 */
function FundingSparkline({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) return null;

  const width = 800;
  const height = 80;
  const padding = 4;

  const rates = entries.map((e) => e.fundingRate);
  const maxAbs = Math.max(...rates.map(Math.abs), 0.0001);

  const xStep = (width - padding * 2) / Math.max(entries.length - 1, 1);
  const midY = height / 2;
  const ampY = midY - padding;

  const barWidth = Math.max(xStep * 0.7, 1);

  return (
    <div className="relative h-[80px] w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-label="7-day funding history sparkline"
      >
        {/* Zero baseline */}
        <line
          x1={padding}
          x2={width - padding}
          y1={midY}
          y2={midY}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />

        {/* Bars */}
        {entries.map((e, idx) => {
          const x = padding + idx * xStep;
          const ratio = e.fundingRate / maxAbs;
          const barH = Math.abs(ratio) * ampY;
          const y = e.fundingRate >= 0 ? midY - barH : midY;
          const fill =
            e.fundingRate >= 0 ? "rgba(124,255,107,0.7)" : "rgba(255,107,107,0.7)";
          return (
            <rect
              key={idx}
              x={x - barWidth / 2}
              y={y}
              width={barWidth}
              height={Math.max(barH, 0.5)}
              fill={fill}
            />
          );
        })}
      </svg>

      {/* Axis labels */}
      <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-faint">
        <span>7d ago</span>
        <span>now</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
}) {
  let valueClass = "text-ink";
  if (positive === true) valueClass = "text-signal";
  else if (positive === false) valueClass = "text-[#ff6b6b]";

  return (
    <div className="bg-bg-deep p-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
        {label}
      </div>
      <div className={`mt-2 font-mono text-[18px] font-medium ${valueClass}`}>
        {value}
      </div>
      <div className="mt-1 font-mono text-[10px] text-ink-faint">{sub}</div>
    </div>
  );
}
