/**
 * Order execution module.
 *
 * Two distinct interfaces because Hyperliquid only supports price/time
 * conditions natively. See docs/order-execution-design.md for the full
 * decision context.
 */
export type {
  ConditionalOrderExecutor,
} from "./conditional";
export type {
  TriggeredOrderExecutor,
} from "./triggered";
export type {
  ConditionalOrderParams,
  ConditionalOrderType,
  TriggeredOrderParams,
  OrderResult,
  OrderSide,
  ExecutorError,
} from "./types";

export { DirectWalletConditionalExecutor } from "./conditional";
export { DirectWalletTriggeredExecutor } from "./triggered";
