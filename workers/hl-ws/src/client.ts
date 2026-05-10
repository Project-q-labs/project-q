import WebSocket from "ws";
import type {
  Subscription,
  SubscribeMessage,
  WsMessage,
  WsTrade,
} from "./types";

const WS_URL = "wss://api.hyperliquid.xyz/ws";
const PING_INTERVAL_MS = 20_000; // server idles at 60s; we ping at 20s

export type Handlers = {
  onTrade?: (coin: string, trade: WsTrade) => void;
  onBbo?: (coin: string, bid: number | null, ask: number | null, time: number) => void;
  onAllMids?: (mids: Record<string, number>) => void;
  onSubscribed?: (sub: Subscription) => void;
  onError?: (err: unknown) => void;
  onClose?: () => void;
  onOpen?: () => void;
};

/**
 * A small wrapper around ws that knows about Hyperliquid's subscription
 * protocol and ping/pong heartbeat.
 *
 * Day 8 PM: connect, subscribe, log received messages.
 * Day 9 AM: add reconnect-with-backoff and resubscribe on reconnect.
 */
export class HlWsClient {
  private ws: WebSocket | null = null;
  private subscriptions: Subscription[] = [];
  private pingTimer: NodeJS.Timeout | null = null;
  private handlers: Handlers;
  private connectedAt: number | null = null;
  private messageCount = 0;

  constructor(handlers: Handlers = {}) {
    this.handlers = handlers;
  }

  /** Open the WebSocket and resolve when handshake completes. */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      log("connecting", { url: WS_URL });
      this.ws = new WebSocket(WS_URL);

      const onOpen = () => {
        this.connectedAt = Date.now();
        log("connected");
        this.startPing();
        this.handlers.onOpen?.();
        resolve();
      };

      const onError = (err: Error) => {
        log("error", { message: err.message });
        this.handlers.onError?.(err);
        reject(err);
      };

      this.ws.once("open", onOpen);
      this.ws.once("error", onError);
      this.ws.on("message", (raw) => this.onRawMessage(raw));
      this.ws.on("close", () => this.onClose());
    });
  }

  /** Subscribe and remember (for resubscribe on reconnect — Day 9). */
  subscribe(sub: Subscription): void {
    this.subscriptions.push(sub);
    if (this.ws?.readyState === WebSocket.OPEN) {
      const msg: SubscribeMessage = { method: "subscribe", subscription: sub };
      this.ws.send(JSON.stringify(msg));
      log("subscribe", sub);
    } else {
      log("subscribe queued (not open)", sub);
    }
  }

  /** Time since open + total messages — used by /healthz endpoint later. */
  stats() {
    return {
      isOpen: this.ws?.readyState === WebSocket.OPEN,
      uptimeMs: this.connectedAt ? Date.now() - this.connectedAt : 0,
      messageCount: this.messageCount,
      subscriptionCount: this.subscriptions.length,
    };
  }

  close(): void {
    this.stopPing();
    this.ws?.close();
    this.ws = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────────────────────────────────
  private onRawMessage(raw: WebSocket.RawData) {
    this.messageCount++;
    let msg: WsMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch (err) {
      log("parse error", { err: String(err), raw: raw.toString().slice(0, 200) });
      return;
    }

    switch (msg.channel) {
      case "subscriptionResponse":
        this.handlers.onSubscribed?.(msg.data.subscription);
        break;
      case "trades":
        for (const trade of msg.data) {
          this.handlers.onTrade?.(trade.coin, trade);
        }
        break;
      case "bbo": {
        const [bid, ask] = msg.data.bbo;
        this.handlers.onBbo?.(
          msg.data.coin,
          bid ? parseFloat(bid.px) : null,
          ask ? parseFloat(ask.px) : null,
          msg.data.time
        );
        break;
      }
      case "allMids": {
        const mids: Record<string, number> = {};
        for (const [k, v] of Object.entries(msg.data.mids)) {
          mids[k] = parseFloat(v);
        }
        this.handlers.onAllMids?.(mids);
        break;
      }
      case "pong":
        // ack — heartbeat alive
        break;
      case "error":
        log("server error", { detail: msg.data });
        this.handlers.onError?.(new Error(msg.data));
        break;
      default:
        // Unknown channel — log and ignore
        log("unknown channel", { msg });
    }
  }

  private onClose() {
    log("closed", this.stats());
    this.stopPing();
    this.handlers.onClose?.();
    // Reconnection logic lives in src/index.ts (Day 9 promotes it here)
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Hyperliquid accepts a json {"method": "ping"} message
        this.ws.send(JSON.stringify({ method: "ping" }));
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny structured logger — JSON lines so Fly.io can parse later
// ─────────────────────────────────────────────────────────────────────────────
function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}
