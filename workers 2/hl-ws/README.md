# Hyperliquid WebSocket Worker

Real-time market data ingestion for Project Q.

> **Status**: Day 9 AM — reconnect + healthz ✅. Local-only.
> **Next**: Supabase persistence (Day 9 PM), Fly.io deployment (Day 12 PM).

## What it does

- Connects to `wss://api.hyperliquid.xyz/ws`
- Subscribes to `trades` and `bbo` for BTC, ETH, SOL, HYPE
- Auto-reconnects with exponential backoff on disconnect
- Replays subscriptions automatically after reconnect
- Pings every 20s (server idles at 60s)
- Logs structured JSON stats every 10s
- Serves `GET /healthz` for Fly.io health checks

No persistence yet — that comes in Day 9 PM when we wire it to Supabase.

## Why a separate worker

Vercel serverless functions can't hold long-lived WebSocket connections. We need a process that runs 24/7. Fly.io's free tier (256MB RAM, `nrt` Tokyo region) is enough.

This is intentionally NOT in the main Next.js codebase — separate `package.json`, separate deploy. It can fail without affecting the web app, and vice versa.

## Run locally

```bash
cd workers/hl-ws
npm install
npm run dev
```

You should see:

```
{"ts":"...","event":"worker.start","coins":["BTC","ETH","SOL","HYPE"],...}
{"ts":"...","event":"healthz.listening","port":8080}
{"ts":"...","event":"connecting","url":"wss://api.hyperliquid.xyz/ws","attempt":0}
{"ts":"...","event":"connected"}
{"ts":"...","event":"subscribed","type":"trades","coin":"BTC"}
... (every 10s) ...
{"ts":"...","event":"stats","uptimeS":30,"totalMsgs":847,"isOpen":true,"reconnects":0,"coins":"BTC=$83451.20 (24 trades, 156 bbo) · ETH=..."}
```

In another terminal, check health:

```bash
curl http://localhost:8080/healthz
# → {"ok":true,"isOpen":true,"uptimeS":42,"messageCount":1234,...}
```

If `totalMsgs` is climbing, `isOpen=true`, and `/healthz` returns 200 — healthy.

Stop with `Ctrl-C`.

## Testing reconnect

To verify reconnect works without waiting for a real disconnect, you can temporarily simulate it by killing the network or by adding a `setTimeout(() => client["ws"]?.terminate(), 30000)` in `index.ts`. You should see:

```
{"event":"closed",...}
{"event":"reconnect scheduled","attempt":1,"delayMs":1000}
{"event":"connecting","attempt":1}
{"event":"connected"}
{"event":"subscriptions replayed","count":8}
```

## Architecture

```
src/
├── types.ts     # Hyperliquid WS protocol types
├── client.ts    # HlWsClient — connect, subscribe, ping, reconnect, dispatch
├── healthz.ts   # Tiny HTTP server for /healthz
└── index.ts     # entry point — wire up handlers, start healthz, log stats
```

## Health semantics

`GET /healthz` returns:
- **200 OK** when WS is open AND a message arrived in the last 2 minutes
- **503** when the WS is closed, or stale (no message in 2 min)

Fly.io will restart the machine if `/healthz` is unhealthy for too long. The 2-minute threshold tolerates quiet markets but catches stuck connections.

## Roadmap

| Day | Work |
|---|---|
| **8 PM** ✅ | Connect, subscribe, parse, log |
| **9 AM** ✅ | Reconnect-with-backoff, resubscribe, healthz endpoint |
| **9 PM** | Persist liquidations to Supabase |
| **12 PM** | Deploy to Fly.io with `flyctl` |

## Deployment notes (Day 12 preview)

- **Platform**: Fly.io free tier (`fly.io`)
- **Resources**: 256MB shared CPU
- **Region**: `nrt` (Tokyo) — closest to Hyperliquid's GCP region (`asia-northeast1`)
- **Restart policy**: always
- **Healthz**: `GET :8080/healthz` (Fly.io will probe this)
- **PORT env var**: Fly.io sets this; the worker honors it (defaults to 8080)
