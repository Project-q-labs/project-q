"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { PriceTicker } from "@/components/PriceTicker";

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirror M2 schema, but local to this mockup)
// ─────────────────────────────────────────────────────────────────────────────
type ConditionKind =
  | "fundingAprAbove"
  | "fundingBelow"
  | "change24hAbove"
  | "change24hBelow"
  | "oiNotionalAbove"
  | "priceAbove"
  | "priceBelow"
  | "liquidationsAbove";

type Symbol = "BTC" | "ETH" | "SOL" | "HYPE" | "DOGE";

type Condition = {
  id: string;
  kind: ConditionKind;
  symbol: Symbol;
  threshold: number;
};

type ActionKind = "open_trade" | "alert_only" | "close_position";
type Side = "long" | "short";

type RuleDraft = {
  name: string;
  combinator: "AND" | "OR";
  conditions: Condition[];
  action: {
    kind: ActionKind;
    side: Side;
    sizePct: number;
    orderType: "market" | "limit";
    slippagePct: number;
  };
};

// Hyperliquid-native condition kinds (Flow A)
const FLOW_A_KINDS: ConditionKind[] = ["priceAbove", "priceBelow"];

// ─────────────────────────────────────────────────────────────────────────────
// Live price hook (lightweight; mirrors PriceTicker pattern)
// ─────────────────────────────────────────────────────────────────────────────
function useLivePrices() {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    const fetchPrices = async () => {
      try {
        const res = await fetch("/api/v1/prices");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.prices) setPrices(data.prices);
      } catch {
        // silent — mockup tolerates stale data
      }
    };
    fetchPrices();
    const id = setInterval(fetchPrices, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return prices;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function newConditionId() {
  return `c_${Math.random().toString(36).slice(2, 9)}`;
}

const KIND_LABELS: Record<ConditionKind, string> = {
  fundingAprAbove: "Funding APR >",
  fundingBelow: "Funding rate <",
  change24hAbove: "24h change >",
  change24hBelow: "24h change <",
  oiNotionalAbove: "Open Interest >",
  priceAbove: "Price >",
  priceBelow: "Price <",
  liquidationsAbove: "1h liquidations >",
};

const KIND_UNITS: Record<ConditionKind, string> = {
  fundingAprAbove: "% APR",
  fundingBelow: "%",
  change24hAbove: "%",
  change24hBelow: "%",
  oiNotionalAbove: "M USD",
  priceAbove: "USD",
  priceBelow: "USD",
  liquidationsAbove: "M USD",
};

const KIND_CATEGORIES = [
  { label: "PRICE", icon: "🎯", kinds: ["priceAbove", "priceBelow"] as ConditionKind[] },
  { label: "FUNDING", icon: "⚡", kinds: ["fundingAprAbove", "fundingBelow"] as ConditionKind[] },
  { label: "OPEN INTEREST", icon: "📊", kinds: ["oiNotionalAbove"] as ConditionKind[] },
  { label: "24H CHANGE", icon: "📈", kinds: ["change24hAbove", "change24hBelow"] as ConditionKind[] },
  { label: "LIQUIDATIONS", icon: "💥", kinds: ["liquidationsAbove"] as ConditionKind[] },
];

// Mock current values (in M2 these are live)
const MOCK_LIVE: Record<ConditionKind, Partial<Record<Symbol, number>>> = {
  fundingAprAbove: { BTC: 11.0, ETH: 8.5, SOL: 14.3, HYPE: 22.1, DOGE: 38.7 },
  fundingBelow: { BTC: 0.0013, ETH: -0.0024, SOL: 0.0042, HYPE: 0.0067, DOGE: 0.0118 },
  change24hAbove: { BTC: 1.2, ETH: 0.72, SOL: 3.4, HYPE: -1.8, DOGE: 5.2 },
  change24hBelow: { BTC: 1.2, ETH: 0.72, SOL: 3.4, HYPE: -1.8, DOGE: 5.2 },
  oiNotionalAbove: { BTC: 3420, ETH: 1280, SOL: 540, HYPE: 760, DOGE: 290 },
  priceAbove: {},
  priceBelow: {},
  liquidationsAbove: { BTC: 45, ETH: 28, SOL: 12, HYPE: 8, DOGE: 5 },
};

function evaluateCondition(c: Condition, livePrices: Record<string, number>): { current: number | null; passes: boolean } {
  let current: number | null = null;
  if (c.kind === "priceAbove" || c.kind === "priceBelow") {
    current = livePrices[c.symbol] ?? null;
  } else {
    current = MOCK_LIVE[c.kind][c.symbol] ?? null;
  }
  if (current === null) return { current: null, passes: false };

  let passes = false;
  switch (c.kind) {
    case "fundingAprAbove":
    case "change24hAbove":
    case "oiNotionalAbove":
    case "priceAbove":
    case "liquidationsAbove":
      passes = current > c.threshold;
      break;
    case "fundingBelow":
    case "change24hBelow":
    case "priceBelow":
      passes = current < c.threshold;
      break;
  }
  return { current, passes };
}

function formatCurrent(c: Condition, current: number | null): string {
  if (current === null) return "—";
  if (c.kind === "priceAbove" || c.kind === "priceBelow") return `$${current.toLocaleString()}`;
  if (c.kind === "oiNotionalAbove" || c.kind === "liquidationsAbove") return `${current}M USD`;
  if (c.kind === "fundingBelow") return `${(current * 100).toFixed(3)}%`;
  return `${current.toFixed(2)}${KIND_UNITS[c.kind].startsWith("%") ? "%" : ""}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Initial state — seeded with one example
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_RULE: RuleDraft = {
  name: "BTC funding extreme — short",
  combinator: "AND",
  conditions: [
    { id: newConditionId(), kind: "fundingAprAbove", symbol: "BTC", threshold: 25 },
  ],
  action: {
    kind: "open_trade",
    side: "short",
    sizePct: 5,
    orderType: "market",
    slippagePct: 0.5,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function RuleBuilderPreviewPage() {
  const [rule, setRule] = useState<RuleDraft>(INITIAL_RULE);
  const [showPicker, setShowPicker] = useState(false);
  const livePrices = useLivePrices();

  const evaluations = rule.conditions.map((c) => ({
    condition: c,
    ...evaluateCondition(c, livePrices),
  }));

  const allConditionsPass = evaluations.length > 0 && (
    rule.combinator === "AND"
      ? evaluations.every((e) => e.passes)
      : evaluations.some((e) => e.passes)
  );

  // Flow classification — Flow A only if ALL conditions are Hyperliquid-native
  const flow: "A" | "B" = useMemo(() => {
    if (rule.conditions.length === 0) return "B";
    return rule.conditions.every((c) => FLOW_A_KINDS.includes(c.kind)) ? "A" : "B";
  }, [rule.conditions]);

  const addCondition = (kind: ConditionKind) => {
    const defaultSymbol: Symbol = "BTC";
    const defaultThresholds: Record<ConditionKind, number> = {
      fundingAprAbove: 25,
      fundingBelow: 0,
      change24hAbove: 5,
      change24hBelow: -5,
      oiNotionalAbove: 800,
      priceAbove: 100000,
      priceBelow: 90000,
      liquidationsAbove: 100,
    };
    const newCondition: Condition = {
      id: newConditionId(),
      kind,
      symbol: defaultSymbol,
      threshold: defaultThresholds[kind],
    };
    setRule({ ...rule, conditions: [...rule.conditions, newCondition] });
    setShowPicker(false);
  };

  const removeCondition = (id: string) => {
    setRule({ ...rule, conditions: rule.conditions.filter((c) => c.id !== id) });
  };

  const updateCondition = (id: string, patch: Partial<Condition>) => {
    setRule({
      ...rule,
      conditions: rule.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const handleSave = () => {
    alert(
      `📌 Demo mode — rule would be saved\n\n` +
        `Name: ${rule.name}\n` +
        `Conditions: ${rule.conditions.length}\n` +
        `Flow: ${flow}\n\n` +
        `In M2, this saves to Supabase and routes the user to the wallet connect / approveBuilderFee flow.`
    );
  };

  return (
    <main className="min-h-dvh bg-bg text-ink">
      <PriceTicker />

      {/* Header */}
      <header className="border-b border-bg-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-mono text-sm">
            <span className="text-signal">●</span> PROJECT.Q
          </Link>
          <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em]">
            <Link href="/rules" className="text-ink-mute hover:text-ink">Rules</Link>
            <span className="text-signal">Builder Preview</span>
          </div>
        </div>
      </header>

      {/* Preview banner */}
      <section className="border-b border-bg-line bg-bg-panel/40">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-signal">▶ PREVIEW MOCKUP</span>
            <span className="text-ink-faint">·</span>
            <span className="text-ink-mute">M2 wireframe — no save, no execution, no signup</span>
            <span className="text-ink-faint">·</span>
            <span className="text-ink-mute">Built W2 Day 13</span>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
        {/* ──────────────────────────────────────────────────────────────── */}
        {/* Left: Builder */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Rule name */}
          <div className="border border-bg-line bg-bg-panel/60 p-5">
            <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              Rule name
            </label>
            <input
              type="text"
              value={rule.name}
              onChange={(e) => setRule({ ...rule, name: e.target.value })}
              className="mt-2 w-full bg-transparent text-xl font-medium tracking-tight outline-none placeholder:text-ink-faint"
              placeholder="Give your rule a name"
            />
          </div>

          {/* WHEN panel */}
          <div className="border border-bg-line bg-bg-panel/60">
            <div className="flex items-center justify-between border-b border-bg-line px-5 py-3">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-mute">
                When
              </h2>
              {rule.conditions.length > 1 && (
                <div className="flex gap-px border border-bg-line">
                  {(["AND", "OR"] as const).map((op) => (
                    <button
                      key={op}
                      onClick={() => setRule({ ...rule, combinator: op })}
                      className={`px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${
                        rule.combinator === op
                          ? "bg-signal/15 text-signal"
                          : "text-ink-mute hover:text-ink"
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Conditions */}
            <div className="divide-y divide-bg-line">
              {evaluations.map((evalResult, idx) => (
                <ConditionRowComponent
                  key={evalResult.condition.id}
                  condition={evalResult.condition}
                  current={evalResult.current}
                  passes={evalResult.passes}
                  isFirst={idx === 0}
                  combinator={rule.combinator}
                  onChange={(patch) => updateCondition(evalResult.condition.id, patch)}
                  onRemove={() => removeCondition(evalResult.condition.id)}
                />
              ))}
              {rule.conditions.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-ink-faint">
                  Add at least one condition to start
                </div>
              )}
            </div>

            {/* Add condition */}
            <div className="relative border-t border-bg-line p-3">
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="flex w-full items-center justify-center gap-2 border border-dashed border-bg-line py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-mute transition hover:border-signal hover:text-signal"
              >
                <span>+ Add condition</span>
              </button>

              {showPicker && (
                <div className="absolute left-3 right-3 top-full z-10 mt-2 border border-bg-line bg-bg-panel shadow-xl">
                  <div className="border-b border-bg-line px-4 py-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-mute">
                      What should trigger this rule?
                    </p>
                  </div>
                  <div className="divide-y divide-bg-line">
                    {KIND_CATEGORIES.map((cat) => (
                      <div key={cat.label} className="p-3">
                        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                          {cat.icon} {cat.label}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {cat.kinds.map((kind) => (
                            <button
                              key={kind}
                              onClick={() => addCondition(kind)}
                              className="border border-bg-line bg-bg px-3 py-1.5 text-xs hover:border-signal hover:text-signal"
                            >
                              {KIND_LABELS[kind]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* THEN panel */}
          <div className="border border-bg-line bg-bg-panel/60">
            <div className="border-b border-bg-line px-5 py-3">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-mute">
                Then
              </h2>
            </div>

            <div className="space-y-4 p-5">
              {/* Action kind selector */}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {(
                  [
                    { kind: "open_trade", icon: "💰", label: "Open trade screen", desc: "Alert + pre-filled order" },
                    { kind: "alert_only", icon: "🚨", label: "Alert only", desc: "Notification, no order" },
                    { kind: "close_position", icon: "⛔", label: "Close position", desc: "Exit existing position" },
                  ] as const
                ).map((a) => (
                  <button
                    key={a.kind}
                    onClick={() => setRule({ ...rule, action: { ...rule.action, kind: a.kind } })}
                    className={`border p-3 text-left transition ${
                      rule.action.kind === a.kind
                        ? "border-signal bg-signal/5"
                        : "border-bg-line hover:border-ink-faint"
                    }`}
                  >
                    <div className="font-mono text-sm">
                      {a.icon} {a.label}
                    </div>
                    <div className="mt-1 text-[11px] text-ink-mute">{a.desc}</div>
                  </button>
                ))}
              </div>

              {/* Open-trade specific fields */}
              {rule.action.kind === "open_trade" && (
                <div className="space-y-4 border-t border-bg-line pt-4">
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                      Direction
                    </label>
                    <div className="mt-2 flex gap-px border border-bg-line">
                      {(["long", "short"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setRule({ ...rule, action: { ...rule.action, side: s } })}
                          className={`flex-1 px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] ${
                            rule.action.side === s
                              ? s === "long"
                                ? "bg-signal/15 text-signal"
                                : "bg-red-500/15 text-red-400"
                              : "text-ink-mute"
                          }`}
                        >
                          {s === "long" ? "↗ Long / Buy" : "↘ Short / Sell"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                        Size (% of portfolio)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={rule.action.sizePct}
                        onChange={(e) =>
                          setRule({ ...rule, action: { ...rule.action, sizePct: parseFloat(e.target.value) || 0 } })
                        }
                        className="mt-2 w-full border border-bg-line bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-signal"
                      />
                      <p className="mt-1 text-[10px] text-ink-faint">
                        ~${((rule.action.sizePct / 100) * 10000).toFixed(0)} at $10k equity
                      </p>
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                        Max slippage (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={rule.action.slippagePct}
                        onChange={(e) =>
                          setRule({ ...rule, action: { ...rule.action, slippagePct: parseFloat(e.target.value) || 0 } })
                        }
                        className="mt-2 w-full border border-bg-line bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-signal"
                      />
                      <p className="mt-1 text-[10px] text-ink-faint">
                        Caps market orders
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* Right: Live preview + flow badge */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* Flow badge */}
          <div
            className={`border p-4 ${
              flow === "A"
                ? "border-signal/40 bg-signal/5"
                : "border-yellow-500/40 bg-yellow-500/5"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{flow === "A" ? "🟢" : "🟡"}</span>
              <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-ink">
                {flow === "A" ? "Auto-executed" : "Alert + Trade screen"}
              </h3>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-mute">
              {flow === "A"
                ? "Hyperliquid runs this rule directly. Sign once now; the exchange fills when conditions hit. Latency: milliseconds."
                : "Project Q watches 24/7. When the rule triggers, we'll send Telegram + in-app alerts with a link to our trade screen, where the order is pre-filled and you confirm with one tap."}
            </p>
          </div>

          {/* Live status */}
          <div className="border border-bg-line bg-bg-panel/60 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                Status now
              </h3>
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
                  allConditionsPass ? "text-signal" : "text-ink-mute"
                }`}
              >
                {allConditionsPass ? "● Triggered" : "○ Waiting"}
              </span>
            </div>
            <div className="mt-3 space-y-2 text-[12px]">
              {evaluations.length === 0 ? (
                <p className="text-ink-faint">Add conditions to see live status</p>
              ) : (
                evaluations.map((e) => (
                  <div key={e.condition.id} className="flex items-center justify-between">
                    <span className="text-ink-mute">
                      {e.condition.symbol} {KIND_LABELS[e.condition.kind]} {e.condition.threshold}
                      {KIND_UNITS[e.condition.kind].startsWith("%") ? "%" : ""}
                    </span>
                    <span className={e.passes ? "text-signal" : "text-ink-faint"}>
                      {formatCurrent(e.condition, e.current)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 border border-signal bg-signal/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-signal transition hover:bg-signal/20"
            >
              Save rule
            </button>
            <button
              onClick={() =>
                alert(
                  "📊 Backtest (demo)\n\nIn M2, this would query historical data and show:\n• How many times this rule would have triggered in the last 30 days\n• Average time between triggers\n• Most recent virtual trigger"
                )
              }
              className="border border-bg-line px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-mute transition hover:border-ink-faint hover:text-ink"
            >
              Test
            </button>
          </div>

          {/* Cost preview */}
          {rule.action.kind === "open_trade" && (
            <div className="border border-bg-line bg-bg-panel/40 p-4">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                Estimated fees per trade
              </h3>
              <div className="mt-3 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-ink-mute">Hyperliquid (taker)</span>
                  <span className="font-mono">0.045%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-mute">Project Q (builder fee)</span>
                  <span className="font-mono">0.040%</span>
                </div>
                <div className="flex justify-between border-t border-bg-line pt-1.5">
                  <span className="text-ink">Total</span>
                  <span className="font-mono">0.085%</span>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-ink-faint">
                ${(((rule.action.sizePct / 100) * 10000 * 0.00085)).toFixed(2)} on a $
                {((rule.action.sizePct / 100) * 10000).toFixed(0)} notional position.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* Footer note */}
      <footer className="border-t border-bg-line">
        <div className="mx-auto max-w-7xl px-6 py-6 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          Builder Preview · M2 wireframe · This is a mockup; no rules are saved and no orders are placed.
        </div>
      </footer>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Condition row
// ─────────────────────────────────────────────────────────────────────────────
function ConditionRowComponent({
  condition,
  current,
  passes,
  isFirst,
  combinator,
  onChange,
  onRemove,
}: {
  condition: Condition;
  current: number | null;
  passes: boolean;
  isFirst: boolean;
  combinator: "AND" | "OR";
  onChange: (patch: Partial<Condition>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="px-5 py-4">
      {!isFirst && (
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          {combinator}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          value={condition.symbol}
          onChange={(e) => onChange({ symbol: e.target.value as Symbol })}
          className="border border-bg-line bg-bg px-2 py-1 font-mono text-xs outline-none focus:border-signal"
        >
          {(["BTC", "ETH", "SOL", "HYPE", "DOGE"] as Symbol[]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <span className="text-ink-mute">{KIND_LABELS[condition.kind]}</span>

        <input
          type="number"
          step={
            condition.kind === "priceAbove" || condition.kind === "priceBelow"
              ? "100"
              : "0.5"
          }
          value={condition.threshold}
          onChange={(e) => onChange({ threshold: parseFloat(e.target.value) || 0 })}
          className="w-24 border border-bg-line bg-bg px-2 py-1 text-right font-mono text-xs outline-none focus:border-signal"
        />

        <span className="text-ink-faint text-xs">{KIND_UNITS[condition.kind]}</span>

        <div className="flex-1" />

        <span
          className={`font-mono text-[11px] ${
            passes ? "text-signal" : "text-ink-mute"
          }`}
        >
          now: {formatCurrent(condition, current)}
        </span>

        <button
          onClick={onRemove}
          className="ml-2 text-ink-faint hover:text-red-400"
          title="Remove"
        >
          ×
        </button>
      </div>
    </div>
  );
}
