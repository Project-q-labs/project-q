"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { PriceTicker } from "@/components/PriceTicker";
import { CandleChart, generateSyntheticCandles, type CandleData } from "@/components/CandleChart";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Symbol = "BTC" | "ETH" | "SOL" | "HYPE" | "DOGE";

type SignalKind = "funding" | "oi" | "liquidations" | "flow";

type Signal = {
  kind: SignalKind;
  name: string;
  value: number;
  display: string; // formatted value
  trend: "up" | "down" | "flat";
  intensity: number; // 0-1, position on the bar
  label: "low" | "normal" | "high" | "extreme";
  context: string; // e.g. "rising", "+5% 24h"
};

type ConditionKind = "fundingAprAbove" | "oiAbove" | "liquidationsAbove" | "buyFlowAbove";

type TriggerCondition = {
  id: string;
  kind: ConditionKind;
  threshold: number;
};

type OrderType = "market" | "limit" | "trigger";
type Side = "long" | "short";

// ─────────────────────────────────────────────────────────────────────────────
// Mock data per symbol
// ─────────────────────────────────────────────────────────────────────────────
const SYMBOL_DATA: Record<Symbol, { price: number; signals: Signal[] }> = {
  BTC: {
    price: 80883,
    signals: [
      { kind: "funding", name: "Funding APR", value: 11.0, display: "11.0% APR", trend: "up", intensity: 0.55, label: "high", context: "rising" },
      { kind: "oi", name: "Open Interest", value: 3420, display: "$3.42B", trend: "up", intensity: 0.35, label: "normal", context: "+5.2% 24h" },
      { kind: "liquidations", name: "Liq 1h", value: 45, display: "$45M", trend: "down", intensity: 0.20, label: "low", context: "long-heavy" },
      { kind: "flow", name: "Order Flow", value: 56, display: "Buy 56%", trend: "flat", intensity: 0.50, label: "normal", context: "neutral" },
    ],
  },
  ETH: {
    price: 2336,
    signals: [
      { kind: "funding", name: "Funding APR", value: 8.5, display: "8.5% APR", trend: "down", intensity: 0.35, label: "normal", context: "stable" },
      { kind: "oi", name: "Open Interest", value: 1280, display: "$1.28B", trend: "up", intensity: 0.40, label: "normal", context: "+3.1% 24h" },
      { kind: "liquidations", name: "Liq 1h", value: 28, display: "$28M", trend: "flat", intensity: 0.15, label: "low", context: "balanced" },
      { kind: "flow", name: "Order Flow", value: 52, display: "Buy 52%", trend: "flat", intensity: 0.48, label: "normal", context: "neutral" },
    ],
  },
  SOL: {
    price: 95.17,
    signals: [
      { kind: "funding", name: "Funding APR", value: 14.3, display: "14.3% APR", trend: "up", intensity: 0.60, label: "high", context: "spiking" },
      { kind: "oi", name: "Open Interest", value: 540, display: "$540M", trend: "up", intensity: 0.55, label: "high", context: "+12% 24h" },
      { kind: "liquidations", name: "Liq 1h", value: 12, display: "$12M", trend: "up", intensity: 0.30, label: "normal", context: "short-heavy" },
      { kind: "flow", name: "Order Flow", value: 64, display: "Buy 64%", trend: "up", intensity: 0.68, label: "high", context: "buy-pressure" },
    ],
  },
  HYPE: {
    price: 41.88,
    signals: [
      { kind: "funding", name: "Funding APR", value: 22.1, display: "22.1% APR", trend: "up", intensity: 0.78, label: "extreme", context: "very high" },
      { kind: "oi", name: "Open Interest", value: 760, display: "$760M", trend: "up", intensity: 0.62, label: "high", context: "+18% 24h" },
      { kind: "liquidations", name: "Liq 1h", value: 8, display: "$8M", trend: "flat", intensity: 0.10, label: "low", context: "quiet" },
      { kind: "flow", name: "Order Flow", value: 58, display: "Buy 58%", trend: "up", intensity: 0.55, label: "normal", context: "slight buy" },
    ],
  },
  DOGE: {
    price: 0.1098,
    signals: [
      { kind: "funding", name: "Funding APR", value: 38.7, display: "38.7% APR", trend: "up", intensity: 0.92, label: "extreme", context: "fade signal" },
      { kind: "oi", name: "Open Interest", value: 290, display: "$290M", trend: "down", intensity: 0.30, label: "normal", context: "-2% 24h" },
      { kind: "liquidations", name: "Liq 1h", value: 5, display: "$5M", trend: "flat", intensity: 0.08, label: "low", context: "quiet" },
      { kind: "flow", name: "Order Flow", value: 61, display: "Buy 61%", trend: "up", intensity: 0.62, label: "high", context: "crowded long" },
    ],
  },
};

