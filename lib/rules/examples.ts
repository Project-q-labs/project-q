/**
 * Example rules for the /rules preview page.
 *
 * Each rule is a structured trigger spec that can be evaluated against
 * current Hyperliquid market data. The preview page shows whether each
 * rule's conditions are currently TRUE — making the preview alive
 * with real data, not just static mockups.
 */

export type Condition =
  | { kind: "fundingAbove"; symbol: string; thresholdPct: number }
  | { kind: "fundingBelow"; symbol: string; thresholdPct: number }
  | { kind: "fundingAprAbove"; symbol: string; thresholdPct: number }
  | { kind: "change24hAbove"; symbol: string; thresholdPct: number }
  | { kind: "change24hBelow"; symbol: string; thresholdPct: number }
  | { kind: "oiNotionalAbove"; symbol: string; thresholdUsd: number };

export type RuleAction = {
  side: "long" | "short" | "alert" | "close";
  description: string;
};

export type ExampleRule = {
  id: string;
  category: "Funding" | "Order Flow" | "Macro" | "Risk";
  conditions: Condition[];
  combinator: "AND" | "OR";
  action: RuleAction;
};

export const EXAMPLE_RULES: ExampleRule[] = [
  {
    id: "btc-funding-extreme-short",
    category: "Funding",
    conditions: [
      { kind: "fundingAprAbove", symbol: "BTC", thresholdPct: 25 },
    ],
    combinator: "AND",
    action: {
      side: "short",
      description: "Open BTC short with 5% portfolio (mean reversion)",
    },
  },
  {
    id: "eth-funding-flip-long",
    category: "Funding",
    conditions: [
      { kind: "fundingBelow", symbol: "ETH", thresholdPct: 0 },
      { kind: "change24hAbove", symbol: "ETH", thresholdPct: -2 },
    ],
    combinator: "AND",
    action: {
      side: "long",
      description: "ETH long entry — negative funding + price holding",
    },
  },
  {
    id: "sol-momentum-long",
    category: "Order Flow",
    conditions: [
      { kind: "change24hAbove", symbol: "SOL", thresholdPct: 5 },
      { kind: "fundingAprAbove", symbol: "SOL", thresholdPct: 5 },
    ],
    combinator: "AND",
    action: {
      side: "long",
      description: "SOL momentum long with 3% portfolio",
    },
  },
  {
    id: "hype-oi-spike-alert",
    category: "Order Flow",
    conditions: [
      { kind: "oiNotionalAbove", symbol: "HYPE", thresholdUsd: 800_000_000 },
    ],
    combinator: "AND",
    action: {
      side: "alert",
      description: "Telegram alert: HYPE OI > $800M, watch for breakout",
    },
  },
  {
    id: "btc-deep-correction-buy",
    category: "Risk",
    conditions: [
      { kind: "change24hBelow", symbol: "BTC", thresholdPct: -5 },
      { kind: "fundingBelow", symbol: "BTC", thresholdPct: 0 },
    ],
    combinator: "AND",
    action: {
      side: "long",
      description: "BTC buy the dip — 24h drop + capitulation funding",
    },
  },
  {
    id: "doge-extreme-funding-fade",
    category: "Funding",
    conditions: [
      { kind: "fundingAprAbove", symbol: "DOGE", thresholdPct: 50 },
    ],
    combinator: "AND",
    action: {
      side: "short",
      description: "Fade DOGE crowded longs — extreme funding short",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation
// ─────────────────────────────────────────────────────────────────────────────

export type MarketSnapshot = {
  symbol: string;
  markPx: number;
  prevDayPx: number;
  change24hPct: number;
  funding: number; // hourly
  fundingApr: number; // annualized %
  openInterestNotional: number;
};

export type ConditionResult = {
  condition: Condition;
  satisfied: boolean;
  currentValue: string;
  thresholdLabel: string;
};

export function evaluateCondition(
  condition: Condition,
  markets: Record<string, MarketSnapshot>
): ConditionResult {
  const market = markets[condition.symbol];
  if (!market) {
    return {
      condition,
      satisfied: false,
      currentValue: "—",
      thresholdLabel: "—",
    };
  }

  switch (condition.kind) {
    case "fundingAbove": {
      const fundingPct = market.funding * 100;
      return {
        condition,
        satisfied: fundingPct > condition.thresholdPct,
        currentValue: `${fundingPct >= 0 ? "+" : ""}${fundingPct.toFixed(4)}%`,
        thresholdLabel: `> ${condition.thresholdPct}%`,
      };
    }
    case "fundingBelow": {
      const fundingPct = market.funding * 100;
      return {
        condition,
        satisfied: fundingPct < condition.thresholdPct,
        currentValue: `${fundingPct >= 0 ? "+" : ""}${fundingPct.toFixed(4)}%`,
        thresholdLabel: `< ${condition.thresholdPct}%`,
      };
    }
    case "fundingAprAbove": {
      return {
        condition,
        satisfied: market.fundingApr > condition.thresholdPct,
        currentValue: `${market.fundingApr.toFixed(1)}% APR`,
        thresholdLabel: `> ${condition.thresholdPct}% APR`,
      };
    }
    case "change24hAbove": {
      return {
        condition,
        satisfied: market.change24hPct > condition.thresholdPct,
        currentValue: `${market.change24hPct >= 0 ? "+" : ""}${market.change24hPct.toFixed(2)}%`,
        thresholdLabel: `> ${condition.thresholdPct >= 0 ? "+" : ""}${condition.thresholdPct}%`,
      };
    }
    case "change24hBelow": {
      return {
        condition,
        satisfied: market.change24hPct < condition.thresholdPct,
        currentValue: `${market.change24hPct >= 0 ? "+" : ""}${market.change24hPct.toFixed(2)}%`,
        thresholdLabel: `< ${condition.thresholdPct}%`,
      };
    }
    case "oiNotionalAbove": {
      return {
        condition,
        satisfied: market.openInterestNotional > condition.thresholdUsd,
        currentValue: `$${formatCompact(market.openInterestNotional)}`,
        thresholdLabel: `> $${formatCompact(condition.thresholdUsd)}`,
      };
    }
  }
}

export function evaluateRule(
  rule: ExampleRule,
  markets: Record<string, MarketSnapshot>
): { satisfied: boolean; results: ConditionResult[] } {
  const results = rule.conditions.map((c) => evaluateCondition(c, markets));
  const satisfied =
    rule.combinator === "AND"
      ? results.every((r) => r.satisfied)
      : results.some((r) => r.satisfied);
  return { satisfied, results };
}

export function describeCondition(condition: Condition): string {
  switch (condition.kind) {
    case "fundingAbove":
      return `${condition.symbol} funding rate > ${condition.thresholdPct}% (1h)`;
    case "fundingBelow":
      return `${condition.symbol} funding rate < ${condition.thresholdPct}% (1h)`;
    case "fundingAprAbove":
      return `${condition.symbol} funding > ${condition.thresholdPct}% APR`;
    case "change24hAbove":
      return `${condition.symbol} 24h change > ${condition.thresholdPct >= 0 ? "+" : ""}${condition.thresholdPct}%`;
    case "change24hBelow":
      return `${condition.symbol} 24h change < ${condition.thresholdPct}%`;
    case "oiNotionalAbove":
      return `${condition.symbol} OI > $${formatCompact(condition.thresholdUsd)}`;
  }
}

function formatCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}
