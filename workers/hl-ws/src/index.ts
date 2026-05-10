/**
 * Hyperliquid WebSocket worker — Day 8 PM PoC.
 *
 * Connects to wss://api.hyperliquid.xyz/ws, subscribes to trade and BBO
 * feeds for a small set of high-volume pairs, and prints stats every
 * 10 seconds.
 *
 * Run locally with:
 *   cd workers/hl-ws
 *   npm install
 *   npm run dev
 *
 * Day 9 will add: reconnect-with-backoff, resubscribe, healthz endpoint,
 * Supabase persistence for liquidations.
 *
 * Day 12 will deploy this to Fly.io for 24/7 operation.
 */
import { HlWsClient } from "./client";

const COINS = ["BTC", "ETH", "SOL", "HYPE"] as const;

async function main() {
  log("worker.start", { coins: COINS, ws_url: "wss://api.hyperliquid.xyz/ws" });

  // Per-pair counters for the periodic stats line
  const tradeCounts = new Map<string, number>();
  const bboCounts = new Map<string, number>();
  for (const coin of COINS) {
    tradeCounts.set(coin, 0);
    bboCounts.set(coin, 0);
  }

  const lastPx = new Map<string, number>();

  const client = new HlWsClient({
    onOpen: () => {
      // Re-subscribe to everything after open
    },
    onSubscribed: (sub) => {
      log("subscribed", sub as Record<string, unknown>);
    },
    onTrade: (coin, trade) => {
      tradeCounts.set(coin, (tradeCounts.get(coin) ?? 0) + 1);
      lastPx.set(coin, parseFloat(trade.px));
    },
    onBbo: (coin, bid, ask, _time) => {
      bboCounts.set(coin, (bboCounts.get(coin) ?? 0) + 1);
      // Optional: track spread
      void bid;
      void ask;
    },
    onError: (err) => {
      log("error", { message: err instanceof Error ? err.message : String(err) });
    },
    onClose: () => {
      log("connection.closed", {});
      // Day 9 will reconnect here
    },
  });

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
      coins: lines.join(" · "),
    });
  }, 10_000);

  // Graceful shutdown
  const shutdown = (sig: string) => () => {
    log("shutdown", { signal: sig });
    clearInterval(statsInterval);
    client.close();
    process.exit(0);
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