// Signal kind → condition kind mapping (when user clicks a signal row)
const SIGNAL_TO_CONDITION: Record<SignalKind, ConditionKind> = {
  funding: "fundingAprAbove",
  oi: "oiAbove",
  liquidations: "liquidationsAbove",
  flow: "buyFlowAbove",
};

const CONDITION_LABELS: Record<ConditionKind, { label: string; unit: string }> = {
  fundingAprAbove: { label: "Funding APR >", unit: "% APR" },
  oiAbove: { label: "Open Interest >", unit: "M USD" },
  liquidationsAbove: { label: "Liq 1h >", unit: "M USD" },
  buyFlowAbove: { label: "Buy Flow >", unit: "%" },
};

// Get current value of a condition kind for a symbol (for "Currently: X" display)
function currentValue(symbol: Symbol, kind: ConditionKind): number {
  const data = SYMBOL_DATA[symbol];
  switch (kind) {
    case "fundingAprAbove": return data.signals.find(s => s.kind === "funding")!.value;
    case "oiAbove": return data.signals.find(s => s.kind === "oi")!.value;
    case "liquidationsAbove": return data.signals.find(s => s.kind === "liquidations")!.value;
    case "buyFlowAbove": return data.signals.find(s => s.kind === "flow")!.value;
  }
}

function formatValue(kind: ConditionKind, val: number): string {
  const unit = CONDITION_LABELS[kind].unit;
  if (unit === "% APR" || unit === "%") return `${val.toFixed(1)}${unit.startsWith("%") ? "%" : " " + unit}`;
  return `$${val}M`;
}

