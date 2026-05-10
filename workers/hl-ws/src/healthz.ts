import http from "http";
import type { HlWsClient } from "./client";

const DEFAULT_PORT = 8080;

/**
 * Tiny HTTP server exposing /healthz for Fly.io health checks.
 *
 * GET /healthz
 *   200 OK  → {"ok": true, "uptimeS": 1234, "messageCount": 5678, ...}
 *   503     → {"ok": false, ...}  (when WS is disconnected for too long)
 *
 * GET /
 *   Same as /healthz — convenience for browser checks.
 *
 * Fly.io will hit /healthz periodically; if it returns non-2xx for too long,
 * Fly.io restarts the machine.
 */
export function startHealthzServer(client: HlWsClient, port = DEFAULT_PORT) {
  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";

    if (req.method !== "GET" || (url !== "/healthz" && url !== "/")) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const stats = client.stats();
    // Healthy = WS open AND we received a message in the last 2 minutes.
    // The 2-minute threshold tolerates quiet markets (BBO often quiet at night)
    // while still catching truly stuck connections.
    const stale =
      stats.msSinceLastMessage !== null && stats.msSinceLastMessage > 120_000;
    const healthy = stats.isOpen && !stale;

    const body = JSON.stringify({
      ok: healthy,
      isOpen: stats.isOpen,
      uptimeS: Math.floor(stats.uptimeMs / 1000),
      messageCount: stats.messageCount,
      subscriptionCount: stats.subscriptionCount,
      reconnectAttempts: stats.reconnectAttempts,
      msSinceLastMessage: stats.msSinceLastMessage,
    });

    res.writeHead(healthy ? 200 : 503, {
      "Content-Type": "application/json",
    });
    res.end(body);
  });

  server.listen(port, () => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: "healthz.listening",
        port,
      })
    );
  });

  return server;
}
