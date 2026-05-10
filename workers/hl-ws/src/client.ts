import WebSocket from "ws";
import type {
  Subscription,
  SubscribeMessage,
  WsMessage,
  WsTrade,
} from "./types";

const WS_URL = "wss://api.hyperliquid.xyz/ws";
const PING_INTERVAL_MS = 20_000; // server idles at 60s; we ping at 20s

// Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, capped at 60s
const RECONNECT_INITIAL_MS = 1_000;
const RECONNECT_MAX_MS = 60_000;

export type Handlers = {
  onTrade?: (coin: string, trade: WsTrade) => void;
  onBbo?: (coin: string, bid: number | null, ask: number | null, time: number) => void;
  onAllMids?: (mids: Record<string, number>) => void;
  onSubscribed?: (sub: Subscription) => void;
  onError?: (err: unknown) => void;
  onClose?: () => void;
  onOpen?: () => void;
  onReconnect?: (attempt: number, delayMs: number) => void;
};

/**
 * A small wrapper around ws that knows about Hyperliquid's subscription
 * protocol, ping/pong heartbeat, and automatic reconnection.
 *
 * - On disconnect: reconnects with exponential backoff (1s → 60s capped).
 * - On reconnect: replays all remembered subscriptions automatically.
 * - The caller can subscribe() at any time; subscriptions are remembered
 *   forever (until close() is called).
 */
export class HlWsClient {
  private ws: WebSocket | null = null;
  private subscriptions: Subscription[] = [];
  private pingTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private handlers: Handlers;
  private connectedAt: number | null = null;
  private messageCount = 0;
  private reconnectAttempts = 0;
  private intentionalClose = false;
  private lastMessageAt: number | null = null;

  constructor(handlers: Handlers = {}) {
    this.handlers = handlers;
  }

  /**
   * Open the initial WebSocket. Resolves when first handshake completes.
   * Subsequent disconnects are handled internally and won't throw.
   */
  connect(): Promise<void> {
    this.intentionalClose = false;
    return this.openSocket();
  }

  /** Subscribe and remember (replayed on every reconnect). */
  subscribe(sub: Subscription): void {
    // Avoid duplicates if the same coin is requested twice
    const already = this.subscriptions.some(
      (s) => JSON.stringify(s) === JSON.stringify(sub)
    );
    if (!already) {
      this.subscriptions.push(sub);
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      const msg: SubscribeMessage = { method: "subscribe", subscription: sub };
      this.ws.send(JSON.stringify(msg));
      log("subscribe", sub);
    } else {
      log("subscribe queued (not open)", sub);
    }
  }

  /** Stats for /healthz endpoint and periodic logging. */
  stats() {
    return {
      isOpen: this.ws?.readyState === WebSocket.OPEN,
      uptimeMs: this.connectedAt ? Date.now() - this.connectedAt : 0,
      messageCount: this.messageCount,
      subscriptionCount: this.subscriptions.length,
      reconnectAttempts: this.reconnectAttempts,
      msSinceLastMessage: this.lastMessageAt
        ? Date.now() - this.lastMessageAt
        : null,
    };
  }

  /** Permanently close the connection (no reconnect). */
  close(): void {
    this.intentionalClose = true;
    this.stopPing();
    this.stopReconnect();
    this.ws?.close();
    this.ws = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: socket lifecycle
  // ─────────────────────────────────────────────────────────────────────────
  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      log("connecting", { url: WS_URL, attempt: this.reconnectAttempts });
      this.ws = new WebSocket(WS_URL);

      const onOpen = () => {
        this.connectedAt = Date.now();
        this.reconnectAttempts = 0; // success — reset backoff
        log("connected");
        this.startPing();
        // Replay subscriptions (no-op on first connect, critical on reconnect)
        for (const sub of this.subscriptions) {
          const msg: SubscribeMessage = { method: "subscribe", subscription: sub };
          this.ws?.send(JSON.stringify(msg));
        }
        if (this.subscriptions.length > 0) {
          log("subscriptions replayed", { count: this.subscriptions.length });
        }
        this.handlers.onOpen?.();
        resolve();
      };

      const onErrorOnce = (err: Error) => {
        // Only used for the very first connect — after that, errors are
        // handled by the close handler which schedules a reconnect.
        log("error (initial)", { message: err.message });
        this.handlers.onError?.(err);
        reject(err);
      };

      this.ws.once("open", onOpen);
      this.ws.once("error", onErrorOnce);
      this.ws.on("message", (raw) => this.onRawMessage(raw));
      this.ws.on("close", () => this.onClose());
      // Persistent error handler for post-handshake errors (don't reject)
      this.ws.on("error", (err) => {
        log("error", { message: err.message });
        this.handlers.onError?.(err);
      });
    });
  }

  private onClose() {
    log("closed", this.stats());
    this.stopPing();
    this.connectedAt = null;
    this.handlers.onClose?.();

    if (this.intentionalClose) {
      log("not reconnecting (intentional close)");
      return;
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(
      RECONNECT_INITIAL_MS * Math.pow(2, this.reconnectAttempts - 1),
      RECONNECT_MAX_MS
    );
    log("reconnect scheduled", { attempt: this.reconnectAttempts, delayMs: delay });
    this.handlers.onReconnect?.(this.reconnectAttempts, delay);

    this.stopReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.openSocket().catch((err) => {
        // openSocket rejected (initial handshake failed). Schedule another.
        log("reconnect failed", {
          attempt: this.reconnectAttempts,
          message: err instanceof Error ? err.message : String(err),
        });
        this.scheduleReconnect();
      });
    }, delay);
  }

  private stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: message handling
  // ─────────────────────────────────────────────────────────────────────────
  private onRawMessage(raw: WebSocket.RawData) {
    this.messageCount++;
    this.lastMessageAt = Date.now();
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
        log("unknown channel", { msg });
    }
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
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