// Color helper based on label
function labelColor(label: Signal["label"]): { text: string; bar: string; bg: string } {
  switch (label) {
    case "low": return { text: "text-zinc-400", bar: "bg-zinc-500", bg: "bg-zinc-500/10" };
    case "normal": return { text: "text-blue-300", bar: "bg-blue-400", bg: "bg-blue-500/10" };
    case "high": return { text: "text-amber-300", bar: "bg-amber-400", bg: "bg-amber-500/10" };
    case "extreme": return { text: "text-red-300", bar: "bg-red-400", bg: "bg-red-500/10" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function TradePreviewPage() {
  const [symbol, setSymbol] = useState<Symbol>("BTC");
  const [sheetExpanded, setSheetExpanded] = useState(false); // mobile bottom sheet

  // Order state
  const [side, setSide] = useState<Side>("long");
  const [sizePct, setSizePct] = useState(5);
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [triggerConditions, setTriggerConditions] = useState<TriggerCondition[]>([]);
  const [combinator, setCombinator] = useState<"AND" | "OR">("AND");

  // Synthetic candles for the chart
  const [candles, setCandles] = useState<CandleData[]>([]);
  useEffect(() => {
    const basePrice = SYMBOL_DATA[symbol].price;
    setCandles(generateSyntheticCandles(60, basePrice, 3600));
  }, [symbol]);

  const symbolData = SYMBOL_DATA[symbol];

  // Handle signal row click → add condition to trigger
  const handleSignalClick = (signal: Signal) => {
    if (triggerConditions.length >= 3) {
      alert("V1 alpha allows maximum 3 conditions per rule.\nPro tier (V2) will extend this — sign up for updates.");
      return;
    }
    const kind = SIGNAL_TO_CONDITION[signal.kind];
    const newCondition: TriggerCondition = {
      id: `c_${Math.random().toString(36).slice(2, 9)}`,
      kind,
      threshold: Math.ceil(signal.value * 1.3), // suggest 30% higher than current as a "meaningful" threshold
    };
    setTriggerConditions([...triggerConditions, newCondition]);
    setOrderType("trigger");
    // On mobile, open the sheet so user sees the new condition
    setSheetExpanded(true);
  };

  // Evaluate if current state matches all conditions
  const triggerEvaluation = useMemo(() => {
    if (triggerConditions.length === 0) return { matches: false, anyEvaluated: false };
    const results = triggerConditions.map((c) => {
      const current = currentValue(symbol, c.kind);
      return current > c.threshold;
    });
    const matches = combinator === "AND" ? results.every(Boolean) : results.some(Boolean);
    return { matches, anyEvaluated: true };
  }, [triggerConditions, combinator, symbol]);

  const removeCondition = (id: string) => {
    setTriggerConditions(triggerConditions.filter((c) => c.id !== id));
  };

  const updateConditionThreshold = (id: string, threshold: number) => {
    setTriggerConditions(triggerConditions.map((c) => c.id === id ? { ...c, threshold } : c));
  };

  const handleAction = () => {
    if (orderType === "market") {
      alert(`📌 Demo: Market ${side} ${sizePct}% of portfolio\n\nIn M3, this signs with your wallet and submits to Hyperliquid via @nktkas/hyperliquid SDK with our builder code (4 bps fee).`);
    } else if (orderType === "limit") {
      alert(`📌 Demo: Limit ${side} at $${limitPrice}\n\nIn M3, this places a resting limit order on Hyperliquid.`);
    } else if (orderType === "trigger") {
      if (triggerEvaluation.matches) {
        alert(`📌 Demo: Conditions already match — choose action:\n\n• Save as Rule (future triggers)\n• Execute Now (immediate ${side})\n\nIn V1, both options would appear.`);
      } else {
        alert(`📌 Demo: Save as Rule\n\n${triggerConditions.length} condition(s), ${combinator} combinator\nAction: ${side} ${sizePct}% portfolio on trigger\n\nIn M2, this saves to Supabase, our worker watches 24/7, and alerts you when conditions match.`);
      }
    }
  };

  const actionLabel = () => {
    if (orderType === "market") return "Execute Now";
    if (orderType === "limit") return "Place Limit Order";
    if (triggerEvaluation.matches) return "Save as Rule  /  Execute Now";
    return "Save as Rule";
  };

  return (
    <main className="min-h-dvh bg-bg text-ink">
      <PriceTicker />

      {/* Header */}
      <header className="border-b border-bg-line">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-2 font-mono text-sm">
            <span className="text-signal">●</span> PROJECT.Q
          </Link>
          <div className="flex items-center gap-4">
            {/* Pair selector */}
            <select
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value as Symbol);
                setTriggerConditions([]); // reset trigger when changing pair
              }}
              className="border border-bg-line bg-bg-panel px-3 py-1.5 font-mono text-sm outline-none focus:border-signal"
            >
              {(["BTC", "ETH", "SOL", "HYPE", "DOGE"] as Symbol[]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="font-mono text-sm">
              <span className="text-ink-mute">$</span>
              <span className="text-ink">{symbolData.price.toLocaleString()}</span>
              <span className="ml-2 text-signal">↑</span>
            </div>
          </div>
          <Link href="/rules" className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-ink-mute hover:text-ink md:block">
            Rules
          </Link>
        </div>
      </header>

      {/* Preview banner */}
      <section className="border-b border-bg-line bg-bg-panel/40">
        <div className="mx-auto max-w-[1600px] px-4 py-2 md:px-6">
          <div className="flex items-center gap-2 font-mono text-[10px] md:text-[11px]">
            <span className="text-signal">▶ PREVIEW</span>
            <span className="text-ink-faint">·</span>
            <span className="text-ink-mute">Trade page mockup (W2 Day 13 v3) — no save, no execution</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* Mobile-first layout: stacked. Desktop: 3-region grid       */}
      {/* ─────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1600px]">
        {/* Signal Bar (always at top, full width) */}
        <SignalBar
          signals={symbolData.signals}
          onSignalClick={handleSignalClick}
        />

        {/* Main 2-column area on desktop */}
        <div className="grid lg:grid-cols-[1fr_360px]">
          {/* Chart region */}
          <div className="border-b border-bg-line lg:border-b-0 lg:border-r">
            <ChartRegion
              symbol={symbol}
              candles={candles}
            />
          </div>

          {/* Order Panel — desktop only (mobile shows bottom sheet) */}
          <aside className="hidden lg:block">
            <OrderPanel
              symbol={symbol}
              side={side}
              setSide={setSide}
              sizePct={sizePct}
              setSizePct={setSizePct}
              orderType={orderType}
              setOrderType={setOrderType}
              limitPrice={limitPrice}
              setLimitPrice={setLimitPrice}
              slippage={slippage}
              setSlippage={setSlippage}
              triggerConditions={triggerConditions}
              setTriggerConditions={setTriggerConditions}
              combinator={combinator}
              setCombinator={setCombinator}
              triggerEvaluation={triggerEvaluation}
              onRemoveCondition={removeCondition}
              onUpdateThreshold={updateConditionThreshold}
              onAction={handleAction}
              actionLabel={actionLabel()}
            />
          </aside>
        </div>
      </div>

      {/* Mobile Bottom Sheet */}
      <MobileBottomSheet
        expanded={sheetExpanded}
        onToggle={() => setSheetExpanded(!sheetExpanded)}
        side={side}
      >
        <OrderPanel
          symbol={symbol}
          side={side}
          setSide={setSide}
          sizePct={sizePct}
          setSizePct={setSizePct}
          orderType={orderType}
          setOrderType={setOrderType}
          limitPrice={limitPrice}
          setLimitPrice={setLimitPrice}
          slippage={slippage}
          setSlippage={setSlippage}
          triggerConditions={triggerConditions}
          setTriggerConditions={setTriggerConditions}
          combinator={combinator}
          setCombinator={setCombinator}
          triggerEvaluation={triggerEvaluation}
          onRemoveCondition={removeCondition}
          onUpdateThreshold={updateConditionThreshold}
          onAction={handleAction}
          actionLabel={actionLabel()}
        />
      </MobileBottomSheet>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal Bar
// ─────────────────────────────────────────────────────────────────────────────
function SignalBar({
  signals,
  onSignalClick,
}: {
  signals: Signal[];
  onSignalClick: (s: Signal) => void;
}) {
  return (
    <div className="border-b border-bg-line bg-bg-panel/30">
      <div className="px-4 py-3 md:px-6">
        <div className="space-y-1.5">
          {signals.map((signal) => {
            const colors = labelColor(signal.label);
            return (
              <button
                key={signal.kind}
                onClick={() => onSignalClick(signal)}
                className="group flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left transition hover:bg-bg-panel/60"
                title="Click to add as trigger condition"
              >
                {/* Name */}
                <div className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute md:w-32 md:text-xs">
                  {signal.name}
                </div>

                {/* Value */}
                <div className="w-20 shrink-0 font-mono text-xs md:w-28 md:text-sm">
                  {signal.display}
                  {signal.trend === "up" && <span className="ml-1 text-signal">↑</span>}
                  {signal.trend === "down" && <span className="ml-1 text-red-400">↓</span>}
                </div>

                {/* Intensity bar */}
                <div className="relative h-1.5 flex-1 min-w-[60px] max-w-[260px] rounded-full bg-bg-line">
                  <div
                    className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ${colors.bar} shadow-md`}
                    style={{ left: `calc(${signal.intensity * 100}% - 6px)` }}
                  />
                </div>

                {/* Label */}
                <div className={`w-16 shrink-0 text-right font-mono text-[10px] uppercase tracking-[0.1em] md:w-20 md:text-[11px] ${colors.text}`}>
                  {signal.label}
                </div>

                {/* Context */}
                <div className="hidden w-32 shrink-0 text-right font-mono text-[10px] text-ink-faint md:block">
                  {signal.context}
                </div>

                {/* Hover hint */}
                <div className="hidden text-[10px] text-ink-faint group-hover:block lg:block">
                  +trigger
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart Region
// ─────────────────────────────────────────────────────────────────────────────
function ChartRegion({ symbol, candles }: { symbol: Symbol; candles: CandleData[] }) {
  const [timeframe, setTimeframe] = useState("1h");
  const timeframes = ["1m", "5m", "15m", "1h", "4h", "1d"];

  return (
    <div className="p-3 md:p-4">
      {/* Timeframe + controls */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-px border border-bg-line">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 font-mono text-[11px] uppercase ${
                timeframe === tf ? "bg-signal/15 text-signal" : "text-ink-mute hover:text-ink"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="flex gap-px border border-bg-line">
          <button className="px-2.5 py-1 font-mono text-[11px] uppercase text-ink-mute hover:text-ink">
            Vol
          </button>
          <button className="px-2.5 py-1 font-mono text-[11px] uppercase text-ink-mute hover:text-ink">
            Trig
          </button>
        </div>
      </div>

      {/* Chart */}
      <CandleChart candles={candles} height={420} />

      <div className="mt-2 text-center font-mono text-[10px] text-ink-faint">
        Synthetic data ({symbol}) · M1 replaces with real Hyperliquid candles
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Panel (shared between desktop sidebar and mobile bottom sheet)
// ─────────────────────────────────────────────────────────────────────────────
type OrderPanelProps = {
  symbol: Symbol;
  side: Side;
  setSide: (s: Side) => void;
  sizePct: number;
  setSizePct: (n: number) => void;
  orderType: OrderType;
  setOrderType: (t: OrderType) => void;
  limitPrice: string;
  setLimitPrice: (s: string) => void;
  slippage: number;
  setSlippage: (n: number) => void;
  triggerConditions: TriggerCondition[];
  setTriggerConditions: (c: TriggerCondition[]) => void;
  combinator: "AND" | "OR";
  setCombinator: (c: "AND" | "OR") => void;
  triggerEvaluation: { matches: boolean; anyEvaluated: boolean };
  onRemoveCondition: (id: string) => void;
  onUpdateThreshold: (id: string, threshold: number) => void;
  onAction: () => void;
  actionLabel: string;
};

function OrderPanel(props: OrderPanelProps) {
  const {
    symbol, side, setSide, sizePct, setSizePct,
    orderType, setOrderType,
    limitPrice, setLimitPrice, slippage, setSlippage,
    triggerConditions, combinator, setCombinator,
    triggerEvaluation, onRemoveCondition, onUpdateThreshold,
    onAction, actionLabel,
  } = props;

  return (
    <div className="space-y-4 p-4 md:p-5">
      {/* Direction */}
      <div className="flex gap-px border border-bg-line">
        <button
          onClick={() => setSide("long")}
          className={`flex-1 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] transition ${
            side === "long" ? "bg-signal/15 text-signal" : "text-ink-mute"
          }`}
        >
          ↗ Long
        </button>
        <button
          onClick={() => setSide("short")}
          className={`flex-1 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] transition ${
            side === "short" ? "bg-red-500/15 text-red-400" : "text-ink-mute"
          }`}
        >
          ↘ Short
        </button>
      </div>

      {/* Size */}
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          Size (% of portfolio)
        </label>
        <input
          type="number"
          step="0.5"
          value={sizePct}
          onChange={(e) => setSizePct(parseFloat(e.target.value) || 0)}
          className="mt-1.5 w-full border border-bg-line bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-signal"
        />
        <p className="mt-1 text-[10px] text-ink-faint">
          ~${((sizePct / 100) * 10000).toFixed(0)} at $10k equity
        </p>
      </div>

      {/* Order type */}
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          Type
        </label>
        <div className="mt-1.5 space-y-1.5">
          {(
            [
              { kind: "market", label: "Market (now)" },
              { kind: "limit", label: "Limit at price" },
              { kind: "trigger", label: "Trigger when..." },
            ] as const
          ).map((t) => (
            <button
              key={t.kind}
              onClick={() => setOrderType(t.kind)}
              className={`flex w-full items-center gap-2 border px-3 py-2 text-left transition ${
                orderType === t.kind
                  ? t.kind === "trigger"
                    ? "border-amber-500/50 bg-amber-500/5"
                    : "border-signal bg-signal/5"
                  : "border-bg-line hover:border-ink-faint"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 rounded-full border ${
                  orderType === t.kind
                    ? t.kind === "trigger"
                      ? "border-amber-500 bg-amber-500"
                      : "border-signal bg-signal"
                    : "border-ink-faint"
                }`}
              />
              <span className="font-mono text-xs">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Order-type specific fields */}
      {orderType === "market" && (
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            Max slippage (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={slippage}
            onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
            className="mt-1.5 w-full border border-bg-line bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-signal"
          />
        </div>
      )}

      {orderType === "limit" && (
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            Limit price (USD)
          </label>
          <input
            type="text"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            placeholder="100000"
            className="mt-1.5 w-full border border-bg-line bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-signal"
          />
        </div>
      )}

      {orderType === "trigger" && (
        <div className="space-y-2 border-l-2 border-amber-500/40 pl-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              When (max 3 conditions)
            </span>
            {triggerConditions.length > 1 && (
              <div className="flex gap-px border border-bg-line">
                {(["AND", "OR"] as const).map((op) => (
                  <button
                    key={op}
                    onClick={() => setCombinator(op)}
                    className={`px-2 py-0.5 font-mono text-[10px] ${
                      combinator === op ? "bg-signal/15 text-signal" : "text-ink-mute"
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            )}
          </div>

          {triggerConditions.length === 0 ? (
            <p className="text-[11px] text-ink-faint">
              Click any signal row above to add a condition
            </p>
          ) : (
            <div className="space-y-1.5">
              {triggerConditions.map((c, idx) => (
                <div key={c.id} className="space-y-0.5">
                  {idx > 0 && (
                    <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">
                      {combinator}
                    </div>
                  )}
                  <div className="flex items-center gap-2 border border-bg-line bg-bg px-2 py-1.5">
                    <span className="flex-1 truncate font-mono text-[11px] text-ink-mute">
                      {symbol} {CONDITION_LABELS[c.kind].label}
                    </span>
                    <input
                      type="number"
                      step="0.5"
                      value={c.threshold}
                      onChange={(e) => onUpdateThreshold(c.id, parseFloat(e.target.value) || 0)}
                      className="w-16 border border-bg-line bg-bg px-1.5 py-0.5 text-right font-mono text-[11px] outline-none focus:border-signal"
                    />
                    <button
                      onClick={() => onRemoveCondition(c.id)}
                      className="text-ink-faint hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Live current state */}
          {triggerConditions.length > 0 && (
            <div className={`border px-2 py-1.5 font-mono text-[11px] ${
              triggerEvaluation.matches
                ? "border-signal/40 bg-signal/5 text-signal"
                : "border-bg-line text-ink-mute"
            }`}>
              {triggerEvaluation.matches ? (
                <>● WOULD FIRE NOW — conditions match</>
              ) : (
                <>○ Currently: conditions not met</>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fee preview */}
      {orderType !== "limit" && (
        <div className="border-t border-bg-line pt-3">
          <div className="flex items-center justify-between font-mono text-[10px] text-ink-mute">
            <span>Estimated fees</span>
            <span>0.085% (~${(((sizePct / 100) * 10000 * 0.00085)).toFixed(2)})</span>
          </div>
          <div className="mt-0.5 text-[9px] text-ink-faint">
            Hyperliquid 0.045% + Project Q 0.040% builder fee
          </div>
        </div>
      )}

      {/* Action button */}
      <button
        onClick={onAction}
        disabled={orderType === "trigger" && triggerConditions.length === 0}
        className={`w-full px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] transition ${
          orderType === "trigger" && triggerEvaluation.matches
            ? "border border-signal bg-signal/15 text-signal hover:bg-signal/25"
            : orderType === "trigger"
              ? "border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              : "border border-signal bg-signal/15 text-signal hover:bg-signal/25"
        } disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        {actionLabel}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Bottom Sheet
// ─────────────────────────────────────────────────────────────────────────────
function MobileBottomSheet({
  expanded,
  onToggle,
  side,
  children,
}: {
  expanded: boolean;
  onToggle: () => void;
  side: Side;
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Backdrop when expanded */}
      {expanded && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onToggle}
        />
      )}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-bg-line bg-bg shadow-2xl transition-transform duration-300 lg:hidden ${
          expanded ? "translate-y-0" : "translate-y-[calc(100%-60px)]"
        }`}
        style={{ maxHeight: "85dvh" }}
      >
        {/* Drag handle / collapsed view */}
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-between border-b border-bg-line px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <div className="h-1 w-10 rounded-full bg-ink-faint" />
            <span className="font-mono text-xs uppercase tracking-[0.15em]">
              Trade {side === "long" ? "(Long)" : "(Short)"}
            </span>
          </div>
          <span className={`text-ink-mute transition-transform ${expanded ? "rotate-180" : ""}`}>
            ▲
          </span>
        </button>
        {/* Content */}
        <div className="max-h-[calc(85dvh-60px)] overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}
