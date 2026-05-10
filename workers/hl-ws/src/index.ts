/**
 * Hyperliquid WebSocket worker.
 *
 * Connects to wss://api.hyperliquid.xyz/ws, subscribes to trade and BBO
 * feeds for a small set of high-volume pairs, and prints stats every
 * 10 seconds.
 *
 * Day 8 PM: connect, subscribe, log.
 * Day 9 AM: reconnect-with-backoff, resubscribe, /healthz endpoint.  ← we are here
 * Day 9 PM: persist liquidations to Supabase (TBD).
 * Day 12 PM: deploy to Fly.io.
 *
 * Run locally:
 *   cd workers/hl-ws
 *   npm install
 *   npm run dev
 *
 * Healthz:
 *   curl http://localhost:8080/healthz
 */
import { HlWsClient } from "./client";
import { startHealthzServer } from "./healthz";

const COINS = ["BTC", "ETH", "SOL", "HYPE"] as const;
const HEALTHZ_PORT = parseInt(process.env.PORT ?? "8080", 10);

async function main() {
  log("worker.start", {
    coins: COINS,
    ws_url: "wss://api.hyperliquid.xyz/ws",
    healthz_port: HEALTHZ_PORT,
  });

  // Per-pair counters for the periodic stats line
  const tradeCounts = new Map<string, number>();
  const bboCounts = new Map<string, number>();
  for (const coin of COINS) {
    tradeCounts.set(coin, 0);
    bboCounts.set(coin, 0);
  }

  const lastPx = new Map<string, number>();

  const client = new HlWsClient({
    onSubscribed: (sub) => {
      log("subscribed", sub as Record<string, unknown>);
    },
    onTrade: (coin, trade) => {
      tradeCounts.set(coin, (tradeCounts.get(coin) ?? 0) + 1);
      lastPx.set(coin, parseFloat(trade.px));
    },
    onBbo: (coin, _bid, _ask, _time) => {
      bboCounts.set(coin, (bboCounts.get(coin) ?? 0) + 1);
    },
    onError: (err) => {
      log("error", { message: err instanceof Error ? err.message : String(err) });
    },
    onClose: () => {
      log("connection.closed");
    },
    onReconnect: (attempt, delayMs) => {
      log("reconnecting", { attempt, delayMs });
    },
    onOpen: () => {
      log("connection.open");
    },
  });

  // Start /healthz BEFORE the WS connects, so health probes work immediately.
  // Initially unhealthy (WS not open yet) — Fly.io will tolerate during boot.
  const healthServer = startHealthzServer(client, HEALTHZ_PORT);

  await client.connect();

  // Subscribe to trades + bbo for each coin
  for (const coin of COINS) {
    client.subscribe({ type: "trades", coin });
    client.subscribe({ type: "bbo", coin });
  }

  // Periodic stats
  const statsInterval = setInterval(() => {
    const stats = client.stats();
    const lines: string[] = [];
    for (const coin of COINS) {
      const px = lastPx.get(coin);
      lines.push(
        `${coin}=${px ? `$${px.toFixed(2)}` : "—"} ` +
          `(${tradeCounts.get(coin) ?? 0} trades, ${bboCounts.get(coin) ?? 0} bbo)`
      );
    }
    log("stats", {
      uptimeS: Math.floor(stats.uptimeMs / 1000),
      totalMsgs: stats.messageCount,
      isOpen: stats.isOpen,
      reconnects: stats.reconnectAttempts,
      coins: lines.join(" · "),
    });
  }, 10_000);

  // Graceful shutdown
  const shutdown = (sig: string) => () => {
    log("shutdown", { signal: sig });
    clearInterval(statsInterval);
    client.close();
    healthServer.close(() => process.exit(0));
    // Force exit if server doesn't close in 5s
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on("SIGINT", shutdown("SIGINT"));
  process.on("SIGTERM", shutdown("SIGTERM"));
}

function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}

main().catch((err) => {
  log("fatal", { message: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
