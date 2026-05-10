/**
 * Order execution types — shared between conditional and triggered executors.
 *
 * Project Q has TWO distinct order execution flows because Hyperliquid only
 * accepts price- and time-based conditions natively:
 *
 *   1. Conditional (Hyperliquid-native): user sets "buy BTC at $90k" once,
 *      Hyperliquid holds the order and fills it when price hits. We sign
 *      once at registration, the exchange handles everything else.
 *
 *   2. Triggered (Project Q server-watched): user sets "buy BTC when funding
 *      > 0.05%" — Hyperliquid doesn't accept this as an order condition.
 *      Our worker watches the indicator, and when the rule fires it submits
 *      a market order at that moment.
 *
 * Same coin/size/side semantics; different lifecycle. We model them with
 * separate interfaces so the rule engine and UI can branch on rule type
 * without leaking executor details.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Common
// ─────────────────────────────────────────────────────────────────────────────
export type OrderSide = "buy" | "sell";

export type OrderResult =
  | { success: true; hlOrderId: number; filledSize?: number }
  | { success: false; error: ExecutorError; details?: string };

export type ExecutorError =
  | "insufficient_margin"
  | "user_rejected" // user declined the wallet signature prompt
  | "invalid_size"
  | "invalid_price"
  | "network_error"
  | "rate_limited"
  | "exchange_rejected" // Hyperliquid returned an error
  | "not_implemented"
  | "unknown";

// ─────────────────────────────────────────────────────────────────────────────
// Conditional orders — Hyperliquid-native (price/time triggers)
// ─────────────────────────────────────────────────────────────────────────────
export type ConditionalOrderType =
  | "limit" // resting order at a price
  | "stop_market" // trigger price hit → market order
  | "stop_limit" // trigger price hit → limit order
  | "take_profit"; // close position at target price

export type ConditionalOrderParams = {
  coin: string; // "BTC", "ETH", ...
  side: OrderSide;
  size: number; // base coin units
  type: ConditionalOrderType;
  triggerPrice?: number; // for stop/take_profit
  limitPrice?: number; // for limit / stop_limit
  reduceOnly?: boolean;
  clientOrderId: string; // idempotency
};

// ─────────────────────────────────────────────────────────────────────────────
// Triggered orders — Project Q server fires market order when rule matches
// ─────────────────────────────────────────────────────────────────────────────
export type TriggeredOrderParams = {
  coin: string;
  side: OrderSide;
  size: number;
  /** Optional max slippage as a fraction, e.g. 0.005 = 0.5%. */
  maxSlippage?: number;
  reduceOnly?: boolean;
  clientOrderId: string;
  /**
   * The rule that fired. Used for logging and for the user-facing
   * "why was this order placed?" trail.
   */
  ruleId: string;
  ruleVersion: number;
};
