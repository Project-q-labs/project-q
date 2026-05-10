/**
 * ConditionalOrderExecutor — orders that Hyperliquid evaluates and executes
 * on its own (limit, stop, take-profit).
 *
 * V1 flow:
 *   - User configures rule "buy 0.1 BTC when price hits $90k"
 *   - Project Q calls placeStopOrder() once
 *   - User signs in their wallet
 *   - Hyperliquid holds the order; when price hits $90k, it fills
 *   - No further user interaction needed
 *
 * Because Hyperliquid handles execution, V1 already gets fully automatic
 * behavior for these rule types — no Agent Wallet required.
 */
import type {
  ConditionalOrderParams,
  OrderResult,
} from "./types";

export interface ConditionalOrderExecutor {
  readonly kind: "conditional_direct_wallet";

  /** Submit a conditional order to Hyperliquid. User must sign. */
  placeOrder(params: ConditionalOrderParams): Promise<OrderResult>;

  /** Cancel a previously-placed conditional order. */
  cancelOrder(coin: string, hlOrderId: number): Promise<OrderResult>;

  /** Modify an existing order (price/size). Best effort — some types may not support. */
  modifyOrder(
    coin: string,
    hlOrderId: number,
    changes: Partial<ConditionalOrderParams>,
  ): Promise<OrderResult>;
}

/**
 * V1 implementation: user signs each call via their connected wallet.
 *
 * This is a STUB. Real implementation in M3 (W7-W8) will:
 *   - Use Hyperliquid's order signing scheme (EIP-712 typed data)
 *   - Call exchange POST /exchange endpoint
 *   - Map response codes to ExecutorError
 *
 * Day 10 PM will research the exact SDK / signing pattern.
 */
export class DirectWalletConditionalExecutor implements ConditionalOrderExecutor {
  readonly kind = "conditional_direct_wallet" as const;

  async placeOrder(_params: ConditionalOrderParams): Promise<OrderResult> {
    return {
      success: false,
      error: "not_implemented",
      details: "DirectWalletConditionalExecutor.placeOrder is a stub. Real implementation in M3.",
    };
  }

  async cancelOrder(_coin: string, _hlOrderId: number): Promise<OrderResult> {
    return {
      success: false,
      error: "not_implemented",
      details: "DirectWalletConditionalExecutor.cancelOrder is a stub. Real implementation in M3.",
    };
  }

  async modifyOrder(
    _coin: string,
    _hlOrderId: number,
    _changes: Partial<ConditionalOrderParams>,
  ): Promise<OrderResult> {
    return {
      success: false,
      error: "not_implemented",
      details: "DirectWalletConditionalExecutor.modifyOrder is a stub. Real implementation in M3.",
    };
  }
}
