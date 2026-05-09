"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExampleRule,
  MarketSnapshot,
  describeCondition,
  evaluateRule,
} from "@/lib/rules/examples";

type ApiMarketsResponse = {
  data: Array<{
    symbol: string;
    markPx: number;
    prevDayPx: number;
    change24hPct: number;
    funding: number;
    fundingApr: number;
    openInterestNotional: number;
  }>;
  meta: { count: number; source: string; fetchedAt: string };
};

type Props = {
  rule: ExampleRule;
};

/**
 * Display a single example rule with its conditions and current evaluation
 * status. Polls /api/v1/markets every 5 seconds to keep evaluation fresh.
 */
export function RuleCard({ rule }: Props) {
  const [markets, setMarkets] = useState<Record<string, MarketSnapshot> | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/v1/markets", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiMarketsResponse = await res.json();

        const map: Record<string, MarketSnapshot> = {};
        for (const m of json.data) {
          map[m.symbol] = {
            symbol: m.symbol,
            markPx: m.markPx,
            prevDayPx: m.prevDayPx,
            change24hPct: m.change24hPct,
            funding: m.funding,
            fundingApr: m.fundingApr,
            openInterestNotional: m.openInterestNotional,
          };
        }

        if (!cancelled) setMarkets(map);
      } catch {
        // Silent — keep previous snapshot
      }
    };

    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const evaluation = useMemo(() => {
    if (!markets) return null;
    return evaluateRule(rule, markets);
  }, [markets, rule]);

  const sideColor = {
    long: "text-signal",
    short: "text-[#ff6b6b]",
    alert: "text-[#FFD66B]",
    close: "text-ink-mute",
  }[rule.action.side];

  const sideLabel = {
    long: "LONG",
    short: "SHORT",
    alert: "ALERT",
    close: "CLOSE",
  }[rule.action.side];

  return (
    <div className="bg-bg p-7">
      {/* Tag + status pill */}
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-signal-dim">
          {rule.category}
        </div>
        {evaluation === null ? (
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            evaluating…
          </div>
        ) : evaluation.satisfied ? (
          <div className="inline-flex items-center gap-2 border border-signal/40 bg-signal/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-signal">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
            </span>
            triggered now
          </div>
        ) : (
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            waiting
          </div>
        )}
      </div>

      {/* Conditions (IF) */}
      <div className="mt-5 font-mono text-[11px] uppercase tracking-widest text-ink-faint">
        IF
      </div>
      <div className="mt-2 space-y-2">
        {rule.conditions.map((cond, idx) => {
          const result = evaluation?.results[idx];
          const satisfied = result?.satisfied;
          return (
            <div
              key={idx}
              className="flex items-baseline justify-between gap-3 border-l-2 border-bg-line pl-3"
              style={
                satisfied === true
                  ? { borderColor: "rgba(124, 255, 107, 0.4)" }
                  : undefined
              }
            >
              <div className="font-sans text-[14px] leading-snug text-ink">
                {describeCondition(cond)}
              </div>
              {result && (
                <div
                  className={`shrink-0 font-mono text-[11px] ${
                    satisfied ? "text-signal" : "text-ink-mute"
                  }`}
                >
                  {result.currentValue}
                </div>
              )}
            </div>
          );
        })}
        {rule.conditions.length > 1 && (
          <div className="pt-1 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            ({rule.combinator} all conditions)
          </div>
        )}
      </div>

      {/* Action (THEN) */}
      <div className="mt-6 font-mono text-[11px] uppercase tracking-widest text-ink-faint">
        THEN
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <span
          className={`shrink-0 font-mono text-[11px] uppercase tracking-widest ${sideColor}`}
        >
          [{sideLabel}]
        </span>
        <span className="font-sans text-[14px] leading-snug text-ink-mute">
          {rule.action.description}
        </span>
      </div>
    </div>
  );
}
