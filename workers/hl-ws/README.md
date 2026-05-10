# Hyperliquid WebSocket Worker

Real-time market data ingestion for Project Q.

> **Status**: PoC (W2 Day 8 PM). Local-only.
> **Next**: reconnect logic (Day 9 AM), Fly.io deployment (Day 12 PM).

## What it does

Connects to `wss://api.hyperliquid.xyz/ws` and subscribes to:
- `trades` for BTC, ETH, SOL, HYPE — every fill on those pairs
- `bbo` for the same pairs — best bid/ask updates

Logs structured JSON stats every 10 seconds. No persistence yet — that comes in Day 9 when we wire it to Supabase.

## Why a separate worker

Vercel serverless functions can't hold long-lived WebSocket connections. We need a process that runs 24/7. Fly.io's free tier (256MB RAM) is enough.

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
{"ts":"...","event":"connecting","url":"wss://api.hyperliquid.xyz/ws"}
{"ts":"...","event":"connected"}
{"ts":"...","event":"subscribed","type":"trades","coin":"BTC"}
{"ts":"...","event":"subscribed","type":"bbo","coin":"BTC"}
... (every 10s) ...
{"ts":"...","event":"stats","uptimeS":30,"totalMsgs":847,"isOpen":true,"coins":"BTC=$83451.20 (24 trades, 156 bbo) · ETH=..."}
```

If `totalMsgs` is climbing and `isOpen=true`, the connection is healthy.

Stop with `Ctrl-C`.

## Architecture

```
src/
├── types.ts     # Hyperliquid WS protocol types
├── client.ts    # HlWsClient — connect, subscribe, ping, message dispatch
└── index.ts     # entry point — wire up handlers and log stats
```

## Roadmap

| Day | Work |
|---|---|
| **8 PM** ✅ | Connect, subscribe, parse, log |
| **9 AM** | Reconnect-with-backoff, resubscribe, healthz endpoint |
| **9 PM** | Persist liquidations to Supabase |
| **12 PM** | Deploy to Fly.io with `flyctl` |

## Deployment notes (Day 12 preview)

- **Platform**: Fly.io free tier (`fly.io`)
- **Resources**: 256MB shared CPU
- **Region**: `nrt` (Tokyo) — closest to Hyperliquid's GCP region (`asia-northeast1`)
- **Restart policy**: always
- **Healthz**: `GET :8080/healthz` returns `{ok: true, uptime, msgs}` (Day 9)
