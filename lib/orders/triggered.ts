/**
 * TriggeredOrderExecutor — orders fired by Project Q's server when a
 * non-Hyperliquid-native condition is met (funding rate, indicator,
 * volume spike, on-chain event, etc.).
 *
 * V1 flow:
 *   - User configures rule "short ETH when funding > 0.05%"
 *   - Project Q's worker watches funding via WebSocket
 *   - Funding crosses 0.05% → executor.executeMarketOrder() is called
 *   - V1: notification → user taps to approve → wallet signs → submitted
 *   - V2: Agent Wallet auto-signs immediately (post-launch)
 *
 * The interface is the same for V1 and V2; only the implementation differs.
 * V1 implementation will queue the request and surface it via push;
 * V2 implementation will sign and submit synchronously.
 */
import type { OrderResult, TriggeredOrderParams } from "./types";

export interface TriggeredOrderExecutor {
  readonly kind: "triggered_direct_wallet" | "triggered_agent_wallet";

  /**
   * Fire a market order in response to a rule trigger.
   * V1: returns a pending result and waits for user approval out-of-band.
   * V2: returns synchronously after submission.
   */
  executeMarketOrder(params: TriggeredOrderParams): Promise<OrderResult>;
}

/**
 * V1 implementation: queues an approval request and returns immediately.
 *
 * This is a STUB. Real implementation in M3 will:
 *   - Insert a row into `pending_approvals` table
 *   - Send push notification (Telegram bot or PWA push) to user
 *   - When user taps "approve", frontend prompts wallet signature
 *   - Frontend submits the signed order
 *   - Worker observes the resulting order row and updates rule's last_fired_at
 *
 * Day 10 PM will research the exact submission pattern.
 */
export class DirectWalletTriggeredExecutor implements TriggeredOrderExecutor {
  readonly kind = "triggered_direct_wallet" as const;

  async executeMarketOrder(_params: TriggeredOrderParams): Promise<OrderResult> {
    return {
      success: false,
      error: "not_implemented",
      details: "DirectWalletTriggeredExecutor.executeMarketOrder is a stub. Real implementation in M3.",
    };
  }
}
