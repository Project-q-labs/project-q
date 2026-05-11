"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { CandleChart, generateSyntheticCandles, type CandleData } from "@/components/CandleChart";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Symbol = "BTC" | "ETH" | "SOL" | "HYPE" | "DOGE";
type SignalKind = "funding" | "oi" | "liquidations" | "flow";
type ConditionKind = "fundingAprAbove" | "oiAbove" | "liquidationsAbove" | "buyFlowAbove";
type OrderType = "market" | "limit" | "trigger";
type Side = "long" | "short";
type BottomTab = "balances" | "positions" | "outcomes" | "openOrders" | "twap" | "tradeHistory" | "fundingHistory" | "orderHistory" | "triggerHistory";
type MobileTab = "markets" | "trade" | "account";
type MarketsSubTab = "chart" | "signal" | "trigger";

type Signal = {
  kind: SignalKind;
  name: string;
  display: string;
  value: number;
  trend: "up" | "down" | "flat";
  intensity: number;
  label: "low" | "normal" | "high" | "extreme";
  context: string;
};

type TriggerCondition = {
  id: string;
  kind: ConditionKind;
  threshold: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────
const SYMBOL_DATA: Record<Symbol, {
  mark: number; oracle: number; change24h: number; volume24h: number;
  oi: number; fundingPct: number; countdown: string; signals: Signal[];
}> = {
  BTC: {
    mark: 80883, oracle: 80877, change24h: -3.31, volume24h: 260622586, oi: 841009402, fundingPct: 0.0013, countdown: "00:32:36",
    signals: [
      { kind: "funding", name: "Funding APR", display: "11.0% APR", value: 11.0, trend: "up", intensity: 0.55, label: "high", context: "rising" },
      { kind: "oi", name: "Open Interest", display: "$3.42B", value: 3420, trend: "up", intensity: 0.35, label: "normal", context: "+5.2% 24h" },
      { kind: "liquidations", name: "Liq 1h", display: "$45M", value: 45, trend: "down", intensity: 0.20, label: "low", context: "long-heavy" },
      { kind: "flow", name: "Order Flow", display: "Buy 56%", value: 56, trend: "flat", intensity: 0.50, label: "normal", context: "neutral" },
    ],
  },
  ETH: {
    mark: 2336, oracle: 2335, change24h: 0.72, volume24h: 142000000, oi: 280000000, fundingPct: -0.0024, countdown: "00:32:36",
    signals: [
      { kind: "funding", name: "Funding APR", display: "8.5% APR", value: 8.5, trend: "down", intensity: 0.35, label: "normal", context: "stable" },
      { kind: "oi", name: "Open Interest", display: "$1.28B", value: 1280, trend: "up", intensity: 0.40, label: "normal", context: "+3.1% 24h" },
      { kind: "liquidations", name: "Liq 1h", display: "$28M", value: 28, trend: "flat", intensity: 0.15, label: "low", context: "balanced" },
      { kind: "flow", name: "Order Flow", display: "Buy 52%", value: 52, trend: "flat", intensity: 0.48, label: "normal", context: "neutral" },
    ],
  },
  SOL: {
    mark: 95.17, oracle: 95.15, change24h: 3.4, volume24h: 89000000, oi: 156000000, fundingPct: 0.0042, countdown: "00:32:36",
    signals: [
      { kind: "funding", name: "Funding APR", display: "14.3% APR", value: 14.3, trend: "up", intensity: 0.60, label: "high", context: "spiking" },
      { kind: "oi", name: "Open Interest", display: "$540M", value: 540, trend: "up", intensity: 0.55, label: "high", context: "+12% 24h" },
      { kind: "liquidations", name: "Liq 1h", display: "$12M", value: 12, trend: "up", intensity: 0.30, label: "normal", context: "short-heavy" },
      { kind: "flow", name: "Order Flow", display: "Buy 64%", value: 64, trend: "up", intensity: 0.68, label: "high", context: "buy-pressure" },
    ],
  },
  HYPE: {
    mark: 41.483, oracle: 41.477, change24h: -3.31, volume24h: 260622586, oi: 841009402, fundingPct: 0.0013, countdown: "00:32:36",
    signals: [
      { kind: "funding", name: "Funding APR", display: "22.1% APR", value: 22.1, trend: "up", intensity: 0.78, label: "extreme", context: "very high" },
      { kind: "oi", name: "Open Interest", display: "$760M", value: 760, trend: "up", intensity: 0.62, label: "high", context: "+18% 24h" },
      { kind: "liquidations", name: "Liq 1h", display: "$8M", value: 8, trend: "flat", intensity: 0.10, label: "low", context: "quiet" },
      { kind: "flow", name: "Order Flow", display: "Buy 58%", value: 58, trend: "up", intensity: 0.55, label: "normal", context: "slight buy" },
    ],
  },
  DOGE: {
    mark: 0.1098, oracle: 0.1097, change24h: 5.2, volume24h: 67000000, oi: 89000000, fundingPct: 0.0118, countdown: "00:32:36",
    signals: [
      { kind: "funding", name: "Funding APR", display: "38.7% APR", value: 38.7, trend: "up", intensity: 0.92, label: "extreme", context: "fade signal" },
      { kind: "oi", name: "Open Interest", display: "$290M", value: 290, trend: "down", intensity: 0.30, label: "normal", context: "-2% 24h" },
      { kind: "liquidations", name: "Liq 1h", display: "$5M", value: 5, trend: "flat", intensity: 0.08, label: "low", context: "quiet" },
      { kind: "flow", name: "Order Flow", display: "Buy 61%", value: 61, trend: "up", intensity: 0.62, label: "high", context: "crowded long" },
    ],
  },
};

const SIGNAL_TO_CONDITION: Record<SignalKind, ConditionKind> = {
  funding: "fundingAprAbove",
  oi: "oiAbove",
  liquidations: "liquidationsAbove",
  flow: "buyFlowAbove",
};

const CONDITION_LABELS: Record<ConditionKind, { label: string; unit: string }> = {
  fundingAprAbove: { label: "Funding APR >", unit: "%" },
  oiAbove: { label: "OI >", unit: "M USD" },
  liquidationsAbove: { label: "Liq 1h >", unit: "M USD" },
  buyFlowAbove: { label: "Buy Flow >", unit: "%" },
};

function currentValue(symbol: Symbol, kind: ConditionKind): number {
  const signals = SYMBOL_DATA[symbol].signals;
  switch (kind) {
    case "fundingAprAbove": return signals.find(s => s.kind === "funding")!.value;
    case "oiAbove": return signals.find(s => s.kind === "oi")!.value;
    case "liquidationsAbove": return signals.find(s => s.kind === "liquidations")!.value;
    case "buyFlowAbove": return signals.find(s => s.kind === "flow")!.value;
  }
}

function labelColor(label: Signal["label"]) {
  switch (label) {
    case "low": return { text: "text-zinc-400", bar: "bg-zinc-500" };
    case "normal": return { text: "text-blue-300", bar: "bg-blue-400" };
    case "high": return { text: "text-amber-300", bar: "bg-amber-400" };
    case "extreme": return { text: "text-red-300", bar: "bg-red-400" };
  }
}

function formatBig(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

const MOCK_TRIGGER_HISTORY = [
  { time: "2026-05-11 14:23", rule: "BTC funding extreme — short", trigger: "Funding APR > 25%", fired: "11.2% (watching)", status: "watching" as const, action: undefined as string | undefined },
  { time: "2026-05-10 09:15", rule: "DOGE crowded long fade", trigger: "Funding APR > 30%", fired: "38.7% ✓ fired", status: "executed" as const, action: "Short DOGE 3% @ $0.1102" },
  { time: "2026-05-09 18:42", rule: "SOL momentum entry", trigger: "OI 24h > 10%", fired: "12% ✓ fired", status: "executed" as const, action: "Long SOL 5% @ $94.20" },
];

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function TradePreviewPage() {
  const [symbol, setSymbol] = useState<Symbol>("BTC");
  const [side, setSide] = useState<Side>("long");
  const [sizePct, setSizePct] = useState(5);
  const [sizeRaw, setSizeRaw] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [triggerConditions, setTriggerConditions] = useState<TriggerCondition[]>([]);
  const [combinator, setCombinator] = useState<"AND" | "OR">("AND");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpsl, setTpsl] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTab>("positions");

  // Mobile-specific state
  const [mobileTab, setMobileTab] = useState<MobileTab>("markets");
  const [marketsSubTab, setMarketsSubTab] = useState<MarketsSubTab>("chart");

  const [candles, setCandles] = useState<CandleData[]>([]);
  useEffect(() => {
    setCandles(generateSyntheticCandles(80, SYMBOL_DATA[symbol].mark, 3600));
  }, [symbol]);

  const data = SYMBOL_DATA[symbol];

  const handleSignalClick = (signal: Signal) => {
    if (triggerConditions.length >= 3) {
      alert("V1 alpha allows maximum 3 trigger conditions per rule.\nPro tier (V2) will extend this.");
      return;
    }
    const newCondition: TriggerCondition = {
      id: `c_${Math.random().toString(36).slice(2, 9)}`,
      kind: SIGNAL_TO_CONDITION[signal.kind],
      threshold: Math.ceil(signal.value * 1.3),
    };
    setTriggerConditions([...triggerConditions, newCondition]);
    setOrderType("trigger");
    // On mobile, switch to Trigger sub-tab to show the result
    setMarketsSubTab("trigger");
  };

  const triggerEvaluation = useMemo(() => {
    if (triggerConditions.length === 0) return { matches: false };
    const results = triggerConditions.map((c) => currentValue(symbol, c.kind) > c.threshold);
    const matches = combinator === "AND" ? results.every(Boolean) : results.some(Boolean);
    return { matches };
  }, [triggerConditions, combinator, symbol]);

  const removeCondition = (id: string) => setTriggerConditions(triggerConditions.filter(c => c.id !== id));
  const updateConditionThreshold = (id: string, threshold: number) =>
    setTriggerConditions(triggerConditions.map(c => c.id === id ? { ...c, threshold } : c));

  const handleAction = () => {
    if (orderType === "market") {
      alert(`Demo: Market ${side} ${sizePct}% portfolio\n\nIn M3, signs with wallet → submits to Hyperliquid via @nktkas/hyperliquid SDK with 4 bps builder code.`);
    } else if (orderType === "limit") {
      alert(`Demo: Limit ${side} at $${limitPrice}\n\nIn M3, places a resting limit order.`);
    } else if (orderType === "trigger") {
      if (triggerEvaluation.matches) {
        alert(`Demo: Conditions match.\n\nV1 shows two buttons:\n• Save as Rule\n• Execute Now`);
      } else {
        alert(`Demo: Save as Rule\n\n${triggerConditions.length} condition(s), ${combinator}\nAction on trigger: ${side} ${sizePct}%\n\nIn M2, saves to Supabase. Worker watches 24/7. Telegram + in-app alerts.`);
      }
    }
  };

  return (
    <main className="min-h-dvh bg-bg text-ink">
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* DESKTOP — full 3-column layout (hidden below lg)           */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block">
        {/* Top nav */}
        <header className="border-b border-bg-line">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2 font-mono text-sm">
                <span className="text-signal">●</span>
                <span className="font-medium tracking-tight">PROJECT.Q</span>
              </Link>
              <nav className="flex gap-6">
                {["Trade", "Portfolio", "Referrals", "Leaderboard"].map((item) => (
                  <a key={item} href="#" onClick={(e) => e.preventDefault()}
                    className={`text-sm tracking-tight ${item === "Trade" ? "text-signal" : "text-ink-mute hover:text-ink"}`}>
                    {item}
                  </a>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <button className="border border-signal/60 bg-signal/10 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em] text-signal hover:bg-signal/20">
                Connect
              </button>
              <IconButton title="Language"><GlobeIcon /></IconButton>
              <IconButton title="Settings"><GearIcon /></IconButton>
            </div>
          </div>

          {/* Pair header */}
          <div className="flex items-center gap-4 overflow-x-auto border-t border-bg-line px-4 py-2.5">
            <div className="flex items-center gap-2 shrink-0">
              <select value={symbol} onChange={(e) => { setSymbol(e.target.value as Symbol); setTriggerConditions([]); }}
                className="border border-bg-line bg-bg-panel px-2.5 py-1.5 font-mono text-sm outline-none focus:border-signal">
                {(["BTC", "ETH", "SOL", "HYPE", "DOGE"] as Symbol[]).map(s => (
                  <option key={s} value={s}>{s}-USDC</option>
                ))}
              </select>
              <span className="border border-bg-line bg-bg-panel px-2 py-1.5 font-mono text-xs text-ink-mute">10x</span>
            </div>
            <div className="flex items-center gap-5 text-xs">
              <Stat label="Mark" value={data.mark.toLocaleString()} />
              <Stat label="Oracle" value={data.oracle.toLocaleString()} />
              <Stat label="24h Change" value={`${data.change24h > 0 ? "+" : ""}${data.change24h.toFixed(2)}%`} color={data.change24h > 0 ? "text-signal" : "text-red-400"} />
              <Stat label="24h Volume" value={formatBig(data.volume24h)} />
              <Stat label="Open Interest" value={formatBig(data.oi)} />
              <Stat label="Funding / Countdown" value={`${data.fundingPct.toFixed(4)}%`} sub={data.countdown} />
            </div>
            <div className="ml-auto flex items-center gap-px border border-bg-line shrink-0">
              {["Cross", "10x", "Classic"].map((m, i) => (
                <button key={m} className={`px-3 py-1 font-mono text-[11px] ${i === 0 ? "bg-bg-panel text-ink" : "text-ink-mute hover:text-ink"}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="border-b border-bg-line bg-bg-panel/40 px-4 py-1.5">
          <span className="font-mono text-[11px] text-signal">▶ PREVIEW</span>
          <span className="font-mono text-[11px] text-ink-faint"> · </span>
          <span className="font-mono text-[11px] text-ink-mute">Trade page mockup (W2 Day 13 v5) — Hyperliquid layout</span>
        </div>

        {/* 3-column main */}
        <div className="grid grid-cols-[1fr_220px_280px]">
          <div className="border-r border-bg-line">
            <ChartColumn candles={candles} symbol={symbol} />
          </div>
          <div className="border-r border-bg-line">
            <SignalsColumn signals={data.signals} onSignalClick={handleSignalClick} />
          </div>
          <aside>
            <OrderColumn
              data={data} symbol={symbol}
              side={side} setSide={setSide}
              sizePct={sizePct} setSizePct={setSizePct}
              sizeRaw={sizeRaw} setSizeRaw={setSizeRaw}
              orderType={orderType} setOrderType={setOrderType}
              limitPrice={limitPrice} setLimitPrice={setLimitPrice}
              slippage={slippage} setSlippage={setSlippage}
              triggerConditions={triggerConditions}
              combinator={combinator} setCombinator={setCombinator}
              triggerEvaluation={triggerEvaluation}
              onRemoveCondition={removeCondition}
              onUpdateThreshold={updateConditionThreshold}
              reduceOnly={reduceOnly} setReduceOnly={setReduceOnly}
              tpsl={tpsl} setTpsl={setTpsl}
              onAction={handleAction}
            />
          </aside>
        </div>

        <BottomTabsArea activeTab={bottomTab} onTabChange={setBottomTab} />
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MOBILE — Hyperliquid-style Bottom Tab Bar pattern          */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="lg:hidden">
        {/* Top header — simplified for mobile */}
        <header className="border-b border-bg-line">
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-3">
              <button className="text-ink-mute"><HamburgerIcon /></button>
              <Link href="/" className="flex items-center gap-1.5 font-mono text-sm">
                <span className="text-signal">●</span>
                <span className="font-medium">PROJECT.Q</span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {mobileTab !== "trade" && (
                <button
                  onClick={() => setMobileTab("trade")}
                  className="border border-signal/60 bg-signal/10 px-3 py-1.5 font-mono text-xs uppercase text-signal"
                >
                  Connect
                </button>
              )}
              <IconButton title="Language"><GlobeIcon /></IconButton>
              <IconButton title="Settings"><GearIcon /></IconButton>
            </div>
          </div>
        </header>

        <div className="border-b border-bg-line bg-bg-panel/40 px-3 py-1.5">
          <span className="font-mono text-[10px] text-signal">▶ PREVIEW</span>
          <span className="font-mono text-[10px] text-ink-faint"> · </span>
          <span className="font-mono text-[10px] text-ink-mute">Mobile mockup (W2 Day 13 v5)</span>
        </div>

        {/* Content area — depends on mobileTab */}
        <div className="pb-[68px]"> {/* padding for bottom tab bar */}
          {mobileTab === "markets" && (
            <MobileMarkets
              symbol={symbol} setSymbol={(s) => { setSymbol(s); setTriggerConditions([]); }}
              data={data} candles={candles}
              subTab={marketsSubTab} setSubTab={setMarketsSubTab}
              onSignalClick={handleSignalClick}
              side={side} setSide={setSide}
              sizePct={sizePct} setSizePct={setSizePct}
              sizeRaw={sizeRaw} setSizeRaw={setSizeRaw}
              orderType={orderType} setOrderType={setOrderType}
              limitPrice={limitPrice} setLimitPrice={setLimitPrice}
              slippage={slippage} setSlippage={setSlippage}
              triggerConditions={triggerConditions}
              combinator={combinator} setCombinator={setCombinator}
              triggerEvaluation={triggerEvaluation}
              onRemoveCondition={removeCondition}
              onUpdateThreshold={updateConditionThreshold}
              reduceOnly={reduceOnly} setReduceOnly={setReduceOnly}
              tpsl={tpsl} setTpsl={setTpsl}
              onAction={handleAction}
            />
          )}
          {mobileTab === "trade" && <MobileTradeConnect />}
          {mobileTab === "account" && <MobileAccount />}
        </div>

        {/* Bottom Tab Bar — fixed at bottom */}
        <BottomTabBar activeTab={mobileTab} onTabChange={setMobileTab} />
      </div>
    </main>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SHARED PIECES
// ═════════════════════════════════════════════════════════════════════════════
function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col leading-tight shrink-0">
      <span className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-mono text-sm ${color ?? "text-ink"}`}>{value}</span>
        {sub && <span className="font-mono text-[10px] text-ink-mute">{sub}</span>}
      </div>
    </div>
  );
}

function IconButton({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <button className="border border-bg-line p-1.5 text-ink-mute hover:text-ink" title={title}>
      {children}
    </button>
  );
}

function GlobeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth="1.5"/>
      <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" strokeWidth="1.5"/>
    </svg>
  );
}
function GearIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" strokeWidth="1.5"/>
      <path d="M19 12a7 7 0 01-.1 1.2l2.1 1.7-2 3.5-2.5-1a7 7 0 01-2.1 1.2l-.4 2.6h-4l-.4-2.6a7 7 0 01-2.1-1.2l-2.5 1-2-3.5 2.1-1.7A7 7 0 015 12c0-.4 0-.8.1-1.2L3 9.1l2-3.5 2.5 1a7 7 0 012.1-1.2L10 2.8h4l.4 2.6a7 7 0 012.1 1.2l2.5-1 2 3.5-2.1 1.7c.1.4.1.8.1 1.2z" strokeWidth="1.5"/>
    </svg>
  );
}
function HamburgerIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M4 6h16M4 12h16M4 18h16" strokeWidth="1.5"/>
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// DESKTOP COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════
function ChartColumn({ candles, symbol }: { candles: CandleData[]; symbol: Symbol }) {
  const [tf, setTf] = useState("1h");
  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          {["5m", "1h", "D"].map(t => (
            <button key={t} onClick={() => setTf(t)} className={`font-mono ${tf === t ? "text-ink" : "text-ink-mute hover:text-ink"}`}>{t}</button>
          ))}
          <span className="text-ink-faint">|</span>
          <button className="font-mono text-ink-mute hover:text-ink">ƒ Indicators</button>
        </div>
        <button className="text-ink-mute hover:text-ink">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4h6M4 4v6M20 4h-6M20 4v6M4 20h6M4 20v-6M20 20h-6M20 20v-6" strokeWidth="1.5"/></svg>
        </button>
      </div>
      <CandleChart candles={candles} height={420} />
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-mute">
        <div className="flex gap-2 font-mono">
          {["5y", "1y", "6m", "3m", "1m", "5d", "1d"].map(r => (
            <button key={r} className="hover:text-ink">{r}</button>
          ))}
        </div>
        <span className="font-mono">{symbol}-USD · Synthetic</span>
      </div>
    </div>
  );
}

function SignalsColumn({ signals, onSignalClick }: { signals: Signal[]; onSignalClick: (s: Signal) => void }) {
  return (
    <div className="p-3">
      <div className="mb-3 flex items-center gap-3 border-b border-bg-line pb-2">
        <button className="font-mono text-xs text-signal">Signals</button>
        <button className="font-mono text-xs text-ink-faint">Trades</button>
        <button className="ml-auto text-ink-mute hover:text-ink"><span className="font-mono text-xs">⋮</span></button>
      </div>
      <div className="space-y-3">
        {signals.map((signal) => {
          const colors = labelColor(signal.label);
          return (
            <button key={signal.kind} onClick={() => onSignalClick(signal)} className="group block w-full text-left transition hover:bg-bg-panel/50">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">{signal.name}</span>
                <span className={`font-mono text-[9px] uppercase ${colors.text}`}>{signal.label}</span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-sm">{signal.display}</span>
                {signal.trend === "up" && <span className="text-signal text-[10px]">↑</span>}
                {signal.trend === "down" && <span className="text-red-400 text-[10px]">↓</span>}
              </div>
              <div className="mt-1.5 relative h-1 rounded-full bg-bg-line">
                <div className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${colors.bar}`}
                  style={{ left: `calc(${signal.intensity * 100}% - 5px)` }} />
              </div>
              <div className="mt-1 text-[10px] text-ink-faint">
                {signal.context}
                <span className="ml-2 opacity-0 group-hover:opacity-100 text-amber-300">+ trigger</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-4 border-t border-bg-line pt-3 font-mono text-[10px] text-ink-faint">
        Click any signal to add as trigger →
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Order column — shared between desktop and mobile Trigger sub-tab
// ─────────────────────────────────────────────────────────────────────────────
type OrderColumnProps = {
  data: typeof SYMBOL_DATA[Symbol];
  symbol: Symbol;
  side: Side; setSide: (s: Side) => void;
  sizePct: number; setSizePct: (n: number) => void;
  sizeRaw: string; setSizeRaw: (s: string) => void;
  orderType: OrderType; setOrderType: (t: OrderType) => void;
  limitPrice: string; setLimitPrice: (s: string) => void;
  slippage: number; setSlippage: (n: number) => void;
  triggerConditions: TriggerCondition[];
  combinator: "AND" | "OR"; setCombinator: (c: "AND" | "OR") => void;
  triggerEvaluation: { matches: boolean };
  onRemoveCondition: (id: string) => void;
  onUpdateThreshold: (id: string, threshold: number) => void;
  reduceOnly: boolean; setReduceOnly: (b: boolean) => void;
  tpsl: boolean; setTpsl: (b: boolean) => void;
  onAction: () => void;
};

function OrderColumn(props: OrderColumnProps) {
  const {
    data, symbol, side, setSide, sizePct, setSizePct, sizeRaw, setSizeRaw,
    orderType, setOrderType, limitPrice, setLimitPrice, slippage, setSlippage,
    triggerConditions, combinator, setCombinator, triggerEvaluation,
    onRemoveCondition, onUpdateThreshold, reduceOnly, setReduceOnly, tpsl, setTpsl, onAction
  } = props;

  const actionLabel = () => {
    if (orderType === "market" || orderType === "limit") return "Connect";
    if (triggerConditions.length === 0) return "Add condition first";
    if (triggerEvaluation.matches) return "Save as Rule  /  Execute";
    return "Save as Rule";
  };

  return (
    <div className="p-3">
      <div className="mb-3 flex gap-px border-b border-bg-line">
        {(["market", "limit", "trigger"] as OrderType[]).map(t => (
          <button key={t} onClick={() => setOrderType(t)}
            className={`px-3 py-2 font-mono text-xs uppercase tracking-[0.1em] ${
              orderType === t
                ? t === "trigger" ? "border-b-2 border-amber-400 text-amber-300" : "border-b-2 border-signal text-signal"
                : "text-ink-mute hover:text-ink"
            }`}>
            {t === "trigger" ? "Trigger" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex gap-px border border-bg-line">
        <button onClick={() => setSide("long")} className={`flex-1 px-2 py-2 font-mono text-xs ${side === "long" ? "bg-signal/15 text-signal" : "text-ink-mute"}`}>Buy / Long</button>
        <button onClick={() => setSide("short")} className={`flex-1 px-2 py-2 font-mono text-xs ${side === "short" ? "bg-red-500/15 text-red-400" : "text-ink-mute"}`}>Sell / Short</button>
      </div>

      <div className="mt-3 space-y-1 text-[11px]">
        <div className="flex justify-between"><span className="text-ink-faint">Available to Trade</span><span className="font-mono text-ink-mute">0.00 USDC</span></div>
        <div className="flex justify-between"><span className="text-ink-faint">Current Position</span><span className="font-mono text-ink-mute">0.00 {symbol}</span></div>
      </div>

      {orderType === "limit" && (
        <div className="mt-3">
          <label className="block text-[10px] uppercase tracking-[0.1em] text-ink-faint">Price (USDC)</label>
          <input type="text" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder={data.mark.toLocaleString()}
            className="mt-1 w-full border border-bg-line bg-bg px-2 py-1.5 font-mono text-sm outline-none focus:border-signal" />
        </div>
      )}

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">Size</label>
          <span className="font-mono text-[10px] text-ink-faint">{symbol}</span>
        </div>
        <input type="text" value={sizeRaw} onChange={(e) => setSizeRaw(e.target.value)} placeholder="0.00"
          className="w-full border border-bg-line bg-bg px-2 py-1.5 font-mono text-sm outline-none focus:border-signal" />
        <div className="mt-2 flex items-center gap-2">
          <input type="range" min="0" max="100" value={sizePct} onChange={(e) => setSizePct(parseInt(e.target.value))} className="flex-1 accent-signal" />
          <div className="flex items-center border border-bg-line bg-bg">
            <input type="number" value={sizePct} onChange={(e) => setSizePct(parseFloat(e.target.value) || 0)}
              className="w-12 bg-transparent px-1 py-1 text-right font-mono text-xs outline-none" />
            <span className="px-1 font-mono text-xs text-ink-faint">%</span>
          </div>
        </div>
      </div>

      {orderType === "market" && (
        <div className="mt-3">
          <label className="block text-[10px] uppercase tracking-[0.1em] text-ink-faint">Max slippage</label>
          <div className="mt-1 flex items-center border border-bg-line bg-bg">
            <input type="number" step="0.1" value={slippage} onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
              className="flex-1 bg-transparent px-2 py-1.5 font-mono text-sm outline-none" />
            <span className="pr-2 font-mono text-xs text-ink-faint">%</span>
          </div>
        </div>
      )}

      {orderType === "trigger" && (
        <div className="mt-3 space-y-2 border-l-2 border-amber-500/40 pl-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">When ({triggerConditions.length}/3)</span>
            {triggerConditions.length > 1 && (
              <div className="flex gap-px border border-bg-line">
                {(["AND", "OR"] as const).map(op => (
                  <button key={op} onClick={() => setCombinator(op)} className={`px-2 py-0.5 font-mono text-[10px] ${combinator === op ? "bg-signal/15 text-signal" : "text-ink-mute"}`}>{op}</button>
                ))}
              </div>
            )}
          </div>
          {triggerConditions.length === 0 ? (
            <p className="text-[10px] text-ink-faint">Go to Signals tab and click a signal to add a condition →</p>
          ) : (
            <div className="space-y-1.5">
              {triggerConditions.map((c, idx) => (
                <div key={c.id}>
                  {idx > 0 && <div className="my-1 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">{combinator}</div>}
                  <div className="flex items-center gap-1.5 border border-bg-line bg-bg px-1.5 py-1.5">
                    <span className="flex-1 truncate font-mono text-[10px] text-ink-mute">{symbol} {CONDITION_LABELS[c.kind].label}</span>
                    <input type="number" step="0.5" value={c.threshold} onChange={(e) => onUpdateThreshold(c.id, parseFloat(e.target.value) || 0)}
                      className="w-14 border border-bg-line bg-bg px-1 py-0.5 text-right font-mono text-[10px] outline-none focus:border-signal" />
                    <button onClick={() => onRemoveCondition(c.id)} className="text-ink-faint hover:text-red-400">×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {triggerConditions.length > 0 && (
            <div className={`border px-2 py-1 font-mono text-[10px] ${triggerEvaluation.matches ? "border-signal/40 bg-signal/5 text-signal" : "border-bg-line text-ink-mute"}`}>
              {triggerEvaluation.matches ? "● WOULD FIRE NOW" : "○ waiting…"}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" checked={reduceOnly} onChange={(e) => setReduceOnly(e.target.checked)} className="accent-signal" />
          <span className="text-ink-mute">Reduce Only</span>
        </label>
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" checked={tpsl} onChange={(e) => setTpsl(e.target.checked)} className="accent-signal" />
          <span className="text-ink-mute">Take Profit / Stop Loss</span>
        </label>
      </div>

      <div className="mt-3 space-y-0.5 text-[10px]">
        <div className="flex justify-between"><span className="text-ink-faint">Liquidation Price</span><span className="font-mono text-ink-mute">N/A</span></div>
        <div className="flex justify-between"><span className="text-ink-faint">Order Value</span><span className="font-mono text-ink-mute">N/A</span></div>
        <div className="flex justify-between"><span className="text-ink-faint">Slippage</span><span className="font-mono text-ink-mute">Est: 0% / Max: 8%</span></div>
        <div className="flex justify-between"><span className="text-ink-faint">Fees</span><span className="font-mono text-ink-mute">0.045% + 0.040%</span></div>
      </div>

      <button onClick={onAction}
        className={`mt-3 w-full px-4 py-2.5 font-mono text-xs uppercase tracking-[0.1em] ${
          orderType === "trigger" && triggerEvaluation.matches
            ? "border border-signal bg-signal/15 text-signal hover:bg-signal/25"
            : orderType === "trigger"
              ? triggerConditions.length === 0
                ? "border border-bg-line bg-bg-panel text-ink-faint cursor-not-allowed"
                : "border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              : "border border-signal bg-signal/15 text-signal hover:bg-signal/25"
        }`}>
        {actionLabel()}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom Tabs (Desktop)
// ─────────────────────────────────────────────────────────────────────────────
function BottomTabsArea({ activeTab, onTabChange }: { activeTab: BottomTab; onTabChange: (t: BottomTab) => void }) {
  const tabs: { id: BottomTab; label: string }[] = [
    { id: "balances", label: "Balances" },
    { id: "positions", label: "Positions" },
    { id: "outcomes", label: "Outcomes" },
    { id: "openOrders", label: "Open Orders" },
    { id: "twap", label: "TWAP" },
    { id: "tradeHistory", label: "Trade History" },
    { id: "fundingHistory", label: "Funding History" },
    { id: "orderHistory", label: "Order History" },
    { id: "triggerHistory", label: "Trigger History" },
  ];
  return (
    <div className="border-t border-bg-line">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-bg-line px-3">
        {tabs.map(t => (
          <button key={t.id} onClick={() => onTabChange(t.id)}
            className={`shrink-0 px-3 py-2.5 font-mono text-xs ${activeTab === t.id ? "text-signal border-b-2 border-signal" : "text-ink-mute hover:text-ink"}`}>
            {t.label}
            {t.id === "triggerHistory" && <span className="ml-1.5 inline-block rounded-sm bg-amber-500/20 px-1 py-px text-[9px] text-amber-300">Project.Q</span>}
          </button>
        ))}
      </div>
      <div className="min-h-[160px] p-4 text-sm">
        {activeTab === "triggerHistory" ? <TriggerHistoryTable /> : (
          <p className="text-ink-faint">
            {activeTab === "positions" ? "No open positions yet" : `No data yet — connect wallet to see your ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()}`}
          </p>
        )}
      </div>
    </div>
  );
}

function TriggerHistoryTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-bg-line text-left text-ink-faint">
            <th className="py-2 px-2 font-mono text-[10px] uppercase">Time</th>
            <th className="py-2 px-2 font-mono text-[10px] uppercase">Rule</th>
            <th className="py-2 px-2 font-mono text-[10px] uppercase">Trigger</th>
            <th className="py-2 px-2 font-mono text-[10px] uppercase">State</th>
            <th className="py-2 px-2 font-mono text-[10px] uppercase">Action</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_TRIGGER_HISTORY.map((h, i) => (
            <tr key={i} className="border-b border-bg-line/40">
              <td className="py-2 px-2 font-mono text-[11px] text-ink-mute">{h.time}</td>
              <td className="py-2 px-2 text-ink">{h.rule}</td>
              <td className="py-2 px-2 font-mono text-[11px] text-ink-mute">{h.trigger}</td>
              <td className="py-2 px-2"><span className={`font-mono text-[10px] uppercase ${h.status === "executed" ? "text-signal" : "text-ink-mute"}`}>{h.fired}</span></td>
              <td className="py-2 px-2 font-mono text-[11px] text-ink-mute">{h.action ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 font-mono text-[10px] text-ink-faint">Mock data — V1 shows your real trigger fires (M2/M3).</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MOBILE COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════
type MobileMarketsProps = OrderColumnProps & {
  setSymbol: (s: Symbol) => void;
  candles: CandleData[];
  subTab: MarketsSubTab; setSubTab: (t: MarketsSubTab) => void;
  onSignalClick: (s: Signal) => void;
};

function MobileMarkets(props: MobileMarketsProps) {
  const { symbol, setSymbol, data, candles, subTab, setSubTab, onSignalClick } = props;

  return (
    <div>
      {/* Pair header — compact */}
      <div className="border-b border-bg-line px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <select value={symbol} onChange={(e) => setSymbol(e.target.value as Symbol)}
              className="border-0 bg-transparent pr-6 font-medium text-lg outline-none">
              {(["BTC", "ETH", "SOL", "HYPE", "DOGE"] as Symbol[]).map(s => (
                <option key={s} value={s}>{s}-USDC</option>
              ))}
            </select>
            <span className="text-[10px] text-signal">10x</span>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg">{data.mark.toLocaleString()}</div>
            <div className={`font-mono text-xs ${data.change24h > 0 ? "text-signal" : "text-red-400"}`}>
              {data.change24h > 0 ? "+" : ""}{data.change24h.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tabs: Chart / Signal / Trigger */}
      <div className="border-b border-bg-line">
        <div className="flex">
          {(["chart", "signal", "trigger"] as MarketsSubTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={`flex-1 py-3 text-center font-medium ${
                subTab === t
                  ? t === "trigger"
                    ? "border-b-2 border-amber-400 text-amber-300"
                    : "border-b-2 border-signal text-signal"
                  : "text-ink-mute"
              }`}
            >
              {t === "chart" && "Chart"}
              {t === "signal" && "Signal"}
              {t === "trigger" && "Trigger"}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tab content */}
      <div>
        {subTab === "chart" && <MobileChartTab candles={candles} symbol={symbol} />}
        {subTab === "signal" && <MobileSignalTab signals={data.signals} onSignalClick={onSignalClick} />}
        {subTab === "trigger" && <MobileTriggerTab {...props} />}
      </div>
    </div>
  );
}

function MobileChartTab({ candles, symbol }: { candles: CandleData[]; symbol: Symbol }) {
  const [tf, setTf] = useState("1h");
  return (
    <div className="p-3">
      <div className="mb-2 flex items-center gap-3 text-xs">
        {["5m", "1h", "D"].map(t => (
          <button key={t} onClick={() => setTf(t)} className={`font-mono ${tf === t ? "text-ink" : "text-ink-mute"}`}>{t}</button>
        ))}
        <span className="text-ink-faint">|</span>
        <button className="font-mono text-ink-mute">ƒ Indicators</button>
      </div>
      <CandleChart candles={candles} height={360} />
      <div className="mt-2 flex justify-between text-[11px]">
        <div className="flex gap-2 font-mono text-ink-mute">
          {["5y", "1y", "6m", "3m", "1m", "5d", "1d"].map(r => <button key={r}>{r}</button>)}
        </div>
        <span className="font-mono text-ink-faint">{symbol}-USD</span>
      </div>
    </div>
  );
}

function MobileSignalTab({ signals, onSignalClick }: { signals: Signal[]; onSignalClick: (s: Signal) => void }) {
  return (
    <div className="p-3">
      <p className="mb-3 font-mono text-[10px] text-ink-faint">
        Tap any signal to add as a trigger condition →
      </p>
      <div className="space-y-3">
        {signals.map((signal) => {
          const colors = labelColor(signal.label);
          return (
            <button key={signal.kind} onClick={() => onSignalClick(signal)}
              className="block w-full border border-bg-line bg-bg-panel/40 p-3 text-left transition active:bg-bg-panel/80">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">{signal.name}</span>
                <span className={`font-mono text-[10px] uppercase ${colors.text}`}>{signal.label}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-lg">{signal.display}</span>
                {signal.trend === "up" && <span className="text-signal text-xs">↑</span>}
                {signal.trend === "down" && <span className="text-red-400 text-xs">↓</span>}
              </div>
              <div className="mt-2 relative h-1.5 rounded-full bg-bg-line">
                <div className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ${colors.bar}`}
                  style={{ left: `calc(${signal.intensity * 100}% - 6px)` }} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-ink-faint">{signal.context}</span>
                <span className="font-mono text-[10px] text-amber-300">+ trigger →</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileTriggerTab(props: MobileMarketsProps) {
  // Reuse OrderColumn directly — it has the same shape as desktop
  return <OrderColumn {...props} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Trade tab (Connect sheet)
// ─────────────────────────────────────────────────────────────────────────────
function MobileTradeConnect() {
  const handleConnect = (method: string) => {
    alert(`Demo: ${method}\n\nIn V1, this initiates a real wallet connection via Wagmi/ConnectKit.`);
  };

  return (
    <div className="p-5">
      <h2 className="mb-4 text-xl">Connect</h2>

      <div className="space-y-3">
        <button onClick={() => handleConnect("Link Desktop Wallet")}
          className="flex w-full items-center gap-3 border border-bg-line bg-bg-panel/60 p-4 text-left transition active:bg-bg-panel">
          <svg className="h-5 w-5 text-ink-mute" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="12" rx="1" strokeWidth="1.5"/>
            <path d="M2 19h20" strokeWidth="1.5"/>
          </svg>
          <span>Link Desktop Wallet</span>
        </button>

        <button onClick={() => handleConnect("Log in with Email")}
          className="flex w-full items-center gap-3 border border-bg-line bg-bg-panel/60 p-4 text-left transition active:bg-bg-panel">
          <svg className="h-5 w-5 text-ink-mute" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="14" rx="1" strokeWidth="1.5"/>
            <path d="M3 7l9 7 9-7" strokeWidth="1.5"/>
          </svg>
          <span>Log in with Email</span>
        </button>

        <div className="flex items-center gap-2 py-2">
          <div className="h-px flex-1 bg-bg-line"/>
          <span className="font-mono text-[10px] text-ink-faint">OR</span>
          <div className="h-px flex-1 bg-bg-line"/>
        </div>

        <button onClick={() => handleConnect("WalletConnect")}
          className="flex w-full items-center gap-3 border border-bg-line bg-bg-panel/60 p-4 text-left transition active:bg-bg-panel">
          <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.5 9.5c3-3 7-3 10 0l.4.4c.2.2.2.4 0 .6l-1.3 1.3c-.1.1-.2.1-.3 0l-.5-.5c-2.1-2-5.4-2-7.5 0l-.6.6c-.1.1-.2.1-.3 0L5.1 10.6c-.2-.2-.2-.4 0-.6l1.4-.5zM19.6 13l1.2 1.2c.2.2.2.4 0 .6l-5.4 5.3c-.2.2-.4.2-.6 0L11 16.5c-.1 0-.1 0-.2 0l-3.8 3.7c-.2.2-.4.2-.6 0L1 14.8c-.2-.2-.2-.4 0-.6L2.2 13c.2-.2.4-.2.6 0l3.8 3.7c.1.1.2.1.3 0l3.8-3.7c.2-.2.4-.2.6 0l3.8 3.7c.1.1.2.1.3 0l3.8-3.7c.2-.2.4-.2.5 0z"/>
          </svg>
          <span>WalletConnect</span>
        </button>
      </div>

      <div className="mt-5 rounded border border-signal/30 bg-signal/5 p-3">
        <p className="text-sm">
          <span className="text-ink-mute">Prefer an app-like experience? </span>
          <button className="text-signal underline">Try the PWA.</button>
        </p>
      </div>

      <p className="mt-6 text-center font-mono text-[10px] text-ink-faint">
        Demo mode — no real wallet connection in this mockup
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Account tab
// ─────────────────────────────────────────────────────────────────────────────
function MobileAccount() {
  return (
    <div>
      <div className="bg-signal/10 px-4 py-3 text-sm">
        <span className="text-ink-mute">Welcome to Project Q! Get started </span>
        <button className="text-signal underline">here</button>.
      </div>

      <div className="p-4">
        <h3 className="mb-3 text-base">Account Equity</h3>
        <div className="space-y-2 border-b border-bg-line pb-4">
          <div className="flex justify-between">
            <span className="text-ink-mute underline decoration-dotted">Spot</span>
            <span className="font-mono">$0.00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-mute underline decoration-dotted">Perps</span>
            <span className="font-mono">$0.00</span>
          </div>
        </div>

        <h3 className="mb-3 mt-5 text-base">Perps Overview</h3>
        <div className="space-y-2">
          <Row label="Balance" value="$0.00" />
          <Row label="Unrealized PNL" value="$0.00" />
          <Row label="Cross Margin Ratio" value="0.00%" valueColor="text-signal" />
          <Row label="Maintenance Margin" value="$0.00" />
          <Row label="Cross Account Leverage" value="0.00x" />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-[68px] space-y-2 border-t border-bg-line bg-bg p-3">
        <button className="w-full border border-signal bg-signal/15 py-3 font-medium text-signal">
          Deposit
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button className="border border-bg-line py-2.5 text-sm text-signal">Perps ⇄ Spot</button>
          <button className="border border-bg-line py-2.5 text-sm text-signal">Withdraw</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-mute underline decoration-dotted">{label}</span>
      <span className={`font-mono ${valueColor ?? "text-ink"}`}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom Tab Bar (mobile only)
// ─────────────────────────────────────────────────────────────────────────────
function BottomTabBar({ activeTab, onTabChange }: { activeTab: MobileTab; onTabChange: (t: MobileTab) => void }) {
  const tabs: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "markets",
      label: "Markets",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M4 20V10M12 20V4M20 20V14" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      id: "trade",
      label: "Trade",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" strokeWidth="2"/>
          <circle cx="12" cy="12" r="9" strokeWidth="2"/>
        </svg>
      ),
    },
    {
      id: "account",
      label: "Account",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="4" strokeWidth="2"/>
          <path d="M4 21v-2a4 4 0 014-4h8a4 4 0 014 4v2" strokeWidth="2"/>
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-bg-line bg-bg">
      <div className="flex">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`flex flex-1 flex-col items-center gap-1 py-3 transition ${
              activeTab === t.id ? "text-signal" : "text-ink-mute"
            }`}
          >
            {t.icon}
            <span className="text-[11px]">{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
