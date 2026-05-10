/**
 * Hyperliquid WebSocket message types.
 *
 * Reference: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions
 *
 * Only the subset we currently consume — we'll grow this as new feeds
 * come online.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Subscription requests (client → server)
// ─────────────────────────────────────────────────────────────────────────────
export type Subscription =
  | { type: "trades"; coin: string }
  | { type: "bbo"; coin: string }
  | { type: "allMids" }
  | { type: "candle"; coin: string; interval: string }
  | { type: "userEvents"; user: string };

export type SubscribeMessage = {
  method: "subscribe";
  subscription: Subscription;
};

export type UnsubscribeMessage = {
  method: "unsubscribe";
  subscription: Subscription;
};

// ─────────────────────────────────────────────────────────────────────────────
// Server → client messages
// ─────────────────────────────────────────────────────────────────────────────
export type WsMessage =
  | WsSubscriptionResponse
  | WsTradesMessage
  | WsBboMessage
  | WsAllMidsMessage
  | WsPongMessage
  | WsErrorMessage;

export type WsSubscriptionResponse = {
  channel: "subscriptionResponse";
  data: { method: "subscribe" | "unsubscribe"; subscription: Subscription };
};

/** A trade execution. price, size, side, timestamp. */
export type WsTrade = {
  coin: string;
  side: "A" | "B"; // A=ask (sell aggressor), B=bid (buy aggressor)
  px: string;
  sz: string;
  time: number; // milliseconds
  hash: string;
  tid: number;
  users: [string, string]; // [buyer, seller]
};

export type WsTradesMessage = {
  channel: "trades";
  data: WsTrade[];
};

/** Best bid / best offer. */
export type WsBboMessage = {
  channel: "bbo";
  data: {
    coin: string;
    time: number;
    bbo: [
      { px: string; sz: string; n: number } | null, // best bid
      { px: string; sz: string; n: number } | null, // best ask
    ];
  };
};

export type WsAllMidsMessage = {
  channel: "allMids";
  data: { mids: Record<string, string> };
};

export type WsPongMessage = { channel: "pong" };

export type WsErrorMessage = {
  channel: "error";
  data: string;
};
